const prisma = require('../config/prisma');
const collaborationSocketRelay = require('./collaborationSocketRelay');
const rdNotificationService = require('./rdNotificationService');

class RdCommentService {
  /**
   * Get contextual comments for any R&D record
   */
  async getComments(tenantId, recordType, recordId) {
    if (!recordType || !recordId) {
      throw new Error('Record type and record ID are required.');
    }

    const comments = await prisma.rdContextComment.findMany({
      where: {
        tenantId,
        recordType: recordType.toUpperCase(),
        recordId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, name: true, email: true, role: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter to top-level comments (parentCommentId === null) so replies are nested
    return comments.filter((c) => !c.parentCommentId);
  }

  /**
   * Create a contextual comment on any record
   */
  async createComment(tenantId, authorId, data) {
    const { recordType, recordId, content, parentCommentId = null, recordTitle = null } = data;

    if (!recordType || !recordId || !content || !content.trim()) {
      throw new Error('Record type, record ID, and content are required.');
    }

    const comment = await prisma.rdContextComment.create({
      data: {
        tenantId,
        recordType: recordType.toUpperCase(),
        recordId,
        authorId,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
      },
    });

    // Check @mentions
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matchedUsernames = [...content.matchAll(mentionRegex)].map((m) => m[1]);

    if (matchedUsernames.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { name: { in: matchedUsernames } },
            { email: { in: matchedUsernames } },
          ],
        },
        select: { id: true, name: true },
      });

      for (const mUser of mentionedUsers) {
        if (mUser.id !== authorId) {
          await prisma.rdMention.create({
            data: {
              tenantId,
              sourceType: 'COMMENT',
              sourceId: comment.id,
              mentionedUserId: mUser.id,
              createdById: authorId,
            },
          });

          await rdNotificationService.createNotification(tenantId, {
            userId: mUser.id,
            type: 'MENTION',
            title: `${comment.author?.name || 'Someone'} mentioned you on ${recordType.toLowerCase()}`,
            message: content.substring(0, 120),
            linkUrl: `/crm/rd/${recordType.toLowerCase()}s?id=${recordId}`,
            recordType: recordType.toUpperCase(),
            recordId,
          });
        }
      }
    }

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:comment:new', {
      recordType: recordType.toUpperCase(),
      recordId,
      comment,
    });

    return comment;
  }

  /**
   * Edit a comment
   */
  async editComment(tenantId, commentId, authorId, newContent) {
    if (!newContent || !newContent.trim()) {
      throw new Error('Comment content cannot be empty.');
    }

    const comment = await prisma.rdContextComment.findFirst({
      where: { id: commentId, tenantId },
    });

    if (!comment) throw new Error('Comment not found.');
    if (comment.authorId !== authorId) {
      throw new Error('Unauthorized: You can only edit your own comments.');
    }

    const updated = await prisma.rdContextComment.update({
      where: { id: commentId },
      data: {
        content: newContent.trim(),
        isEdited: true,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
      },
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:comment:updated', updated);
    return updated;
  }

  /**
   * Delete a comment (soft deletion)
   */
  async deleteComment(tenantId, commentId, authorId) {
    const comment = await prisma.rdContextComment.findFirst({
      where: { id: commentId, tenantId },
    });

    if (!comment) throw new Error('Comment not found.');
    if (comment.authorId !== authorId) {
      throw new Error('Unauthorized: You can only delete your own comments.');
    }

    const deleted = await prisma.rdContextComment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        content: '[This comment has been removed by author]',
      },
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:comment:deleted', {
      commentId,
      recordType: comment.recordType,
      recordId: comment.recordId,
    });
    return deleted;
  }
}

module.exports = new RdCommentService();

