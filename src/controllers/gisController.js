const gisSearchService = require('../services/gisSearchService');
const gisTerritoryService = require('../services/gisTerritoryService');
const prisma = require('../config/prisma');

class GisController {
  /**
   * GET /api/gis/workspace/telemetry
   */
  async getWorkspaceTelemetry(req, res, next) {
    try {
      const tenantId = req.user.tenantId;

      const [layers, territories, regions, files, arcgisConfig] = await Promise.all([
        gisTerritoryService.getLayers(tenantId),
        gisTerritoryService.getTerritories(tenantId),
        gisTerritoryService.getRegions(tenantId),
        gisTerritoryService.getUploadedFiles(tenantId),
        gisTerritoryService.getArcgisConfig(tenantId),
      ]);

      return res.json({
        success: true,
        data: {
          layers,
          territoriesCount: territories.length,
          regionsCount: regions.length,
          filesCount: files.length,
          arcgisStatus: arcgisConfig?.status || 'DISCONNECTED',
          territories: territories.slice(0, 10),
          regions,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/search
   * Unified 7-Search Mode Endpoint
   */
  async search(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { searchMode, params } = req.body;
      const result = await gisSearchService.executeSearch(tenantId, searchMode, params || req.body);
      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/files/upload
   */
  async uploadFile(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { filename, rawContent, fileType } = req.body;
      const result = await gisTerritoryService.uploadGisFile(
        tenantId,
        { filename, rawContent, fileType },
        userId
      );
      return res.status(201).json({
        success: true,
        message: `GIS file '${filename}' imported successfully with ${result.featureCount} features.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/files
   */
  async getUploadedFiles(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const files = await gisTerritoryService.getUploadedFiles(tenantId);
      return res.json({ success: true, data: files });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/regions
   */
  async getRegions(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const regions = await gisTerritoryService.getRegions(tenantId, req.query);
      return res.json({ success: true, data: regions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/regions
   */
  async createRegion(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const region = await gisTerritoryService.createRegion(tenantId, req.body, userId);
      return res.status(201).json({ success: true, data: region });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/gis/regions/:id
   */
  async updateRegion(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const region = await gisTerritoryService.updateRegion(tenantId, req.params.id, req.body, userId);
      return res.json({ success: true, data: region });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/gis/regions/:id
   */
  async deleteRegion(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const result = await gisTerritoryService.deleteRegion(tenantId, req.params.id, userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/territories
   */
  async getTerritories(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const territories = await gisTerritoryService.getTerritories(tenantId, req.query);
      return res.json({ success: true, count: territories.length, data: territories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/territories/:id
   */
  async getTerritoryById(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const territory = await gisTerritoryService.getTerritoryById(tenantId, req.params.id);
      return res.json({ success: true, data: territory });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/territories
   */
  async createTerritory(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const territory = await gisTerritoryService.createTerritory(tenantId, req.body, userId);
      return res.status(201).json({ success: true, data: territory });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/gis/territories/:id
   */
  async updateTerritory(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const territory = await gisTerritoryService.updateTerritory(tenantId, req.params.id, req.body, userId);
      return res.json({ success: true, data: territory });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/gis/territories/:id
   */
  async deleteTerritory(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const result = await gisTerritoryService.deleteTerritory(tenantId, req.params.id, userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/layers
   */
  async getLayers(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const layers = await gisTerritoryService.getLayers(tenantId);
      return res.json({ success: true, data: layers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/gis/layers/:id
   */
  async updateLayer(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const layer = await gisTerritoryService.updateLayer(tenantId, req.params.id, req.body, userId);
      return res.json({ success: true, data: layer });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/features
   */
  async getFeatures(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const features = await gisTerritoryService.getFeatures(tenantId, req.query);
      return res.json({ success: true, count: features.length, data: features });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/features
   */
  async createFeature(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const feature = await gisTerritoryService.createFeature(tenantId, req.body, userId);
      return res.status(201).json({ success: true, data: feature });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/gis/features/:id
   */
  async deleteFeature(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const result = await gisTerritoryService.deleteFeature(tenantId, req.params.id, userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/realignments
   */
  async getRealignments(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const realignments = await gisTerritoryService.getRealignments(tenantId, req.query);
      return res.json({ success: true, data: realignments });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/realignments
   */
  async createRealignment(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const realignment = await gisTerritoryService.createRealignmentProposal(tenantId, req.body, userId);
      return res.status(201).json({ success: true, data: realignment });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/realignments/:id/submit
   */
  async submitRealignment(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const realignment = await gisTerritoryService.submitRealignment(tenantId, req.params.id, userId);
      return res.json({ success: true, data: realignment });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/realignments/:id/approve
   */
  async approveRealignment(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const result = await gisTerritoryService.approveRealignment(tenantId, req.params.id, userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/realignments/:id/reject
   */
  async rejectRealignment(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { justification } = req.body;
      const realignment = await gisTerritoryService.rejectRealignment(tenantId, req.params.id, justification, userId);
      return res.json({ success: true, data: realignment });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/arcgis/config
   */
  async getArcgisConfig(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const config = await gisTerritoryService.getArcgisConfig(tenantId);
      return res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/arcgis/config
   */
  async saveArcgisConfig(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const config = await gisTerritoryService.saveArcgisConfig(tenantId, req.body, userId);
      return res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/gis/arcgis/test
   */
  async testArcgisConnection(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { serviceName } = req.body;
      const result = await gisTerritoryService.testArcgisConnection(tenantId, serviceName);
      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/gis/audit-logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const logs = await gisTerritoryService.getAuditLogs(tenantId, req.query);
      return res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new GisController();

