const rdPortfolioService = require('../services/rdPortfolioService');

class RdPortfolioController {
  async getPortfolio(req, res, next) {
    try {
      const data = await rdPortfolioService.getPortfolio(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectsList(req, res, next) {
    try {
      const data = await rdPortfolioService.getPortfolio(req.user.tenantId, req.query);
      return res.status(200).json({
        success: true,
        data: data.projects,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectById(req, res, next) {
    try {
      const project = await rdPortfolioService.getProjectById(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async createProject(req, res, next) {
    try {
      const project = await rdPortfolioService.createRdProject(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'R&D Project created successfully.',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req, res, next) {
    try {
      const project = await rdPortfolioService.updateRdProject(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'R&D Project updated successfully.',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdPortfolioController();
