const rdMilestoneService = require('../services/rdMilestoneService');

class RdMilestoneController {
  async getMilestones(req, res, next) {
    try {
      const milestones = await rdMilestoneService.getMilestones(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        count: milestones.length,
        data: milestones,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMilestoneById(req, res, next) {
    try {
      const milestone = await rdMilestoneService.getMilestoneById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createMilestone(req, res, next) {
    try {
      const milestone = await rdMilestoneService.createMilestone(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Milestone created successfully.',
        data: milestone,
      });
    } catch (error) {
      if (error.message && (error.message.includes('required') || error.message.includes('not found'))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateMilestone(req, res, next) {
    try {
      const milestone = await rdMilestoneService.updateMilestone(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Milestone updated successfully.',
        data: milestone,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateMilestoneStatus(req, res, next) {
    try {
      const { status } = req.body;
      const result = await rdMilestoneService.updateMilestoneStatus(req.user.tenantId, req.params.id, status, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Milestone status updated.',
        data: result.milestone,
        warning: result.warning,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message && error.message.includes('Invalid')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async deleteMilestone(req, res, next) {
    try {
      const result = await rdMilestoneService.deleteMilestone(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async linkTasks(req, res, next) {
    try {
      const { taskIds } = req.body;
      const result = await rdMilestoneService.linkTasksToMilestone(req.user.tenantId, req.params.id, taskIds, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async reorderMilestones(req, res, next) {
    try {
      const { orderedMilestoneIds } = req.body;
      const result = await rdMilestoneService.reorderMilestones(req.user.tenantId, orderedMilestoneIds, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdMilestoneController();
