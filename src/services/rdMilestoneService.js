const prisma = require('../config/prisma');

class RdMilestoneService {
  /**
   * Helper: Calculate milestone progress from linked tasks
   */
  calculateMilestoneProgress(milestone, tasks) {
    if (!tasks || tasks.length === 0) {
      return milestone.progress || 0;
    }
    const totalProgress = tasks.reduce((sum, t) => sum + (t.progress || (t.rdStatus === 'DONE' ? 100 : 0)), 0);
    return Math.round(totalProgress / tasks.length);
  }

  // ==============================================================================
  // 1. MILESTONE RETRIEVAL & LISTING
  // ==============================================================================

  async getMilestones(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.milestoneType) where.milestoneType = filters.milestoneType;
    if (filters.priority) where.priority = filters.priority;

    const milestones = await prisma.rdMilestone.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        project: { select: { id: true, name: true, projectType: true, stage: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            rdStatus: true,
            priority: true,
            taskType: true,
            progress: true,
            estimatedHours: true,
            actualHours: true,
            startDate: true,
            dueDate: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { plannedEndDate: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();

    return milestones.map((ms) => {
      // Dynamic task-derived progress
      const derivedProgress = this.calculateMilestoneProgress(ms, ms.tasks);
      const isAutoDelayed =
        ms.status !== 'COMPLETED' &&
        ms.status !== 'CANCELLED' &&
        ms.plannedEndDate &&
        new Date(ms.plannedEndDate) < now;

      const completedTasks = ms.tasks.filter((t) => t.rdStatus === 'DONE' || t.progress === 100).length;

      return {
        ...ms,
        progress: derivedProgress,
        isDelayed: isAutoDelayed,
        taskCount: ms.tasks.length,
        completedTaskCount: completedTasks,
        pendingTaskCount: ms.tasks.length - completedTasks,
      };
    });
  }

  async getMilestoneById(tenantId, id) {
    const milestone = await prisma.rdMilestone.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        project: { select: { id: true, name: true, projectType: true, stage: true, client: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            rdStatus: true,
            priority: true,
            taskType: true,
            progress: true,
            estimatedHours: true,
            actualHours: true,
            startDate: true,
            dueDate: true,
            assignedUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!milestone) {
      throw new Error('Milestone not found or unauthorized.');
    }

    const derivedProgress = this.calculateMilestoneProgress(milestone, milestone.tasks);
    const completedTasks = milestone.tasks.filter((t) => t.rdStatus === 'DONE' || t.progress === 100).length;

    return {
      ...milestone,
      progress: derivedProgress,
      taskCount: milestone.tasks.length,
      completedTaskCount: completedTasks,
      pendingTaskCount: milestone.tasks.length - completedTasks,
    };
  }

  // ==============================================================================
  // 2. MILESTONE CREATION & UPDATES
  // ==============================================================================

  async createMilestone(tenantId, data, userId) {
    const {
      projectId,
      title,
      description,
      milestoneCode,
      milestoneType = 'DELIVERABLE',
      plannedStartDate,
      plannedEndDate,
      priority = 'MEDIUM',
      ownerId,
      status = 'PLANNED',
      taskIds = [],
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Milestone title is required.');

    // Verify project exists in tenant
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('Project not found in tenant workspace.');

    // Auto sort order
    const maxSort = await prisma.rdMilestone.aggregate({
      where: { tenantId, projectId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder || 0) + 10;

    const generatedCode = milestoneCode || `MS-${Date.now().toString().slice(-4)}`;

    const milestone = await prisma.rdMilestone.create({
      data: {
        tenantId,
        projectId,
        title: title.trim(),
        description: description || null,
        milestoneCode: generatedCode,
        milestoneType: ['DELIVERABLE', 'STAGE_GATE', 'REVIEW', 'DECISION', 'RELEASE'].includes(milestoneType)
          ? milestoneType
          : 'DELIVERABLE',
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        actualStartDate: status === 'IN_PROGRESS' ? new Date() : null,
        status: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'ON_HOLD', 'CANCELLED'].includes(status)
          ? status
          : 'PLANNED',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        ownerId: ownerId || userId || null,
        sortOrder: nextSort,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Associate initial tasks if provided
    if (Array.isArray(taskIds) && taskIds.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds }, tenantId, projectId },
        data: { milestoneId: milestone.id },
      });
    }

    return milestone;
  }

  async updateMilestone(tenantId, id, data, userId) {
    const existing = await prisma.rdMilestone.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Milestone not found.');
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.milestoneCode !== undefined) updateData.milestoneCode = data.milestoneCode;
    if (data.milestoneType !== undefined) updateData.milestoneType = data.milestoneType;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = parseInt(data.sortOrder, 10) || 0;
    if (data.progress !== undefined) updateData.progress = parseInt(data.progress, 10) || 0;

    if (data.plannedStartDate !== undefined) {
      updateData.plannedStartDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null;
    }
    if (data.plannedEndDate !== undefined) {
      updateData.plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null;
    }
    if (data.actualStartDate !== undefined) {
      updateData.actualStartDate = data.actualStartDate ? new Date(data.actualStartDate) : null;
    }
    if (data.actualCompletionDate !== undefined) {
      updateData.actualCompletionDate = data.actualCompletionDate ? new Date(data.actualCompletionDate) : null;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED' && !existing.actualCompletionDate) {
        updateData.actualCompletionDate = new Date();
        updateData.progress = 100;
      } else if (data.status === 'IN_PROGRESS' && !existing.actualStartDate) {
        updateData.actualStartDate = new Date();
      }
    }

    const updated = await prisma.rdMilestone.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        tasks: { select: { id: true, title: true, rdStatus: true, progress: true } },
      },
    });

