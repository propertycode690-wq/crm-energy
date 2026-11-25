/**
 * Enterprise Governance & Quality Assurance Controller
 * Master Prompt 16: IP Management, SOP Compliance, Audit Logs, API Keys & Universal Exports
 */

const rdIpService = require('../services/rdIpService');
const rdComplianceService = require('../services/rdComplianceService');
const rdAuditService = require('../services/rdAuditService');
const rdApiKeyService = require('../services/rdApiKeyService');
const rdUniversalExportService = require('../services/rdUniversalExportService');

class RdEnterpriseController {
  extractActorInfo(req) {
    return {
      name: req.user?.name || req.user?.email || 'Authenticated User',
      ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'EgoLytics/Enterprise'
    };
  }

  // ==========================================
  // INTELLECTUAL PROPERTY & PATENTS
  // ==========================================

  async listIpAssets(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const result = await rdIpService.listIpAssets(tenantId, req.query);
      return res.status(200).json({ success: true, data: result.assets, pagination: result.pagination });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async getIpAsset(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const asset = await rdIpService.getIpAssetById(tenantId, req.params.id);
      return res.status(200).json({ success: true, data: asset });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async createIpAsset(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const asset = await rdIpService.createIpAsset(tenantId, userId, req.body, actorInfo);
      return res.status(201).json({ success: true, data: asset, message: 'IP Asset registered successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async updateIpAsset(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const asset = await rdIpService.updateIpAsset(tenantId, req.params.id, req.body, userId, actorInfo);
      return res.status(200).json({ success: true, data: asset, message: 'IP Asset updated successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async deleteIpAsset(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const result = await rdIpService.deleteIpAsset(tenantId, req.params.id, userId, actorInfo);
      return res.status(200).json({ success: true, data: result, message: 'IP Asset deleted successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async getIpMetrics(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const metrics = await rdIpService.getIpMetrics(tenantId);
      return res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  // ==========================================
  // REGULATORY COMPLIANCE & SOPS
  // ==========================================

  async listSops(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const result = await rdComplianceService.listSops(tenantId, req.query);
      return res.status(200).json({ success: true, data: result.sops, pagination: result.pagination });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async getSop(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const sop = await rdComplianceService.getSopById(tenantId, req.params.id);
      return res.status(200).json({ success: true, data: sop });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async createSop(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const sop = await rdComplianceService.createSop(tenantId, userId, req.body, actorInfo);
      return res.status(201).json({ success: true, data: sop, message: 'SOP created successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async updateSop(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const sop = await rdComplianceService.updateSop(tenantId, req.params.id, req.body, userId, actorInfo);
      return res.status(200).json({ success: true, data: sop, message: 'SOP updated successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async approveSop(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const { comments, isApproved = true } = req.body;
      const sop = await rdComplianceService.approveSop(tenantId, req.params.id, userId, { comments, isApproved }, actorInfo);
      return res.status(200).json({ success: true, data: sop, message: `SOP ${isApproved ? 'approved' : 'rejected'} successfully` });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async addChecklistItem(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const sop = await rdComplianceService.addChecklistItem(tenantId, req.params.id, req.body, userId, actorInfo);
      return res.status(200).json({ success: true, data: sop, message: 'Checklist step added successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async recordIncident(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const sop = await rdComplianceService.recordIncident(tenantId, req.params.id, req.body, userId, actorInfo);
      return res.status(200).json({ success: true, data: sop, message: 'Non-compliance incident recorded' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async getComplianceMetrics(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const metrics = await rdComplianceService.getComplianceMetrics(tenantId);
      return res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  // ==========================================
  // ENTERPRISE AUDIT TRAIL
  // ==========================================

  async listAuditLogs(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const result = await rdAuditService.listAuditLogs(tenantId, req.query);
      return res.status(200).json({ success: true, data: result.logs, pagination: result.pagination });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async getAuditMetrics(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const metrics = await rdAuditService.getAuditMetrics(tenantId);
      return res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  // ==========================================
  // SCOPED API KEYS
  // ==========================================

  async listApiKeys(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const keys = await rdApiKeyService.listKeys(tenantId);
      return res.status(200).json({ success: true, data: keys });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async generateApiKey(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const newKey = await rdApiKeyService.generateKey(tenantId, userId, req.body, actorInfo);
      return res.status(201).json({
        success: true,
        data: newKey,
        message: 'API Key generated. Copy the raw key immediately; it will not be displayed again.'
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  async revokeApiKey(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const actorInfo = this.extractActorInfo(req);
      const result = await rdApiKeyService.revokeKey(tenantId, req.params.id, userId, actorInfo);
      return res.status(200).json({ success: true, data: result, message: 'API Key revoked successfully' });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }

  // ==========================================
  // UNIVERSAL DATA EXPORT
  // ==========================================

  async exportData(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const actorInfo = this.extractActorInfo(req);
      const { entityType = 'projects', format = 'json' } = req.query;

      const exportResult = await rdUniversalExportService.exportData(tenantId, {
        entityType,
        format,
        userId: req.user.id
      }, actorInfo);

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      return res.status(200).send(exportResult.payload);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new RdEnterpriseController();

