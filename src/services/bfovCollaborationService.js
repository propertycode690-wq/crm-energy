/**
 * BFOV Charts — Collaboration, Sharing & Comments Service
 * Master Prompt 15: Manages sharing permissions, comments, activity log, and template saving
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class BfovCollaborationService {
  /**
   * Share a diagram with a collaborator
   */
  async shareDiagram(tenantId, diagramId, { sharedWithUserId, sharedWithEmail, role = 'VIEWER' }) {
    const diagram = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });
    if (!diagram) throw new Error('Diagram not found.');

    const cleanRole = role.toUpperCase() === 'EDITOR' ? 'EDITOR' : 'VIEWER';

    const share = await prisma.bfovDiagramShare.create({
      data: {
        diagramId,
        tenantId,
        sharedWithUserId: sharedWithUserId || null,
        sharedWithEmail: sharedWithEmail ? sharedWithEmail.trim().toLowerCase() : null,
        role: cleanRole
      },
      include: {
        sharedWithUser: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return share;
  }

  /**
   * List all shares for a diagram
   */
  async listShares(tenantId, diagramId) {
    return prisma.bfovDiagramShare.findMany({
      where: { diagramId, tenantId },
      include: {
        sharedWithUser: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Remove a share permission
   */
  async removeShare(tenantId, shareId) {
    const existing = await prisma.bfovDiagramShare.findFirst({
      where: { id: shareId, tenantId }
    });
    if (!existing) throw new Error('Share record not found.');

    await prisma.bfovDiagramShare.delete({
      where: { id: shareId }
    });

    return { success: true, message: 'Collaborator removed successfully.' };
  }

  /**
   * Check if a user has access to a diagram
   */
  async verifyDiagramAccess(tenantId, userId, diagramId, requiredRole = 'VIEWER') {
    const diagram = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });
    if (!diagram) return { hasAccess: false, reason: 'Diagram does not exist in tenant.' };

    // Owner has full access
    if (diagram.userId === userId) {
      return { hasAccess: true, role: 'OWNER' };
    }

    // Public diagrams can be viewed
    if (diagram.isPublic && requiredRole === 'VIEWER') {
      return { hasAccess: true, role: 'VIEWER' };
    }

    // Check shares
    const share = await prisma.bfovDiagramShare.findFirst({
      where: {
        diagramId,
        tenantId,
        sharedWithUserId: userId
      }
    });

    if (!share) return { hasAccess: false, reason: 'User not granted access to diagram.' };

    if (requiredRole === 'EDITOR' && share.role !== 'EDITOR') {
      return { hasAccess: false, reason: 'Editor permissions required.' };
    }

    return { hasAccess: true, role: share.role };
  }

  /**
   * Add a comment to a diagram
   */
  async addComment(tenantId, userId, diagramId, { content, nodeId }) {
    if (!content || !content.trim()) throw new Error('Comment content cannot be empty.');

    const diagram = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });
    if (!diagram) throw new Error('Diagram not found.');

    const comment = await prisma.bfovDiagramComment.create({
      data: {
        diagramId,
        tenantId,
        userId,
        content: content.trim(),
        nodeId: nodeId || null
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return comment;
  }

  /**
   * List comments on a diagram
   */
  async listComments(tenantId, diagramId) {
    return prisma.bfovDiagramComment.findMany({
      where: { diagramId, tenantId },
      include: {
        author: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Mark comment as resolved
   */
  async resolveComment(tenantId, commentId, isResolved = true) {
    const comment = await prisma.bfovDiagramComment.findFirst({
      where: { id: commentId, tenantId }
    });
    if (!comment) throw new Error('Comment not found.');

    return prisma.bfovDiagramComment.update({
      where: { id: commentId },
      data: { isResolved: Boolean(isResolved) }
    });
  }

  /**
   * Delete comment
   */
  async deleteComment(tenantId, commentId) {
    const comment = await prisma.bfovDiagramComment.findFirst({
      where: { id: commentId, tenantId }
    });
    if (!comment) throw new Error('Comment not found.');

    await prisma.bfovDiagramComment.delete({
      where: { id: commentId }
    });

    return { success: true, message: 'Comment deleted.' };
  }

  /**
   * Save an existing diagram as a reusable blueprint template
   */
  async saveAsTemplate(tenantId, userId, diagramId, { templateKey, title, description, category }) {
    const diagram = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });
    if (!diagram) throw new Error('Diagram not found.');

    const key = templateKey || `user-tmpl-${Date.now()}`;
    const tmplTitle = title || `${diagram.title} (Template)`;
    const tmplCat = category || diagram.category || 'General';

    const template = await prisma.bfovDiagramTemplate.create({
      data: {
        templateKey: key,
        title: tmplTitle,
        description: description || diagram.description || 'Custom user created template blueprint',
        category: tmplCat,
        diagramType: diagram.diagramType,
        defaultGraphData: diagram.graphData,
        icon: 'Boxes',
        isSystem: false
      }
    });

    return template;
  }
}

module.exports = new BfovCollaborationService();

