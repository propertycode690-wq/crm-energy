const rdGanttService = require('../services/rdGanttService');

class RdGanttController {
  async getGanttData(req, res, next) {
    try {
      const data = await rdGanttService.getProjectGanttData(req.user.tenantId, req.params.projectId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateTaskScheduleDates(req, res, next) {
    try {
      const result = await rdGanttService.updateTaskScheduleDates(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Task schedule dates updated.',
        data: result,
      });
    } catch (error) {
      if (error.message && (error.message.includes('precede') || error.message.includes('required'))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getProjectRoadmap(req, res, next) {
    try {
      const roadmap = await rdGanttService.getProjectRoadmap(req.user.tenantId, req.params.projectId);
      return res.status(200).json({
        success: true,
        data: roadmap,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getProjectTimeline(req, res, next) {
    try {
      const timeline = await rdGanttService.getProjectTimeline(
        req.user.tenantId,
        req.params.projectId,
        req.query
      );
      return res.status(200).json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

module.exports = new RdGanttController();
