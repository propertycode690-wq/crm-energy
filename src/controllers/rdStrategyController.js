const rdStrategyService = require('../services/rdStrategyService');

class RdStrategyController {
  async getGoals(req, res, next) {
    try {
      const goals = await rdStrategyService.getGoals(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        count: goals.length,
        data: goals,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGoalById(req, res, next) {
    try {
      const goal = await rdStrategyService.getGoalById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: goal,
      });
    } catch (error) {
      next(error);
    }
  }

  async createGoal(req, res, next) {
    try {
      const goal = await rdStrategyService.createGoal(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Strategic Goal created successfully.',
        data: goal,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateGoal(req, res, next) {
    try {
      const goal = await rdStrategyService.updateGoal(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Strategic Goal updated successfully.',
        data: goal,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteGoal(req, res, next) {
    try {
      await rdStrategyService.deleteGoal(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Strategic Goal deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async alignProject(req, res, next) {
    try {
      const alignment = await rdStrategyService.alignProject(req.user.tenantId, req.body);
      return res.status(200).json({
        success: true,
        message: 'Project successfully aligned with strategic goal.',
        data: alignment,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeAlignment(req, res, next) {
    try {
      await rdStrategyService.removeAlignment(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Project alignment removed successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  async getStrategyMatrix(req, res, next) {
    try {
      const matrix = await rdStrategyService.getStrategyMatrix(req.user.tenantId);
      return res.status(200).json({
        success: true,
        data: matrix,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdStrategyController();
