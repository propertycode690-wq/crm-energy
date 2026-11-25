/**
 * Intellectual Property & Patent Management Service
 * Master Prompt 16: IP Asset Tracking, Filing Lifecycles, and Patent Portfolios
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const rdAuditService = require('./rdAuditService');

const VALID_CATEGORIES = ['PATENT', 'TRADEMARK', 'COPYRIGHT', 'INDUSTRIAL_DESIGN', 'TRADE_SECRET'];
const VALID_STATUSES = [
  'INVENTION_DISCLOSURE',
  'INITIAL_REVIEW',
  'FILING_PREP',
  'APPLICATION_SUBMITTED',
  'EXAMINATION',
  'GRANTED',
  'REJECTED',
  'EXPIRED',
  'ABANDONED'
];

class RdIpService {
  /**
   * List IP Assets with multi-parameter filtering & search
   */
  async listIpAssets(tenantId, options = {}) {
    const {
      search,
      category,
      status,
      jurisdiction,
      projectId,
      page = 1,
      limit = 25,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const where = { tenantId };

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
        { applicationNumber: { contains: search.trim() } },
        { patentNumber: { contains: search.trim() } }
      ];
    }

    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (jurisdiction && jurisdiction !== 'ALL') {
      where.jurisdiction = jurisdiction.toUpperCase();
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const take = Math.min(100, parseInt(limit));

    const [assets, total] = await Promise.all([
      prisma.rdIpAsset.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          project: {
            select: { id: true, name: true, status: true, stage: true }
          },
          creator: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.rdIpAsset.count({ where })
    ]);

    return {
      assets,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  /**
   * Get single IP asset by ID
   */
  async getIpAssetById(tenantId, id) {
    const asset = await prisma.rdIpAsset.findFirst({
      where: { id, tenantId },
      include: {
        project: {
          select: { id: true, name: true, status: true, stage: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!asset) {
      const error = new Error('Intellectual Property asset not found');
      error.statusCode = 404;
      throw error;
    }

    return asset;
  }

  /**
   * Register a new IP Asset
   */
  async createIpAsset(tenantId, userId, data, actorInfo = {}) {
    const {
      title,
      description,
      category = 'PATENT',
      ipType = 'PATENT',
      status = 'INVENTION_DISCLOSURE',
      jurisdiction = 'US',
      projectId,
      applicationNumber,
      patentNumber,
      filingDate,
      grantDate,
      expiryDate,
      priorityDate,
      claimsCount = 1,
      inventors = [],
      ownerEntity = 'EgoLytics R&D Division',
      supportingDocs = [],
      notes
    } = data;

    if (!title || !title.trim()) {
      const error = new Error('IP Asset Title is required');
      error.statusCode = 400;
      throw error;
    }

    const normalizedCategory = VALID_CATEGORIES.includes(category.toUpperCase())
      ? category.toUpperCase()
      : 'PATENT';
    const normalizedStatus = VALID_STATUSES.includes(status.toUpperCase())
      ? status.toUpperCase()
      : 'INVENTION_DISCLOSURE';

    const asset = await prisma.rdIpAsset.create({
      data: {
        tenantId,
        projectId: projectId || null,
        title: title.trim(),
        description: description ? description.trim() : null,
        category: normalizedCategory,
        ipType: ipType || normalizedCategory,
        status: normalizedStatus,
        jurisdiction: (jurisdiction || 'US').toUpperCase(),
        applicationNumber: applicationNumber ? applicationNumber.trim() : null,
        patentNumber: patentNumber ? patentNumber.trim() : null,
        filingDate: filingDate ? new Date(filingDate) : null,
        grantDate: grantDate ? new Date(grantDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        priorityDate: priorityDate ? new Date(priorityDate) : null,
        claimsCount: Math.max(1, parseInt(claimsCount) || 1),
        inventors: Array.isArray(inventors) ? inventors : [String(inventors)],
        ownerEntity: ownerEntity || 'EgoLytics R&D Division',
        supportingDocs: Array.isArray(supportingDocs) ? supportingDocs : [],
        notes: notes ? notes.trim() : null,
        createdById: userId || null
      },
      include: {
        project: { select: { id: true, name: true, status: true } }
      }
    });

    // Immutable audit record
    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'R&D Officer',
      action: 'CREATE_IP_ASSET',
      entityType: 'IP_ASSET',
      entityId: asset.id,
      details: { title: asset.title, category: asset.category, status: asset.status },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return asset;
  }

  /**
   * Update IP asset and transition lifecycle
   */
  async updateIpAsset(tenantId, id, data, userId, actorInfo = {}) {
    const existing = await this.getIpAssetById(tenantId, id);

    const updatePayload = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.category && VALID_CATEGORIES.includes(data.category.toUpperCase())) {
      updatePayload.category = data.category.toUpperCase();
    }
    if (data.status && VALID_STATUSES.includes(data.status.toUpperCase())) {
      updatePayload.status = data.status.toUpperCase();
    }
    if (data.jurisdiction !== undefined) updatePayload.jurisdiction = data.jurisdiction.toUpperCase();
    if (data.applicationNumber !== undefined) updatePayload.applicationNumber = data.applicationNumber;
    if (data.patentNumber !== undefined) updatePayload.patentNumber = data.patentNumber;
    if (data.filingDate !== undefined) updatePayload.filingDate = data.filingDate ? new Date(data.filingDate) : null;
    if (data.grantDate !== undefined) updatePayload.grantDate = data.grantDate ? new Date(data.grantDate) : null;
    if (data.expiryDate !== undefined) updatePayload.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    if (data.priorityDate !== undefined) updatePayload.priorityDate = data.priorityDate ? new Date(data.priorityDate) : null;
    if (data.claimsCount !== undefined) updatePayload.claimsCount = Math.max(1, parseInt(data.claimsCount) || 1);
    if (data.inventors !== undefined) updatePayload.inventors = Array.isArray(data.inventors) ? data.inventors : [data.inventors];
    if (data.ownerEntity !== undefined) updatePayload.ownerEntity = data.ownerEntity;
    if (data.supportingDocs !== undefined) updatePayload.supportingDocs = data.supportingDocs;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.projectId !== undefined) updatePayload.projectId = data.projectId || null;

    const updated = await prisma.rdIpAsset.update({
      where: { id },
      data: updatePayload,
      include: {
        project: { select: { id: true, name: true, status: true } }
      }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'R&D Officer',
      action: 'UPDATE_IP_ASSET',
      entityType: 'IP_ASSET',
      entityId: id,
      details: {
        previousStatus: existing.status,
        newStatus: updated.status,
        changes: Object.keys(updatePayload)
      },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return updated;
  }

  /**
   * Delete an IP Asset
   */
  async deleteIpAsset(tenantId, id, userId, actorInfo = {}) {
    const existing = await this.getIpAssetById(tenantId, id);

    await prisma.rdIpAsset.delete({
      where: { id }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'R&D Officer',
      action: 'DELETE_IP_ASSET',
      entityType: 'IP_ASSET',
      entityId: id,
      details: { title: existing.title, category: existing.category },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return { success: true, id };
  }

  /**
   * Summary metrics for IP dashboards & executive reporting
   */
  async getIpMetrics(tenantId) {
    const assets = await prisma.rdIpAsset.findMany({
      where: { tenantId },
      select: {
        id: true,
        category: true,
        status: true,
        jurisdiction: true,
        filingDate: true,
        grantDate: true,
        expiryDate: true
      }
    });

    const categoryDistribution = {};
    const statusDistribution = {};
    const jurisdictionDistribution = {};

    let grantedCount = 0;
    let pendingCount = 0;
    let tradeSecretCount = 0;

    const now = new Date();
    const upcomingRenewals = [];

    assets.forEach(a => {
      categoryDistribution[a.category] = (categoryDistribution[a.category] || 0) + 1;
      statusDistribution[a.status] = (statusDistribution[a.status] || 0) + 1;
      jurisdictionDistribution[a.jurisdiction] = (jurisdictionDistribution[a.jurisdiction] || 0) + 1;

      if (a.status === 'GRANTED') grantedCount++;
      if (['INVENTION_DISCLOSURE', 'INITIAL_REVIEW', 'FILING_PREP', 'APPLICATION_SUBMITTED', 'EXAMINATION'].includes(a.status)) {
        pendingCount++;
      }
      if (a.category === 'TRADE_SECRET') tradeSecretCount++;

      if (a.expiryDate && new Date(a.expiryDate) > now) {
        const daysUntilExpiry = Math.ceil((new Date(a.expiryDate) - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 365) {
          upcomingRenewals.push({ id: a.id, daysUntilExpiry, expiryDate: a.expiryDate });
        }
      }
    });

    return {
      totalAssets: assets.length,
      grantedPatents: grantedCount,
      pendingApplications: pendingCount,
      tradeSecrets: tradeSecretCount,
      categoryDistribution,
      statusDistribution,
      jurisdictionDistribution,
      upcomingRenewalsCount: upcomingRenewals.length,
      upcomingRenewals
    };
  }
}

module.exports = new RdIpService();
