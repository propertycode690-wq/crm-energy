const rdCalendarService = require('../services/rdCalendarService');

class RdCalendarController {
  async getEvents(req, res, next) {
    try {
      const data = await rdCalendarService.getEvents(
        req.user.tenantId,
        req.user.userId,
        req.query
      );
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  async createEvent(req, res, next) {
    try {
      const result = await rdCalendarService.createEvent(
        req.user.tenantId,
        req.user.userId,
        req.body
      );
      return res.status(201).json({
        success: true,
        message: 'Calendar event created successfully.',
        data: result.event,
        conflicts: result.conflicts,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const data = await rdCalendarService.updateEvent(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body
      );
      return res.status(200).json({
        success: true,
        message: 'Calendar event updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req, res, next) {
    try {
      const data = await rdCalendarService.deleteEvent(
        req.user.tenantId,
        req.params.id,
        req.user.userId
      );
      return res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async respondInvitation(req, res, next) {
    try {
      const { status } = req.body;
      const data = await rdCalendarService.respondToInvitation(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        status
      );
      return res.status(200).json({
        success: true,
        message: `Invitation response recorded as ${status}.`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkConflicts(req, res, next) {
    try {
      const { userIds, startTime, endTime } = req.body;
      const conflicts = await rdCalendarService.checkConflicts(
        req.user.tenantId,
        userIds,
        startTime,
        endTime,
        req.query.excludeEventId
      );
      return res.status(200).json({
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdCalendarController();

