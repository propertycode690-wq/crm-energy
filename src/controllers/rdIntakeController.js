const rdIntakeService = require('../services/rdIntakeService');

class RdIntakeController {
  async getProposals(req, res, next) {
    try {
      const data = await rdIntakeService.getProposals(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProposalById(req, res, next) {
    try {
      const proposal = await rdIntakeService.getProposalById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.createProposal(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'R&D Intake Proposal created successfully.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.updateProposal(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'R&D Proposal updated successfully.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.submitProposal(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Proposal successfully submitted for screening.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.reviewProposal(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Review action processed successfully.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async approveProposal(req, res, next) {
    try {
      const result = await rdIntakeService.approveProposal(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId,
        req.user.name
      );
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async rejectProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.rejectProposal(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Proposal rejected.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }

  async withdrawProposal(req, res, next) {
    try {
      const proposal = await rdIntakeService.withdrawProposal(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Proposal withdrawn.',
        data: proposal,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdIntakeController();
