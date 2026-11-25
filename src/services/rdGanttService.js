const prisma = require('../config/prisma');
const rdTaskService = require('./rdTaskService');
const rdMilestoneService = require('./rdMilestoneService');

class RdGanttService {
  // ==============================================================================
  // 1. UNIFIED GANTT CHART DATASET (REQUIREMENT 13)
  // ==============================================================================

  async getProjectGanttData(tenantId, projectId) {
    if (!projectId) {
      throw new Error('projectId is required.');
    }

    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    if (!project) {
      throw new Error('R&D project not found or unauthorized.');
    }

    // 1. Fetch tasks
    const tasks = await rdTaskService.getTasks(tenantId, { projectId });

    // 2. Fetch milestones
    const milestones = await rdMilestoneService.getMilestones(tenantId, { projectId });

    // 3. Fetch dependencies
    const dependencies = await rdTaskService.getDependencies(tenantId, projectId);

    // 4. Calculate Critical Path Method (CPM)
    let cpmResult = null;
    try {
      cpmResult = await rdTaskService.calculateCPM(tenantId, projectId);
    } catch (cpmErr) {
      console.warn(`[GanttService] CPM calculation notice: ${cpmErr.message}`);
    }

    // 5. Fetch Schedule Baselines & Variance
    const varianceResult = await rdTaskService.getScheduleVariance(tenantId, projectId);

    // 6. Fetch Active Schedule Alerts
    const alerts = await prisma.rdScheduleAlert.findMany({
      where: { tenantId, projectId, status: 'ACTIVE' },
      orderBy: { severity: 'desc' },
    });

    // 7. Format Gantt Task Nodes with CPM & Variance Augmentation
    const criticalTaskSet = new Set(
      cpmResult && cpmResult.criticalPath ? cpmResult.criticalPath.map((cp) => cp.id) : []
    );

    const formattedTasks = tasks.map((task) => {
      const cpmTask = cpmResult ? cpmResult.tasks.find((ct) => ct.id === task.id) : null;
      const baselineVar = varianceResult?.variances?.find((v) => v.taskId === task.id);

      // Duration in days
      let durationDays = 1;
      if (task.startDate && task.dueDate) {
        durationDays = Math.max(1, Math.ceil((new Date(task.dueDate) - new Date(task.startDate)) / 86400000));
      } else if (task.estimatedHours && task.estimatedHours > 0) {
        durationDays = Math.max(1, Math.ceil(task.estimatedHours / 8));
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        rdStatus: task.rdStatus,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        durationDays,
        progress: task.progress,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        assignedUser: task.assignedUser,
        milestoneId: task.milestoneId,
        isBlocked: task.isBlocked,
        blockingPredecessors: task.blockingPredecessors || [],
        // CPM metrics
        isCritical: criticalTaskSet.has(task.id),
        earlyStart: cpmTask?.earlyStart ?? 0,
        earlyFinish: cpmTask?.earlyFinish ?? durationDays,
        lateStart: cpmTask?.lateStart ?? 0,
        lateFinish: cpmTask?.lateFinish ?? durationDays,
        totalFloat: cpmTask?.totalFloat ?? 0,
        freeFloat: cpmTask?.freeFloat ?? 0,
        // Baseline variance metrics
        baselineStartDate: baselineVar?.baselineStartDate || null,
        baselineEndDate: baselineVar?.baselineEndDate || null,
        finishVarianceDays: baselineVar?.finishVarianceDays || 0,
        isSlipped: baselineVar?.isSlipped || false,
      };
    });

    // 8. Format Dependency Connectors for SVG rendering
    const formattedDependencies = dependencies.map((dep) => ({
      id: dep.id,
      fromTaskId: dep.predecessorId,
      toTaskId: dep.successorId,
      type: dep.dependencyType, // FS, SS, FF, SF
      lagDays: dep.lagDays,
      isCritical: criticalTaskSet.has(dep.predecessorId) && criticalTaskSet.has(dep.successorId),
    }));

    return {
      project: {
        id: project.id,
        name: project.name,
        client: project.client,
        projectType: project.projectType,
        stage: project.stage,
        startDate: project.startDate,
        deadline: project.deadline,
        progress: project.progress,
        manager: project.assignedUser?.name || project.manager || 'Unassigned',
      },
      tasks: formattedTasks,
      milestones,
      dependencies: formattedDependencies,
      cpm: cpmResult,
      variance: varianceResult,
      alerts,
      metrics: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.rdStatus === 'DONE' || t.progress === 100).length,
        inProgressTasks: tasks.filter((t) => ['IN_PROGRESS', 'IN_REVIEW'].includes(t.rdStatus)).length,
        blockedTasks: tasks.filter((t) => t.isBlocked).length,
        criticalTasks: criticalTaskSet.size,
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter((m) => m.status === 'COMPLETED').length,
        projectDurationDays: cpmResult?.projectDurationDays || 0,
      },
    };
  }

  // ==============================================================================
  // 2. GANTT DRAG-AND-DROP & RESIZE DATE RESCHEDULING
  // ==============================================================================

  async updateTaskScheduleDates(tenantId, taskId, { startDate, dueDate, durationDays }, userId) {
    if (!taskId) throw new Error('taskId is required.');

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) throw new Error('Task not found.');

    let newStart = startDate ? new Date(startDate) : task.startDate ? new Date(task.startDate) : new Date();
    let newEnd = dueDate ? new Date(dueDate) : null;

    if (!newEnd && durationDays) {
      newEnd = new Date(newStart.getTime() + parseInt(durationDays, 10) * 86400000);
    } else if (!newEnd && task.dueDate) {
      newEnd = new Date(task.dueDate);
    } else if (!newEnd) {
      newEnd = new Date(newStart.getTime() + 86400000);
    }

    if (newEnd < newStart) {
      throw new Error('Due date cannot precede start date.');
    }

    // Update task dates
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        startDate: newStart,
        dueDate: newEnd,
      },
    });

    // Re-evaluate CPM and alerts in background
    let recalculatedCPM = null;
    if (task.projectId) {
      try {
        recalculatedCPM = await rdTaskService.calculateCPM(tenantId, task.projectId);
        await rdTaskService.scanAndGenerateAlerts(tenantId, task.projectId);
      } catch (err) {
        console.warn(`[GanttService] Auto-recalculate notice: ${err.message}`);
      }
    }

    return {
      task: updated,
      recalculatedCPM,
      cpmRecalculated: !!recalculatedCPM,
    };
  }

  // ==============================================================================
  // 3. PROJECT ROADMAP (REQUIREMENT 9)
  // ==============================================================================

  async getProjectRoadmap(tenantId, projectId) {
    if (!projectId) throw new Error('projectId is required.');

    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new Error('Project not found.');

    const [tasks, milestones, cpmResult, variance] = await Promise.all([
      rdTaskService.getTasks(tenantId, { projectId }),
      rdMilestoneService.getMilestones(tenantId, { projectId }),
      rdTaskService.calculateCPM(tenantId, projectId).catch(() => null),
      rdTaskService.getScheduleVariance(tenantId, projectId).catch(() => null),
    ]);

    // Group tasks by milestone or work package
    const milestoneMap = new Map();
    for (const ms of milestones) {
      milestoneMap.set(ms.id, {
        ...ms,
        tasks: [],
      });
    }

    const unassignedTasks = [];
    for (const t of tasks) {
      if (t.milestoneId && milestoneMap.has(t.milestoneId)) {
        milestoneMap.get(t.milestoneId).tasks.push(t);
      } else {
        unassignedTasks.push(t);
      }
    }

    // Build Roadmap Flightpath Phases
    const phases = Array.from(milestoneMap.values()).map((ms) => ({
      milestoneId: ms.id,
      title: ms.title,
      code: ms.milestoneCode,
      type: ms.milestoneType,
      status: ms.status,
      progress: ms.progress,
      plannedEndDate: ms.plannedEndDate,
      actualCompletionDate: ms.actualCompletionDate,
      isDelayed: ms.isDelayed,
      taskCount: ms.tasks.length,
      tasks: ms.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        rdStatus: t.rdStatus,
        progress: t.progress,
        isBlocked: t.isBlocked,
      })),
    }));

    // Critical Path Highlights
    const criticalChain = cpmResult?.criticalPath || [];

    return {
      project: {
        id: project.id,
        name: project.name,
        client: project.client,
        projectType: project.projectType,
        stage: project.stage,
        startDate: project.startDate,
        deadline: project.deadline,
        overallProgress: project.progress,
        manager: project.assignedUser?.name || 'Unassigned',
      },
      summary: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.rdStatus === 'DONE' || t.progress === 100).length,
        totalMilestones: milestones.length,
        completedMilestones: milestones.filter((m) => m.status === 'COMPLETED').length,
        projectDurationDays: cpmResult?.projectDurationDays || 0,
        criticalTaskCount: criticalChain.length,
        baselineVersion: variance?.baselineVersion || null,
        totalSlipped: variance?.totalSlipped || 0,
      },
      criticalChain,
      criticalPathDurationDays: cpmResult?.projectDurationDays || 0,
      roadmapPhases: phases,
      phases,
      milestones,
      unassignedTasksCount: unassignedTasks.length,
    };
  }

  // ==============================================================================
  // 4. CHRONOLOGICAL TIMELINE VIEWS (REQUIREMENT 14)
  // ==============================================================================

  async getProjectTimeline(tenantId, projectId, filters = {}) {
    if (!projectId) throw new Error('projectId is required.');

    const [tasks, milestones, cpmResult] = await Promise.all([
      rdTaskService.getTasks(tenantId, { projectId }),
      rdMilestoneService.getMilestones(tenantId, { projectId }),
      rdTaskService.calculateCPM(tenantId, projectId).catch(() => null),
    ]);

    const criticalSet = new Set(cpmResult?.criticalPath?.map((c) => c.id) || []);

    const events = [];

    // 1. Milestone Events
    for (const ms of milestones) {
      if (ms.plannedEndDate) {
        events.push({
          id: `ms-${ms.id}`,
          entityType: 'MILESTONE',
          entityId: ms.id,
          title: ms.title,
          description: ms.description || `Milestone Phase: ${ms.milestoneCode || 'Checkpoint'}`,
          date: ms.actualCompletionDate || ms.plannedEndDate,
          plannedDate: ms.plannedEndDate,
          actualDate: ms.actualCompletionDate,
          status: ms.status,
          isCompleted: ms.status === 'COMPLETED',
          isCritical: false,
          color: ms.status === 'COMPLETED' ? '#10b981' : ms.isDelayed ? '#ef4444' : '#3b82f6',
        });
      }
    }

    // 2. Task Events
    for (const t of tasks) {
      if (t.dueDate) {
        const isCrit = criticalSet.has(t.id);
        events.push({
          id: `task-${t.id}`,
          entityType: 'TASK',
          entityId: t.id,
          title: t.title,
          description: `Task (${t.taskType}) • ${t.estimatedHours}h est`,
          date: t.dueDate,
          plannedDate: t.dueDate,
          actualDate: t.rdStatus === 'DONE' ? t.updatedAt : null,
          status: t.rdStatus,
          isCompleted: t.rdStatus === 'DONE',
          isCritical: isCrit,
          color: t.rdStatus === 'DONE' ? '#10b981' : isCrit ? '#f59e0b' : '#64748b',
        });
      }
    }

    // Sort chronologically ascending
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      projectId,
      totalEvents: events.length,
      events,
    };
  }
}

module.exports = new RdGanttService();
