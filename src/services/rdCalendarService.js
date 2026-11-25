const prisma = require('../config/prisma');
const collaborationSocketRelay = require('./collaborationSocketRelay');
const rdNotificationService = require('./rdNotificationService');

class RdCalendarService {
  /**
   * Get calendar events with optional filtering by project, type, date range, or participant
   */
  async getEvents(tenantId, userId, query = {}) {
    const { projectId, eventType, startDate, endDate, myEventsOnly, search } = query;

    const where = {
      tenantId,
      status: { not: 'CANCELLED' },
      ...(projectId ? { projectId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(startDate || endDate
        ? {
            AND: [
              startDate ? { endTime: { gte: new Date(startDate) } } : {},
              endDate ? { startTime: { lte: new Date(endDate) } } : {},
            ],
          }
        : {}),
      ...(myEventsOnly === 'true'
        ? {
            OR: [
              { createdById: userId },
              { participants: { some: { userId } } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { location: { contains: search } },
            ],
          }
        : {}),
    };

    const events = await prisma.rdCalendarEvent.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
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
      },
      orderBy: { startTime: 'asc' },
    });

    return events;
  }

  /**
   * Check for schedule conflicts for a set of users during a time slot
   */
  async checkConflicts(tenantId, userIds = [], startTime, endTime, excludeEventId = null) {
    if (!userIds || userIds.length === 0) return [];

    const start = new Date(startTime);
    const end = new Date(endTime);

    const conflictingEvents = await prisma.rdCalendarEvent.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
        startTime: { lt: end },
        endTime: { gt: start },
        OR: [
          { createdById: { in: userIds } },
          { participants: { some: { userId: { in: userIds }, status: { in: ['ACCEPTED', 'PENDING'] } } } },
        ],
      },
      include: {
        creator: { select: { id: true, name: true } },
        participants: {
          where: { userId: { in: userIds } },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return conflictingEvents.map((ev) => ({
      eventId: ev.id,
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime,
      conflictedUsers: [
        ...(userIds.includes(ev.createdById) ? [ev.creator] : []),
        ...ev.participants.map((p) => p.user).filter(Boolean),
      ],
    }));
  }

  /**
   * Create a new calendar event with participants
   */
  async createEvent(tenantId, userId, data) {
    const {
      title,
      description,
      eventType = 'PROJECT_MEETING',
      projectId = null,
      location = null,
      meetingUrl = null,
      startTime,
      endTime,
      allDay = false,
      isRecurring = false,
      recurrenceRule = null,
      participantUserIds = [],
    } = data;

    if (!title || !startTime || !endTime) {
      throw new Error('Title, start time, and end time are required.');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      throw new Error('End time must be after start time.');
    }

    // Check conflicts for invitees
    const allUserIds = Array.from(new Set([userId, ...participantUserIds]));
    const conflicts = await this.checkConflicts(tenantId, allUserIds, start, end);

    const event = await prisma.rdCalendarEvent.create({
      data: {
        tenantId,
        createdById: userId,
        projectId: projectId || null,
        title: title.trim(),
        description: description || null,
        eventType,
        location: location || null,
        meetingUrl: meetingUrl || null,
        startTime: start,
        endTime: end,
        allDay: Boolean(allDay),
        isRecurring: Boolean(isRecurring),
        recurrenceRule: recurrenceRule || null,
        status: 'CONFIRMED',
        participants: {
          create: allUserIds.map((uId) => ({
            tenantId,
            userId: uId,
            isHost: uId === userId,
            status: uId === userId ? 'ACCEPTED' : 'PENDING',
          })),
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, role: true, avatar: true },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    });

    // Notify participants
    for (const pId of participantUserIds) {
      if (pId !== userId) {
        await rdNotificationService.createNotification(tenantId, {
          userId: pId,
          type: 'CALENDAR_INVITE',
          title: `Calendar Invite: ${title}`,
          message: `${event.creator?.name || 'Someone'} invited you to ${title} on ${start.toLocaleDateString()}`,
          linkUrl: `/crm/rd/calendar?eventId=${event.id}`,
          recordType: 'CALENDAR_EVENT',
          recordId: event.id,
        });
      }
    }

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:calendar:event_created', event);

    return {
      event,
      conflicts,
    };
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(tenantId, eventId, userId, data) {
    const existing = await prisma.rdCalendarEvent.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!existing) throw new Error('Calendar event not found.');

    const updated = await prisma.rdCalendarEvent.update({
      where: { id: eventId },
      data: {
        title: data.title ?? existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        eventType: data.eventType ?? existing.eventType,
        location: data.location !== undefined ? data.location : existing.location,
        meetingUrl: data.meetingUrl !== undefined ? data.meetingUrl : existing.meetingUrl,
        startTime: data.startTime ? new Date(data.startTime) : existing.startTime,
        endTime: data.endTime ? new Date(data.endTime) : existing.endTime,
        allDay: data.allDay !== undefined ? Boolean(data.allDay) : existing.allDay,
        status: data.status ?? existing.status,
      },
      include: {
        creator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:calendar:event_updated', updated);
    return updated;
  }

  /**
   * Delete or cancel an event
   */
  async deleteEvent(tenantId, eventId, userId) {
    const existing = await prisma.rdCalendarEvent.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!existing) throw new Error('Event not found.');

    await prisma.rdCalendarEvent.update({
      where: { id: eventId },
      data: { status: 'CANCELLED' },
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:calendar:event_deleted', { eventId });
    return { success: true, message: 'Event cancelled successfully.' };
  }

  /**
   * Respond to an invitation (ACCEPTED, DECLINED, TENTATIVE)
   */
  async respondToInvitation(tenantId, eventId, userId, status) {
    const validStatuses = ['ACCEPTED', 'DECLINED', 'TENTATIVE'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const participant = await prisma.rdCalendarParticipant.findFirst({
      where: { eventId, userId, tenantId },
    });

    if (!participant) {
      throw new Error('You are not invited to this event.');
    }

    const updated = await prisma.rdCalendarParticipant.update({
      where: { id: participant.id },
      data: { status },
    });

    collaborationSocketRelay.emitToTenant(tenantId, 'rd:calendar:participant_status', {
      eventId,
      userId,
      status,
    });

    return updated;
  }
}

module.exports = new RdCalendarService();

