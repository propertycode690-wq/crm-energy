const prisma = require('../config/prisma');
const collaborationSocketRelay = require('./collaborationSocketRelay');
const rdNotificationService = require('./rdNotificationService');

class RdCollaborationService {
  /**
   * List conversations visible to user in tenant
   */
  async getConversations(tenantId, userId, query = {}) {
    const { projectId, type, search } = query;

    const where = {
      tenantId,
      isArchived: false,
      ...(projectId ? { projectId } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { topic: { contains: search } },
            ],
          }
        : {}),
      OR: [
        // User is an explicit participant
        { participants: { some: { userId } } },
        // OR conversation is a non-private project channel in the tenant
        { isPrivate: false, type: 'PROJECT_CHANNEL' },
      ],
    };

    const conversations = await prisma.rdConversation.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, status: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, avatar: true },
            },
          },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        _count: {
          select: { messages: true, participants: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute unread count for current user
    return conversations.map((conv) => {
      const myParticipation = conv.participants.find((p) => p.userId === userId);
      const lastRead = myParticipation?.lastReadAt ? new Date(myParticipation.lastReadAt) : null;
      const latestMessage = conv.messages[0] || null;
      const hasUnread = latestMessage && (!lastRead || new Date(latestMessage.createdAt) > lastRead);

      return {
        id: conv.id,
        tenantId: conv.tenantId,
        projectId: conv.projectId,
        projectName: conv.project?.name || null,
        type: conv.type,
        title: conv.title,
        topic: conv.topic,
        isPrivate: conv.isPrivate,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        participantsCount: conv._count.participants,
        messagesCount: conv._count.messages,
        participants: conv.participants.map((p) => ({
          userId: p.userId,
          name: p.user?.name,
          email: p.user?.email,
          role: p.role,
          avatar: p.user?.avatar,
          joinedAt: p.joinedAt,
          isMuted: p.isMuted,
        })),
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              content: latestMessage.content,
              createdAt: latestMessage.createdAt,
              senderName: latestMessage.sender?.name,
              senderId: latestMessage.senderId,
            }
          : null,
        hasUnread: Boolean(hasUnread && latestMessage?.senderId !== userId),
      };
    });
  }

  /**
   * Create a conversation (Project Channel, Direct Message, or Group Chat)
   */
  async createConversation(tenantId, userId, data) {
    const {
      type = 'PROJECT_CHANNEL',
      title,
      topic,
      projectId,
      isPrivate = false,
      participantUserIds = [],
    } = data;

    // For 1-on-1 DIRECT_MESSAGE, check if one already exists between these 2 users
    if (type === 'DIRECT_MESSAGE' && participantUserIds.length === 1) {
      const targetUserId = participantUserIds[0];
      const existing = await prisma.rdConversation.findFirst({
        where: {
          tenantId,
          type: 'DIRECT_MESSAGE',
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: targetUserId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true, avatar: true },
              },
            },
          },
        },
      });

      if (existing) {
        return existing;
      }
    }

    let defaultTitle = title;
    if (!defaultTitle && type === 'DIRECT_MESSAGE' && participantUserIds.length === 1) {
      const targetUser = await prisma.user.findUnique({
        where: { id: participantUserIds[0] },
        select: { name: true },
      });
      defaultTitle = targetUser ? `Chat with ${targetUser.name}` : 'Direct Message';
    } else if (!defaultTitle) {
      defaultTitle = 'General Collaboration';
    }

    const conversation = await prisma.rdConversation.create({
      data: {
        tenantId,
        projectId: projectId || null,
        type,
        title: defaultTitle,
        topic: topic || null,
        isPrivate: Boolean(isPrivate),
        createdById: userId,
      },
    });

    // Add creator as OWNER
    const allParticipantIds = Array.from(new Set([userId, ...participantUserIds]));
    const participantData = allParticipantIds.map((pId) => ({
      tenantId,
      conversationId: conversation.id,
      userId: pId,
      role: pId === userId ? 'OWNER' : 'MEMBER',
      lastReadAt: pId === userId ? new Date() : null,
    }));

    await prisma.rdConversationParticipant.createMany({
      data: participantData,
      skipDuplicates: true,
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:conversation:created', {
      conversationId: conversation.id,
      title: conversation.title,
      type: conversation.type,
      projectId: conversation.projectId,
    });

    return this.getConversationById(tenantId, conversation.id, userId);
  }

  /**
   * Get single conversation details with participants
   */
  async getConversationById(tenantId, conversationId, userId) {
    const conv = await prisma.rdConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        project: {
          select: { id: true, name: true, status: true, budget: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, avatar: true },
            },
          },
        },
      },
    });

    if (!conv) {
      throw new Error('Conversation not found or access denied.');
    }

    return conv;
  }

  /**
   * Update conversation metadata
   */
  async updateConversation(tenantId, conversationId, userId, data) {
    const conv = await prisma.rdConversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new Error('Conversation not found.');

    const updated = await prisma.rdConversation.update({
      where: { id: conversationId },
      data: {
        title: data.title ?? conv.title,
        topic: data.topic !== undefined ? data.topic : conv.topic,
        isPrivate: data.isPrivate !== undefined ? Boolean(data.isPrivate) : conv.isPrivate,
        isArchived: data.isArchived !== undefined ? Boolean(data.isArchived) : conv.isArchived,
      },
    });

    collaborationSocketRelay.emitToConversation(conversationId, 'rd:conversation:updated', updated);
    return updated;
  }

  /**
   * Add a participant to conversation
   */
  async addParticipant(tenantId, conversationId, userId, targetUserId, role = 'MEMBER') {
    const conv = await prisma.rdConversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new Error('Conversation not found.');

    const participant = await prisma.rdConversationParticipant.upsert({
      where: {
        conversationId_userId: { conversationId, userId: targetUserId },
      },
      update: { role },
      create: {
        tenantId,
        conversationId,
        userId: targetUserId,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
      },
    });

    collaborationSocketRelay.emitToConversation(conversationId, 'rd:participant:added', participant);
    return participant;
  }

  /**
   * Remove a participant from conversation
   */
  async removeParticipant(tenantId, conversationId, userId, targetUserId) {
    await prisma.rdConversationParticipant.deleteMany({
      where: {
        conversationId,
        userId: targetUserId,
        tenantId,
      },
    });

    collaborationSocketRelay.emitToConversation(conversationId, 'rd:participant:removed', {
      conversationId,
      userId: targetUserId,
    });
    return { success: true, message: 'Participant removed successfully.' };
  }

  /**
   * Get messages for conversation with pagination, threading, and attachments
   */
  async getMessages(tenantId, conversationId, userId, query = {}) {
    const { page = 1, limit = 50, parentMessageId, search } = query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {
      tenantId,
      conversationId,
      ...(parentMessageId !== undefined
        ? { parentMessageId: parentMessageId || null }
        : {}),
      ...(search ? { content: { contains: search } } : {}),
    };

    const [messages, total] = await Promise.all([
      prisma.rdMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take,
        skip,
        include: {
          sender: {
            select: { id: true, name: true, email: true, role: true, avatar: true },
          },
          attachments: true,
          _count: {
            select: { replies: true },
          },
        },
      }),
      prisma.rdMessage.count({ where }),
    ]);

    // Update current user's read pointer
    await prisma.rdConversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });

    return {
      messages,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        pages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Send a new message, handle mentions, notify participants, and emit real-time event
   */
  async sendMessage(tenantId, userId, conversationId, data) {
    const {
      content,
      messageType = 'TEXT',
      parentMessageId = null,
      linkedRecordType = null,
      linkedRecordId = null,
      attachments = [],
    } = data;

    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty.');
    }

    const conversation = await prisma.rdConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied.');
    }

    const message = await prisma.rdMessage.create({
      data: {
        tenantId,
        conversationId,
        senderId: userId,
        content: content.trim(),
        messageType,
        parentMessageId: parentMessageId || null,
        linkedRecordType: linkedRecordType || null,
        linkedRecordId: linkedRecordId || null,
        attachments: {
          create: attachments.map((att) => ({
            tenantId,
            fileName: att.fileName || 'Attachment',
            fileUrl: att.fileUrl || '',
            fileType: att.fileType || 'application/octet-stream',
            fileSize: att.fileSize || 0,
          })),
        },
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        attachments: true,
      },
    });

    // Update conversation timestamp & sender's read pointer
    await Promise.all([
      prisma.rdConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      prisma.rdConversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: new Date() },
      }),
    ]);

    // Process @mentions (e.g., @User or @email)
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
        if (mUser.id !== userId) {
          await prisma.rdMention.create({
            data: {
              tenantId,
              sourceType: 'MESSAGE',
              sourceId: message.id,
              mentionedUserId: mUser.id,
              createdById: userId,
            },
          });

          await rdNotificationService.createNotification(tenantId, {
            userId: mUser.id,
            type: 'MENTION',
            title: `${message.sender?.name || 'Someone'} mentioned you`,
            message: content.substring(0, 120),
            linkUrl: `/crm/rd/collaboration?conversationId=${conversationId}`,
            recordType: 'CONVERSATION',
            recordId: conversationId,
          });
        }
      }
    }

    // Broadcast to conversation room and tenant
    collaborationSocketRelay.emitToConversation(conversationId, 'rd:message:new', message);
    collaborationSocketRelay.emitToTenant(tenantId, 'rd:conversation:message_preview', {
      conversationId,
      messageId: message.id,
      senderName: message.sender?.name,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
    });

    return message;
  }

  /**
   * Edit a message
   */
  async editMessage(tenantId, messageId, userId, newContent) {
    if (!newContent || !newContent.trim()) {
      throw new Error('Updated content cannot be empty.');
    }

    const message = await prisma.rdMessage.findFirst({
      where: { id: messageId, tenantId },
    });

    if (!message) throw new Error('Message not found.');
    if (message.senderId !== userId) {
      throw new Error('Unauthorized: You can only edit your own messages.');
    }

    const updated = await prisma.rdMessage.update({
      where: { id: messageId },
      data: {
        content: newContent.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        attachments: true,
      },
    });

    collaborationSocketRelay.emitToConversation(message.conversationId, 'rd:message:updated', updated);
    return updated;
  }

  /**
   * Delete a message (soft deletion)
   */
  async deleteMessage(tenantId, messageId, userId) {
    const message = await prisma.rdMessage.findFirst({
      where: { id: messageId, tenantId },
    });

    if (!message) throw new Error('Message not found.');
    if (message.senderId !== userId) {
      throw new Error('Unauthorized: You can only delete your own messages.');
    }

    const deleted = await prisma.rdMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: '[This message was deleted by user]',
      },
    });

    collaborationSocketRelay.emitToConversation(message.conversationId, 'rd:message:deleted', {
      messageId,
      conversationId: message.conversationId,
    });
    return deleted;
  }

  /**
   * Pin or unpin a message
   */
  async pinMessage(tenantId, messageId, userId, isPinned = true) {
    const message = await prisma.rdMessage.findFirst({
      where: { id: messageId, tenantId },
    });
    if (!message) throw new Error('Message not found.');

    const updated = await prisma.rdMessage.update({
      where: { id: messageId },
      data: { isPinned: Boolean(isPinned) },
    });

    collaborationSocketRelay.emitToConversation(message.conversationId, 'rd:message:pinned', {
      messageId,
      isPinned: updated.isPinned,
      conversationId: message.conversationId,
    });
    return updated;
  }

  /**
   * Search messages across all accessible conversations
   */
  async searchMessages(tenantId, userId, query = {}) {
    const { term, projectId } = query;
    if (!term || !term.trim()) return [];

    return prisma.rdMessage.findMany({
      where: {
        tenantId,
        isDeleted: false,
        content: { contains: term.trim() },
        conversation: {
          tenantId,
          ...(projectId ? { projectId } : {}),
          OR: [
            { participants: { some: { userId } } },
            { isPrivate: false },
          ],
        },
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        conversation: {
          select: { id: true, title: true, type: true, projectId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

module.exports = new RdCollaborationService();

