const prisma = require('../config/prisma');
const collaborationSocketRelay = require('./collaborationSocketRelay');

class RdNotificationService {
  /**
   * Fetch paginated in-app notifications for user with unread count
   */
  async getNotifications(tenantId, userId, query = {}) {
    const { unreadOnly = 'false', page = 1, limit = 30 } = query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {
      tenantId,
      userId,
      ...(unreadOnly === 'true' ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.rdNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.rdNotification.count({ where }),
      prisma.rdNotification.count({
        where: { tenantId, userId, isRead: false },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        unreadCount,
        page: parseInt(page, 10) || 1,
        pages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Create an in-app notification and check preferences
   */
  async createNotification(tenantId, { userId, type, title, message, linkUrl, recordType, recordId }) {
    if (!tenantId || !userId || !title) return null;

    // Check user preferences
    const pref = await prisma.rdNotificationPreference.findUnique({
      where: { userId },
    });

    if (pref) {
      if (pref.inAppNotifications === false) return null;
      if (type === 'MENTION' && pref.mentionNotifications === false) return null;
      if (type === 'CALENDAR_INVITE' && pref.calendarNotifications === false) return null;
    }

    const notification = await prisma.rdNotification.create({
      data: {
        tenantId,
        userId,
        type: type || 'SYSTEM',
        title,
        message: message || '',
        linkUrl: linkUrl || null,
        recordType: recordType || null,
        recordId: recordId || null,
      },
    });

    // Real-time delivery
    collaborationSocketRelay.emitToUser(userId, 'rd:notification:new', notification);

    return notification;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(tenantId, notificationId, userId) {
    const notif = await prisma.rdNotification.findFirst({
      where: { id: notificationId, tenantId, userId },
    });

    if (!notif) {
      throw new Error('Notification not found or access denied.');
    }

    const updated = await prisma.rdNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    collaborationSocketRelay.emitToUser(userId, 'rd:notification:updated', updated);
    return updated;
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(tenantId, userId) {
    await prisma.rdNotification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    collaborationSocketRelay.emitToUser(userId, 'rd:notification:all_read', { userId });
    return { success: true, message: 'All notifications marked as read.' };
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(tenantId, userId) {
    let pref = await prisma.rdNotificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await prisma.rdNotificationPreference.create({
        data: {
          tenantId,
          userId,
          emailNotifications: true,
          inAppNotifications: true,
          mentionNotifications: true,
          calendarNotifications: true,
          slackSync: false,
          teamsSync: false,
        },
      });
    }

    return pref;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(tenantId, userId, data) {
    return prisma.rdNotificationPreference.upsert({
      where: { userId },
      update: {
        emailNotifications: data.emailNotifications ?? true,
        inAppNotifications: data.inAppNotifications ?? true,
        mentionNotifications: data.mentionNotifications ?? true,
        calendarNotifications: data.calendarNotifications ?? true,
        slackSync: data.slackSync ?? false,
        teamsSync: data.teamsSync ?? false,
      },
      create: {
        tenantId,
        userId,
        emailNotifications: data.emailNotifications ?? true,
        inAppNotifications: data.inAppNotifications ?? true,
        mentionNotifications: data.mentionNotifications ?? true,
        calendarNotifications: data.calendarNotifications ?? true,
        slackSync: data.slackSync ?? false,
        teamsSync: data.teamsSync ?? false,
      },
    });
  }
}

module.exports = new RdNotificationService();

