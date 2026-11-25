/**
 * BFOV Charts — Routes
 * Master Prompt 14 & 15: Core & Advanced REST API routes
 */

const express = require('express');
const router = express.Router();
const bfovController = require('../controllers/bfovController');
const { authenticateToken } = require('../middleware/auth');
const { validateTenantScope } = require('../middleware/tenantIsolation');

// All diagramming routes require verified authentication and tenant isolation
router.use(authenticateToken);
router.use(validateTenantScope);

// Telemetry & blueprints
router.get('/telemetry', (req, res) => bfovController.getWorkspaceTelemetry(req, res));
router.get('/templates', (req, res) => bfovController.listTemplates(req, res));
router.post('/from-template', (req, res) => bfovController.createFromTemplate(req, res));
router.post('/:id/save-template', (req, res) => bfovController.saveAsTemplate(req, res));

// Geometry & calculation helpers
router.post('/helpers/route', (req, res) => bfovController.computeEdgeRoute(req, res));
router.post('/helpers/align', (req, res) => bfovController.alignNodes(req, res));

// Mermaid Import Engine
router.post('/mermaid/parse', (req, res) => bfovController.parseMermaid(req, res));
router.post('/mermaid/import', (req, res) => bfovController.importMermaid(req, res));

// AI Text-to-Diagram & AI-Assisted Editing
router.get('/ai/status', (req, res) => bfovController.getAiStatus(req, res));
router.post('/ai/generate', (req, res) => bfovController.generateDiagramFromAi(req, res));
router.post('/ai/edit', (req, res) => bfovController.editDiagramFromAi(req, res));

// Multi-Format Export & Safe Import
router.get('/:id/export/svg', (req, res) => bfovController.exportSvg(req, res));
router.get('/:id/export/json', (req, res) => bfovController.exportJson(req, res));
router.get('/:id/export/pdf', (req, res) => bfovController.exportPdf(req, res));
router.post('/import/json', (req, res) => bfovController.importJson(req, res));

// Sharing & Collaborators
router.get('/:id/shares', (req, res) => bfovController.listShares(req, res));
router.post('/:id/shares', (req, res) => bfovController.addShare(req, res));
router.delete('/shares/:shareId', (req, res) => bfovController.removeShare(req, res));

// Contextual Comments
router.get('/:id/comments', (req, res) => bfovController.listComments(req, res));
router.post('/:id/comments', (req, res) => bfovController.addComment(req, res));
router.patch('/comments/:commentId/resolve', (req, res) => bfovController.resolveComment(req, res));
router.delete('/comments/:commentId', (req, res) => bfovController.deleteComment(req, res));

// Diagram CRUD
router.get('/', (req, res) => bfovController.listDiagrams(req, res));
router.post('/', (req, res) => bfovController.createDiagram(req, res));
router.get('/:id', (req, res) => bfovController.getDiagramById(req, res));
router.put('/:id', (req, res) => bfovController.updateDiagram(req, res));
router.delete('/:id', (req, res) => bfovController.deleteDiagram(req, res));

// Duplication & version history
router.post('/:id/duplicate', (req, res) => bfovController.duplicateDiagram(req, res));
router.get('/:id/versions', (req, res) => bfovController.getVersions(req, res));
router.post('/:id/restore', (req, res) => bfovController.restoreVersion(req, res));

module.exports = router;
