const prisma = require('../config/prisma');

class RdTaskService {
  /**
   * Helper: Check if a task's predecessors are complete
   */
  async checkTaskBlocked(tenantId, taskId) {
    const dependencies = await prisma.rdTaskDependency.findMany({
      where: { tenantId, successorId: taskId },
      include: {
        predecessor: {
          select: { id: true, title: true, rdStatus: true, status: true },
        },
      },
    });

    const incompletePredecessors = dependencies.filter(
      (d) => d.predecessor && d.predecessor.rdStatus !== 'DONE' && d.predecessor.status !== 'COMPLETED'
    );

    return {
      isBlocked: incompletePredecessors.length > 0,
      blockingCount: incompletePredecessors.length,
      blockingTasks: incompletePredecessors.map((d) => ({
        id: d.predecessor.id,
        title: d.predecessor.title,
        status: d.predecessor.rdStatus || d.predecessor.status,
        dependencyType: d.dependencyType,
      })),
    };
  }

  // ==============================================================================
  // 1. TASK CRUD & LIFECYCLE (REQUIREMENTS 11 & 12)
  // ==============================================================================

  async getTasks(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.sprintId) {
      if (filters.sprintId === 'none' || filters.sprintId === 'null') {
        where.sprintId = null;
      } else {
        where.sprintId = filters.sprintId;
      }
    }
    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.taskType) where.taskType = filters.taskType;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.rdStatus) where.rdStatus = filters.rdStatus;

    if (filters.isBacklog !== undefined) {
      where.isBacklog = filters.isBacklog === 'true' || filters.isBacklog === true;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        project: {
          select: { id: true, name: true, projectType: true, stage: true },
        },
        sprint: {
          select: { id: true, name: true, status: true, startDate: true, endDate: true },
        },
        stage: {
          select: { id: true, name: true, stageNumber: true, color: true },
        },
        predecessorDependencies: {
          include: {
            successor: {
              select: { id: true, title: true, rdStatus: true },
            },
          },
        },
        successorDependencies: {
          include: {
            predecessor: {
              select: { id: true, title: true, rdStatus: true, status: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Augment with blocked calculation
    return tasks.map((task) => {
      const incompletePredecessors = task.successorDependencies.filter(
        (dep) =>
          dep.predecessor &&
          dep.predecessor.rdStatus !== 'DONE' &&
          dep.predecessor.status !== 'COMPLETED'
      );
      return {
        ...task,
        isBlocked: incompletePredecessors.length > 0,
        blockingPredecessors: incompletePredecessors.map((d) => ({
          id: d.predecessor.id,
          title: d.predecessor.title,
          status: d.predecessor.rdStatus,
          type: d.dependencyType,
        })),
      };
    });
  }

  async getTaskById(tenantId, id) {
    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        project: {
          select: { id: true, name: true, projectType: true, stage: true },
        },
        sprint: {
          select: { id: true, name: true, status: true, startDate: true, endDate: true },
        },
        stage: {
          select: { id: true, name: true, stageNumber: true, color: true },
        },
        predecessorDependencies: {
          include: {
            successor: {
              select: { id: true, title: true, rdStatus: true },
            },
          },
        },
        successorDependencies: {
          include: {
            predecessor: {
              select: { id: true, title: true, rdStatus: true, status: true },
            },
          },
        },
        baselines: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        scheduleAlerts: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!task) {
      throw new Error('R&D task not found or unauthorized.');
    }

    const incompletePredecessors = task.successorDependencies.filter(
      (dep) =>
        dep.predecessor &&
        dep.predecessor.rdStatus !== 'DONE' &&
        dep.predecessor.status !== 'COMPLETED'
    );

    return {
      ...task,
      isBlocked: incompletePredecessors.length > 0,
      blockingPredecessors: incompletePredecessors.map((d) => ({
        id: d.predecessor.id,
        title: d.predecessor.title,
        status: d.predecessor.rdStatus,
        type: d.dependencyType,
      })),
    };
  }

  async createTask(tenantId, data, userId) {
    const {
      title,
      description,
      priority = 'MEDIUM',
      taskType = 'TASK',
      rdStatus = 'TODO',
      projectId,
      sprintId,
      stageId,
      assignedUserId,
      dueDate,
      startDate,
      estimatedHours = 0,
      actualHours = 0,
      progress = 0,
      isBacklog = false,
    } = data;

    if (!title || !title.trim()) {
      throw new Error('Task title is required.');
    }

    // Determine default sort order (place at end)
    const maxSort = await prisma.task.aggregate({
      where: { tenantId, projectId: projectId || null },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder || 0) + 10;

    // Map rdStatus to standard CRM TaskStatus for backward compatibility
    let crmStatus = 'PENDING';
    if (rdStatus === 'IN_PROGRESS' || rdStatus === 'IN_REVIEW') crmStatus = 'IN_PROGRESS';
    else if (rdStatus === 'DONE') crmStatus = 'COMPLETED';
    else if (rdStatus === 'CANCELLED') crmStatus = 'CANCELLED';

    const task = await prisma.task.create({
      data: {
        tenantId,
        title: title.trim(),
        description: description || null,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        status: crmStatus,
        rdStatus: rdStatus || (isBacklog ? 'BACKLOG' : 'TODO'),
        taskType: ['TASK', 'USER_STORY', 'RESEARCH_SPIKE', 'BUG', 'TECHNICAL_DEBT', 'SUBTASK'].includes(taskType)
          ? taskType
          : 'TASK',
        projectId: projectId || null,
        sprintId: sprintId || null,
        stageId: stageId || null,
        assignedUserId: assignedUserId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        estimatedHours: parseFloat(estimatedHours) || 0,
        actualHours: parseFloat(actualHours) || 0,
        progress: parseInt(progress, 10) || (rdStatus === 'DONE' ? 100 : 0),
        sortOrder: nextSort,
        isBacklog: Boolean(isBacklog || rdStatus === 'BACKLOG'),
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    return task;
  }

  async updateTask(tenantId, id, data, userId) {
    const existing = await prisma.task.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('R&D task not found.');
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null;
    if (data.sprintId !== undefined) updateData.sprintId = data.sprintId || null;
    if (data.stageId !== undefined) updateData.stageId = data.stageId || null;
    if (data.assignedUserId !== undefined) updateData.assignedUserId = data.assignedUserId || null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = parseFloat(data.estimatedHours) || 0;
    if (data.actualHours !== undefined) updateData.actualHours = parseFloat(data.actualHours) || 0;
    if (data.progress !== undefined) updateData.progress = parseInt(data.progress, 10) || 0;
    if (data.sortOrder !== undefined) updateData.sortOrder = parseInt(data.sortOrder, 10) || 0;
    if (data.isBacklog !== undefined) updateData.isBacklog = Boolean(data.isBacklog);

    if (data.rdStatus !== undefined) {
      updateData.rdStatus = data.rdStatus;
      if (data.rdStatus === 'DONE') {
        updateData.status = 'COMPLETED';
        updateData.progress = 100;
      } else if (data.rdStatus === 'IN_PROGRESS' || data.rdStatus === 'IN_REVIEW') {
        updateData.status = 'IN_PROGRESS';
        if (existing.progress === 100) updateData.progress = 50;
      } else if (data.rdStatus === 'CANCELLED') {
        updateData.status = 'CANCELLED';
      } else {
        updateData.status = 'PENDING';
        if (existing.progress === 100) updateData.progress = 0;
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async updateTaskStatus(tenantId, id, rdStatus, userId) {
    const validStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'];
    if (!validStatuses.includes(rdStatus)) {
      throw new Error(`Invalid status '${rdStatus}'. Valid statuses: ${validStatuses.join(', ')}`);
    }

    const existing = await prisma.task.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('R&D task not found.');
    }

    // Check if task is moving to IN_PROGRESS while blocked
    if (rdStatus === 'IN_PROGRESS') {
      const blockedCheck = await this.checkTaskBlocked(tenantId, id);
      if (blockedCheck.isBlocked) {
        // Warning: still permit but track
      }
    }

    let crmStatus = 'PENDING';
    let progress = existing.progress;
    let isBacklog = existing.isBacklog;

    if (rdStatus === 'DONE') {
      crmStatus = 'COMPLETED';
      progress = 100;
      isBacklog = false;
    } else if (rdStatus === 'IN_PROGRESS' || rdStatus === 'IN_REVIEW') {
      crmStatus = 'IN_PROGRESS';
      if (progress === 100) progress = 50;
      isBacklog = false;
    } else if (rdStatus === 'BACKLOG') {
      crmStatus = 'PENDING';
      isBacklog = true;
    } else if (rdStatus === 'CANCELLED') {
      crmStatus = 'CANCELLED';
    } else {
      crmStatus = 'PENDING';
      if (progress === 100) progress = 0;
      if (rdStatus === 'TODO') isBacklog = false;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        rdStatus,
        status: crmStatus,
        progress,
        isBacklog,
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async deleteTask(tenantId, id, userId) {
    const existing = await prisma.task.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('R&D task not found.');
    }

    // Dependencies and baselines cascade or are deleted
    await prisma.rdTaskDependency.deleteMany({
      where: {
        OR: [{ predecessorId: id }, { successorId: id }],
      },
    });

    await prisma.rdTaskScheduleBaseline.deleteMany({
      where: { taskId: id },
    });

    await prisma.rdScheduleAlert.deleteMany({
      where: { taskId: id },
    });

    await prisma.task.delete({ where: { id } });

    return { success: true, message: 'R&D task deleted successfully.' };
  }

  // ==============================================================================
  // 2. SPRINT PLANNING & EXECUTION (REQUIREMENT 15)
  // ==============================================================================

  async getSprints(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const sprints = await prisma.rdSprint.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            rdStatus: true,
            priority: true,
            taskType: true,
            estimatedHours: true,
            actualHours: true,
            progress: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });

    return sprints.map((sprint) => {
      const totalTasks = sprint.tasks.length;
      const completedTasks = sprint.tasks.filter((t) => t.rdStatus === 'DONE').length;
      const totalHours = sprint.tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const completedHours = sprint.tasks
        .filter((t) => t.rdStatus === 'DONE')
        .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const actualHoursTotal = sprint.tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...sprint,
        metrics: {
          totalTasks,
          completedTasks,
          inProgressTasks: sprint.tasks.filter((t) => ['IN_PROGRESS', 'IN_REVIEW'].includes(t.rdStatus)).length,
          blockedTasks: sprint.tasks.filter((t) => t.rdStatus === 'BLOCKED').length,
          totalHours,
          completedHours,
          actualHoursTotal,
          completionRate,
        },
      };
    });
  }

  async createSprint(tenantId, data, userId) {
    const { projectId, name, code, goal, startDate, endDate, capacityHours = 0 } = data;

    if (!name || !name.trim()) {
      throw new Error('Sprint name is required.');
    }

    const sprint = await prisma.rdSprint.create({
      data: {
        tenantId,
        projectId: projectId || null,
        name: name.trim(),
        code: code || `SP-${Date.now().toString().slice(-4)}`,
        goal: goal || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        capacityHours: parseFloat(capacityHours) || 0,
        status: 'PLANNED',
        createdById: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    return sprint;
  }

  async updateSprint(tenantId, id, data, userId) {
    const existing = await prisma.rdSprint.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Sprint not found.');
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.code !== undefined) updateData.code = data.code;
    if (data.goal !== undefined) updateData.goal = data.goal;
    if (data.capacityHours !== undefined) updateData.capacityHours = parseFloat(data.capacityHours) || 0;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.rdSprint.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async startSprint(tenantId, id, userId) {
    const existing = await prisma.rdSprint.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Sprint not found.');
    }

    // Ensure no other active sprint for the same project
    if (existing.projectId) {
      const activeOther = await prisma.rdSprint.findFirst({
        where: {
          tenantId,
          projectId: existing.projectId,
          id: { not: id },
          status: 'ACTIVE',
        },
      });
      if (activeOther) {
        throw new Error(`Project already has an active sprint: '${activeOther.name}'. Complete or cancel it first.`);
      }
    }

    const updated = await prisma.rdSprint.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startDate: existing.startDate || new Date(),
      },
    });

    return updated;
  }

  async completeSprint(tenantId, id, rolloverAction = 'BACKLOG', userId) {
    const sprint = await prisma.rdSprint.findFirst({
      where: { id, tenantId },
      include: {
        tasks: true,
      },
    });

    if (!sprint) {
      throw new Error('Sprint not found.');
    }

    const completedTasks = sprint.tasks.filter((t) => t.rdStatus === 'DONE');
    const incompleteTasks = sprint.tasks.filter((t) => t.rdStatus !== 'DONE');

    // Calculate velocity (sum of completed task estimated hours)
    const velocity = completedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    // Complete sprint
    const completedSprint = await prisma.rdSprint.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        velocity,
        completedAt: new Date(),
      },
    });

    // Handle rollover of incomplete tasks
    if (incompleteTasks.length > 0) {
      const incompleteIds = incompleteTasks.map((t) => t.id);
      if (rolloverAction === 'BACKLOG') {
        await prisma.task.updateMany({
          where: { id: { in: incompleteIds } },
          data: {
            sprintId: null,
            isBacklog: true,
            rdStatus: 'BACKLOG',
          },
        });
      }
    }

    return {
      sprint: completedSprint,
      velocity,
      completedTaskCount: completedTasks.length,
      rolledOverCount: incompleteTasks.length,
    };
  }

  // ==============================================================================
  // 3. BACKLOG MANAGEMENT (REQUIREMENT 16)
  // ==============================================================================

  async getBacklog(tenantId, projectId) {
    const where = {
      tenantId,
      OR: [{ isBacklog: true }, { sprintId: null }],
    };
    if (projectId) where.projectId = projectId;

    const backlogTasks = await prisma.task.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, avatar: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return backlogTasks;
  }

  async reorderBacklog(tenantId, orderedTaskIds, userId) {
    if (!Array.isArray(orderedTaskIds)) {
      throw new Error('orderedTaskIds must be an array of task IDs.');
    }

    // Atomic update of sort orders
    await prisma.$transaction(
      orderedTaskIds.map((taskId, index) =>
        prisma.task.updateMany({
          where: { id: taskId, tenantId },
          data: { sortOrder: (index + 1) * 10 },
        })
      )
    );

    return { success: true, count: orderedTaskIds.length };
  }

  async commitBacklogToSprint(tenantId, sprintId, taskIds, userId) {
    if (!sprintId) throw new Error('sprintId is required.');
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new Error('taskIds must be a non-empty array.');
    }

    const sprint = await prisma.rdSprint.findFirst({
      where: { id: sprintId, tenantId },
    });
    if (!sprint) throw new Error('Target sprint not found.');

    await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        tenantId,
      },
      data: {
        sprintId,
        isBacklog: false,
        rdStatus: 'TODO',
      },
    });

    return {
      success: true,
      committedCount: taskIds.length,
      sprint: { id: sprint.id, name: sprint.name },
    };
  }

  // ==============================================================================
  // 4. TASK DEPENDENCY MANAGEMENT & CYCLE DETECTION (REQUIREMENT 17)
  // ==============================================================================

  async getDependencies(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) {
      where.predecessor = { projectId };
    }

    const dependencies = await prisma.rdTaskDependency.findMany({
      where,
      include: {
        predecessor: {
          select: { id: true, title: true, rdStatus: true, dueDate: true, projectId: true },
        },
        successor: {
          select: { id: true, title: true, rdStatus: true, dueDate: true, projectId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return dependencies;
  }

  /**
   * Tarjan / DFS Cycle Detection
   * Returns true if there exists a path from startId to targetId in the directed graph
   */
  async detectsCycle(tenantId, predecessorId, successorId) {
    // If predecessor equals successor, self cycle!
    if (predecessorId === successorId) return true;

    // We want to add edge: predecessorId -> successorId
    // A cycle is formed IF there is ALREADY a path: successorId -> ... -> predecessorId
    const allEdges = await prisma.rdTaskDependency.findMany({
      where: { tenantId },
      select: { predecessorId: true, successorId: true },
    });

    // Build adjacency list: node -> array of successors
    const adj = new Map();
    for (const edge of allEdges) {
      if (!adj.has(edge.predecessorId)) adj.set(edge.predecessorId, []);
      adj.get(edge.predecessorId).push(edge.successorId);
    }

    // DFS from successorId to see if predecessorId is reachable
    const visited = new Set();
    const stack = [successorId];

    while (stack.length > 0) {
      const curr = stack.pop();
      if (curr === predecessorId) {
        return true; // Path exists, adding edge creates cycle!
      }

      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adj.get(curr) || [];
        for (const next of neighbors) {
          if (!visited.has(next)) {
            stack.push(next);
          }
        }
      }
    }

    return false;
  }

  async addDependency(tenantId, data, userId) {
    const { predecessorId, successorId, dependencyType = 'FS', lagDays = 0 } = data;

    if (!predecessorId || !successorId) {
      throw new Error('Both predecessorId and successorId are required.');
    }
    if (predecessorId === successorId) {
      throw new Error('A task cannot depend on itself.');
    }

    // Verify both tasks exist in tenant
    const [predTask, succTask] = await Promise.all([
      prisma.task.findFirst({ where: { id: predecessorId, tenantId } }),
      prisma.task.findFirst({ where: { id: successorId, tenantId } }),
    ]);

    if (!predTask || !succTask) {
      throw new Error('One or both tasks not found in tenant workspace.');
    }

    // Check if dependency already exists
    const existing = await prisma.rdTaskDependency.findFirst({
      where: { predecessorId, successorId },
    });
    if (existing) {
      return existing;
    }

    // Perform Cycle Detection
    const hasCycle = await this.detectsCycle(tenantId, predecessorId, successorId);
    if (hasCycle) {
      throw new Error(
        `Circular dependency detected: task '${succTask.title}' already has a path leading to '${predTask.title}'. Adding this dependency creates a cycle.`
      );
    }

    const dependency = await prisma.rdTaskDependency.create({
      data: {
        tenantId,
        predecessorId,
        successorId,
        dependencyType: ['FS', 'SS', 'FF', 'SF'].includes(dependencyType) ? dependencyType : 'FS',
        lagDays: parseInt(lagDays, 10) || 0,
      },
      include: {
        predecessor: { select: { id: true, title: true, rdStatus: true } },
        successor: { select: { id: true, title: true, rdStatus: true } },
      },
    });

    return dependency;
  }

  async deleteDependency(tenantId, id, userId) {
    const dep = await prisma.rdTaskDependency.findFirst({ where: { id, tenantId } });
    if (!dep) {
      throw new Error('Dependency link not found.');
    }

    await prisma.rdTaskDependency.delete({ where: { id } });
    return { success: true, message: 'Dependency removed successfully.' };
  }

  // ==============================================================================
  // 5. MATHEMATICAL CRITICAL PATH METHOD (CPM) ENGINE (REQUIREMENT 18)
  // ==============================================================================

  /**
   * Deterministic Critical Path Method calculation
   * Inputs: tenantId, projectId
   * Returns: { tasks, projectDuration, criticalPath, topologicalOrder }
   */
  async calculateCPM(tenantId, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for CPM calculation.');
    }

    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true, name: true, startDate: true, deadline: true },
    });
    if (!project) throw new Error('R&D project not found.');

    const tasks = await prisma.task.findMany({
      where: { tenantId, projectId },
      select: {
        id: true,
        title: true,
        rdStatus: true,
        priority: true,
        taskType: true,
        estimatedHours: true,
        startDate: true,
        dueDate: true,
      },
    });

    if (tasks.length === 0) {
      return {
        projectId,
        projectName: project.name,
        taskCount: 0,
        projectDuration: 0,
        criticalPath: [],
        tasks: [],
      };
    }

    const taskIds = tasks.map((t) => t.id);
    const dependencies = await prisma.rdTaskDependency.findMany({
      where: {
        tenantId,
        predecessorId: { in: taskIds },
        successorId: { in: taskIds },
      },
    });

    // 1. Compute duration D_i in days for each task
    // If dates are provided, calculate difference. Otherwise estimatedHours / 8 (min 1 day).
    const durations = new Map();
    for (const t of tasks) {
      let dur = 1;
      if (t.startDate && t.dueDate) {
        const diffMs = new Date(t.dueDate).getTime() - new Date(t.startDate).getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        dur = Math.max(1, diffDays);
      } else if (t.estimatedHours && t.estimatedHours > 0) {
        dur = Math.max(1, Math.ceil(t.estimatedHours / 8));
      }
      durations.set(t.id, dur);
    }

    // 2. Build graph adjacencies:
    // successorsOf[u] = list of { successorId, lagDays }
    // predecessorsOf[v] = list of { predecessorId, lagDays }
    const successorsOf = new Map();
    const predecessorsOf = new Map();
    const inDegree = new Map();

    for (const t of tasks) {
      successorsOf.set(t.id, []);
      predecessorsOf.set(t.id, []);
      inDegree.set(t.id, 0);
    }

    for (const dep of dependencies) {
      if (successorsOf.has(dep.predecessorId) && predecessorsOf.has(dep.successorId)) {
        successorsOf.get(dep.predecessorId).push({ id: dep.successorId, lag: dep.lagDays || 0 });
        predecessorsOf.get(dep.successorId).push({ id: dep.predecessorId, lag: dep.lagDays || 0 });
        inDegree.set(dep.successorId, inDegree.get(dep.successorId) + 1);
      }
    }

    // 3. Kahn's Algorithm for Topological Sort
    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    const topoOrder = [];
    while (queue.length > 0) {
      const curr = queue.shift();
      topoOrder.push(curr);

      for (const succ of successorsOf.get(curr)) {
        const newDeg = inDegree.get(succ.id) - 1;
        inDegree.set(succ.id, newDeg);
        if (newDeg === 0) {
          queue.push(succ.id);
        }
      }
    }

    if (topoOrder.length !== tasks.length) {
      throw new Error('Cycle detected in task dependencies; topological ordering impossible.');
    }

    // 4. FORWARD PASS: Calculate Early Start (ES) and Early Finish (EF)
    const ES = new Map();
    const EF = new Map();

    for (const id of topoOrder) {
      const preds = predecessorsOf.get(id);
      let maxPredEF = 0;
      for (const p of preds) {
        const predEF = (EF.get(p.id) || 0) + p.lag;
        if (predEF > maxPredEF) {
          maxPredEF = predEF;
        }
      }
      const es = maxPredEF;
      const ef = es + durations.get(id);
      ES.set(id, es);
      EF.set(id, ef);
    }

    // Project completion duration T_project = max(EF_i)
    let projectDuration = 0;
    for (const ef of EF.values()) {
      if (ef > projectDuration) projectDuration = ef;
    }

    // 5. BACKWARD PASS: Calculate Late Finish (LF) and Late Start (LS)
    const LF = new Map();
    const LS = new Map();

    // Iterate reverse topological order
    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const id = topoOrder[i];
      const succs = successorsOf.get(id);
      let minSuccLS = projectDuration;

      if (succs.length > 0) {
        minSuccLS = Infinity;
        for (const s of succs) {
          const succLS = (LS.get(s.id) !== undefined ? LS.get(s.id) : projectDuration) - s.lag;
          if (succLS < minSuccLS) {
            minSuccLS = succLS;
          }
        }
      }

      const lf = minSuccLS === Infinity ? projectDuration : minSuccLS;
      const ls = lf - durations.get(id);
      LF.set(id, lf);
      LS.set(id, ls);
    }

    // 6. FLOAT & CRITICAL PATH IDENTIFICATION
    const cpmTasks = [];
    const criticalTaskIds = new Set();

    for (const t of tasks) {
      const d = durations.get(t.id);
      const es = ES.get(t.id);
      const ef = EF.get(t.id);
      const ls = LS.get(t.id);
      const lf = LF.get(t.id);
      const totalFloat = lf - ef; // or ls - es

      // Free Float: min(ES_successors) - EF
      const succs = successorsOf.get(t.id);
      let freeFloat = totalFloat;
      if (succs.length > 0) {
        let minSuccES = Infinity;
        for (const s of succs) {
          const succES = ES.get(s.id);
          if (succES < minSuccES) minSuccES = succES;
        }
        freeFloat = Math.max(0, minSuccES - ef);
      }

      const isCritical = totalFloat === 0;
      if (isCritical) {
        criticalTaskIds.add(t.id);
      }

      cpmTasks.push({
        id: t.id,
        title: t.title,
        rdStatus: t.rdStatus,
        priority: t.priority,
        durationDays: d,
        earlyStart: es,
        earlyFinish: ef,
        lateStart: ls,
        lateFinish: lf,
        totalFloat,
        freeFloat,
        isCritical,
      });
    }

    // Extract critical path chain ordered by earlyStart
    const criticalPath = cpmTasks
      .filter((t) => t.isCritical)
      .sort((a, b) => a.earlyStart - b.earlyStart);

    return {
      projectId,
      projectName: project.name,
      taskCount: tasks.length,
      projectDurationDays: projectDuration,
      criticalTaskCount: criticalPath.length,
      criticalPath: criticalPath.map((t) => ({
        id: t.id,
        title: t.title,
        durationDays: t.durationDays,
        earlyStart: t.earlyStart,
        earlyFinish: t.earlyFinish,
      })),
      tasks: cpmTasks,
    };
  }

  // ==============================================================================
  // 6. BASELINE SCHEDULE & VARIANCE (REQUIREMENT 19)
  // ==============================================================================

  async createBaseline(tenantId, projectId, version = 1, userId) {
    const tasks = await prisma.task.findMany({
      where: { tenantId, projectId },
    });

    if (tasks.length === 0) {
      throw new Error('No tasks found to create baseline snapshot.');
    }

    // Find highest version if not specified
    const maxVer = await prisma.rdTaskScheduleBaseline.aggregate({
      where: { tenantId, projectId },
      _max: { version: true },
    });
    const ver = version || (maxVer._max.version || 0) + 1;

    const baselines = await prisma.$transaction(
      tasks.map((task) => {
        let dur = 1;
        if (task.startDate && task.dueDate) {
          dur = Math.max(1, Math.ceil((new Date(task.dueDate) - new Date(task.startDate)) / 86400000));
        } else if (task.estimatedHours) {
          dur = Math.max(1, Math.ceil(task.estimatedHours / 8));
        }

        return prisma.rdTaskScheduleBaseline.create({
          data: {
            tenantId,
            taskId: task.id,
            projectId,
            baselineStartDate: task.startDate || new Date(),
            baselineEndDate: task.dueDate || null,
            plannedDurationDays: dur,
            version: ver,
          },
        });
      })
    );

    return {
      success: true,
      version: ver,
      tasksCaptured: baselines.length,
    };
  }

  async getScheduleVariance(tenantId, projectId) {
    // Get latest baseline version for project
    const latestBaseline = await prisma.rdTaskScheduleBaseline.findFirst({
      where: { tenantId, projectId },
      orderBy: { version: 'desc' },
    });

    if (!latestBaseline) {
      return {
        hasBaseline: false,
        message: 'No baseline recorded for this project.',
        variances: [],
      };
    }

    const baselineRecords = await prisma.rdTaskScheduleBaseline.findMany({
      where: { tenantId, projectId, version: latestBaseline.version },
      include: {
        task: true,
      },
    });

    const variances = baselineRecords.map((base) => {
      const task = base.task;
      let startVarianceDays = 0;
      let finishVarianceDays = 0;

      if (base.baselineStartDate && task.startDate) {
        startVarianceDays = Math.round((new Date(task.startDate) - new Date(base.baselineStartDate)) / 86400000);
      }
      if (base.baselineEndDate && task.dueDate) {
        finishVarianceDays = Math.round((new Date(task.dueDate) - new Date(base.baselineEndDate)) / 86400000);
      }

      return {
        taskId: task.id,
        taskTitle: task.title,
        rdStatus: task.rdStatus,
        baselineStartDate: base.baselineStartDate,
        baselineEndDate: base.baselineEndDate,
        currentStartDate: task.startDate,
        currentDueDate: task.dueDate,
        startVarianceDays,
        finishVarianceDays,
        isSlipped: finishVarianceDays > 0,
        isAhead: finishVarianceDays < 0,
      };
    });

    return {
      hasBaseline: true,
      baselineVersion: latestBaseline.version,
      capturedAt: latestBaseline.createdAt,
      variances,
      totalSlipped: variances.filter((v) => v.isSlipped).length,
      totalAhead: variances.filter((v) => v.isAhead).length,
    };
  }

  // ==============================================================================
  // 7. SCHEDULE VARIANCE ALERTS (REQUIREMENT 20)
  // ==============================================================================

  async scanAndGenerateAlerts(tenantId, projectId) {
    const now = new Date();
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        successorDependencies: {
          include: { predecessor: true },
        },
      },
    });

    const alertsCreated = [];

    for (const task of tasks) {
      if (task.rdStatus === 'DONE' || task.status === 'COMPLETED') continue;

      // 1. OVERDUE ALERT
      if (task.dueDate && new Date(task.dueDate) < now) {
        const daysOverdue = Math.ceil((now - new Date(task.dueDate)) / 86400000);
        const alert = await this.upsertAlert(tenantId, {
          projectId: task.projectId,
          taskId: task.id,
          alertType: 'OVERDUE',
          severity: 'CRITICAL',
          message: `Task '${task.title}' is overdue by ${daysOverdue} day(s) (Due: ${task.dueDate.toISOString().slice(0, 10)}).`,
        });
        alertsCreated.push(alert);
      }

      // 2. DUE SOON ALERT (within 48 hours)
      else if (task.dueDate) {
        const msRemaining = new Date(task.dueDate).getTime() - now.getTime();
        const hoursRemaining = msRemaining / (1000 * 60 * 60);
        if (hoursRemaining > 0 && hoursRemaining <= 48) {
          const alert = await this.upsertAlert(tenantId, {
            projectId: task.projectId,
            taskId: task.id,
            alertType: 'DUE_SOON',
            severity: 'WARNING',
            message: `Task '${task.title}' is due in ${Math.round(hoursRemaining)} hours (Due: ${task.dueDate.toISOString().slice(0, 10)}).`,
          });
          alertsCreated.push(alert);
        }
      }

      // 3. DEPENDENCY BLOCKED ALERT
      const incompletePreds = task.successorDependencies.filter(
        (dep) => dep.predecessor && dep.predecessor.rdStatus !== 'DONE' && dep.predecessor.status !== 'COMPLETED'
      );
      if (['TODO', 'IN_PROGRESS'].includes(task.rdStatus) && incompletePreds.length > 0) {
        const alert = await this.upsertAlert(tenantId, {
          projectId: task.projectId,
          taskId: task.id,
          alertType: 'DEPENDENCY_BLOCKED',
          severity: 'WARNING',
          message: `Task '${task.title}' is blocked by ${incompletePreds.length} incomplete predecessor task(s): ${incompletePreds.map((d) => d.predecessor.title).join(', ')}.`,
        });
        alertsCreated.push(alert);
      }
    }

    return {
      success: true,
      alertsEvaluated: alertsCreated.length,
      alerts: alertsCreated,
    };
  }

  async upsertAlert(tenantId, { projectId, taskId, alertType, severity, message }) {
    const existing = await prisma.rdScheduleAlert.findFirst({
      where: {
        tenantId,
        taskId,
        alertType,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      return prisma.rdScheduleAlert.update({
        where: { id: existing.id },
        data: { message, severity, detectedAt: new Date() },
      });
    }

    return prisma.rdScheduleAlert.create({
      data: {
        tenantId,
        projectId,
        taskId,
        alertType,
        severity,
        message,
        status: 'ACTIVE',
      },
    });
  }

  async getAlerts(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.alertType) where.alertType = filters.alertType;

    return prisma.rdScheduleAlert.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, rdStatus: true, dueDate: true } },
      },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    });
  }

  async resolveAlert(tenantId, alertId, userId) {
    const alert = await prisma.rdScheduleAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) throw new Error('Alert not found.');

    return prisma.rdScheduleAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }
}

module.exports = new RdTaskService();
