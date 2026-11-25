const rdGovernanceService = require('../services/rdGovernanceService');

class RdGovernanceController {
  // Templates
  async getTemplates(req, res, next) {
    try {
      const templates = await rdGovernanceService.getTemplates(req.user.tenantId, req.user.userId);
      return res.status(200).json({
        success: true,
        count: templates.length,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateById(req, res, next) {
    try {
      const template = await rdGovernanceService.getTemplateById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req, res, next) {
    try {
      const template = await rdGovernanceService.createTemplate(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Stage-Gate template created successfully.',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  // Project Governance
  async initializeProjectGovernance(req, res, next) {
    try {
      const governance = await rdGovernanceService.initializeProjectGovernance(
        req.user.tenantId,
        req.params.projectId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({
        success: true,
        message: 'Stage-Gate governance initialized for project.',
        data: governance,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectGovernance(req, res, next) {
    try {
      const governance = await rdGovernanceService.getProjectGovernance(
        req.user.tenantId,
        req.params.projectId,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        data: governance,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGovernedProjects(req, res, next) {
    try {
      const data = await rdGovernanceService.getGovernedProjects(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async resumeHeldGovernance(req, res, next) {
    try {
      const result = await rdGovernanceService.resumeHeldGovernance(
        req.user.tenantId,
        req.params.projectId,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Project governance resumed from hold.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Gate Reviews & Decision Workflow
  async submitGateReview(req, res, next) {
    try {
      const review = await rdGovernanceService.submitGateReview(
        req.user.tenantId,
        req.params.reviewId,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Gate review submitted successfully.',
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignReviewers(req, res, next) {
    try {
      const assignments = await rdGovernanceService.assignReviewers(
        req.user.tenantId,
        req.params.reviewId,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Gatekeeper reviewers assigned.',
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitSignOff(req, res, next) {
    try {
      const signOff = await rdGovernanceService.submitSignOff(
        req.user.tenantId,
        req.params.reviewId,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Formal sign-off recorded.',
        data: signOff,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadEvidence(req, res, next) {
    try {
      const evidence = await rdGovernanceService.uploadEvidence(
        req.user.tenantId,
        req.params.reviewId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({
        success: true,
        message: 'Evidence document linked to review.',
        data: evidence,
      });
    } catch (error) {
      next(error);
    }
  }

  async recordGateDecision(req, res, next) {
    try {
      const result = await rdGovernanceService.recordGateDecision(
        req.user.tenantId,
        req.params.reviewId,
        req.body,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: `Gate decision (${req.body.decision}) recorded successfully.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Dashboard & Inbox
  async getDashboardMetrics(req, res, next) {
    try {
      const metrics = await rdGovernanceService.getDashboardMetrics(req.user.tenantId);
      return res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReviewerInbox(req, res, next) {
    try {
      const inbox = await rdGovernanceService.getReviewerInbox(req.user.tenantId, req.user.userId);
      return res.status(200).json({
        success: true,
        count: inbox.length,
        data: inbox,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdGovernanceController();
