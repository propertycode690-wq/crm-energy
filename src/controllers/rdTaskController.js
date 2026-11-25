const rdTaskService = require('../services/rdTaskService');

class RdTaskController {
  // ==============================================================================
  // TASKS
  // ==============================================================================

  async getTasks(req, res, next) {
    try {
      const tasks = await rdTaskService.getTasks(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        count: tasks.length,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req, res, next) {
    try {
      const task = await rdTaskService.getTaskById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createTask(req, res, next) {
    try {
      const task = await rdTaskService.createTask(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'R&D task created successfully.',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req, res, next) {
    try {
      const task = await rdTaskService.updateTask(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'R&D task updated successfully.',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTaskStatus(req, res, next) {
    try {
      const { rdStatus } = req.body;
      const task = await rdTaskService.updateTaskStatus(req.user.tenantId, req.params.id, rdStatus, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'R&D task status updated.',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req, res, next) {
    try {
      const result = await rdTaskService.deleteTask(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // SPRINTS
  // ==============================================================================

  async getSprints(req, res, next) {
    try {
      const sprints = await rdTaskService.getSprints(req.user.tenantId, req.query.projectId);
      return res.status(200).json({
        success: true,
        count: sprints.length,
        data: sprints,
      });
    } catch (error) {
      next(error);
    }
  }

  async createSprint(req, res, next) {
    try {
      const sprint = await rdTaskService.createSprint(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Sprint created successfully.',
        data: sprint,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSprint(req, res, next) {
    try {
      const sprint = await rdTaskService.updateSprint(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Sprint updated successfully.',
        data: sprint,
      });
    } catch (error) {
      next(error);
    }
  }

  async startSprint(req, res, next) {
    try {
      const sprint = await rdTaskService.startSprint(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Sprint started.',
        data: sprint,
      });
    } catch (error) {
      next(error);
    }
  }

  async completeSprint(req, res, next) {
    try {
      const { rolloverAction } = req.body;
      const result = await rdTaskService.completeSprint(req.user.tenantId, req.params.id, rolloverAction, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Sprint completed.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // BACKLOG
  // ==============================================================================

  async getBacklog(req, res, next) {
    try {
      const backlog = await rdTaskService.getBacklog(req.user.tenantId, req.query.projectId);
      return res.status(200).json({
        success: true,
        count: backlog.length,
        data: backlog,
      });
    } catch (error) {
      next(error);
    }
  }

  async reorderBacklog(req, res, next) {
    try {
      const { orderedTaskIds } = req.body;
      const result = await rdTaskService.reorderBacklog(req.user.tenantId, orderedTaskIds, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async commitBacklogToSprint(req, res, next) {
    try {
      const { sprintId, taskIds } = req.body;
      const result = await rdTaskService.commitBacklogToSprint(req.user.tenantId, sprintId, taskIds, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // DEPENDENCIES
  // ==============================================================================

  async getDependencies(req, res, next) {
    try {
      const deps = await rdTaskService.getDependencies(req.user.tenantId, req.query.projectId);
      return res.status(200).json({
        success: true,
        count: deps.length,
        data: deps,
      });
    } catch (error) {
      next(error);
    }
  }

  async addDependency(req, res, next) {
    try {
      const dep = await rdTaskService.addDependency(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Dependency created successfully.',
        data: dep,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDependency(req, res, next) {
    try {
      const result = await rdTaskService.deleteDependency(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // CRITICAL PATH METHOD (CPM) & SCHEDULING
  // ==============================================================================

  async calculateCPM(req, res, next) {
    try {
      const cpm = await rdTaskService.calculateCPM(req.user.tenantId, req.params.projectId);
      return res.status(200).json({
        success: true,
        data: cpm,
      });
    } catch (error) {
      next(error);
    }
  }

  async createBaseline(req, res, next) {
    try {
      const { projectId, version } = req.body;
      const result = await rdTaskService.createBaseline(req.user.tenantId, projectId, version, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Schedule baseline snapshot created.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getScheduleVariance(req, res, next) {
    try {
      const result = await rdTaskService.getScheduleVariance(req.user.tenantId, req.params.projectId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // SCHEDULE ALERTS
  // ==============================================================================

  async scanAlerts(req, res, next) {
    try {
      const result = await rdTaskService.scanAndGenerateAlerts(req.user.tenantId, req.query.projectId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req, res, next) {
    try {
      const alerts = await rdTaskService.getAlerts(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        count: alerts.length,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolveAlert(req, res, next) {
    try {
      const alert = await rdTaskService.resolveAlert(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Alert resolved.',
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdTaskController();
