/**
 * BFOV Charts — Controller
 * Master Prompt 14 & 15: Core & Advanced REST endpoints
 */

const bfovDiagramService = require('../services/bfovDiagramService');
const bfovRoutingEngine = require('../services/bfovRoutingEngine');
const bfovMermaidService = require('../services/bfovMermaidService');
const bfovAiService = require('../services/bfovAiService');
const bfovExportService = require('../services/bfovExportService');
const bfovCollaborationService = require('../services/bfovCollaborationService');

class BfovController {
  // Telemetry & Blueprints
  async getWorkspaceTelemetry(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const telemetry = await bfovDiagramService.getWorkspaceTelemetry(tenantId);
      const aiStatus = await bfovAiService.getAiProviderStatus();
      return res.json({ success: true, telemetry: { ...telemetry, aiStatus } });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async listTemplates(req, res) {
    try {
      const { category, diagramType } = req.query;
      const templates = await bfovDiagramService.listTemplates(category, diagramType);
      return res.json({ success: true, templates });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async createFromTemplate(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { templateKey, customTitle } = req.body;

      if (!templateKey) {
        return res.status(400).json({ success: false, error: 'templateKey is required.' });
      }

      const diagram = await bfovDiagramService.createFromTemplate(tenantId, userId, templateKey, customTitle);
      return res.status(201).json({ success: true, diagram });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async saveAsTemplate(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { id } = req.params;
      const template = await bfovCollaborationService.saveAsTemplate(tenantId, userId, id, req.body);
      return res.status(201).json({ success: true, template });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Diagram CRUD
  async listDiagrams(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const result = await bfovDiagramService.listDiagrams(tenantId, req.query);
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async getDiagramById(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const diagram = await bfovDiagramService.getDiagramById(tenantId, id);
      return res.json({ success: true, diagram });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, error: err.message });
    }
  }

  async createDiagram(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const diagram = await bfovDiagramService.createDiagram(tenantId, userId, req.body);
      return res.status(201).json({ success: true, diagram });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async updateDiagram(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { id } = req.params;
      const diagram = await bfovDiagramService.updateDiagram(tenantId, userId, id, req.body);
      return res.json({ success: true, diagram });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }
  }

  async duplicateDiagram(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { id } = req.params;
      const { title } = req.body;
      const diagram = await bfovDiagramService.duplicateDiagram(tenantId, userId, id, title);
      return res.status(201).json({ success: true, diagram });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }
  }

  async deleteDiagram(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const result = await bfovDiagramService.deleteDiagram(tenantId, id);
      return res.json({ success: true, ...result });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, error: err.message });
    }
  }

  // Version history
  async getVersions(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const versions = await bfovDiagramService.getVersions(tenantId, id);
      return res.json({ success: true, versions });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async restoreVersion(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { id } = req.params;
      const { version } = req.body;
      if (!version) {
        return res.status(400).json({ success: false, error: 'version number is required to restore.' });
      }
      const diagram = await bfovDiagramService.restoreVersion(tenantId, userId, id, version);
      return res.json({ success: true, diagram });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Mermaid Import Engine
  async parseMermaid(req, res) {
    try {
      const { mermaidCode } = req.body;
      const parseResult = bfovMermaidService.parse(mermaidCode);
      if (!parseResult.isValid) {
        return res.status(400).json({ success: false, ...parseResult });
      }
      return res.json({ success: true, ...parseResult });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async importMermaid(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { mermaidCode, title, category } = req.body;

      const parseResult = bfovMermaidService.parse(mermaidCode);
      if (!parseResult.isValid) {
        return res.status(400).json({ success: false, error: 'Mermaid parsing failed', errors: parseResult.errors });
      }

      const diagram = await bfovDiagramService.createDiagram(tenantId, userId, {
        title: title || `Imported Mermaid (${parseResult.diagramType})`,
        description: `Imported from Mermaid syntax on ${new Date().toLocaleDateString()}`,
        diagramType: parseResult.diagramType,
        category: category || 'Architecture',
        tags: ['mermaid', 'imported', parseResult.diagramType.toLowerCase()],
        graphData: parseResult.graphData,
        metadata: {
          importedFrom: 'MERMAID',
          originalSourceLength: mermaidCode.length
        }
      });

      return res.status(201).json({ success: true, diagram, parseResult });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // AI Text-to-Diagram & Assisted Editing
  async getAiStatus(req, res) {
    try {
      const status = await bfovAiService.getAiProviderStatus();
      return res.json({ success: true, status });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async generateDiagramFromAi(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { prompt, diagramType } = req.body;

      const result = await bfovAiService.generateDiagramFromText({
        tenantId,
        userId,
        prompt,
        diagramType
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async editDiagramFromAi(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { diagramId, currentGraphData, editInstruction } = req.body;

      const result = await bfovAiService.editDiagramWithAi({
        tenantId,
        userId,
        diagramId,
        currentGraphData,
        editInstruction
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Multi-Format Export
  async exportSvg(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const diagram = await bfovDiagramService.getDiagramById(tenantId, id);
      const svg = bfovExportService.exportToSvg(diagram);

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${diagram.title.replace(/[^a-z0-9]/gi, '_')}.svg"`);
      return res.send(svg);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async exportJson(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const diagram = await bfovDiagramService.getDiagramById(tenantId, id);
      const json = bfovExportService.exportToJson(diagram);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${diagram.title.replace(/[^a-z0-9]/gi, '_')}.json"`);
      return res.json(json);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async exportPdf(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const diagram = await bfovDiagramService.getDiagramById(tenantId, id);
      const pdfBuffer = bfovExportService.exportToPdf(diagram);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${diagram.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Safe JSON Import
  async importJson(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { jsonData } = req.body;

      const val = bfovExportService.validateImportJson(jsonData);
      if (!val.isValid) {
        return res.status(400).json({ success: false, errors: val.errors });
      }

      const diagram = await bfovDiagramService.createDiagram(tenantId, userId, val.diagram);
      return res.status(201).json({ success: true, diagram });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Sharing & Granular Permissions
  async listShares(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const shares = await bfovCollaborationService.listShares(tenantId, id);
      return res.json({ success: true, shares });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async addShare(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const share = await bfovCollaborationService.shareDiagram(tenantId, id, req.body);
      return res.status(201).json({ success: true, share });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async removeShare(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { shareId } = req.params;
      const result = await bfovCollaborationService.removeShare(tenantId, shareId);
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Comments & Discussions
  async listComments(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { id } = req.params;
      const comments = await bfovCollaborationService.listComments(tenantId, id);
      return res.json({ success: true, comments });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async addComment(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const userId = req.user?.id;
      const { id } = req.params;
      const comment = await bfovCollaborationService.addComment(tenantId, userId, id, req.body);
      return res.status(201).json({ success: true, comment });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async resolveComment(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { commentId } = req.params;
      const { isResolved } = req.body;
      const comment = await bfovCollaborationService.resolveComment(tenantId, commentId, isResolved);
      return res.json({ success: true, comment });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async deleteComment(req, res) {
    try {
      const tenantId = req.user?.tenantId || req.tenantId;
      const { commentId } = req.params;
      const result = await bfovCollaborationService.deleteComment(tenantId, commentId);
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Helper APIs
  async computeEdgeRoute(req, res) {
    try {
      const { edge, nodeMap } = req.body;
      if (!edge || !nodeMap) {
        return res.status(400).json({ success: false, error: 'edge and nodeMap are required.' });
      }
      const route = bfovRoutingEngine.computeEdgeRoute(edge, nodeMap);
      return res.json({ success: true, route });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async alignNodes(req, res) {
    try {
      const { nodes, alignType } = req.body;
      if (!Array.isArray(nodes) || !alignType) {
        return res.status(400).json({ success: false, error: 'nodes array and alignType are required.' });
      }
      const aligned = bfovRoutingEngine.alignNodes(nodes, alignType);
      return res.json({ success: true, nodes: aligned });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new BfovController();
