const rdIdeaService = require('../services/rdIdeaService');

class RdIdeaController {
  async getIdeas(req, res, next) {
    try {
      const data = await rdIdeaService.getIdeas(req.user.tenantId, req.query, req.user.userId);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getIdeaById(req, res, next) {
    try {
      const idea = await rdIdeaService.getIdeaById(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        data: idea,
      });
    } catch (error) {
      next(error);
    }
  }

  async createIdea(req, res, next) {
    try {
      const idea = await rdIdeaService.createIdea(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Research Idea created successfully.',
        data: idea,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateIdea(req, res, next) {
    try {
      const idea = await rdIdeaService.updateIdea(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Research Idea updated successfully.',
        data: idea,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitIdea(req, res, next) {
    try {
      const idea = await rdIdeaService.submitIdea(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Idea successfully submitted for review.',
        data: idea,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateIdeaStatus(req, res, next) {
    try {
      const idea = await rdIdeaService.updateIdeaStatus(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Idea status updated successfully.',
        data: idea,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardMetrics(req, res, next) {
    try {
      const metrics = await rdIdeaService.getDashboardMetrics(req.user.tenantId);
      return res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPipeline(req, res, next) {
    try {
      const pipeline = await rdIdeaService.getPipeline(req.user.tenantId);
      return res.status(200).json({
        success: true,
        data: pipeline,
      });
    } catch (error) {
      next(error);
    }
  }

  // Voting
  async voteIdea(req, res, next) {
    try {
      const result = await rdIdeaService.voteIdea(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async unvoteIdea(req, res, next) {
    try {
      const result = await rdIdeaService.unvoteIdea(req.user.tenantId, req.params.id, req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Comments
  async getComments(req, res, next) {
    try {
      const comments = await rdIdeaService.getComments(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        count: comments.length,
        data: comments,
      });
    } catch (error) {
      next(error);
    }
  }

  async addComment(req, res, next) {
    try {
      const comment = await rdIdeaService.addComment(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Comment posted.',
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req, res, next) {
    try {
      await rdIdeaService.deleteComment(req.user.tenantId, req.params.commentId, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Comment deleted.',
      });
    } catch (error) {
      next(error);
    }
  }

  // Categories
  async getCategories(req, res, next) {
    try {
      const categories = await rdIdeaService.getCategories(req.user.tenantId, req.user.userId);
      return res.status(200).json({
        success: true,
        count: categories.length,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req, res, next) {
    try {
      const category = await rdIdeaService.createCategory(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Category created.',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await rdIdeaService.updateCategory(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Category updated.',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await rdIdeaService.deleteCategory(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Category removed or deactivated.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Tags
  async getTags(req, res, next) {
    try {
      const tags = await rdIdeaService.getTags(req.user.tenantId);
      return res.status(200).json({
        success: true,
        count: tags.length,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  // Reviewers
  async assignReviewer(req, res, next) {
    try {
      const assignment = await rdIdeaService.assignReviewer(req.user.tenantId, req.params.id, req.body, req.user.userId);
      return res.status(200).json({
        success: true,
        message: 'Reviewer assigned.',
        data: assignment,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeReviewer(req, res, next) {
    try {
      await rdIdeaService.removeReviewer(req.user.tenantId, req.params.id, req.params.reviewerId);
      return res.status(200).json({
        success: true,
        message: 'Reviewer removed.',
      });
    } catch (error) {
      next(error);
    }
  }

  async getIdeaReviewers(req, res, next) {
    try {
      const reviewers = await rdIdeaService.getIdeaReviewers(req.user.tenantId, req.params.id);
      return res.status(200).json({
        success: true,
        count: reviewers.length,
        data: reviewers,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdIdeaController();
