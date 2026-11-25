/**
 * Regulatory Compliance & SOP Management Service
 * Master Prompt 16: SOP Registry, Regulatory Standards, Checklists & Incidents
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const rdAuditService = require('./rdAuditService');

const VALID_CATEGORIES = ['LAB_SAFETY', 'DATA_INTEGRITY', 'REGULATORY', 'CLINICAL', 'QUALITY', 'CYBERSECURITY'];
const VALID_APPROVAL_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'OBSOLETE'];

class RdComplianceService {
  /**
   * List SOPs and compliance guidelines with filters
   */
  async listSops(tenantId, options = {}) {
    const {
      search,
      category,
      approvalStatus,
      regulatoryStandard,
      ownerId,
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const where = { tenantId };

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { sopIdentifier: { contains: search.trim() } },
        { description: { contains: search.trim() } }
      ];
    }

    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    if (approvalStatus && approvalStatus !== 'ALL') {
      where.approvalStatus = approvalStatus.toUpperCase();
    }

    if (regulatoryStandard && regulatoryStandard !== 'ALL') {
      where.regulatoryStandard = { contains: regulatoryStandard.trim() };
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const take = Math.min(100, parseInt(limit));

    const [sops, total] = await Promise.all([
      prisma.rdComplianceSop.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.rdComplianceSop.count({ where })
    ]);

    return {
      sops,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  /**
   * Get single SOP by ID
   */
  async getSopById(tenantId, id) {
    const sop = await prisma.rdComplianceSop.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } }
      }
    });

    if (!sop) {
      const error = new Error('Compliance SOP not found');
      error.statusCode = 404;
      throw error;
    }

    return sop;
  }

  /**
   * Create new Standard Operating Procedure
   */
  async createSop(tenantId, userId, data, actorInfo = {}) {
    const {
      sopIdentifier,
      title,
      description,
      version = '1.0',
      category = 'LAB_SAFETY',
      regulatoryStandard = 'ISO 9001 / GLP',
      effectiveDate,
      reviewDate,
      checklists = [],
      nonComplianceRecords = [],
      supportingDocs = []
    } = data;

    if (!title || !title.trim()) {
      const error = new Error('SOP Title is required');
      error.statusCode = 400;
      throw error;
    }

    // Auto-generate identifier if not provided
    let identifier = sopIdentifier ? sopIdentifier.trim().toUpperCase() : null;
    if (!identifier) {
      const count = await prisma.rdComplianceSop.count({ where: { tenantId } });
      identifier = `SOP-RD-${String(count + 1).padStart(3, '0')}`;
    }

    // Check uniqueness within tenant
    const existing = await prisma.rdComplianceSop.findFirst({
      where: { tenantId, sopIdentifier: identifier }
    });
    if (existing) {
      const error = new Error(`SOP identifier "${identifier}" is already registered in this tenant`);
      error.statusCode = 409;
      throw error;
    }

    const normalizedCategory = VALID_CATEGORIES.includes(category.toUpperCase())
      ? category.toUpperCase()
      : 'LAB_SAFETY';

    const sop = await prisma.rdComplianceSop.create({
      data: {
        tenantId,
        sopIdentifier: identifier,
        title: title.trim(),
        description: description ? description.trim() : null,
        version: version || '1.0',
        category: normalizedCategory,
        regulatoryStandard: regulatoryStandard || 'ISO 9001 / GLP',
        approvalStatus: 'DRAFT',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        ownerId: userId || null,
        checklists: Array.isArray(checklists) ? checklists : [],
        nonComplianceRecords: Array.isArray(nonComplianceRecords) ? nonComplianceRecords : [],
        supportingDocs: Array.isArray(supportingDocs) ? supportingDocs : []
      },
      include: {
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'Compliance Officer',
      action: 'CREATE_SOP',
      entityType: 'COMPLIANCE_SOP',
      entityId: sop.id,
      details: { sopIdentifier: sop.sopIdentifier, title: sop.title, category: sop.category },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return sop;
  }

  /**
   * Update SOP details or advance version
   */
  async updateSop(tenantId, id, data, userId, actorInfo = {}) {
    const existing = await this.getSopById(tenantId, id);

    const updatePayload = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.version !== undefined) updatePayload.version = data.version;
    if (data.category && VALID_CATEGORIES.includes(data.category.toUpperCase())) {
      updatePayload.category = data.category.toUpperCase();
    }
    if (data.regulatoryStandard !== undefined) updatePayload.regulatoryStandard = data.regulatoryStandard;
    if (data.effectiveDate !== undefined) updatePayload.effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : null;
    if (data.reviewDate !== undefined) updatePayload.reviewDate = data.reviewDate ? new Date(data.reviewDate) : null;
    if (data.checklists !== undefined) updatePayload.checklists = data.checklists;
    if (data.nonComplianceRecords !== undefined) updatePayload.nonComplianceRecords = data.nonComplianceRecords;
    if (data.supportingDocs !== undefined) updatePayload.supportingDocs = data.supportingDocs;

    const updated = await prisma.rdComplianceSop.update({
      where: { id },
      data: updatePayload,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } }
      }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'Compliance Officer',
      action: 'UPDATE_SOP',
      entityType: 'COMPLIANCE_SOP',
      entityId: id,
      details: { sopIdentifier: existing.sopIdentifier, updatedFields: Object.keys(updatePayload) },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return updated;
  }

  /**
   * Formal Governance Approval or Rejection of an SOP
   */
  async approveSop(tenantId, id, approverId, { comments, isApproved }, actorInfo = {}) {
    const existing = await this.getSopById(tenantId, id);

    const targetStatus = isApproved ? 'APPROVED' : 'REJECTED';
    const now = new Date();

    const updated = await prisma.rdComplianceSop.update({
      where: { id },
      data: {
        approvalStatus: targetStatus,
        approvedById: approverId,
        approvedAt: now,
        effectiveDate: isApproved ? (existing.effectiveDate || now) : existing.effectiveDate
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } }
      }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId: approverId,
      actorName: actorInfo.name || 'Quality Approver',
      action: isApproved ? 'APPROVE_SOP' : 'REJECT_SOP',
      entityType: 'COMPLIANCE_SOP',
      entityId: id,
      details: {
        sopIdentifier: existing.sopIdentifier,
        decision: targetStatus,
        comments: comments || 'N/A'
      },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return updated;
  }

  /**
   * Add a checklist step to an SOP
   */
  async addChecklistItem(tenantId, id, item, userId, actorInfo = {}) {
    const existing = await this.getSopById(tenantId, id);
    const checklists = Array.isArray(existing.checklists) ? [...existing.checklists] : [];

    const newChecklist = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stepNumber: checklists.length + 1,
      requirement: item.requirement || item.title || 'Verification Step',
      mandatory: item.mandatory !== false,
      verificationMethod: item.verificationMethod || 'Visual Inspection',
      createdAt: new Date().toISOString()
    };

    checklists.push(newChecklist);

    const updated = await prisma.rdComplianceSop.update({
      where: { id },
      data: { checklists }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'Compliance Auditor',
      action: 'ADD_SOP_CHECKLIST',
      entityType: 'COMPLIANCE_SOP',
      entityId: id,
      details: { stepNumber: newChecklist.stepNumber, requirement: newChecklist.requirement },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return updated;
  }

  /**
   * Record a non-compliance incident or deviation
   */
  async recordIncident(tenantId, id, incidentData, userId, actorInfo = {}) {
    const existing = await this.getSopById(tenantId, id);
    const incidents = Array.isArray(existing.nonComplianceRecords) ? [...existing.nonComplianceRecords] : [];

    const incident = {
      incidentId: `INC-${Date.now().toString(36).toUpperCase()}`,
      severity: incidentData.severity || 'MEDIUM', // LOW, MEDIUM, HIGH, CRITICAL
      description: incidentData.description,
      rootCause: incidentData.rootCause || 'Under Investigation',
      correctiveAction: incidentData.correctiveAction || 'Pending review',
      reportedBy: actorInfo.name || 'Auditor',
      reportedAt: new Date().toISOString(),
      status: 'OPEN'
    };

    incidents.push(incident);

    const updated = await prisma.rdComplianceSop.update({
      where: { id },
      data: { nonComplianceRecords: incidents }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'Auditor',
      action: 'RECORD_NON_COMPLIANCE_INCIDENT',
      entityType: 'COMPLIANCE_SOP',
      entityId: id,
      details: { incidentId: incident.incidentId, severity: incident.severity },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return updated;
  }

  /**
   * Summary metrics for compliance & audit governance
   */
  async getComplianceMetrics(tenantId) {
    const sops = await prisma.rdComplianceSop.findMany({
      where: { tenantId },
      select: {
        id: true,
        category: true,
        approvalStatus: true,
        regulatoryStandard: true,
        checklists: true,
        nonComplianceRecords: true
      }
    });

    const categoryDistribution = {};
    const statusDistribution = {};
    let approvedCount = 0;
    let pendingReviewCount = 0;
    let totalChecklists = 0;
    let totalIncidents = 0;
    let openIncidents = 0;

    sops.forEach(s => {
      categoryDistribution[s.category] = (categoryDistribution[s.category] || 0) + 1;
      statusDistribution[s.approvalStatus] = (statusDistribution[s.approvalStatus] || 0) + 1;

      if (s.approvalStatus === 'APPROVED') approvedCount++;
      if (s.approvalStatus === 'UNDER_REVIEW' || s.approvalStatus === 'DRAFT') pendingReviewCount++;

      if (Array.isArray(s.checklists)) {
        totalChecklists += s.checklists.length;
      }

      if (Array.isArray(s.nonComplianceRecords)) {
        totalIncidents += s.nonComplianceRecords.length;
        openIncidents += s.nonComplianceRecords.filter(i => i.status === 'OPEN').length;
      }
    });

    return {
      totalSops: sops.length,
      approvedSops: approvedCount,
      pendingReviewSops: pendingReviewCount,
      totalChecklists,
      totalIncidents,
      openIncidents,
      categoryDistribution,
      statusDistribution
    };
  }
}

module.exports = new RdComplianceService();

