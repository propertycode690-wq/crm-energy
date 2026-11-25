const express = require('express');
const router = express.Router();
const gisController = require('../controllers/gisController');
const { authenticateToken } = require('../middleware/auth');
const { validateTenantScope } = require('../middleware/tenantIsolation');

// All GIS & Territory Management endpoints require verified JWT session and strict tenant scoping
router.use(authenticateToken);
router.use(validateTenantScope);

// ==============================================================================
// 1. WORKSPACE TELEMETRY & 7 SEARCH MODES
// ==============================================================================
router.get('/workspace/telemetry', (req, res, next) => gisController.getWorkspaceTelemetry(req, res, next));
router.post('/search', (req, res, next) => gisController.search(req, res, next));

// ==============================================================================
// 2. GEOGRAPHIC FILE UPLOAD & INGESTION (GEOJSON, KML)
// ==============================================================================
router.post('/files/upload', (req, res, next) => gisController.uploadFile(req, res, next));
router.get('/files', (req, res, next) => gisController.getUploadedFiles(req, res, next));

// ==============================================================================
// 3. REGIONS & TERRITORIES MANAGEMENT
// ==============================================================================
router.get('/regions', (req, res, next) => gisController.getRegions(req, res, next));
router.post('/regions', (req, res, next) => gisController.createRegion(req, res, next));
router.put('/regions/:id', (req, res, next) => gisController.updateRegion(req, res, next));
router.delete('/regions/:id', (req, res, next) => gisController.deleteRegion(req, res, next));

router.get('/territories', (req, res, next) => gisController.getTerritories(req, res, next));
router.post('/territories', (req, res, next) => gisController.createTerritory(req, res, next));
router.get('/territories/:id', (req, res, next) => gisController.getTerritoryById(req, res, next));
router.put('/territories/:id', (req, res, next) => gisController.updateTerritory(req, res, next));
router.delete('/territories/:id', (req, res, next) => gisController.deleteTerritory(req, res, next));

// ==============================================================================
// 4. MAP LAYERS & SPATIAL FEATURES (DRAWING)
// ==============================================================================
router.get('/layers', (req, res, next) => gisController.getLayers(req, res, next));
router.put('/layers/:id', (req, res, next) => gisController.updateLayer(req, res, next));

router.get('/features', (req, res, next) => gisController.getFeatures(req, res, next));
router.post('/features', (req, res, next) => gisController.createFeature(req, res, next));
router.delete('/features/:id', (req, res, next) => gisController.deleteFeature(req, res, next));

// ==============================================================================
// 5. TERRITORY REALIGNMENT & DRAFTS WORKFLOW
// ==============================================================================
router.get('/realignments', (req, res, next) => gisController.getRealignments(req, res, next));
router.post('/realignments', (req, res, next) => gisController.createRealignment(req, res, next));
router.post('/realignments/:id/submit', (req, res, next) => gisController.submitRealignment(req, res, next));
router.post('/realignments/:id/approve', (req, res, next) => gisController.approveRealignment(req, res, next));
router.post('/realignments/:id/reject', (req, res, next) => gisController.rejectRealignment(req, res, next));

// ==============================================================================
// 6. ARCGIS INTEGRATION CONFIGURATION & HANDSHAKE
// ==============================================================================
router.get('/arcgis/config', (req, res, next) => gisController.getArcgisConfig(req, res, next));
router.post('/arcgis/config', (req, res, next) => gisController.saveArcgisConfig(req, res, next));
router.post('/arcgis/test', (req, res, next) => gisController.testArcgisConnection(req, res, next));

// ==============================================================================
// 7. AUDIT LOGS
// ==============================================================================
router.get('/audit-logs', (req, res, next) => gisController.getAuditLogs(req, res, next));

module.exports = router;

