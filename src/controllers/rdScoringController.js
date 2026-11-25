const rdScoringService = require('../services/rdScoringService');

class RdScoringController {
  // Rubrics
  async getActiveRubric(req, res, next) {
    try {
      const rubric = await rdScoringService.getActiveRubric(req.user.tenantId);
      return res.status(200).json({
        success: true,
        data: rubric,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRubrics(req, res, next) {
    try {
      const rubrics = await rdScoringService.getRubrics(req.user.tenantId);
      return res.status(200).json({
        success: true,
        count: rubrics.length,
        data: rubrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async configureRubric(req, res, next) {
    try {
      const rubric = await rdScoringService.configureRubric(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Evaluation rubric configured successfully.',
        data: rubric,
      });
    } catch (error) {
      next(error);
    }
  }

  // Evaluations
  async getEvaluation(req, res, next) {
    try {
      const evaluatorId = req.query.evaluatorId || req.user.userId;
      const evaluation = await rdScoringService.getEvaluation(req.user.tenantId, req.params.id, evaluatorId);
      return res.status(200).json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitEvaluation(req, res, next) {
    try {
      const result = await rdScoringService.submitEvaluation(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: req.body.isDraft ? 'Evaluation draft saved.' : 'Evaluation submitted successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Leaderboard
  async getLeaderboard(req, res, next) {
    try {
      const data = await rdScoringService.getLeaderboard(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdScoringController();
