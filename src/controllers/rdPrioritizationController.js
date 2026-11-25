const rdPrioritizationService = require('../services/rdPrioritizationService');

class RdPrioritizationController {
  async getPrioritizedProjects(req, res, next) {
    try {
      const data = await rdPrioritizationService.getPrioritizedProjects(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePrioritization(req, res, next) {
    try {
      const result = await rdPrioritizationService.updatePrioritization(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async recalculateAll(req, res, next) {
    try {
      const result = await rdPrioritizationService.recalculateAll(req.user.tenantId, req.body.weights || {});
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdPrioritizationController();
