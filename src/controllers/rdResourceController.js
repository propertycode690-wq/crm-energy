const rdResourceService = require('../services/rdResourceService');

class RdResourceController {
  _getContext(req) {
    const tenantId = req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];
    if (!tenantId) {
      const err = new Error('Authentication required: Tenant context missing.');
      err.statusCode = 401;
      throw err;
    }
    return { tenantId, userId, user: req.user };
  }

  // ==============================================================================
  // OVERVIEW
  // ==============================================================================

  async getOverview(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getResourceOverview(tenantId, req.query.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 1. RESOURCE PROFILES (Req 51)
  // ==============================================================================

  async listProfiles(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listResourceProfiles(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getResourceProfile(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.updateResourceProfile(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 2. RESOURCE ALLOCATIONS (Req 51, 53)
  // ==============================================================================

  async listAllocations(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listAllocations(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createAllocation(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const assignedByName = user?.name || user?.email || 'Resource Manager';
      const data = await rdResourceService.createAllocation(tenantId, userId, assignedByName, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateAllocation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.updateAllocation(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteAllocation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.deleteAllocation(tenantId, req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 3. SKILL MATRIX & EXPERTISE MAPPING (Req 52)
  // ==============================================================================

  async listSkills(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listSkills(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createSkill(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.createSkill(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateSkill(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.updateSkill(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async upsertEmployeeSkill(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const payload = {
        userId: req.body.userId || userId,
        ...req.body,
      };
      const data = await rdResourceService.upsertEmployeeSkill(tenantId, payload);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async verifyEmployeeSkill(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const verifiedByName = user?.name || user?.email || 'Skill Evaluator';
      const data = await rdResourceService.verifyEmployeeSkill(
        tenantId,
        req.params.id,
        userId,
        verifiedByName
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteEmployeeSkill(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.deleteEmployeeSkill(tenantId, req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async getSkillMatrix(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getSkillMatrix(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async searchResourcesBySkills(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.searchResourcesBySkills(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 4. TEAM CAPACITY PLANNING (Req 53)
  // ==============================================================================

  async getCapacityPlanning(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getCapacityPlanning(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 5. TIMESHEETS & TIME TRACKING (Req 54)
  // ==============================================================================

  async listTimesheets(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listTimesheets(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getTimesheet(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getTimesheet(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getOrCreateWeeklyTimesheet(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const targetUserId = req.query.userId || userId;
      const weekStartDate = req.query.weekStartDate || new Date().toISOString().substring(0, 10);
      const data = await rdResourceService.getOrCreateWeeklyTimesheet(tenantId, targetUserId, weekStartDate);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async addTimeEntry(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const timesheetId = req.params.id;
      const targetUserId = req.body.userId || userId;
      const data = await rdResourceService.addTimeEntry(tenantId, targetUserId, timesheetId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteTimeEntry(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.deleteTimeEntry(tenantId, req.params.entryId);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async submitTimesheet(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const userName = user?.name || user?.email || 'Employee';
      const data = await rdResourceService.submitTimesheet(tenantId, req.params.id, userId, userName);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async approveTimesheet(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const reviewerName = user?.name || user?.email || 'R&D Approver';
      const data = await rdResourceService.approveTimesheet(
        tenantId,
        req.params.id,
        userId,
        reviewerName,
        req.body.notes
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async rejectTimesheet(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const reviewerName = user?.name || user?.email || 'R&D Approver';
      const data = await rdResourceService.rejectTimesheet(
        tenantId,
        req.params.id,
        userId,
        reviewerName,
        req.body.reason
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 6. COST & BUDGET INTEGRATION (Req 55, 56, 57)
  // ==============================================================================

  async getProjectLaborCostSummary(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getProjectLaborCostSummary(tenantId, req.params.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 7. RESOURCE UTILIZATION METRICS (Req 58)
  // ==============================================================================

  async getUtilizationMetrics(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getUtilizationMetrics(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 8. SHARED LAB FACILITIES & EQUIPMENT (Req 59)
  // ==============================================================================

  async listFacilities(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listFacilities(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getFacility(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getFacility(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createFacility(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.createFacility(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateFacility(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.updateFacility(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteFacility(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.deleteFacility(tenantId, req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  // Equipment
  async listEquipment(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listEquipment(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getEquipment(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getEquipment(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createEquipment(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.createEquipment(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateEquipment(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.updateEquipment(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteEquipment(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.deleteEquipment(tenantId, req.params.id);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  async scheduleMaintenance(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const performedByName = user?.name || user?.email || 'Maintenance Technician';
      const payload = {
        performedById: userId,
        performedByName,
        ...req.body,
      };
      const data = await rdResourceService.scheduleMaintenance(tenantId, payload);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async completeMaintenance(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.completeMaintenance(tenantId, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 9. FACILITY & EQUIPMENT BOOKINGS (Req 59, 60)
  // ==============================================================================

  async listBookings(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.listBookings(tenantId, req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getBooking(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const data = await rdResourceService.getBooking(tenantId, req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createBooking(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const requestedByName = user?.name || user?.email || 'Researcher';
      const data = await rdResourceService.createBooking(tenantId, userId, requestedByName, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async cancelBooking(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const userName = user?.name || user?.email || 'User';
      const data = await rdResourceService.cancelBooking(
        tenantId,
        req.params.id,
        userId,
        userName,
        req.body.reason
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RdResourceController();