    return updated;
  }

  async updateMilestoneStatus(tenantId, id, status, userId) {
    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'ON_HOLD', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid milestone status '${status}'. Valid values: ${validStatuses.join(', ')}`);
    }

    const existing = await prisma.rdMilestone.findFirst({
      where: { id, tenantId },
      include: { tasks: true },
    });
    if (!existing) {
      throw new Error('Milestone not found.');
    }

    const updateData = { status };
    let warning = null;

    if (status === 'COMPLETED') {
      updateData.actualCompletionDate = new Date();
      updateData.progress = 100;

      // Check if linked tasks are incomplete
      const incompleteTasks = existing.tasks.filter((t) => t.rdStatus !== 'DONE' && t.progress !== 100);
      if (incompleteTasks.length > 0) {
        warning = `Milestone marked complete, but ${incompleteTasks.length} associated task(s) remain incomplete.`;
      }
    } else if (status === 'IN_PROGRESS') {
      if (!existing.actualStartDate) updateData.actualStartDate = new Date();
    }

    const updated = await prisma.rdMilestone.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return {
      milestone: updated,
      warning,
    };
  }

  async deleteMilestone(tenantId, id, userId) {
    const existing = await prisma.rdMilestone.findFirst({
      where: { id, tenantId },
      include: { tasks: true },
    });
    if (!existing) {
      throw new Error('Milestone not found.');
    }

    // Safely unlink any associated tasks first
    if (existing.tasks.length > 0) {
      await prisma.task.updateMany({
        where: { milestoneId: id, tenantId },
        data: { milestoneId: null },
      });
    }

    await prisma.rdMilestone.delete({ where: { id } });

    return {
      success: true,
      message: 'Milestone deleted successfully. Linked tasks unlinked safely.',
    };
  }

  // ==============================================================================
  // 3. TASK-MILESTONE RELATIONSHIPS
  // ==============================================================================

  async linkTasksToMilestone(tenantId, milestoneId, taskIds, userId) {
    if (!Array.isArray(taskIds)) throw new Error('taskIds must be an array.');

    const milestone = await prisma.rdMilestone.findFirst({
      where: { id: milestoneId, tenantId },
    });
    if (!milestone) throw new Error('Target milestone not found.');

    await prisma.task.updateMany({
      where: { id: { in: taskIds }, tenantId },
      data: { milestoneId },
    });

    // Fetch updated tasks to recalculate progress
    const updatedTasks = await prisma.task.findMany({
      where: { milestoneId, tenantId },
    });

    const newProgress = this.calculateMilestoneProgress(milestone, updatedTasks);
    await prisma.rdMilestone.update({
      where: { id: milestoneId },
      data: { progress: newProgress },
    });

    return {
      success: true,
      linkedCount: taskIds.length,
      milestoneId,
      calculatedProgress: newProgress,
    };
  }

  async reorderMilestones(tenantId, orderedMilestoneIds, userId) {
    if (!Array.isArray(orderedMilestoneIds)) {
      throw new Error('orderedMilestoneIds must be an array of IDs.');
    }

    await prisma.$transaction(
      orderedMilestoneIds.map((id, index) =>
        prisma.rdMilestone.updateMany({
          where: { id, tenantId },
          data: { sortOrder: (index + 1) * 10 },
        })
      )
    );

    return { success: true, reorderedCount: orderedMilestoneIds.length };
  }
}

module.exports = new RdMilestoneService();
