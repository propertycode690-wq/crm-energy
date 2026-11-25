const rdGovernanceOpsService = require('../services/rdGovernanceOpsService');

class RdGovernanceOpsController {
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
      const data = await rdGovernanceOpsService.getGovernanceOverview(tenantId, req.query.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 1. DECISIONS (Req 31)
  // ==============================================================================

  async listDecisions(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const decisions = await rdGovernanceOpsService.listDecisions(tenantId, req.query);
      res.json({ success: true, data: decisions });
    } catch (err) {
      next(err);
    }
  }

  async createDecision(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        decisionMakerName: req.body.decisionMakerName || user?.name || user?.email,
      };
      const decision = await rdGovernanceOpsService.createDecision(tenantId, userId, payload);
      res.status(201).json({ success: true, data: decision, message: 'Decision registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getDecision(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const decision = await rdGovernanceOpsService.getDecision(tenantId, req.params.id);
      res.json({ success: true, data: decision });
    } catch (err) {
      next(err);
    }
  }

  async updateDecision(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const decision = await rdGovernanceOpsService.updateDecision(tenantId, userId, req.params.id, {
        ...req.body,
        changedByName: user?.name || user?.email,
      });
      res.json({ success: true, data: decision, message: 'Decision updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async updateDecisionStatus(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { status, comment } = req.body;
      const decision = await rdGovernanceOpsService.updateDecisionStatus(
        tenantId,
        userId,
        req.params.id,
        status,
        comment,
        user?.name || user?.email
      );
      res.json({ success: true, data: decision, message: `Decision status changed to ${status}.` });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 2. RISKS & 5x5 MATRIX (Req 32 & 33)
  // ==============================================================================

  async listRisks(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const risks = await rdGovernanceOpsService.listRisks(tenantId, req.query);
      res.json({ success: true, data: risks });
    } catch (err) {
      next(err);
    }
  }

  async createRisk(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const risk = await rdGovernanceOpsService.createRisk(tenantId, userId, payload);
      res.status(201).json({ success: true, data: risk, message: 'Risk identified and scored successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getRisk(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const risk = await rdGovernanceOpsService.getRisk(tenantId, req.params.id);
      res.json({ success: true, data: risk });
    } catch (err) {
      next(err);
    }
  }

  async updateRisk(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const risk = await rdGovernanceOpsService.updateRisk(tenantId, userId, req.params.id, req.body);
      res.json({ success: true, data: risk, message: 'Risk record updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async reviewRisk(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        reviewerName: user?.name || user?.email,
      };
      const risk = await rdGovernanceOpsService.reviewRisk(tenantId, userId, req.params.id, payload);
      res.json({ success: true, data: risk, message: 'Risk review and scoring reassessment completed.' });
    } catch (err) {
      next(err);
    }
  }

  async getRiskMatrix(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const matrix = await rdGovernanceOpsService.getRiskMatrix(tenantId, req.query.projectId);
      res.json({ success: true, data: matrix });
    } catch (err) {
      next(err);
    }
  }

  async addRiskMitigation(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const mitigation = await rdGovernanceOpsService.addRiskMitigation(tenantId, userId, req.params.id, payload);
      res.status(201).json({ success: true, data: mitigation, message: 'Mitigation action registered.' });
    } catch (err) {
      next(err);
    }
  }

  async updateRiskMitigation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const mitigation = await rdGovernanceOpsService.updateRiskMitigation(tenantId, req.params.mitigationId, req.body);
      res.json({ success: true, data: mitigation, message: 'Mitigation action updated.' });
    } catch (err) {
      next(err);
    }
  }

  async deleteRiskMitigation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      await rdGovernanceOpsService.deleteRiskMitigation(tenantId, req.params.mitigationId);
      res.json({ success: true, message: 'Mitigation action deleted.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 3. ISSUES (Req 34)
  // ==============================================================================

  async listIssues(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const issues = await rdGovernanceOpsService.listIssues(tenantId, req.query);
      res.json({ success: true, data: issues });
    } catch (err) {
      next(err);
    }
  }

  async createIssue(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const issue = await rdGovernanceOpsService.createIssue(tenantId, userId, payload);
      res.status(201).json({ success: true, data: issue, message: 'Issue registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getIssue(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const issue = await rdGovernanceOpsService.getIssue(tenantId, req.params.id);
      res.json({ success: true, data: issue });
    } catch (err) {
      next(err);
    }
  }

  async updateIssue(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const issue = await rdGovernanceOpsService.updateIssue(tenantId, req.params.id, req.body);
      res.json({ success: true, data: issue, message: 'Issue updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async updateIssueStatus(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { status, resolution, comment } = req.body;
      const issue = await rdGovernanceOpsService.updateIssueStatus(
        tenantId,
        userId,
        req.params.id,
        status,
        resolution,
        comment,
        user?.name || user?.email
      );
      res.json({ success: true, data: issue, message: `Issue status updated to ${status}.` });
    } catch (err) {
      next(err);
    }
  }

  async addIssueComment(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { commentText, isInternalOnly } = req.body;
      const comment = await rdGovernanceOpsService.addIssueComment(
        tenantId,
        userId,
        req.params.id,
        commentText,
        user?.name || user?.email,
        isInternalOnly
      );
      res.status(201).json({ success: true, data: comment, message: 'Comment added.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 4. CHANGE REQUESTS (Req 35)
  // ==============================================================================

  async listChangeRequests(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const changes = await rdGovernanceOpsService.listChangeRequests(tenantId, req.query);
      res.json({ success: true, data: changes });
    } catch (err) {
      next(err);
    }
  }

  async createChangeRequest(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        requesterName: req.body.requesterName || user?.name || user?.email,
      };
      const cr = await rdGovernanceOpsService.createChangeRequest(tenantId, userId, payload);
      res.status(201).json({ success: true, data: cr, message: 'Change request submitted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getChangeRequest(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const cr = await rdGovernanceOpsService.getChangeRequest(tenantId, req.params.id);
      res.json({ success: true, data: cr });
    } catch (err) {
      next(err);
    }
  }

  async updateChangeRequest(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const cr = await rdGovernanceOpsService.updateChangeRequest(tenantId, req.params.id, req.body);
      res.json({ success: true, data: cr, message: 'Change request updated.' });
    } catch (err) {
      next(err);
    }
  }

  async reviewChangeRequest(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { decision, comments } = req.body;
      const cr = await rdGovernanceOpsService.reviewChangeRequest(
        tenantId,
        userId,
        req.params.id,
        decision,
        comments,
        user?.name || user?.email
      );
      res.json({ success: true, data: cr, message: `Change request ${decision}.` });
    } catch (err) {
      next(err);
    }
  }

  async implementChangeRequest(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const { notes } = req.body;
      const cr = await rdGovernanceOpsService.implementChangeRequest(tenantId, userId, req.params.id, notes);
      res.json({ success: true, data: cr, message: 'Change request marked as implemented.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 5. REQUIREMENTS & TRACEABILITY (Req 36)
  // ==============================================================================

  async listRequirements(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const requirements = await rdGovernanceOpsService.listRequirements(tenantId, req.query);
      res.json({ success: true, data: requirements });
    } catch (err) {
      next(err);
    }
  }

  async createRequirement(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const requirement = await rdGovernanceOpsService.createRequirement(tenantId, userId, payload);
      res.status(201).json({ success: true, data: requirement, message: 'Requirement registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getRequirement(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const requirement = await rdGovernanceOpsService.getRequirement(tenantId, req.params.id);
      res.json({ success: true, data: requirement });
    } catch (err) {
      next(err);
    }
  }

  async updateRequirement(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const requirement = await rdGovernanceOpsService.updateRequirement(tenantId, req.params.id, req.body);
      res.json({ success: true, data: requirement, message: 'Requirement updated.' });
    } catch (err) {
      next(err);
    }
  }

  async addCriterionToRequirement(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const criterion = await rdGovernanceOpsService.addCriterionToRequirement(tenantId, req.params.id, req.body);
      res.status(201).json({ success: true, data: criterion, message: 'Acceptance criterion added.' });
    } catch (err) {
      next(err);
    }
  }

  async verifyRequirementCriterion(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        verifiedByName: user?.name || user?.email,
      };
      const criterion = await rdGovernanceOpsService.verifyRequirementCriterion(tenantId, userId, req.params.criterionId, payload);
      res.json({ success: true, data: criterion, message: 'Criterion verification status updated.' });
    } catch (err) {
      next(err);
    }
  }

  async getTraceabilityMatrix(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const matrix = await rdGovernanceOpsService.getTraceabilityMatrix(tenantId, req.query.projectId);
      res.json({ success: true, data: matrix });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 6. SCOPE BASELINES & WBS (Req 37)
  // ==============================================================================

  async getScopeBaselines(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const baselines = await rdGovernanceOpsService.getScopeBaselines(tenantId, req.query.projectId);
      res.json({ success: true, data: baselines });
    } catch (err) {
      next(err);
    }
  }

  async createScopeBaseline(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        approvedByName: req.body.status === 'APPROVED' ? (user?.name || user?.email) : null,
      };
      const baseline = await rdGovernanceOpsService.createScopeBaseline(tenantId, userId, payload);
      res.status(201).json({ success: true, data: baseline, message: 'Scope baseline established.' });
    } catch (err) {
      next(err);
    }
  }

  async getWbs(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const wbs = await rdGovernanceOpsService.getWbsItems(tenantId, req.query.projectId);
      res.json({ success: true, data: wbs });
    } catch (err) {
      next(err);
    }
  }

  async createWbsItem(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const item = await rdGovernanceOpsService.createWbsItem(tenantId, userId, payload);
      res.status(201).json({ success: true, data: item, message: 'WBS node created.' });
    } catch (err) {
      next(err);
    }
  }

  async updateWbsItem(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const item = await rdGovernanceOpsService.updateWbsItem(tenantId, req.params.id, req.body);
      res.json({ success: true, data: item, message: 'WBS node updated.' });
    } catch (err) {
      next(err);
    }
  }

  async deleteWbsItem(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      await rdGovernanceOpsService.deleteWbsItem(tenantId, req.params.id);
      res.json({ success: true, message: 'WBS node deleted.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 7. DELIVERABLES (Req 38)
  // ==============================================================================

  async listDeliverables(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const deliverables = await rdGovernanceOpsService.listDeliverables(tenantId, req.query);
      res.json({ success: true, data: deliverables });
    } catch (err) {
      next(err);
    }
  }

  async createDeliverable(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        ownerName: req.body.ownerName || user?.name || user?.email,
      };
      const del = await rdGovernanceOpsService.createDeliverable(tenantId, userId, payload);
      res.status(201).json({ success: true, data: del, message: 'Deliverable registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getDeliverable(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const del = await rdGovernanceOpsService.getDeliverable(tenantId, req.params.id);
      res.json({ success: true, data: del });
    } catch (err) {
      next(err);
    }
  }

  async updateDeliverable(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const del = await rdGovernanceOpsService.updateDeliverable(tenantId, req.params.id, req.body);
      res.json({ success: true, data: del, message: 'Deliverable updated.' });
    } catch (err) {
      next(err);
    }
  }

  async submitDeliverable(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const del = await rdGovernanceOpsService.submitDeliverable(tenantId, userId, req.params.id, req.body);
      res.json({ success: true, data: del, message: 'Deliverable submitted for review.' });
    } catch (err) {
      next(err);
    }
  }

  async reviewDeliverable(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { decision, notes } = req.body;
      const del = await rdGovernanceOpsService.reviewDeliverable(
        tenantId,
        userId,
        req.params.id,
        decision,
        notes,
        user?.name || user?.email
      );
      res.json({ success: true, data: del, message: `Deliverable ${decision}.` });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 8. QUALITY CHECKPOINTS (Req 39)
  // ==============================================================================

  async listQualityCheckpoints(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const checkpoints = await rdGovernanceOpsService.listQualityCheckpoints(tenantId, req.query);
      res.json({ success: true, data: checkpoints });
    } catch (err) {
      next(err);
    }
  }

  async createQualityCheckpoint(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        leadInspectorName: req.body.leadInspectorName || user?.name || user?.email,
      };
      const qc = await rdGovernanceOpsService.createQualityCheckpoint(tenantId, userId, payload);
      res.status(201).json({ success: true, data: qc, message: 'Quality checkpoint established.' });
    } catch (err) {
      next(err);
    }
  }

  async getQualityCheckpoint(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const qc = await rdGovernanceOpsService.getQualityCheckpoint(tenantId, req.params.id);
      res.json({ success: true, data: qc });
    } catch (err) {
      next(err);
    }
  }

  async addCriterionToCheckpoint(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const criterion = await rdGovernanceOpsService.addCriterionToCheckpoint(tenantId, req.params.id, req.body);
      res.status(201).json({ success: true, data: criterion, message: 'Inspection criterion added.' });
    } catch (err) {
      next(err);
    }
  }

  async evaluateQualityCriterion(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        verifiedByName: user?.name || user?.email,
      };
      const criterion = await rdGovernanceOpsService.evaluateQualityCriterion(tenantId, userId, req.params.criterionId, payload);
      res.json({ success: true, data: criterion, message: 'Criterion inspection evaluated.' });
    } catch (err) {
      next(err);
    }
  }

  async conductQualityCheckpoint(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const result = await rdGovernanceOpsService.conductQualityCheckpoint(tenantId, userId, req.params.id, req.body);
      res.json({ success: true, data: result, message: 'Quality checkpoint audit completed.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 9. BUDGETS & FINANCIAL CONTROLS (Req 40)
  // ==============================================================================

  async listBudgets(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const budgets = await rdGovernanceOpsService.listBudgets(tenantId, req.query);
      res.json({ success: true, data: budgets });
    } catch (err) {
      next(err);
    }
  }

  async createBudget(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const budget = await rdGovernanceOpsService.createBudget(tenantId, userId, req.body);
      res.status(201).json({ success: true, data: budget, message: 'Project budget created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getBudget(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const budget = await rdGovernanceOpsService.getBudget(tenantId, req.params.id);
      res.json({ success: true, data: budget });
    } catch (err) {
      next(err);
    }
  }

  async updateBudget(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const budget = await rdGovernanceOpsService.updateBudget(tenantId, req.params.id, req.body);
      res.json({ success: true, data: budget, message: 'Budget parameters updated.' });
    } catch (err) {
      next(err);
    }
  }

  async addBudgetAllocation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const allocation = await rdGovernanceOpsService.addBudgetAllocation(tenantId, req.params.id, req.body);
      res.status(201).json({ success: true, data: allocation, message: 'Budget allocation added.' });
    } catch (err) {
      next(err);
    }
  }

  async updateBudgetAllocation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const allocation = await rdGovernanceOpsService.updateBudgetAllocation(tenantId, req.params.allocationId, req.body);
      res.json({ success: true, data: allocation, message: 'Budget allocation updated.' });
    } catch (err) {
      next(err);
    }
  }

  async deleteBudgetAllocation(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      await rdGovernanceOpsService.deleteBudgetAllocation(tenantId, req.params.allocationId);
      res.json({ success: true, message: 'Budget allocation removed.' });
    } catch (err) {
      next(err);
    }
  }

  async approveBudget(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { approvalNotes } = req.body;
      const budget = await rdGovernanceOpsService.approveBudget(
        tenantId,
        userId,
        req.params.id,
        approvalNotes,
        user?.name || user?.email
      );
      res.json({ success: true, data: budget, message: 'Project budget formally approved.' });
    } catch (err) {
      next(err);
    }
  }

  async requestBudgetRevision(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const payload = {
        ...req.body,
        requestedByName: user?.name || user?.email,
      };
      const revision = await rdGovernanceOpsService.requestBudgetRevision(tenantId, userId, req.params.id, payload);
      res.status(201).json({ success: true, data: revision, message: 'Budget revision request submitted.' });
    } catch (err) {
      next(err);
    }
  }

  async reviewBudgetRevision(req, res, next) {
    try {
      const { tenantId, userId, user } = this._getContext(req);
      const { decision, reviewNotes } = req.body;
      const revision = await rdGovernanceOpsService.reviewBudgetRevision(
        tenantId,
        userId,
        req.params.revisionId,
        decision,
        reviewNotes,
        user?.name || user?.email
      );
      res.json({ success: true, data: revision, message: `Budget revision ${decision}.` });
    } catch (err) {
      next(err);
    }
  }

  async getBudgetSummary(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const summary = await rdGovernanceOpsService.getBudgetSummary(tenantId, req.params.id);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RdGovernanceOpsController();
