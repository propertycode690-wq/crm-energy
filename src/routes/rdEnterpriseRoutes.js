/**
 * Enterprise Governance & Quality Assurance Routes
 * Master Prompt 16: IP Management, SOP Compliance, Audit Logs, API Keys & Universal Exports
 */

const express = require('express');
const router = express.Router();
const rdEnterpriseController = require('../controllers/rdEnterpriseController');
const { dualAuth, requireScope } = require('../middleware/apiKeyAuth');

// Bind controller context
const ctrl = rdEnterpriseController;

// ==========================================
// INTELLECTUAL PROPERTY & PATENTS
// ==========================================
router.get('/ip/metrics', dualAuth, requireScope('rd:read'), (req, res) => ctrl.getIpMetrics(req, res));
router.get('/ip', dualAuth, requireScope('rd:read'), (req, res) => ctrl.listIpAssets(req, res));
router.get('/ip/:id', dualAuth, requireScope('rd:read'), (req, res) => ctrl.getIpAsset(req, res));
router.post('/ip', dualAuth, requireScope('rd:write'), (req, res) => ctrl.createIpAsset(req, res));
router.put('/ip/:id', dualAuth, requireScope('rd:write'), (req, res) => ctrl.updateIpAsset(req, res));
router.delete('/ip/:id', dualAuth, requireScope('rd:write'), (req, res) => ctrl.deleteIpAsset(req, res));

// ==========================================
// REGULATORY COMPLIANCE & SOPS
// ==========================================
router.get('/compliance/metrics', dualAuth, requireScope('rd:read'), (req, res) => ctrl.getComplianceMetrics(req, res));
router.get('/compliance/sops', dualAuth, requireScope('rd:read'), (req, res) => ctrl.listSops(req, res));
router.get('/compliance/sops/:id', dualAuth, requireScope('rd:read'), (req, res) => ctrl.getSop(req, res));
router.post('/compliance/sops', dualAuth, requireScope('rd:write'), (req, res) => ctrl.createSop(req, res));
router.put('/compliance/sops/:id', dualAuth, requireScope('rd:write'), (req, res) => ctrl.updateSop(req, res));
router.post('/compliance/sops/:id/approve', dualAuth, requireScope('rd:write'), (req, res) => ctrl.approveSop(req, res));
router.post('/compliance/sops/:id/checklists', dualAuth, requireScope('rd:write'), (req, res) => ctrl.addChecklistItem(req, res));
router.post('/compliance/sops/:id/incidents', dualAuth, requireScope('rd:write'), (req, res) => ctrl.recordIncident(req, res));

// ==========================================
// ENTERPRISE AUDIT TRAIL
// ==========================================
router.get('/audit/metrics', dualAuth, requireScope('rd:read'), (req, res) => ctrl.getAuditMetrics(req, res));
router.get('/audit/logs', dualAuth, requireScope('rd:read'), (req, res) => ctrl.listAuditLogs(req, res));

// ==========================================
// SCOPED API KEYS
// ==========================================
router.get('/apikeys', dualAuth, requireScope('rd:admin'), (req, res) => ctrl.listApiKeys(req, res));
router.post('/apikeys', dualAuth, requireScope('rd:admin'), (req, res) => ctrl.generateApiKey(req, res));
router.delete('/apikeys/:id', dualAuth, requireScope('rd:admin'), (req, res) => ctrl.revokeApiKey(req, res));

// ==========================================
// UNIVERSAL DATA EXPORT
// ==========================================
router.get('/export', dualAuth, requireScope('rd:export'), (req, res) => ctrl.exportData(req, res));

module.exports = router;

