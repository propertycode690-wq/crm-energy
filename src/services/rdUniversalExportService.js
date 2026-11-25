/**
 * Universal Data Portability & Export Service
 * Master Prompt 16: Multi-Entity, Multi-Format (CSV, JSON, PDF Summary) Universal Exporter
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const rdAuditService = require('./rdAuditService');

class RdUniversalExportService {
  /**
   * Escape and format CSV fields per RFC 4180
   */
  escapeCsvField(val) {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'object') {
      try {
        val = JSON.stringify(val);
      } catch (e) {
        val = String(val);
      }
    } else {
      val = String(val);
    }
    // Replace quotes with double quotes and wrap in quotes
    return `"${val.replace(/"/g, '""')}"`;
  }

  /**
   * Convert array of objects to CSV string
   */
  convertToCsv(records, fields) {
    if (!records || records.length === 0) {
      return fields.join(',') + '\n';
    }

    const header = fields.map(f => this.escapeCsvField(f)).join(',');
    const rows = records.map(record => {
      return fields.map(f => this.escapeCsvField(record[f])).join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Universal export handler
   */
  async exportData(tenantId, options = {}, actorInfo = {}) {
    const {
      entityType = 'projects',
      format = 'json',
      filters = {},
      userId = null
    } = options;

    const normalizedEntity = entityType.toLowerCase();
    const normalizedFormat = format.toLowerCase();

    let records = [];
    let fields = [];
    let filenameBase = `egolytics_${normalizedEntity}_${Date.now()}`;

    switch (normalizedEntity) {
      case 'projects':
        records = await prisma.erpProject.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            name: true,
            client: true,
            status: true,
            priority: true,
            budget: true,
            spent: true,
            progress: true,
            startDate: true,
            deadline: true,
            createdAt: true
          }
        });
        fields = ['id', 'name', 'client', 'status', 'priority', 'budget', 'spent', 'progress', 'startDate', 'deadline', 'createdAt'];
        break;

      case 'ideas':
      case 'proposals':
        records = await prisma.projectProposal.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            category: true,
            status: true,
            estimatedBudget: true,
            feasibilityScore: true,
            createdAt: true
          }
        });
        fields = ['id', 'referenceNumber', 'title', 'category', 'status', 'estimatedBudget', 'feasibilityScore', 'createdAt'];
        break;

      case 'tasks':
        records = await prisma.projectTask.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            progress: true,
            startDate: true,
            dueDate: true,
            createdAt: true
          }
        });
        fields = ['id', 'taskNumber', 'title', 'status', 'priority', 'progress', 'startDate', 'dueDate', 'createdAt'];
        break;

      case 'experiments':
        records = await prisma.researchExperiment.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            experimentCode: true,
            title: true,
            status: true,
            methodology: true,
            startDate: true,
            conclusionDate: true,
            createdAt: true
          }
        });
        fields = ['id', 'experimentCode', 'title', 'status', 'methodology', 'startDate', 'conclusionDate', 'createdAt'];
        break;

      case 'ip_assets':
      case 'patents':
        records = await prisma.rdIpAsset.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            jurisdiction: true,
            applicationNumber: true,
            patentNumber: true,
            filingDate: true,
            grantDate: true,
            createdAt: true
          }
        });
        fields = ['id', 'title', 'category', 'status', 'jurisdiction', 'applicationNumber', 'patentNumber', 'filingDate', 'grantDate', 'createdAt'];
        break;

      case 'compliance_sops':
      case 'sops':
        records = await prisma.rdComplianceSop.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            sopIdentifier: true,
            title: true,
            version: true,
            category: true,
            approvalStatus: true,
            regulatoryStandard: true,
            effectiveDate: true,
            createdAt: true
          }
        });
        fields = ['id', 'sopIdentifier', 'title', 'version', 'category', 'approvalStatus', 'regulatoryStandard', 'effectiveDate', 'createdAt'];
        break;

      case 'audit_logs':
        records = await prisma.rdEnterpriseAuditLog.findMany({
          where: { tenantId },
          take: 1000,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            actorName: true,
            action: true,
            entityType: true,
            entityId: true,
            ipAddress: true,
            createdAt: true
          }
        });
        fields = ['id', 'actorName', 'action', 'entityType', 'entityId', 'ipAddress', 'createdAt'];
        break;

      case 'diagrams':
        records = await prisma.bfovDiagram.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            title: true,
            diagramType: true,
            category: true,
            version: true,
            nodeCount: true,
            edgeCount: true,
            createdAt: true,
            updatedAt: true
          }
        });
        fields = ['id', 'title', 'diagramType', 'category', 'version', 'nodeCount', 'edgeCount', 'createdAt', 'updatedAt'];
        break;

      case 'gis_territories':
        records = await prisma.gisTerritory.findMany({
          where: { tenantId },
          take: 1000,
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            status: true,
            areaSqKm: true,
            colorHex: true,
            createdAt: true
          }
        });
        fields = ['id', 'name', 'code', 'category', 'status', 'areaSqKm', 'colorHex', 'createdAt'];
        break;

      default:
        throw new Error(`Unsupported export entity type: ${entityType}`);
    }

    // Format output
    let payload;
    let contentType;
    let filename;

    if (normalizedFormat === 'csv') {
      payload = this.convertToCsv(records, fields);
      contentType = 'text/csv; charset=utf-8';
      filename = `${filenameBase}.csv`;
    } else if (normalizedFormat === 'pdf_summary' || normalizedFormat === 'pdf') {
      payload = JSON.stringify({
        reportTitle: `EgoLytics R&D Enterprise Export - ${normalizedEntity.toUpperCase()}`,
        generatedAt: new Date().toISOString(),
        tenantId,
        totalRecords: records.length,
        exportedBy: actorInfo.name || 'System User',
        schema: fields,
        summaryMetrics: {
          recordCount: records.length,
          exportTimestamp: Date.now()
        },
        records: records.slice(0, 500)
      }, null, 2);
      contentType = 'application/json'; // Structured document format ready for PDF print engine
      filename = `${filenameBase}_report.json`;
    } else {
      // Default to JSON
      payload = JSON.stringify({
        meta: {
          entityType: normalizedEntity,
          tenantId,
          count: records.length,
          exportedAt: new Date().toISOString()
        },
        data: records
      }, null, 2);
      contentType = 'application/json; charset=utf-8';
      filename = `${filenameBase}.json`;
    }

    // Log the export event in audit logs
    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'Enterprise Exporter',
      action: 'EXPORT_DATA',
      entityType: normalizedEntity.toUpperCase(),
      entityId: filename,
      details: { format: normalizedFormat, recordCount: records.length },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return {
      payload,
      contentType,
      filename,
      recordCount: records.length
    };
  }
}

module.exports = new RdUniversalExportService();
