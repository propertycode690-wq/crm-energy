/**
 * Enterprise Audit Service
 * Master Prompt 16: Immutable Enterprise Audit Trail & Governance Logging
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RdAuditService {
  /**
   * Sanitizes object to remove passwords, secrets, tokens
   */
  sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return details;
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'rawkey', 'apikey', 'authorization'];
    
    if (Array.isArray(details)) {
      return details.map(item => this.sanitizeDetails(item));
    }

    const sanitized = {};
    for (const [k, v] of Object.entries(details)) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
        sanitized[k] = '***REDACTED***';
      } else if (v && typeof v === 'object') {
        sanitized[k] = this.sanitizeDetails(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Append an immutable audit event
   */
  async logAuditEvent({
    tenantId,
    userId = null,
    actorName = 'System User',
    action,
    entityType,
    entityId,
    details = {},
    ipAddress = '127.0.0.1',
    userAgent = 'EgoLytics/Enterprise-Client'
  }) {
    if (!tenantId || !action || !entityType || !entityId) {
      console.warn('[AuditService] Missing required audit log params', { tenantId, action, entityType, entityId });
      return null;
    }

    try {
      const sanitized = this.sanitizeDetails(details);
      const log = await prisma.rdEnterpriseAuditLog.create({
        data: {
          tenantId,
          userId,
          actorName,
          action: action.toUpperCase(),
          entityType: entityType.toUpperCase(),
          entityId: String(entityId),
          details: sanitized,
          ipAddress,
          userAgent
        }
      });
      return log;
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err.message);
      return null;
    }
  }

  /**
   * List audit logs with multi-attribute filtering & pagination
   */
  async listAuditLogs(tenantId, options = {}) {
    const {
      action,
      entityType,
      userId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = options;

    const where = { tenantId };

    if (action && action !== 'ALL') {
      where.action = action.toUpperCase();
    }

    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType.toUpperCase();
    }

    if (userId) {
      where.userId = userId;
    }

    if (search && search.trim()) {
      where.OR = [
        { actorName: { contains: search.trim() } },
        { entityId: { contains: search.trim() } }
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const take = Math.min(100, parseInt(limit));

    const [logs, total] = await Promise.all([
      prisma.rdEnterpriseAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      }),
      prisma.rdEnterpriseAuditLog.count({ where })
    ]);

    return {
      logs,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  /**
   * Summary metrics for governance dashboards
   */
  async getAuditMetrics(tenantId) {
    const totalLogs = await prisma.rdEnterpriseAuditLog.count({ where: { tenantId } });
    const logs = await prisma.rdEnterpriseAuditLog.findMany({
      where: { tenantId },
      select: { action: true, entityType: true, createdAt: true },
      take: 1000,
      orderBy: { createdAt: 'desc' }
    });

    const actionCounts = {};
    const entityCounts = {};

    logs.forEach(l => {
      actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
      entityCounts[l.entityType] = (entityCounts[l.entityType] || 0) + 1;
    });

    return {
      totalLogs,
      actionDistribution: actionCounts,
      entityDistribution: entityCounts,
      recentActivityCount: logs.length
    };
  }
}

module.exports = new RdAuditService();

