const rdCollaborationService = require('../services/rdCollaborationService');
const rdCommentService = require('../services/rdCommentService');
const rdNotificationService = require('../services/rdNotificationService');

class RdCollaborationController {
  // ==============================================================================
  // CONVERSATIONS
  // ==============================================================================

  async getConversations(req, res, next) {
    try {
      const data = await rdCollaborationService.getConversations(
        req.user.tenantId,
        req.user.userId,
        req.query
      );
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  async createConversation(req, res, next) {
    try {
      const data = await rdCollaborationService.createConversation(
        req.user.tenantId,
        req.user.userId,
        req.body
      );
      return res.status(201).json({
        success: true,
        message: 'Conversation initialized successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversationById(req, res, next) {
    try {
      const data = await rdCollaborationService.getConversationById(
        req.user.tenantId,
        req.params.id,
        req.user.userId
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateConversation(req, res, next) {
    try {
      const data = await rdCollaborationService.updateConversation(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body
      );
      return res.status(200).json({
        success: true,
        message: 'Conversation updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async addParticipant(req, res, next) {
    try {
      const data = await rdCollaborationService.addParticipant(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body.userId,
        req.body.role
      );
      return res.status(200).json({
        success: true,
        message: 'Participant added successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeParticipant(req, res, next) {
    try {
      const data = await rdCollaborationService.removeParticipant(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.params.userId
      );
      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // MESSAGES
  // ==============================================================================

  async getMessages(req, res, next) {
    try {
      const data = await rdCollaborationService.getMessages(
        req.user.tenantId,
        req.params.conversationId,
        req.user.userId,
        req.query
      );
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const data = await rdCollaborationService.sendMessage(
        req.user.tenantId,
        req.user.userId,
        req.params.conversationId,
        req.body
      );
      return res.status(201).json({
        success: true,
        message: 'Message delivered.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async editMessage(req, res, next) {
    try {
      const data = await rdCollaborationService.editMessage(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body.content
      );
      return res.status(200).json({
        success: true,
        message: 'Message updated.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req, res, next) {
    try {
      const data = await rdCollaborationService.deleteMessage(
        req.user.tenantId,
        req.params.id,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Message deleted.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async pinMessage(req, res, next) {
    try {
      const data = await rdCollaborationService.pinMessage(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body.isPinned
      );
      return res.status(200).json({
        success: true,
        message: data.isPinned ? 'Message pinned.' : 'Message unpinned.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async searchMessages(req, res, next) {
    try {
      const data = await rdCollaborationService.searchMessages(
        req.user.tenantId,
        req.user.userId,
        req.query
      );
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // CONTEXTUAL COMMENTS
  // ==============================================================================

  async getComments(req, res, next) {
    try {
      const { recordType, recordId } = req.query;
      const data = await rdCommentService.getComments(req.user.tenantId, recordType, recordId);
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req, res, next) {
    try {
      const data = await rdCommentService.createComment(
        req.user.tenantId,
        req.user.userId,
        req.body
      );
      return res.status(201).json({
        success: true,
        message: 'Comment posted.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async editComment(req, res, next) {
    try {
      const data = await rdCommentService.editComment(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body.content
      );
      return res.status(200).json({
        success: true,
        message: 'Comment updated.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req, res, next) {
    try {
      const data = await rdCommentService.deleteComment(
        req.user.tenantId,
        req.params.id,
        req.user.userId
      );
      return res.status(200).json({
        success: true,
        message: 'Comment deleted.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================================
  // NOTIFICATIONS
  // ==============================================================================

  async getNotifications(req, res, next) {
    try {
      const data = await rdNotificationService.getNotifications(
        req.user.tenantId,
        req.user.userId,
        req.query
      );
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req, res, next) {
    try {
      const data = await rdNotificationService.markAsRead(
        req.user.tenantId,
        req.params.id,
        req.user.userId
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsRead(req, res, next) {
    try {
      const data = await rdNotificationService.markAllAsRead(
        req.user.tenantId,
        req.user.userId
      );
      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req, res, next) {
    try {
      const data = await rdNotificationService.getPreferences(
        req.user.tenantId,
        req.user.userId
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const data = await rdNotificationService.updatePreferences(
        req.user.tenantId,
        req.user.userId,
        req.body
      );
      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdCollaborationController();

