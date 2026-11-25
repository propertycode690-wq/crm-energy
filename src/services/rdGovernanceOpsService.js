const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RdGovernanceOpsService {
  async _logAudit(tenantId, userId, title, description, metadata = {}) {
    try {
      await prisma.activity.create({
        data: {
          tenantId,
          userId: userId || null,
          type: 'NOTE_ADDED',
          title: `[GovernanceOps] ${title}`,
          description,
          metadata,
        },
      });
    } catch (err) {
      console.warn('[RdGovernanceOpsService] Audit logging warning:', err.message);
    }
  }

  // ==============================================================================
  // 1. DECISION LOGS & ARCHITECTURE/STRATEGIC DECISION REGISTRY (Req 31)
  // ==============================================================================

  async listDecisions(tenantId, filters = {}) {
    const { projectId, category, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { decisionCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { rationale: { contains: search.trim() } },
      ];
    }

    return await prisma.rdDecision.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        histories: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDecision(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      category = 'ARCHITECTURE',
      rationale,
      alternativesConsidered,
      tradeOffs,
      impactSummary,
      decisionMakerId,
      decisionMakerName,
      decisionDate,
      effectiveDate,
      reviewDate,
      linkedGateId,
      linkedStageId,
      linkedTaskId,
    } = data;

    if (!projectId || !title || !rationale) {
      throw new Error('Project ID, title, and rationale are required to record a decision.');
    }

    const year = new Date().getFullYear();
    const count = await prisma.rdDecision.count({ where: { tenantId } });
    const decisionCode = data.decisionCode || `DEC-${year}-${String(count + 1).padStart(3, '0')}`;

    const decision = await prisma.rdDecision.create({
      data: {
        tenantId,
        projectId,
        decisionCode,
        title,
        description,
        category,
        rationale,
        alternativesConsidered,
        tradeOffs,
        impactSummary,
        status: data.status || 'PROPOSED',
        decisionMakerId: decisionMakerId || userId,
        decisionMakerName,
        decisionDate: decisionDate ? new Date(decisionDate) : new Date(),
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        linkedGateId,
        linkedStageId,
        linkedTaskId,
        createdById: userId,
        histories: {
          create: {
            tenantId,
            changeType: 'INITIAL_CREATION',
            newStatus: data.status || 'PROPOSED',
            comment: 'Decision proposal created',
            changedById: userId,
            changedByName: decisionMakerName || 'System',
          },
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        histories: true,
      },
    });

    await this._logAudit(tenantId, userId, `Decision Logged: ${decisionCode}`, `Title: ${title} (${category})`);
    return decision;
  }

  async getDecision(tenantId, decisionId) {
    const decision = await prisma.rdDecision.findFirst({
      where: { id: decisionId, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true, budget: true } },
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!decision) throw new Error('Decision record not found.');
    return decision;
  }

  async updateDecision(tenantId, userId, decisionId, data) {
    const existing = await this.getDecision(tenantId, decisionId);

    await prisma.rdDecision.update({
      where: { id: decisionId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        rationale: data.rationale ?? existing.rationale,
        alternativesConsidered: data.alternativesConsidered ?? existing.alternativesConsidered,
        tradeOffs: data.tradeOffs ?? existing.tradeOffs,
        impactSummary: data.impactSummary ?? existing.impactSummary,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : existing.effectiveDate,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : existing.reviewDate,
        decisionMakerId: data.decisionMakerId ?? existing.decisionMakerId,
        decisionMakerName: data.decisionMakerName ?? existing.decisionMakerName,
        linkedGateId: data.linkedGateId ?? existing.linkedGateId,
        linkedStageId: data.linkedStageId ?? existing.linkedStageId,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
      },
    });

    await prisma.rdDecisionHistory.create({
      data: {
        tenantId,
        decisionId,
        changeType: 'CONTENT_UPDATE',
        previousStatus: existing.status,
        newStatus: existing.status,
        comment: data.comment || 'Decision record content updated',
        changedById: userId,
        changedByName: data.changedByName || 'System',
      },
    });

    return await this.getDecision(tenantId, decisionId);
  }

  async updateDecisionStatus(tenantId, userId, decisionId, newStatus, comment, actorName) {
    const existing = await this.getDecision(tenantId, decisionId);
    const validStatuses = ['DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const updated = await prisma.rdDecision.update({
      where: { id: decisionId },
      data: {
        status: newStatus,
        decisionDate: ['APPROVED', 'REJECTED'].includes(newStatus) ? new Date() : existing.decisionDate,
      },
    });

    await prisma.rdDecisionHistory.create({
      data: {
        tenantId,
        decisionId,
        changeType: 'STATUS_CHANGE',
        previousStatus: existing.status,
        newStatus,
        comment: comment || `Status transitioned from ${existing.status} to ${newStatus}`,
        changedById: userId,
        changedByName: actorName || 'System',
      },
    });

    await this._logAudit(tenantId, userId, `Decision Status: ${existing.decisionCode}`, `Changed to ${newStatus}`);
    return this.getDecision(tenantId, decisionId);
  }

  // ==============================================================================
  // 2. RISK REGISTERS, SCORING & 5x5 RISK MATRIX (Req 32 & 33)
  // ==============================================================================

  _calculateRiskMetrics(probability, impact) {
    const p = Math.max(1, Math.min(5, Number(probability) || 1));
    const i = Math.max(1, Math.min(5, Number(impact) || 1));
    const score = p * i;

    let level = 'LOW';
    if (score >= 17) level = 'CRITICAL';
    else if (score >= 10) level = 'HIGH';
    else if (score >= 5) level = 'MODERATE';
    else level = 'LOW';

    return { probability: p, impact: i, riskScore: score, riskLevel: level };
  }

  async listRisks(tenantId, filters = {}) {
    const { projectId, category, riskLevel, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (riskLevel) where.riskLevel = riskLevel;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { riskCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return await prisma.rdRisk.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        mitigations: { orderBy: { createdAt: 'desc' } },
        reviewHistories: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createRisk(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      category = 'TECHNICAL',
      probability = 3,
      impact = 3,
      strategy = 'MITIGATE',
      ownerId,
      ownerName,
      contingencyPlan,
      triggerCondition,
      reviewFrequency = 'MONTHLY',
      nextReviewDate,
      linkedTaskId,
      linkedMilestoneId,
      linkedGateId,
    } = data;

    if (!projectId || !title) {
      throw new Error('Project ID and title are required to register a risk.');
    }

    const { probability: p, impact: i, riskScore, riskLevel } = this._calculateRiskMetrics(probability, impact);

    const year = new Date().getFullYear();
    const count = await prisma.rdRisk.count({ where: { tenantId } });
    const riskCode = data.riskCode || `RSK-${year}-${String(count + 1).padStart(3, '0')}`;

    const risk = await prisma.rdRisk.create({
      data: {
        tenantId,
        projectId,
        riskCode,
        title,
        description,
        category,
        probability: p,
        impact: i,
        riskScore,
        riskLevel,
        status: data.status || 'IDENTIFIED',
        strategy,
        ownerId: ownerId || userId,
        ownerName,
        contingencyPlan,
        triggerCondition,
        reviewFrequency,
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
        linkedTaskId,
        linkedMilestoneId,
        linkedGateId,
        createdById: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        mitigations: true,
      },
    });

    await this._logAudit(tenantId, userId, `Risk Registered: ${riskCode}`, `Level: ${riskLevel} (Score: ${riskScore})`);
    return risk;
  }

  async getRisk(tenantId, riskId) {
    const risk = await prisma.rdRisk.findFirst({
      where: { id: riskId, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true } },
        mitigations: { orderBy: { createdAt: 'desc' } },
        reviewHistories: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!risk) throw new Error('Risk record not found.');
    return risk;
  }

  async updateRisk(tenantId, userId, riskId, data) {
    const existing = await this.getRisk(tenantId, riskId);

    let metrics = {};
    if (data.probability !== undefined || data.impact !== undefined) {
      const p = data.probability !== undefined ? data.probability : existing.probability;
      const i = data.impact !== undefined ? data.impact : existing.impact;
      metrics = this._calculateRiskMetrics(p, i);
    }

    return await prisma.rdRisk.update({
      where: { id: riskId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        strategy: data.strategy ?? existing.strategy,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        contingencyPlan: data.contingencyPlan ?? existing.contingencyPlan,
        triggerCondition: data.triggerCondition ?? existing.triggerCondition,
        status: data.status ?? existing.status,
        reviewFrequency: data.reviewFrequency ?? existing.reviewFrequency,
        nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : existing.nextReviewDate,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
        linkedMilestoneId: data.linkedMilestoneId ?? existing.linkedMilestoneId,
        linkedGateId: data.linkedGateId ?? existing.linkedGateId,
        ...metrics,
      },
      include: {
        mitigations: true,
        reviewHistories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async reviewRisk(tenantId, userId, riskId, data) {
    const existing = await this.getRisk(tenantId, riskId);
    const { newProbability, newImpact, reviewNotes, reviewerName, residualProbability, residualImpact } = data;

    const { probability: p, impact: i, riskScore, riskLevel } = this._calculateRiskMetrics(
      newProbability !== undefined ? newProbability : existing.probability,
      newImpact !== undefined ? newImpact : existing.impact
    );

    let residualScore = null;
    if (residualProbability && residualImpact) {
      residualScore = Math.max(1, Math.min(5, Number(residualProbability))) * Math.max(1, Math.min(5, Number(residualImpact)));
    }

    const updated = await prisma.rdRisk.update({
      where: { id: riskId },
      data: {
        probability: p,
        impact: i,
        riskScore,
        riskLevel,
        residualProbability: residualProbability ? Number(residualProbability) : existing.residualProbability,
        residualImpact: residualImpact ? Number(residualImpact) : existing.residualImpact,
        residualScore: residualScore ?? existing.residualScore,
        lastReviewedAt: new Date(),
        nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : existing.nextReviewDate,
      },
    });

    await prisma.rdRiskReviewHistory.create({
      data: {
        tenantId,
        riskId,
        reviewerId: userId,
        reviewerName: reviewerName || 'Reviewer',
        previousScore: existing.riskScore,
        newScore: riskScore,
        previousLevel: existing.riskLevel,
        newLevel: riskLevel,
        reviewNotes: reviewNotes || 'Periodic risk review completed',
      },
    });

    await this._logAudit(tenantId, userId, `Risk Reviewed: ${existing.riskCode}`, `Updated score ${existing.riskScore} -> ${riskScore} (${riskLevel})`);
    return this.getRisk(tenantId, riskId);
  }

  async getRiskMatrix(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const risks = await prisma.rdRisk.findMany({
      where,
      select: {
        id: true,
        riskCode: true,
        title: true,
        category: true,
        probability: true,
        impact: true,
        riskScore: true,
        riskLevel: true,
        status: true,
        strategy: true,
        ownerName: true,
        project: { select: { id: true, name: true } },
      },
    });

    // 5x5 Grid: probability 1..5 (rows) x impact 1..5 (columns)
    const grid = {};
    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        const key = `${p}_${i}`;
        const score = p * i;
        let level = 'LOW';
        if (score >= 17) level = 'CRITICAL';
        else if (score >= 10) level = 'HIGH';
        else if (score >= 5) level = 'MODERATE';

        grid[key] = {
          probability: p,
          impact: i,
          score,
          level,
          count: 0,
          risks: [],
        };
      }
    }

    const summary = {
      total: risks.length,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      active: 0,
    };

    risks.forEach((risk) => {
      const key = `${risk.probability}_${risk.impact}`;
      if (grid[key]) {
        grid[key].count++;
        grid[key].risks.push(risk);
      }
      if (risk.riskLevel === 'CRITICAL') summary.critical++;
      else if (risk.riskLevel === 'HIGH') summary.high++;
      else if (risk.riskLevel === 'MODERATE') summary.moderate++;
      else summary.low++;

      if (!['RETIRED', 'MATERIALIZED'].includes(risk.status)) {
        summary.active++;
      }
    });

    return { grid, summary, rawRisks: risks };
  }

  async addRiskMitigation(tenantId, userId, riskId, data) {
    await this.getRisk(tenantId, riskId);
    const { actionTitle, actionDescription, ownerId, ownerName, dueDate, status, progressPercent, effectiveness } = data;

    if (!actionTitle) throw new Error('Mitigation action title is required.');

    return await prisma.rdRiskMitigation.create({
      data: {
        tenantId,
        riskId,
        actionTitle,
        actionDescription,
        ownerId: ownerId || userId,
        ownerName,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'PLANNED',
        progressPercent: Number(progressPercent) || 0,
        effectiveness,
      },
    });
  }

  async updateRiskMitigation(tenantId, mitigationId, data) {
    const existing = await prisma.rdRiskMitigation.findFirst({
      where: { id: mitigationId, tenantId },
    });
    if (!existing) throw new Error('Risk mitigation action not found.');

    const isCompleted = data.status === 'COMPLETED' || data.progressPercent === 100;

    return await prisma.rdRiskMitigation.update({
      where: { id: mitigationId },
      data: {
        actionTitle: data.actionTitle ?? existing.actionTitle,
        actionDescription: data.actionDescription ?? existing.actionDescription,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        status: data.status ?? existing.status,
        progressPercent: data.progressPercent !== undefined ? Number(data.progressPercent) : existing.progressPercent,
        effectiveness: data.effectiveness ?? existing.effectiveness,
        completedAt: isCompleted ? (existing.completedAt || new Date()) : null,
      },
    });
  }

  async deleteRiskMitigation(tenantId, mitigationId) {
    const existing = await prisma.rdRiskMitigation.findFirst({
      where: { id: mitigationId, tenantId },
    });
    if (!existing) throw new Error('Risk mitigation action not found.');

    await prisma.rdRiskMitigation.delete({ where: { id: mitigationId } });
    return { success: true };
  }

  // ==============================================================================
  // 3. ISSUE TRACKING & RESOLUTION (Req 34)
  // ==============================================================================

  async listIssues(tenantId, filters = {}) {
    const { projectId, category, priority, severity, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { issueCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { rootCause: { contains: search.trim() } },
      ];
    }

    return await prisma.rdIssue.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createIssue(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      category = 'TECHNICAL',
      priority = 'MEDIUM',
      severity = 'MEDIUM',
      rootCause,
      ownerId,
      ownerName,
      assigneeId,
      assigneeName,
      sourceRiskId,
      linkedTaskId,
      linkedExperimentId,
    } = data;

    if (!projectId || !title) {
      throw new Error('Project ID and title are required to register an issue.');
    }

    const year = new Date().getFullYear();
    const count = await prisma.rdIssue.count({ where: { tenantId } });
    const issueCode = data.issueCode || `ISS-${year}-${String(count + 1).padStart(3, '0')}`;

    const issue = await prisma.rdIssue.create({
      data: {
        tenantId,
        projectId,
        issueCode,
        title,
        description,
        category,
        priority,
        severity,
        status: data.status || 'OPEN',
        rootCause,
        ownerId: ownerId || userId,
        ownerName,
        assigneeId: assigneeId || null,
        assigneeName,
        sourceRiskId,
        linkedTaskId,
        linkedExperimentId,
        createdById: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        comments: true,
      },
    });

    await this._logAudit(tenantId, userId, `Issue Logged: ${issueCode}`, `Title: ${title} [${priority}/${severity}]`);
    return issue;
  }

  async getIssue(tenantId, issueId) {
    const issue = await prisma.rdIssue.findFirst({
      where: { id: issueId, tenantId },
      include: {
        project: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!issue) throw new Error('Issue not found.');
    return issue;
  }

  async updateIssue(tenantId, issueId, data) {
    const existing = await this.getIssue(tenantId, issueId);

    return await prisma.rdIssue.update({
      where: { id: issueId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        priority: data.priority ?? existing.priority,
        severity: data.severity ?? existing.severity,
        rootCause: data.rootCause ?? existing.rootCause,
        resolution: data.resolution ?? existing.resolution,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        assigneeId: data.assigneeId ?? existing.assigneeId,
        assigneeName: data.assigneeName ?? existing.assigneeName,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
        linkedExperimentId: data.linkedExperimentId ?? existing.linkedExperimentId,
      },
      include: { comments: true },
    });
  }

  async updateIssueStatus(tenantId, userId, issueId, newStatus, resolution, comment, authorName) {
    const existing = await this.getIssue(tenantId, issueId);
    const validStatuses = ['OPEN', 'UNDER_INVESTIGATION', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WONT_FIX'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid issue status: ${newStatus}`);
    }

    const updates = { status: newStatus };
    if (resolution) updates.resolution = resolution;
    if (newStatus === 'RESOLVED') updates.resolvedAt = new Date();
    if (newStatus === 'CLOSED') {
      updates.closedAt = new Date();
      if (!existing.resolvedAt) updates.resolvedAt = new Date();
    }

    const updated = await prisma.rdIssue.update({
      where: { id: issueId },
      data: updates,
    });

    if (comment || resolution) {
      await prisma.rdIssueComment.create({
        data: {
          tenantId,
          issueId,
          authorId: userId,
          authorName: authorName || 'System',
          commentText: comment || `Status updated to ${newStatus}. ${resolution ? `Resolution: ${resolution}` : ''}`,
        },
      });
    }

    await this._logAudit(tenantId, userId, `Issue Status: ${existing.issueCode}`, `Changed to ${newStatus}`);
    return this.getIssue(tenantId, issueId);
  }

  async addIssueComment(tenantId, userId, issueId, commentText, authorName, isInternalOnly = false) {
    await this.getIssue(tenantId, issueId);
    if (!commentText || !commentText.trim()) throw new Error('Comment text is required.');

    return await prisma.rdIssueComment.create({
      data: {
        tenantId,
        issueId,
        authorId: userId,
        authorName: authorName || 'User',
        commentText: commentText.trim(),
        isInternalOnly: Boolean(isInternalOnly),
      },
    });
  }

  // ==============================================================================
  // 4. CHANGE MANAGEMENT & IMPACT ASSESSMENT (Req 35)
  // ==============================================================================

  async listChangeRequests(tenantId, filters = {}) {
    const { projectId, changeType, priority, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (changeType) where.changeType = changeType;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { changeCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { reasonForChange: { contains: search.trim() } },
      ];
    }

    return await prisma.rdChangeRequest.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, budget: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createChangeRequest(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      reasonForChange,
      changeType = 'SCOPE',
      scopeImpact,
      scheduleImpactDays = 0,
      costImpactAmount = 0.0,
      riskImpact,
      priority = 'MEDIUM',
      requesterId,
      requesterName,
      linkedTaskId,
      linkedGateId,
    } = data;

    if (!projectId || !title || !reasonForChange) {
      throw new Error('Project ID, title, and reason for change are required.');
    }

    const year = new Date().getFullYear();
    const count = await prisma.rdChangeRequest.count({ where: { tenantId } });
    const changeCode = data.changeCode || `CR-${year}-${String(count + 1).padStart(3, '0')}`;

    const cr = await prisma.rdChangeRequest.create({
      data: {
        tenantId,
        projectId,
        changeCode,
        title,
        description,
        reasonForChange,
        changeType,
        scopeImpact,
        scheduleImpactDays: Number(scheduleImpactDays) || 0,
        costImpactAmount: costImpactAmount,
        riskImpact,
        priority,
        status: data.status || 'SUBMITTED',
        requesterId: requesterId || userId,
        requesterName,
        linkedTaskId,
        linkedGateId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    await this._logAudit(tenantId, userId, `Change Request: ${changeCode}`, `Type: ${changeType}, Title: ${title}`);
    return cr;
  }

  async getChangeRequest(tenantId, crId) {
    const cr = await prisma.rdChangeRequest.findFirst({
      where: { id: crId, tenantId },
      include: { project: { select: { id: true, name: true, budget: true, status: true } } },
    });
    if (!cr) throw new Error('Change request not found.');
    return cr;
  }

  async updateChangeRequest(tenantId, crId, data) {
    const existing = await this.getChangeRequest(tenantId, crId);

    return await prisma.rdChangeRequest.update({
      where: { id: crId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        reasonForChange: data.reasonForChange ?? existing.reasonForChange,
        changeType: data.changeType ?? existing.changeType,
        scopeImpact: data.scopeImpact ?? existing.scopeImpact,
        scheduleImpactDays: data.scheduleImpactDays !== undefined ? Number(data.scheduleImpactDays) : existing.scheduleImpactDays,
        costImpactAmount: data.costImpactAmount !== undefined ? data.costImpactAmount : existing.costImpactAmount,
        riskImpact: data.riskImpact ?? existing.riskImpact,
        priority: data.priority ?? existing.priority,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
        linkedGateId: data.linkedGateId ?? existing.linkedGateId,
      },
    });
  }

  async reviewChangeRequest(tenantId, userId, crId, decision, comments, reviewerName) {
    const existing = await this.getChangeRequest(tenantId, crId);
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw new Error('Review decision must be APPROVED or REJECTED.');
    }

    const updated = await prisma.rdChangeRequest.update({
      where: { id: crId },
      data: {
        status: decision,
        reviewerId: userId,
        reviewerName: reviewerName || 'Reviewer',
        reviewerComments: comments,
        reviewedAt: new Date(),
      },
    });

    await this._logAudit(tenantId, userId, `Change Request ${decision}: ${existing.changeCode}`, comments || 'No comments');
    return updated;
  }

  async implementChangeRequest(tenantId, userId, crId, notes) {
    const existing = await this.getChangeRequest(tenantId, crId);
    if (existing.status !== 'APPROVED') {
      throw new Error('Only approved change requests can be marked as implemented.');
    }

    const updated = await prisma.rdChangeRequest.update({
      where: { id: crId },
      data: {
        status: 'IMPLEMENTED',
        implementationNotes: notes,
        implementedAt: new Date(),
      },
    });

    await this._logAudit(tenantId, userId, `Change Request Implemented: ${existing.changeCode}`, notes || 'Implemented');
    return updated;
  }

  // ==============================================================================
  // 5. REQUIREMENTS MANAGEMENT & TRACEABILITY (Req 36)
  // ==============================================================================

  async listRequirements(tenantId, filters = {}) {
    const { projectId, category, priority, verificationStatus, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (search && search.trim()) {
      where.OR = [
        { reqCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return await prisma.rdRequirement.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequirement(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      category = 'FUNCTIONAL',
      priority = 'HIGH',
      verificationMethod = 'TEST',
      complianceStatus = 'NON_COMPLIANT',
      source,
      version = '1.0',
      ownerId,
      ownerName,
      linkedExperimentId,
      linkedTaskId,
      linkedDeliverableId,
      criteria = [],
    } = data;

    if (!projectId || !title) {
      throw new Error('Project ID and title are required for a requirement.');
    }

    const year = new Date().getFullYear();
    const count = await prisma.rdRequirement.count({ where: { tenantId } });
    const reqCode = data.reqCode || `REQ-${year}-${String(count + 1).padStart(3, '0')}`;

    const req = await prisma.rdRequirement.create({
      data: {
        tenantId,
        projectId,
        reqCode,
        title,
        description,
        category,
        priority,
        verificationMethod,
        verificationStatus: data.verificationStatus || 'UNVERIFIED',
        complianceStatus,
        source,
        version,
        ownerId: ownerId || userId,
        ownerName,
        linkedExperimentId,
        linkedTaskId,
        linkedDeliverableId,
        createdById: userId,
        criteria: criteria.length > 0 ? {
          create: criteria.map(c => ({
            tenantId,
            criterionDescription: c.criterionDescription,
            expectedValue: c.expectedValue,
            actualValue: c.actualValue,
            isMet: Boolean(c.isMet),
          })),
        } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
    });

    await this._logAudit(tenantId, userId, `Requirement Added: ${reqCode}`, `Title: ${title} (${category})`);
    return req;
  }

  async getRequirement(tenantId, reqId) {
    const req = await prisma.rdRequirement.findFirst({
      where: { id: reqId, tenantId },
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
    });
    if (!req) throw new Error('Requirement not found.');
    return req;
  }

  async updateRequirement(tenantId, reqId, data) {
    const existing = await this.getRequirement(tenantId, reqId);

    return await prisma.rdRequirement.update({
      where: { id: reqId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        priority: data.priority ?? existing.priority,
        verificationMethod: data.verificationMethod ?? existing.verificationMethod,
        complianceStatus: data.complianceStatus ?? existing.complianceStatus,
        source: data.source ?? existing.source,
        version: data.version ?? existing.version,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        linkedExperimentId: data.linkedExperimentId ?? existing.linkedExperimentId,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
        linkedDeliverableId: data.linkedDeliverableId ?? existing.linkedDeliverableId,
        verificationStatus: data.verificationStatus ?? existing.verificationStatus,
      },
      include: { criteria: true },
    });
  }

  async addCriterionToRequirement(tenantId, reqId, data) {
    await this.getRequirement(tenantId, reqId);
    if (!data.criterionDescription) throw new Error('Criterion description is required.');

    return await prisma.rdRequirementCriterion.create({
      data: {
        tenantId,
        requirementId: reqId,
        criterionDescription: data.criterionDescription,
        expectedValue: data.expectedValue,
        actualValue: data.actualValue,
        isMet: Boolean(data.isMet),
      },
    });
  }

  async verifyRequirementCriterion(tenantId, userId, criterionId, data) {
    const criterion = await prisma.rdRequirementCriterion.findFirst({
      where: { id: criterionId, tenantId },
    });
    if (!criterion) throw new Error('Requirement criterion not found.');

    const isMet = Boolean(data.isMet);
    const updatedCriterion = await prisma.rdRequirementCriterion.update({
      where: { id: criterionId },
      data: {
        isMet,
        actualValue: data.actualValue ?? criterion.actualValue,
        verifiedAt: new Date(),
        verifiedById: userId,
        verifiedByName: data.verifiedByName || 'Verifier',
      },
    });

    // Auto-update parent requirement verification status
    const allCriteria = await prisma.rdRequirementCriterion.findMany({
      where: { requirementId: criterion.requirementId },
    });

    const total = allCriteria.length;
    const metCount = allCriteria.filter(c => c.isMet).length;

    let newStatus = 'VERIFICATION_IN_PROGRESS';
    let compliance = 'PARTIAL';

    if (total > 0 && metCount === total) {
      newStatus = 'PASSED';
      compliance = 'COMPLIANT';
    } else if (metCount === 0) {
      newStatus = 'FAILED';
      compliance = 'NON_COMPLIANT';
    }

    await prisma.rdRequirement.update({
      where: { id: criterion.requirementId },
      data: {
        verificationStatus: newStatus,
        complianceStatus: compliance,
      },
    });

    return updatedCriterion;
  }

  async getTraceabilityMatrix(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const requirements = await prisma.rdRequirement.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
      orderBy: { reqCode: 'asc' },
    });

    return requirements.map(r => {
      const totalCriteria = r.criteria.length;
      const metCriteria = r.criteria.filter(c => c.isMet).length;
      const completionPercent = totalCriteria > 0 ? Math.round((metCriteria / totalCriteria) * 100) : 0;

      return {
        id: r.id,
        reqCode: r.reqCode,
        title: r.title,
        category: r.category,
        priority: r.priority,
        verificationMethod: r.verificationMethod,
        verificationStatus: r.verificationStatus,
        complianceStatus: r.complianceStatus,
        version: r.version,
        linkedExperimentId: r.linkedExperimentId,
        linkedTaskId: r.linkedTaskId,
        linkedDeliverableId: r.linkedDeliverableId,
        projectName: r.project?.name,
        totalCriteria,
        metCriteria,
        completionPercent,
        criteria: r.criteria,
      };
    });
  }

  // ==============================================================================
  // 6. SCOPE TRACKING & WORK BREAKDOWN STRUCTURE (WBS) (Req 37)
  // ==============================================================================

  async getScopeBaselines(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    return await prisma.rdScopeBaseline.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createScopeBaseline(tenantId, userId, data) {
    const {
      projectId,
      baselineVersion = '1.0',
      title,
      description,
      inScopeSummary,
      outOfScopeSummary,
      assumptions,
      constraints,
      status = 'APPROVED',
      approvedByName,
    } = data;

    if (!projectId || !title) throw new Error('Project ID and title are required for a scope baseline.');

    const baseline = await prisma.rdScopeBaseline.create({
      data: {
        tenantId,
        projectId,
        baselineVersion,
        title,
        description,
        inScopeSummary,
        outOfScopeSummary,
        assumptions,
        constraints,
        status,
        approvedById: status === 'APPROVED' ? userId : null,
        approvedByName: status === 'APPROVED' ? (approvedByName || 'System') : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });

    await this._logAudit(tenantId, userId, `Scope Baseline v${baselineVersion}`, `Project: ${projectId}`);
    return baseline;
  }

  async getWbsItems(tenantId, projectId) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const items = await prisma.rdScopeItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { wbsCode: 'asc' }],
    });

    // Build hierarchy tree
    const map = {};
    const roots = [];

    items.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });

    items.forEach(item => {
      if (item.parentItemId && map[item.parentItemId]) {
        map[item.parentItemId].children.push(map[item.id]);
      } else {
        roots.push(map[item.id]);
      }
    });

    return { flat: items, tree: roots };
  }

  async createWbsItem(tenantId, userId, data) {
    const {
      projectId,
      parentItemId,
      wbsCode,
      title,
      description,
      level = 1,
      itemType = 'WORK_PACKAGE',
      status = 'NOT_STARTED',
      completionPercent = 0,
      ownerId,
      ownerName,
      estimatedHours,
      actualHours,
      sortOrder = 0,
    } = data;

    if (!projectId || !wbsCode || !title) {
      throw new Error('Project ID, WBS Code, and title are required for a WBS item.');
    }

    const item = await prisma.rdScopeItem.create({
      data: {
        tenantId,
        projectId,
        parentItemId: parentItemId || null,
        wbsCode,
        title,
        description,
        level: Number(level) || 1,
        itemType,
        status,
        completionPercent: Number(completionPercent) || 0,
        ownerId: ownerId || userId,
        ownerName,
        estimatedHours,
        actualHours,
        sortOrder: Number(sortOrder) || 0,
      },
    });

    await this._logAudit(tenantId, userId, `WBS Item Created: ${wbsCode}`, title);
    return item;
  }

  async updateWbsItem(tenantId, itemId, data) {
    const existing = await prisma.rdScopeItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) throw new Error('WBS item not found.');

    const completion = data.completionPercent !== undefined ? Number(data.completionPercent) : existing.completionPercent;
    let status = data.status ?? existing.status;
    if (completion === 100 && status !== 'COMPLETED') status = 'COMPLETED';
    else if (completion > 0 && completion < 100 && status === 'NOT_STARTED') status = 'IN_PROGRESS';

    return await prisma.rdScopeItem.update({
      where: { id: itemId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        itemType: data.itemType ?? existing.itemType,
        status,
        completionPercent: completion,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        estimatedHours: data.estimatedHours !== undefined ? data.estimatedHours : existing.estimatedHours,
        actualHours: data.actualHours !== undefined ? data.actualHours : existing.actualHours,
        sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : existing.sortOrder,
      },
    });
  }

  async deleteWbsItem(tenantId, itemId) {
    const existing = await prisma.rdScopeItem.findFirst({
      where: { id: itemId, tenantId },
      include: { childItems: true },
    });
    if (!existing) throw new Error('WBS item not found.');
    if (existing.childItems.length > 0) {
      throw new Error('Cannot delete WBS item with child sub-items. Delete child items first.');
    }

    await prisma.rdScopeItem.delete({ where: { id: itemId } });
    return { success: true };
  }

  // ==============================================================================
  // 7. DELIVERABLE TRACKING & DOCUMENT INTEGRATION (Req 38)
  // ==============================================================================

  async listDeliverables(tenantId, filters = {}) {
    const { projectId, category, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { deliverableCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return await prisma.rdDeliverable.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        document: { select: { id: true, title: true, documentCode: true, originalFilename: true, fileSize: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDeliverable(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      category = 'TECHNICAL_REPORT',
      ownerId,
      ownerName,
      dueDate,
      acceptanceCriteria,
      documentId,
      linkedTaskId,
      linkedMilestoneId,
      linkedScopeItemId,
    } = data;

    if (!projectId || !title) throw new Error('Project ID and title are required for a deliverable.');

    const year = new Date().getFullYear();
    const count = await prisma.rdDeliverable.count({ where: { tenantId } });
    const deliverableCode = data.deliverableCode || `DEL-${year}-${String(count + 1).padStart(3, '0')}`;

    const del = await prisma.rdDeliverable.create({
      data: {
        tenantId,
        projectId,
        deliverableCode,
        title,
        description,
        category,
        ownerId: ownerId || userId,
        ownerName,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: data.status || 'NOT_STARTED',
        acceptanceCriteria,
        documentId: documentId || null,
        linkedTaskId,
        linkedMilestoneId,
        linkedScopeItemId,
      },
      include: {
        project: { select: { id: true, name: true } },
        document: true,
      },
    });

    await this._logAudit(tenantId, userId, `Deliverable Registered: ${deliverableCode}`, title);
    return del;
  }

  async getDeliverable(tenantId, deliverableId) {
    const del = await prisma.rdDeliverable.findFirst({
      where: { id: deliverableId, tenantId },
      include: {
        project: { select: { id: true, name: true } },
        document: true,
      },
    });
    if (!del) throw new Error('Deliverable not found.');
    return del;
  }

  async updateDeliverable(tenantId, deliverableId, data) {
    const existing = await this.getDeliverable(tenantId, deliverableId);

    return await prisma.rdDeliverable.update({
      where: { id: deliverableId },
      data: {
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        ownerId: data.ownerId ?? existing.ownerId,
        ownerName: data.ownerName ?? existing.ownerName,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        acceptanceCriteria: data.acceptanceCriteria ?? existing.acceptanceCriteria,
        documentId: data.documentId ?? existing.documentId,
        linkedTaskId: data.linkedTaskId ?? existing.linkedTaskId,
        linkedMilestoneId: data.linkedMilestoneId ?? existing.linkedMilestoneId,
        linkedScopeItemId: data.linkedScopeItemId ?? existing.linkedScopeItemId,
      },
      include: { document: true },
    });
  }

  async submitDeliverable(tenantId, userId, deliverableId, data = {}) {
    const existing = await this.getDeliverable(tenantId, deliverableId);

    const updated = await prisma.rdDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: 'SUBMITTED',
        submissionDate: new Date(),
        documentId: data.documentId || existing.documentId,
      },
      include: { document: true },
    });

    await this._logAudit(tenantId, userId, `Deliverable Submitted: ${existing.deliverableCode}`, existing.title);
    return updated;
  }

  async reviewDeliverable(tenantId, userId, deliverableId, decision, notes, reviewerName) {
    const existing = await this.getDeliverable(tenantId, deliverableId);
    if (!['ACCEPTED', 'REJECTED'].includes(decision)) {
      throw new Error('Review decision must be ACCEPTED or REJECTED.');
    }

    const updated = await prisma.rdDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: decision,
        acceptanceNotes: notes,
        acceptedById: decision === 'ACCEPTED' ? userId : null,
        acceptedByName: decision === 'ACCEPTED' ? (reviewerName || 'Reviewer') : null,
        acceptedAt: decision === 'ACCEPTED' ? new Date() : null,
      },
    });

    await this._logAudit(tenantId, userId, `Deliverable ${decision}: ${existing.deliverableCode}`, notes || '');
    return updated;
  }

  // ==============================================================================
  // 8. QUALITY CHECKPOINTS & INSPECTION CRITERIA (Req 39)
  // ==============================================================================

  async listQualityCheckpoints(tenantId, filters = {}) {
    const { projectId, checkpointType, status, search } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (checkpointType) where.checkpointType = checkpointType;
    if (status) where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { checkpointCode: { contains: search.trim() } },
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return await prisma.rdQualityCheckpoint.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQualityCheckpoint(tenantId, userId, data) {
    const {
      projectId,
      title,
      description,
      checkpointType = 'STAGE_GATE',
      plannedDate,
      leadInspectorId,
      leadInspectorName,
      linkedGateId,
      linkedMilestoneId,
      linkedDeliverableId,
      criteria = [],
    } = data;

    if (!projectId || !title) throw new Error('Project ID and title are required for a quality checkpoint.');

    const year = new Date().getFullYear();
    const count = await prisma.rdQualityCheckpoint.count({ where: { tenantId } });
    const checkpointCode = data.checkpointCode || `QC-${year}-${String(count + 1).padStart(3, '0')}`;

    const qc = await prisma.rdQualityCheckpoint.create({
      data: {
        tenantId,
        projectId,
        checkpointCode,
        title,
        description,
        checkpointType,
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        status: data.status || 'PLANNED',
        leadInspectorId: leadInspectorId || userId,
        leadInspectorName,
        linkedGateId,
        linkedMilestoneId,
        linkedDeliverableId,
        criteria: criteria.length > 0 ? {
          create: criteria.map(c => ({
            tenantId,
            criterionName: c.criterionName,
            specificationStandard: c.specificationStandard,
            result: c.result || 'PENDING',
            observations: c.observations,
          })),
        } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
    });

    await this._logAudit(tenantId, userId, `Quality Checkpoint Planned: ${checkpointCode}`, title);
    return qc;
  }

  async getQualityCheckpoint(tenantId, checkpointId) {
    const qc = await prisma.rdQualityCheckpoint.findFirst({
      where: { id: checkpointId, tenantId },
      include: {
        project: { select: { id: true, name: true } },
        criteria: true,
      },
    });
    if (!qc) throw new Error('Quality checkpoint not found.');
    return qc;
  }

  async addCriterionToCheckpoint(tenantId, checkpointId, data) {
    await this.getQualityCheckpoint(tenantId, checkpointId);
    if (!data.criterionName) throw new Error('Criterion name is required.');

    return await prisma.rdQualityCriterion.create({
      data: {
        tenantId,
        checkpointId,
        criterionName: data.criterionName,
        specificationStandard: data.specificationStandard,
        result: data.result || 'PENDING',
        observations: data.observations,
      },
    });
  }

  async evaluateQualityCriterion(tenantId, userId, criterionId, data) {
    const criterion = await prisma.rdQualityCriterion.findFirst({
      where: { id: criterionId, tenantId },
    });
    if (!criterion) throw new Error('Quality criterion not found.');

    return await prisma.rdQualityCriterion.update({
      where: { id: criterionId },
      data: {
        result: data.result || criterion.result,
        observations: data.observations ?? criterion.observations,
        verifiedById: userId,
        verifiedByName: data.verifiedByName || 'Inspector',
        verifiedAt: new Date(),
      },
    });
  }

  async conductQualityCheckpoint(tenantId, userId, checkpointId, data) {
    const existing = await this.getQualityCheckpoint(tenantId, checkpointId);
    const { overallResult, summaryFindings, correctiveActions, spawnIssueIfFail = false } = data;

    let status = 'IN_PROGRESS';
    if (overallResult === 'PASS') status = 'PASSED';
    else if (overallResult === 'FAIL') status = 'FAILED';
    else if (overallResult === 'CONDITIONAL') status = 'CONDITIONAL_PASS';

    const updated = await prisma.rdQualityCheckpoint.update({
      where: { id: checkpointId },
      data: {
        conductedDate: new Date(),
        status,
        overallResult,
        summaryFindings,
        correctiveActions,
      },
      include: { criteria: true },
    });

    // If checkpoint failed and spawnIssueIfFail is true, create an issue automatically
    let createdIssue = null;
    if (overallResult === 'FAIL' && spawnIssueIfFail) {
      createdIssue = await this.createIssue(tenantId, userId, {
        projectId: existing.projectId,
        title: `Quality Checkpoint Failure: ${existing.checkpointCode} - ${existing.title}`,
        description: `Automated issue raised from Quality Checkpoint ${existing.checkpointCode}.\nFindings: ${summaryFindings || 'Criteria standards unmet.'}\nCorrective Action: ${correctiveActions || 'Rectify discrepancies and reschedule inspection.'}`,
        category: 'QUALITY',
        priority: 'HIGH',
        severity: 'MAJOR',
        rootCause: summaryFindings,
      });
    }

    await this._logAudit(tenantId, userId, `Quality Checkpoint Conducted: ${existing.checkpointCode}`, `Result: ${overallResult}`);
    return { checkpoint: updated, issue: createdIssue };
  }

  // ==============================================================================
  // 9. BUDGET PLANNING, ALLOCATIONS & FINANCIAL CONTROLS (Req 40)
  // ==============================================================================

  async listBudgets(tenantId, filters = {}) {
    const { projectId, fiscalYear } = filters;
    const where = { tenantId };

    if (projectId) where.projectId = projectId;
    if (fiscalYear) where.fiscalYear = Number(fiscalYear);

    return await prisma.rdProjectBudget.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, budget: true, spent: true } },
        allocations: true,
        revisions: { orderBy: { revisionNumber: 'desc' } },
      },
      orderBy: [{ fiscalYear: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createBudget(tenantId, userId, data) {
    const {
      projectId,
      fiscalYear = new Date().getFullYear(),
      currency = 'USD',
      totalAllocated = 0.0,
      contingencyPercentage = 10.0,
      allocations = [],
    } = data;

    if (!projectId) throw new Error('Project ID is required to set up a project budget.');

    // Calculate contingency amount
    const allocatedNum = Number(totalAllocated) || 0;
    const contPctNum = Number(contingencyPercentage) || 0;
    const contingencyAmount = (allocatedNum * contPctNum) / 100;

    // Check if budget for fiscal year already exists
    const existing = await prisma.rdProjectBudget.findFirst({
      where: { tenantId, projectId, fiscalYear: Number(fiscalYear) },
    });
    if (existing) {
      throw new Error(`Budget already exists for project ${projectId} and fiscal year ${fiscalYear}.`);
    }

    // Validate allocations sum
    if (allocations.length > 0) {
      const sumAlloc = allocations.reduce((acc, curr) => acc + (Number(curr.plannedAmount) || 0), 0);
      if (sumAlloc > allocatedNum) {
        throw new Error(`Allocations sum ($${sumAlloc.toFixed(2)}) exceeds total allocated budget ($${allocatedNum.toFixed(2)}).`);
      }
    }

    const budget = await prisma.rdProjectBudget.create({
      data: {
        tenantId,
        projectId,
        fiscalYear: Number(fiscalYear),
        currency,
        totalAllocated: allocatedNum,
        contingencyPercentage: contPctNum,
        contingencyAmount,
        status: data.status || 'DRAFT',
        createdById: userId,
        allocations: allocations.length > 0 ? {
          create: allocations.map(a => ({
            tenantId,
            category: a.category,
            subcategory: a.subcategory,
            plannedAmount: Number(a.plannedAmount) || 0,
            notes: a.notes,
          })),
        } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        allocations: true,
        revisions: true,
      },
    });

    await this._logAudit(tenantId, userId, `Budget Setup FY${fiscalYear}`, `Project: ${projectId}, Total: $${allocatedNum.toFixed(2)}`);
    return budget;
  }

  async getBudget(tenantId, budgetId) {
    const budget = await prisma.rdProjectBudget.findFirst({
      where: { id: budgetId, tenantId },
      include: {
        project: { select: { id: true, name: true, budget: true, spent: true } },
        allocations: true,
        revisions: { orderBy: { revisionNumber: 'desc' } },
      },
    });
    if (!budget) throw new Error('Project budget not found.');
    return budget;
  }

  async updateBudget(tenantId, budgetId, data) {
    const existing = await this.getBudget(tenantId, budgetId);

    const totalAllocated = data.totalAllocated !== undefined ? Number(data.totalAllocated) : Number(existing.totalAllocated);
    const contPct = data.contingencyPercentage !== undefined ? Number(data.contingencyPercentage) : Number(existing.contingencyPercentage);
    const contingencyAmount = (totalAllocated * contPct) / 100;

    return await prisma.rdProjectBudget.update({
      where: { id: budgetId },
      data: {
        currency: data.currency ?? existing.currency,
        totalAllocated,
        contingencyPercentage: contPct,
        contingencyAmount,
      },
      include: { allocations: true, revisions: true },
    });
  }

  async addBudgetAllocation(tenantId, budgetId, data) {
    const budget = await this.getBudget(tenantId, budgetId);
    const { category, subcategory, plannedAmount = 0, notes } = data;

    if (!category) throw new Error('Allocation category is required.');
    const plannedNum = Number(plannedAmount) || 0;

    // Check budget limit
    const currentSum = budget.allocations.reduce((acc, a) => acc + Number(a.plannedAmount), 0);
    if (currentSum + plannedNum > Number(budget.totalAllocated)) {
      throw new Error(`Adding this allocation ($${plannedNum.toFixed(2)}) would exceed the total budget ($${Number(budget.totalAllocated).toFixed(2)}). Current allocated: $${currentSum.toFixed(2)}.`);
    }

    return await prisma.rdBudgetAllocation.create({
      data: {
        tenantId,
        budgetId,
        category,
        subcategory,
        plannedAmount: plannedNum,
        notes,
      },
    });
  }

  async updateBudgetAllocation(tenantId, allocationId, data) {
    const allocation = await prisma.rdBudgetAllocation.findFirst({
      where: { id: allocationId, tenantId },
      include: { budget: { include: { allocations: true } } },
    });
    if (!allocation) throw new Error('Budget allocation not found.');

    const plannedAmount = data.plannedAmount !== undefined ? Number(data.plannedAmount) : Number(allocation.plannedAmount);
    const actualAmount = data.actualAmount !== undefined ? Number(data.actualAmount) : Number(allocation.actualAmount);
    const committedAmount = data.committedAmount !== undefined ? Number(data.committedAmount) : Number(allocation.committedAmount);

    // Validate total planned vs budget
    const otherSum = allocation.budget.allocations
      .filter(a => a.id !== allocationId)
      .reduce((acc, a) => acc + Number(a.plannedAmount), 0);

    if (otherSum + plannedAmount > Number(allocation.budget.totalAllocated)) {
      throw new Error(`Updated allocation ($${plannedAmount.toFixed(2)}) exceeds remaining total budget.`);
    }

    const updated = await prisma.rdBudgetAllocation.update({
      where: { id: allocationId },
      data: {
        category: data.category ?? allocation.category,
        subcategory: data.subcategory ?? allocation.subcategory,
        plannedAmount,
        actualAmount,
        committedAmount,
        notes: data.notes ?? allocation.notes,
      },
    });

    // Recalculate parent budget spent and committed
    const allAllocations = await prisma.rdBudgetAllocation.findMany({
      where: { budgetId: allocation.budgetId },
    });
    const totalSpent = allAllocations.reduce((acc, a) => acc + Number(a.actualAmount), 0);
    const totalCommitted = allAllocations.reduce((acc, a) => acc + Number(a.committedAmount), 0);

    await prisma.rdProjectBudget.update({
      where: { id: allocation.budgetId },
      data: { totalSpent, totalCommitted },
    });

    return updated;
  }

  async deleteBudgetAllocation(tenantId, allocationId) {
    const allocation = await prisma.rdBudgetAllocation.findFirst({
      where: { id: allocationId, tenantId },
    });
    if (!allocation) throw new Error('Budget allocation not found.');

    await prisma.rdBudgetAllocation.delete({ where: { id: allocationId } });

    // Recalculate parent budget spent and committed
    const allAllocations = await prisma.rdBudgetAllocation.findMany({
      where: { budgetId: allocation.budgetId },
    });
    const totalSpent = allAllocations.reduce((acc, a) => acc + Number(a.actualAmount), 0);
    const totalCommitted = allAllocations.reduce((acc, a) => acc + Number(a.committedAmount), 0);

    await prisma.rdProjectBudget.update({
      where: { id: allocation.budgetId },
      data: { totalSpent, totalCommitted },
    });

    return { success: true };
  }

  async approveBudget(tenantId, userId, budgetId, approvalNotes, approvedByName) {
    const existing = await this.getBudget(tenantId, budgetId);

    const updated = await prisma.rdProjectBudget.update({
      where: { id: budgetId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedByName: approvedByName || 'Finance Director',
        approvedAt: new Date(),
        approvalNotes,
      },
    });

    await this._logAudit(tenantId, userId, `Budget Approved FY${existing.fiscalYear}`, `Approved amount: $${Number(existing.totalAllocated).toFixed(2)}`);
    return updated;
  }

  async requestBudgetRevision(tenantId, userId, budgetId, data) {
    const budget = await this.getBudget(tenantId, budgetId);
    const { newTotal, reason, requestedByName } = data;

    if (!newTotal || !reason) throw new Error('New total budget amount and justification reason are required.');

    const newTotalNum = Number(newTotal);
    const previousTotal = Number(budget.totalAllocated);
    const changeAmount = newTotalNum - previousTotal;

    const revisionCount = await prisma.rdBudgetRevision.count({ where: { budgetId } });

    const revision = await prisma.rdBudgetRevision.create({
      data: {
        tenantId,
        budgetId,
        revisionNumber: revisionCount + 1,
        previousTotal,
        newTotal: newTotalNum,
        changeAmount,
        reason,
        requestedById: userId,
        requestedByName: requestedByName || 'Requester',
        status: 'PENDING',
      },
    });

    await this._logAudit(tenantId, userId, `Budget Revision Requested`, `Change: $${changeAmount.toFixed(2)} on FY${budget.fiscalYear}`);
    return revision;
  }

  async reviewBudgetRevision(tenantId, userId, revisionId, decision, reviewNotes, reviewerName) {
    const revision = await prisma.rdBudgetRevision.findFirst({
      where: { id: revisionId, tenantId },
      include: { budget: true },
    });
    if (!revision) throw new Error('Budget revision not found.');
    if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('Decision must be APPROVED or REJECTED.');

    const updatedRevision = await prisma.rdBudgetRevision.update({
      where: { id: revisionId },
      data: {
        status: decision,
        reviewedById: userId,
        reviewedByName: reviewerName || 'Reviewer',
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    // If approved, update parent budget totalAllocated and contingencyAmount
    if (decision === 'APPROVED') {
      const newTotal = Number(revision.newTotal);
      const contPct = Number(revision.budget.contingencyPercentage);
      const contingencyAmount = (newTotal * contPct) / 100;

      await prisma.rdProjectBudget.update({
        where: { id: revision.budgetId },
        data: {
          totalAllocated: newTotal,
          contingencyAmount,
          status: 'REVISED',
        },
      });
    }

    await this._logAudit(tenantId, userId, `Budget Revision ${decision}`, `Revision #${revision.revisionNumber}`);
    return updatedRevision;
  }

  async getBudgetSummary(tenantId, budgetId) {
    const budget = await this.getBudget(tenantId, budgetId);

    const totalAllocated = Number(budget.totalAllocated);
    const totalSpent = Number(budget.totalSpent);
    const totalCommitted = Number(budget.totalCommitted);
    const remaining = totalAllocated - totalSpent;
    const utilizationPercent = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
    const committedPercent = totalAllocated > 0 ? Math.round(((totalSpent + totalCommitted) / totalAllocated) * 100) : 0;

    const isOverBudget = totalSpent > totalAllocated;
    const isWarning = utilizationPercent >= 90 && !isOverBudget;

    // Breakdown by category
    const categoryBreakdown = {};
    budget.allocations.forEach(a => {
      categoryBreakdown[a.category] = {
        category: a.category,
        planned: Number(a.plannedAmount),
        actual: Number(a.actualAmount),
        committed: Number(a.committedAmount),
        variance: Number(a.plannedAmount) - Number(a.actualAmount),
      };
    });

    return {
      budgetId: budget.id,
      fiscalYear: budget.fiscalYear,
      currency: budget.currency,
      totalAllocated,
      totalSpent,
      totalCommitted,
      remaining,
      utilizationPercent,
      committedPercent,
      isOverBudget,
      isWarning,
      categoryBreakdown,
      status: budget.status,
      allocations: budget.allocations,
      revisions: budget.revisions,
    };
  }

  // ==============================================================================
  // 10. GOVERNANCE OVERVIEW / EXECUTIVE DASHBOARD AGGREGATION
  // ==============================================================================

  async getGovernanceOverview(tenantId, projectId) {
    const whereProject = { tenantId };
    if (projectId) whereProject.projectId = projectId;

    const [
      decisions,
      risks,
      issues,
      changes,
      requirements,
      wbsItems,
      deliverables,
      checkpoints,
      budgets,
    ] = await Promise.all([
      prisma.rdDecision.findMany({ where: whereProject, select: { status: true, category: true } }),
      prisma.rdRisk.findMany({ where: whereProject, select: { riskLevel: true, status: true, riskScore: true } }),
      prisma.rdIssue.findMany({ where: whereProject, select: { priority: true, severity: true, status: true } }),
      prisma.rdChangeRequest.findMany({ where: whereProject, select: { status: true, changeType: true } }),
      prisma.rdRequirement.findMany({ where: whereProject, select: { verificationStatus: true, complianceStatus: true } }),
      prisma.rdScopeItem.findMany({ where: whereProject, select: { status: true, completionPercent: true } }),
      prisma.rdDeliverable.findMany({ where: whereProject, select: { status: true, category: true, dueDate: true } }),
      prisma.rdQualityCheckpoint.findMany({ where: whereProject, select: { status: true, overallResult: true } }),
      prisma.rdProjectBudget.findMany({ where: whereProject, select: { totalAllocated: true, totalSpent: true, totalCommitted: true } }),
    ]);

    const activeRisks = risks.filter(r => !['RETIRED', 'MATERIALIZED'].includes(r.status));
    const openIssues = issues.filter(i => ['OPEN', 'UNDER_INVESTIGATION', 'IN_PROGRESS'].includes(i.status));
    const blockerIssues = openIssues.filter(i => i.priority === 'BLOCKER' || i.priority === 'CRITICAL');
    const pendingChanges = changes.filter(c => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status));

    const totalAllocated = budgets.reduce((acc, b) => acc + Number(b.totalAllocated), 0);
    const totalSpent = budgets.reduce((acc, b) => acc + Number(b.totalSpent), 0);

    const wbsAvgProgress = wbsItems.length > 0
      ? Math.round(wbsItems.reduce((acc, item) => acc + item.completionPercent, 0) / wbsItems.length)
      : 0;

    const reqPassed = requirements.filter(r => r.verificationStatus === 'PASSED').length;
    const reqVerificationRate = requirements.length > 0
      ? Math.round((reqPassed / requirements.length) * 100)
      : 0;

    return {
      kpis: {
        totalDecisions: decisions.length,
        approvedDecisions: decisions.filter(d => d.status === 'APPROVED').length,
        totalRisks: risks.length,
        criticalRisks: activeRisks.filter(r => r.riskLevel === 'CRITICAL').length,
        highRisks: activeRisks.filter(r => r.riskLevel === 'HIGH').length,
        activeRisksCount: activeRisks.length,
        totalIssues: issues.length,
        openIssuesCount: openIssues.length,
        blockerIssuesCount: blockerIssues.length,
        pendingChangesCount: pendingChanges.length,
        totalRequirements: requirements.length,
        reqVerificationRate,
        wbsAvgProgress,
        totalDeliverables: deliverables.length,
        acceptedDeliverables: deliverables.filter(d => d.status === 'ACCEPTED').length,
        qualityCheckpointsCount: checkpoints.length,
        passedCheckpoints: checkpoints.filter(c => c.status === 'PASSED').length,
        totalBudgetAllocated: totalAllocated,
        totalBudgetSpent: totalSpent,
        budgetBurnRate: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
      },
    };
  }
}

module.exports = new RdGovernanceOpsService();
