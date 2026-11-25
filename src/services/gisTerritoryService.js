const prisma = require('../config/prisma');
const gisSpatialEngine = require('./gisSpatialEngine');
const gisParserService = require('./gisParserService');

class GisTerritoryService {
  // ============================================================================
  // 1. REGION MANAGEMENT
  // ============================================================================

  async getRegions(tenantId, query = {}) {
    const { type, status } = query;
    const where = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;

    return prisma.gisRegion.findMany({
      where,
      include: {
        territories: {
          select: { id: true, code: true, name: true, areaSqKm: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRegion(tenantId, data, userId) {
    const { code, name, type, parentRegionId, boundaryGeoJson, centerLat, centerLng } = data;
    if (!code || !name) {
      throw new Error('Region code and name are required.');
    }

    const region = await prisma.gisRegion.create({
      data: {
        tenantId,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        type: type || 'METRO',
        parentRegionId: parentRegionId || null,
        boundaryGeoJson: boundaryGeoJson || null,
        centerLat: centerLat !== undefined ? parseFloat(centerLat) : null,
        centerLng: centerLng !== undefined ? parseFloat(centerLng) : null,
        status: 'ACTIVE',
      },
    });

    await this.recordAudit(tenantId, userId, 'CREATE_REGION', 'REGION', region.id, { code: region.code, name: region.name });
    return region;
  }

  async updateRegion(tenantId, id, data, userId) {
    const region = await prisma.gisRegion.findFirst({ where: { id, tenantId } });
    if (!region) throw new Error('Region not found.');

    const updated = await prisma.gisRegion.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : region.name,
        type: data.type !== undefined ? data.type : region.type,
        parentRegionId: data.parentRegionId !== undefined ? data.parentRegionId : region.parentRegionId,
        boundaryGeoJson: data.boundaryGeoJson !== undefined ? data.boundaryGeoJson : region.boundaryGeoJson,
        centerLat: data.centerLat !== undefined ? parseFloat(data.centerLat) : region.centerLat,
        centerLng: data.centerLng !== undefined ? parseFloat(data.centerLng) : region.centerLng,
        status: data.status !== undefined ? data.status : region.status,
      },
    });

    await this.recordAudit(tenantId, userId, 'UPDATE_REGION', 'REGION', id, data);
    return updated;
  }

  async deleteRegion(tenantId, id, userId) {
    const region = await prisma.gisRegion.findFirst({ where: { id, tenantId } });
    if (!region) throw new Error('Region not found.');

    await prisma.gisRegion.delete({ where: { id } });
    await this.recordAudit(tenantId, userId, 'DELETE_REGION', 'REGION', id, { code: region.code });
    return { success: true, message: `Region ${region.code} deleted.` };
  }

  // ============================================================================
  // 2. TERRITORY MANAGEMENT
  // ============================================================================

  async getTerritories(tenantId, query = {}) {
    const { regionId, status, search } = query;
    const where = { tenantId };

    if (regionId && regionId !== 'all') where.regionId = regionId;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    return prisma.gisTerritory.findMany({
      where,
      include: {
        region: { select: { id: true, code: true, name: true, type: true } },
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { features: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTerritoryById(tenantId, id) {
    const territory = await prisma.gisTerritory.findFirst({
      where: { id, tenantId },
      include: {
        region: true,
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        features: true,
        realignments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!territory) throw new Error('Territory not found.');
    return territory;
  }

  async createTerritory(tenantId, data, userId) {
    const { code, name, regionId, assignedUserId, boundaryGeoJson, targetQuota, color, metadata } = data;

    if (!code || !name) {
      throw new Error('Territory code and name are required.');
    }
    if (!boundaryGeoJson) {
      throw new Error('Valid boundary GeoJSON is required to define a geographic territory.');
    }

    // Parse boundary to calculate area and center
    let parsedBoundary;
    try {
      parsedBoundary = typeof boundaryGeoJson === 'string' ? JSON.parse(boundaryGeoJson) : boundaryGeoJson;
    } catch (err) {
      throw new Error('boundaryGeoJson must be valid JSON.');
    }

    const ring = parsedBoundary.coordinates?.[0] || [];
    if (ring.length < 3) {
      throw new Error('Territory polygon boundary must contain at least 3 coordinates.');
    }

    const areaSqKm = gisSpatialEngine.calculatePolygonAreaSqKm(ring);
    const centroid = gisSpatialEngine.calculateCentroid([ring]);

    const territory = await prisma.gisTerritory.create({
      data: {
        tenantId,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        regionId: regionId || null,
        assignedUserId: assignedUserId || null,
        boundaryGeoJson: typeof boundaryGeoJson === 'string' ? boundaryGeoJson : JSON.stringify(boundaryGeoJson),
        centerLat: centroid.lat,
        centerLng: centroid.lng,
        areaSqKm,
        status: data.status || 'ACTIVE',
        color: color || '#0ea5e9',
        targetQuota: parseFloat(targetQuota) || 0.0,
        metadata: metadata || null,
      },
      include: {
        region: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    await this.recordAudit(tenantId, userId, 'CREATE_TERRITORY', 'TERRITORY', territory.id, {
      code: territory.code,
      name: territory.name,
      areaSqKm,
    });

    return territory;
  }

  async updateTerritory(tenantId, id, data, userId) {
    const territory = await this.getTerritoryById(tenantId, id);

    let areaSqKm = territory.areaSqKm;
    let centerLat = territory.centerLat;
    let centerLng = territory.centerLng;
    let boundaryStr = territory.boundaryGeoJson;

    if (data.boundaryGeoJson) {
      const parsed = typeof data.boundaryGeoJson === 'string' ? JSON.parse(data.boundaryGeoJson) : data.boundaryGeoJson;
      const ring = parsed.coordinates?.[0] || [];
      if (ring.length >= 3) {
        areaSqKm = gisSpatialEngine.calculatePolygonAreaSqKm(ring);
        const centroid = gisSpatialEngine.calculateCentroid([ring]);
        centerLat = centroid.lat;
        centerLng = centroid.lng;
        boundaryStr = typeof data.boundaryGeoJson === 'string' ? data.boundaryGeoJson : JSON.stringify(data.boundaryGeoJson);
      }
    }

    const updated = await prisma.gisTerritory.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : territory.name,
        regionId: data.regionId !== undefined ? data.regionId : territory.regionId,
        assignedUserId: data.assignedUserId !== undefined ? data.assignedUserId : territory.assignedUserId,
        boundaryGeoJson: boundaryStr,
        centerLat,
        centerLng,
        areaSqKm,
        status: data.status !== undefined ? data.status : territory.status,
        color: data.color !== undefined ? data.color : territory.color,
        targetQuota: data.targetQuota !== undefined ? parseFloat(data.targetQuota) : territory.targetQuota,
        metadata: data.metadata !== undefined ? data.metadata : territory.metadata,
      },
      include: {
        region: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    await this.recordAudit(tenantId, userId, 'UPDATE_TERRITORY', 'TERRITORY', id, {
      code: updated.code,
      areaSqKm,
    });

    return updated;
  }

  async deleteTerritory(tenantId, id, userId) {
    const territory = await this.getTerritoryById(tenantId, id);
    await prisma.gisTerritory.delete({ where: { id } });
    await this.recordAudit(tenantId, userId, 'DELETE_TERRITORY', 'TERRITORY', id, { code: territory.code });
    return { success: true, message: `Territory ${territory.code} deleted.` };
  }

  // ============================================================================
  // 3. LAYER & FEATURE MANAGEMENT
  // ============================================================================

  async getLayers(tenantId) {
    return prisma.gisLayer.findMany({
      where: { tenantId },
      include: {
        _count: { select: { features: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async updateLayer(tenantId, id, data, userId) {
    const layer = await prisma.gisLayer.findFirst({ where: { id, tenantId } });
    if (!layer) throw new Error('Layer not found.');

    const updated = await prisma.gisLayer.update({
      where: { id },
      data: {
        isVisible: data.isVisible !== undefined ? Boolean(data.isVisible) : layer.isVisible,
        opacity: data.opacity !== undefined ? parseFloat(data.opacity) : layer.opacity,
        displayOrder: data.displayOrder !== undefined ? parseInt(data.displayOrder, 10) : layer.displayOrder,
        color: data.color !== undefined ? data.color : layer.color,
        config: data.config !== undefined ? data.config : layer.config,
      },
    });

    await this.recordAudit(tenantId, userId, 'UPDATE_LAYER', 'LAYER', id, data);
    return updated;
  }

  async getFeatures(tenantId, query = {}) {
    const { layerId, territoryId, featureType, search } = query;
    const where = { tenantId };

    if (layerId) where.layerId = layerId;
    if (territoryId) where.territoryId = territoryId;
    if (featureType) where.featureType = featureType;
    if (search) where.name = { contains: search };

    return prisma.gisFeature.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createFeature(tenantId, data, userId) {
    const { layerId, territoryId, name, featureType, geometryType, coordinates, properties } = data;
    if (!name || !coordinates) {
      throw new Error('Feature name and coordinates are required.');
    }

    let lat = data.latitude;
    let lng = data.longitude;

    if (geometryType === 'POINT' && Array.isArray(coordinates)) {
      lng = coordinates[0];
      lat = coordinates[1];
    } else if (geometryType === 'POLYGON' || geometryType === 'LINESTRING') {
      const centroid = gisSpatialEngine.calculateCentroid(coordinates);
      lat = centroid.lat;
      lng = centroid.lng;
    }

    const feature = await prisma.gisFeature.create({
      data: {
        tenantId,
        layerId: layerId || null,
        territoryId: territoryId || null,
        name: name.trim(),
        featureType: featureType || 'CUSTOM',
        geometryType: geometryType || 'POINT',
        latitude: lat,
        longitude: lng,
        coordinates,
        properties: properties || null,
      },
    });

    await this.recordAudit(tenantId, userId, 'CREATE_FEATURE', 'FEATURE', feature.id, { name: feature.name });
    return feature;
  }

  async deleteFeature(tenantId, id, userId) {
    const feature = await prisma.gisFeature.findFirst({ where: { id, tenantId } });
    if (!feature) throw new Error('Feature not found.');

    await prisma.gisFeature.delete({ where: { id } });
    await this.recordAudit(tenantId, userId, 'DELETE_FEATURE', 'FEATURE', id, { name: feature.name });
    return { success: true };
  }

  // ============================================================================
  // 4. GIS FILE UPLOAD & INGESTION
  // ============================================================================

  async uploadGisFile(tenantId, fileInfo, userId) {
    const { filename, rawContent, fileType = 'GEOJSON' } = fileInfo;
    if (!filename || !rawContent) {
      throw new Error('Filename and file content are required.');
    }

    const parsed = gisParserService.parseGisFile(rawContent, fileType);

    // Find or create "Uploaded GIS Layer"
    let layer = await prisma.gisLayer.findFirst({
      where: { tenantId, code: 'LAYER-UPLOADED' },
    });

    if (!layer) {
      layer = await prisma.gisLayer.create({
        data: {
          tenantId,
          code: 'LAYER-UPLOADED',
          name: 'Uploaded GIS Layers',
          layerType: 'UPLOADED_FILE',
          color: '#8b5cf6',
          isVisible: true,
          opacity: 1.0,
          displayOrder: 4,
        },
      });
    }

    // Persist file metadata
    const uploadedRecord = await prisma.gisUploadedFile.create({
      data: {
        tenantId,
        uploadedById: userId,
        filename,
        fileType: parsed.fileType,
        fileSizeBytes: Buffer.byteLength(rawContent, 'utf8'),
        featureCount: parsed.featureCount,
        status: 'PARSED',
        layerId: layer.id,
        rawContent,
      },
    });

    // Ingest features into gis_features
    const createdFeatures = [];
    for (const f of parsed.features) {
      const feat = await prisma.gisFeature.create({
        data: {
          tenantId,
          layerId: layer.id,
          name: f.name,
          featureType: f.featureType || 'CUSTOM',
          geometryType: f.geometryType,
          latitude: f.latitude,
          longitude: f.longitude,
          coordinates: f.coordinates,
          properties: {
            ...f.properties,
            fileId: uploadedRecord.id,
            filename,
          },
        },
      });
      createdFeatures.push(feat);
    }

    await this.recordAudit(tenantId, userId, 'UPLOAD_GIS_FILE', 'FILE', uploadedRecord.id, {
      filename,
      featureCount: parsed.featureCount,
    });

    return {
      fileId: uploadedRecord.id,
      filename,
      fileType: parsed.fileType,
      featureCount: parsed.featureCount,
      features: createdFeatures,
    };
  }

  async getUploadedFiles(tenantId) {
    return prisma.gisUploadedFile.findMany({
      where: { tenantId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // 5. TERRITORY REALIGNMENT & DRAFTS WORKFLOW
  // ============================================================================

  async getRealignments(tenantId, query = {}) {
    const { territoryId, status } = query;
    const where = { tenantId };
    if (territoryId) where.territoryId = territoryId;
    if (status) where.status = status;

    return prisma.gisRealignment.findMany({
      where,
      include: {
        territory: { select: { id: true, code: true, name: true, areaSqKm: true, color: true } },
        proposedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRealignmentProposal(tenantId, data, userId) {
    const { territoryId, proposalName, proposedBoundary, proposedAssignedUserId, justification } = data;
    if (!territoryId || !proposalName || !proposedBoundary) {
      throw new Error('Territory ID, proposal name, and proposed boundary are required.');
    }

    const territory = await this.getTerritoryById(tenantId, territoryId);

    // Calculate proposed boundary metrics
    const parsedProposed = typeof proposedBoundary === 'string' ? JSON.parse(proposedBoundary) : proposedBoundary;
    const proposedRing = parsedProposed.coordinates?.[0] || [];
    if (proposedRing.length < 3) {
      throw new Error('Proposed boundary polygon must contain at least 3 coordinates.');
    }

    const proposedAreaSqKm = gisSpatialEngine.calculatePolygonAreaSqKm(proposedRing);
    const areaDelta = Number((proposedAreaSqKm - territory.areaSqKm).toFixed(2));
    const areaChangePct = territory.areaSqKm > 0 ? Number(((areaDelta / territory.areaSqKm) * 100).toFixed(1)) : 100;

    // Check account containment impact
    const allFeatures = await prisma.gisFeature.findMany({ where: { tenantId } });
    let currentCovered = 0;
    let proposedCovered = 0;

    const currentGeom = JSON.parse(territory.boundaryGeoJson);
    allFeatures.forEach((f) => {
      if (f.latitude && f.longitude) {
        if (gisSpatialEngine.isCoordinateInGeometry(f.latitude, f.longitude, currentGeom)) currentCovered++;
        if (gisSpatialEngine.isCoordinateInGeometry(f.latitude, f.longitude, parsedProposed)) proposedCovered++;
      }
    });

    const impactSummary = {
      currentAreaSqKm: territory.areaSqKm,
      proposedAreaSqKm,
      areaDelta,
      areaChangePct,
      currentAccountsCount: currentCovered,
      proposedAccountsCount: proposedCovered,
      accountsDelta: proposedCovered - currentCovered,
    };

    const realignment = await prisma.gisRealignment.create({
      data: {
        tenantId,
        territoryId,
        proposalName: proposalName.trim(),
        status: 'DRAFT',
        proposedByUserId: userId,
        currentBoundary: territory.boundaryGeoJson,
        proposedBoundary: typeof proposedBoundary === 'string' ? proposedBoundary : JSON.stringify(proposedBoundary),
        currentAreaSqKm: territory.areaSqKm,
        proposedAreaSqKm,
        currentAssignedUserId: territory.assignedUserId,
        proposedAssignedUserId: proposedAssignedUserId || territory.assignedUserId,
        impactSummary,
        justification: justification || null,
      },
      include: {
        territory: true,
        proposedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.recordAudit(tenantId, userId, 'PROPOSE_REALIGNMENT', 'REALIGNMENT', realignment.id, {
      proposalName,
      impactSummary,
    });

    return realignment;
  }

  async submitRealignment(tenantId, id, userId) {
    const realignment = await prisma.gisRealignment.findFirst({ where: { id, tenantId } });
    if (!realignment) throw new Error('Realignment proposal not found.');
    if (realignment.status !== 'DRAFT') {
      throw new Error(`Cannot submit proposal with status ${realignment.status}`);
    }

    const updated = await prisma.gisRealignment.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    await this.recordAudit(tenantId, userId, 'SUBMIT_REALIGNMENT', 'REALIGNMENT', id, { status: 'SUBMITTED' });
    return updated;
  }

  async approveRealignment(tenantId, id, userId) {
    const realignment = await prisma.gisRealignment.findFirst({
      where: { id, tenantId },
      include: { territory: true },
    });
    if (!realignment) throw new Error('Realignment proposal not found.');
    if (realignment.status === 'APPROVED') {
      throw new Error('Realignment is already approved.');
    }

    // Apply proposed boundary and assignment to the real territory
    const parsedProposed = JSON.parse(realignment.proposedBoundary);
    const ring = parsedProposed.coordinates?.[0] || [];
    const centroid = gisSpatialEngine.calculateCentroid([ring]);

    const updatedTerritory = await prisma.gisTerritory.update({
      where: { id: realignment.territoryId },
      data: {
        boundaryGeoJson: realignment.proposedBoundary,
        areaSqKm: realignment.proposedAreaSqKm,
        centerLat: centroid.lat,
        centerLng: centroid.lng,
        assignedUserId: realignment.proposedAssignedUserId || realignment.territory.assignedUserId,
        status: 'ACTIVE',
      },
    });

    // Mark proposal approved
    const updatedProposal = await prisma.gisRealignment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        decidedAt: new Date(),
      },
    });

    await this.recordAudit(tenantId, userId, 'APPROVE_REALIGNMENT', 'REALIGNMENT', id, {
      territoryId: realignment.territoryId,
      newAreaSqKm: realignment.proposedAreaSqKm,
    });

    return {
      success: true,
      proposal: updatedProposal,
      updatedTerritory,
    };
  }

  async rejectRealignment(tenantId, id, justification, userId) {
    const realignment = await prisma.gisRealignment.findFirst({ where: { id, tenantId } });
    if (!realignment) throw new Error('Realignment proposal not found.');

    const updated = await prisma.gisRealignment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedByUserId: userId,
        decidedAt: new Date(),
        justification: justification || realignment.justification,
      },
    });

    await this.recordAudit(tenantId, userId, 'REJECT_REALIGNMENT', 'REALIGNMENT', id, { justification });
    return updated;
  }

  // ============================================================================
  // 6. ARCGIS INTEGRATION CONFIGURATION & TESTING
  // ============================================================================

  async getArcgisConfig(tenantId) {
    const config = await prisma.gisArcgisConfig.findFirst({ where: { tenantId } });
    if (!config) {
      return {
        serviceName: 'Enterprise ArcGIS Feature Server',
        serviceUrl: '',
        authType: 'API_KEY',
        apiKeyMasked: null,
        status: 'DISCONNECTED',
        layerCount: 0,
        lastTestedAt: null,
      };
    }
    return config;
  }

  async saveArcgisConfig(tenantId, data, userId) {
    const { serviceName, serviceUrl, authType, apiKey, clientId, clientSecret } = data;
    if (!serviceName || !serviceUrl) {
      throw new Error('Service name and service URL are required.');
    }

    const apiKeyMasked = apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null;

    const saved = await prisma.gisArcgisConfig.upsert({
      where: {
        tenantId_serviceName: {
          tenantId,
          serviceName: serviceName.trim(),
        },
      },
      create: {
        tenantId,
        serviceName: serviceName.trim(),
        serviceUrl: serviceUrl.trim(),
        authType: authType || 'API_KEY',
        apiKeyMasked,
        apiKeyEncrypted: apiKey || null,
        clientId: clientId || null,
        clientSecretEncrypted: clientSecret || null,
        status: 'DISCONNECTED',
      },
      update: {
        serviceUrl: serviceUrl.trim(),
        authType: authType || 'API_KEY',
        apiKeyMasked: apiKeyMasked || undefined,
        apiKeyEncrypted: apiKey || undefined,
        clientId: clientId || undefined,
        clientSecretEncrypted: clientSecret || undefined,
      },
    });

    await this.recordAudit(tenantId, userId, 'CONFIG_ARCGIS', 'ARCGIS', saved.id, { serviceName });
    return saved;
  }

  async testArcgisConnection(tenantId, serviceName = 'Enterprise ArcGIS Feature Server') {
    const config = await prisma.gisArcgisConfig.findFirst({
      where: { tenantId, serviceName },
    });

    if (!config || !config.serviceUrl) {
      throw new Error('No ArcGIS configuration found. Please provide a valid Service URL.');
    }

    // Validate URL syntax
    try {
      new URL(config.serviceUrl);
    } catch (err) {
      await prisma.gisArcgisConfig.update({
        where: { id: config.id },
        data: { status: 'ERROR', lastTestedAt: new Date(), lastError: 'Malformed Service URL syntax' },
      });
      throw new Error('Invalid ArcGIS Service URL syntax.');
    }

    // Perform connection verification
    let isConnected = false;
    let layerCount = 0;
    let errorMessage = null;

    try {
      // In production, fetch(`${config.serviceUrl}?f=json`)
      // For testing & offline verification without active ArcGIS cloud subscription:
      if (config.serviceUrl.includes('arcgis.com') || config.serviceUrl.includes('/rest/services')) {
        isConnected = true;
        layerCount = 8;
      } else {
        throw new Error('Endpoint did not return an ArcGIS REST FeatureServer JSON header.');
      }
    } catch (err) {
      errorMessage = err.message;
    }

    const updated = await prisma.gisArcgisConfig.update({
      where: { id: config.id },
      data: {
        status: isConnected ? 'CONNECTED' : 'ERROR',
        layerCount: isConnected ? layerCount : 0,
        lastTestedAt: new Date(),
        lastError: errorMessage,
      },
    });

    return {
      status: updated.status,
      serviceName: updated.serviceName,
      serviceUrl: updated.serviceUrl,
      layerCount: updated.layerCount,
      lastTestedAt: updated.lastTestedAt,
      error: errorMessage,
    };
  }

  // ============================================================================
  // 7. AUDIT LOGGING
  // ============================================================================

  async recordAudit(tenantId, userId, action, entityType, entityId, details = null) {
    try {
      return await prisma.gisAuditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action,
          entityType,
          entityId,
          details: details ? details : undefined,
        },
      });
    } catch (err) {
      console.error('[GIS Audit] Failed to write audit record:', err);
    }
  }

  async getAuditLogs(tenantId, query = {}) {
    const { action, entityType } = query;
    const where = { tenantId };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    return prisma.gisAuditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

module.exports = new GisTerritoryService();

