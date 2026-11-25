/**
 * BFOV Charts — Diagram Management Service
 * Master Prompt 14: Core Diagramming Engine business logic, persistence, and versioning
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bfovValidationService = require('./bfovValidationService');
const bfovRoutingEngine = require('./bfovRoutingEngine');

class BfovDiagramService {
  /**
   * List diagrams for a tenant with search, filtering, and pagination
   */
  async listDiagrams(tenantId, options = {}) {
    const {
      search,
      diagramType,
      category,
      projectId,
      userId,
      isTemplate,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    const where = { tenantId };

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } }
      ];
    }

    if (diagramType && diagramType !== 'ALL') {
      where.diagramType = diagramType.toUpperCase();
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (isTemplate !== undefined) {
      where.isTemplate = isTemplate === true || isTemplate === 'true';
    }

    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * take;

    const [total, diagrams] = await Promise.all([
      prisma.bfovDiagram.count({ where }),
      prisma.bfovDiagram.findMany({
        where,
        take,
        skip,
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
          project: { select: { id: true, name: true, status: true } }
        }
      })
    ]);

    return {
      total,
      page: parseInt(page, 10) || 1,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
      diagrams
    };
  }

  /**
   * Get a single diagram by ID with full graphData
   */
  async getDiagramById(tenantId, diagramId) {
    const diagram = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true, status: true } },
        versions: {
          select: { id: true, version: true, title: true, changeSummary: true, nodeCount: true, edgeCount: true, createdAt: true },
          orderBy: { version: 'desc' }
        }
      }
    });

    if (!diagram) {
      throw new Error(`Diagram with ID '${diagramId}' not found or belongs to another tenant.`);
    }

    return diagram;
  }

  /**
   * Create a new diagram
   */
  async createDiagram(tenantId, userId, payload) {
    const validation = bfovValidationService.validateDiagramPayload(payload, false);
    if (!validation.isValid) {
      throw new Error(`Diagram validation failed: ${validation.errors.join('; ')}`);
    }

    const defaultGraph = {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    let graphData = defaultGraph;
    if (payload.graphData) {
      const graphValidation = bfovValidationService.validateGraphData(payload.graphData);
      if (!graphValidation.isValid) {
        throw new Error(`Graph data error: ${graphValidation.errors.join('; ')}`);
      }
      graphData = graphValidation.normalizedGraph;
    }

    const nodeCount = graphData.nodes?.length || 0;
    const edgeCount = graphData.edges?.length || 0;

    const diagram = await prisma.bfovDiagram.create({
      data: {
        tenantId,
        userId: userId || null,
        projectId: payload.projectId || null,
        title: payload.title.trim(),
        description: payload.description ? payload.description.trim() : null,
        diagramType: (payload.diagramType || 'FLOWCHART').toUpperCase(),
        category: payload.category || 'General',
        tags: payload.tags || [],
        isPublic: Boolean(payload.isPublic),
        isTemplate: Boolean(payload.isTemplate),
        version: 1,
        nodeCount,
        edgeCount,
        graphData,
        thumbnail: payload.thumbnail || null,
        metadata: payload.metadata || {
          gridSize: 10,
          snapToGrid: true,
          showGrid: true,
          authorName: payload.authorName || 'R&D Architect'
        }
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } }
      }
    });

    // Create initial version snapshot
    await prisma.bfovDiagramVersion.create({
      data: {
        diagramId: diagram.id,
        tenantId,
        version: 1,
        title: diagram.title,
        changeSummary: 'Initial diagram created',
        graphData,
        nodeCount,
        edgeCount,
        createdById: userId || null
      }
    });

    return diagram;
  }

  /**
   * Update an existing diagram and save version snapshot
   */
  async updateDiagram(tenantId, userId, diagramId, payload) {
    const existing = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });

    if (!existing) {
      throw new Error(`Diagram with ID '${diagramId}' not found.`);
    }

    const validation = bfovValidationService.validateDiagramPayload(payload, true);
    if (!validation.isValid) {
      throw new Error(`Diagram validation failed: ${validation.errors.join('; ')}`);
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (payload.title !== undefined) updateData.title = payload.title.trim();
    if (payload.description !== undefined) updateData.description = payload.description?.trim() || null;
    if (payload.diagramType !== undefined) updateData.diagramType = payload.diagramType.toUpperCase();
    if (payload.category !== undefined) updateData.category = payload.category;
    if (payload.tags !== undefined) updateData.tags = payload.tags;
    if (payload.isPublic !== undefined) updateData.isPublic = Boolean(payload.isPublic);
    if (payload.isTemplate !== undefined) updateData.isTemplate = Boolean(payload.isTemplate);
    if (payload.thumbnail !== undefined) updateData.thumbnail = payload.thumbnail;
    if (payload.projectId !== undefined) updateData.projectId = payload.projectId;
    if (payload.metadata !== undefined) updateData.metadata = payload.metadata;

    let hasGraphChange = false;
    let newGraphData = existing.graphData;
    let nodeCount = existing.nodeCount;
    let edgeCount = existing.edgeCount;

    if (payload.graphData !== undefined) {
      const graphValidation = bfovValidationService.validateGraphData(payload.graphData);
      if (!graphValidation.isValid) {
        throw new Error(`Graph data error: ${graphValidation.errors.join('; ')}`);
      }
      newGraphData = graphValidation.normalizedGraph;
      nodeCount = newGraphData.nodes?.length || 0;
      edgeCount = newGraphData.edges?.length || 0;
      updateData.graphData = newGraphData;
      updateData.nodeCount = nodeCount;
      updateData.edgeCount = edgeCount;
      hasGraphChange = true;
    }

    const newVersionNumber = existing.version + 1;
    updateData.version = newVersionNumber;

    const updated = await prisma.bfovDiagram.update({
      where: { id: diagramId },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } }
      }
    });

    // Save version record if graph content or title changed
    if (hasGraphChange || payload.title) {
      await prisma.bfovDiagramVersion.create({
        data: {
          diagramId,
          tenantId,
          version: newVersionNumber,
          title: updated.title,
          changeSummary: payload.changeSummary || `Updated diagram elements (${nodeCount} nodes, ${edgeCount} edges)`,
          graphData: newGraphData,
          nodeCount,
          edgeCount,
          createdById: userId || null
        }
      });
    }

    return updated;
  }

  /**
   * Duplicate an existing diagram
   */
  async duplicateDiagram(tenantId, userId, diagramId, customTitle) {
    const source = await this.getDiagramById(tenantId, diagramId);

    const title = customTitle || `${source.title} (Copy)`;
    const newDiagram = await this.createDiagram(tenantId, userId, {
      title,
      description: source.description ? `Duplicated from: ${source.title}. ${source.description}` : `Copy of ${source.title}`,
      diagramType: source.diagramType,
      category: source.category,
      tags: source.tags,
      projectId: source.projectId,
      graphData: source.graphData,
      thumbnail: source.thumbnail,
      metadata: source.metadata
    });

    return newDiagram;
  }

  /**
   * Delete a diagram and its version history
   */
  async deleteDiagram(tenantId, diagramId) {
    const existing = await prisma.bfovDiagram.findFirst({
      where: { id: diagramId, tenantId }
    });

    if (!existing) {
      throw new Error(`Diagram with ID '${diagramId}' not found.`);
    }

    await prisma.bfovDiagram.delete({
      where: { id: diagramId }
    });

    return {
      success: true,
      deletedId: diagramId,
      message: `Diagram '${existing.title}' deleted successfully.`
    };
  }

  /**
   * List available built-in and user templates
   */
  async listTemplates(category, diagramType) {
    const where = {};
    if (category && category !== 'ALL') where.category = category;
    if (diagramType && diagramType !== 'ALL') where.diagramType = diagramType.toUpperCase();

    const templates = await prisma.bfovDiagramTemplate.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    return templates;
  }

  /**
   * Instantiate a new diagram from a template blueprint
   */
  async createFromTemplate(tenantId, userId, templateKey, customTitle) {
    const template = await prisma.bfovDiagramTemplate.findUnique({
      where: { templateKey }
    });

    if (!template) {
      throw new Error(`Template '${templateKey}' not found.`);
    }

    const title = customTitle || template.title;
    const diagram = await this.createDiagram(tenantId, userId, {
      title,
      description: template.description,
      diagramType: template.diagramType,
      category: template.category,
      tags: [template.category.toLowerCase(), 'template', template.diagramType.toLowerCase()],
      graphData: template.defaultGraphData,
      metadata: {
        sourceTemplate: templateKey,
        instantiatedAt: new Date().toISOString()
      }
    });

    return diagram;
  }

  /**
   * Get version history for a diagram
   */
  async getVersions(tenantId, diagramId) {
    const versions = await prisma.bfovDiagramVersion.findMany({
      where: { diagramId, tenantId },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    return versions;
  }

  /**
   * Restore diagram to a previous version snapshot
   */
  async restoreVersion(tenantId, userId, diagramId, targetVersion) {
    const versionRecord = await prisma.bfovDiagramVersion.findFirst({
      where: { diagramId, tenantId, version: parseInt(targetVersion, 10) }
    });

    if (!versionRecord) {
      throw new Error(`Version ${targetVersion} for diagram '${diagramId}' not found.`);
    }

    return this.updateDiagram(tenantId, userId, diagramId, {
      title: versionRecord.title,
      graphData: versionRecord.graphData,
      changeSummary: `Reverted to version ${targetVersion}`
    });
  }

  /**
   * Get workspace telemetry and stats
   */
  async getWorkspaceTelemetry(tenantId) {
    const [totalDiagrams, typeCounts, recentDiagrams, templatesCount] = await Promise.all([
      prisma.bfovDiagram.count({ where: { tenantId } }),
      prisma.bfovDiagram.groupBy({
        by: ['diagramType'],
        where: { tenantId },
        _count: { id: true }
      }),
      prisma.bfovDiagram.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, diagramType: true, nodeCount: true, edgeCount: true, updatedAt: true }
      }),
      prisma.bfovDiagramTemplate.count()
    ]);

    const distribution = {};
    for (const item of typeCounts) {
      distribution[item.diagramType] = item._count.id;
    }

    return {
      status: 'ACTIVE',
      engine: 'BFOV Core Visual Diagramming Engine v1.0',
      totalDiagrams,
      templatesAvailable: templatesCount,
      distribution,
      recentDiagrams,
      supportedTypes: bfovValidationService.getSupportedTypes()
    };
  }
}

module.exports = new BfovDiagramService();

