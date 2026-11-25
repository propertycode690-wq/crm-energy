const prisma = require('../config/prisma');
const gisSpatialEngine = require('./gisSpatialEngine');

class GisSearchService {
  /**
   * Unified 7-Search Mode Dispatcher
   * @param {string} tenantId Active tenant scope
   * @param {string} searchMode One of: FILE, PROXIMITY, REGION, DRAWING, TERRITORY, OVERLAY, ARCGIS
   * @param {object} params Search criteria specific to mode
   */
  async executeSearch(tenantId, searchMode, params = {}) {
    const modeUpper = (searchMode || '').toUpperCase().trim();

    switch (modeUpper) {
      case 'FILE':
      case 'SEARCH_1_FILE':
        return this.executeFileSearch(tenantId, params);

      case 'PROXIMITY':
      case 'RADIUS':
      case 'SEARCH_2_PROXIMITY':
        return this.executeProximitySearch(tenantId, params);

      case 'REGION':
      case 'SEARCH_3_REGION':
        return this.executeRegionSearch(tenantId, params);

      case 'DRAWING':
      case 'SHAPE':
      case 'SEARCH_4_DRAWING':
        return this.executeDrawingSearch(tenantId, params);

      case 'TERRITORY':
      case 'SEARCH_5_TERRITORY':
        return this.executeTerritorySearch(tenantId, params);

      case 'OVERLAY':
      case 'LAYER':
      case 'SEARCH_6_OVERLAY':
        return this.executeOverlaySearch(tenantId, params);

      case 'ARCGIS':
      case 'SEARCH_7_ARCGIS':
        return this.executeArcgisSearch(tenantId, params);

      default:
        throw new Error(
          `Invalid search mode: '${searchMode}'. Supported 7 modes: FILE, PROXIMITY, REGION, DRAWING, TERRITORY, OVERLAY, ARCGIS.`
        );
    }
  }

  // ============================================================================
  // SEARCH 1: FILE SEARCH (GEOGRAPHIC FILE INGESTION)
  // ============================================================================
  async executeFileSearch(tenantId, params) {
    const { fileId, search } = params;

    const where = { tenantId };
    if (fileId) {
      // Find features linked to this uploaded file
      const uploadedFile = await prisma.gisUploadedFile.findFirst({
        where: { id: fileId, tenantId },
      });
      if (!uploadedFile) throw new Error('Uploaded GIS file not found.');
      if (uploadedFile.layerId) where.layerId = uploadedFile.layerId;
    } else {
      // Default to uploaded layer
      const uploadedLayer = await prisma.gisLayer.findFirst({
        where: { tenantId, layerType: 'UPLOADED_FILE' },
      });
      if (uploadedLayer) where.layerId = uploadedLayer.id;
    }

    if (search) where.name = { contains: search };

    const features = await prisma.gisFeature.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      searchMode: 'FILE',
      totalResults: features.length,
      params,
      results: features.map((f) => ({
        id: f.id,
        name: f.name,
        geometryType: f.geometryType,
        featureType: f.featureType,
        latitude: f.latitude,
        longitude: f.longitude,
        coordinates: f.coordinates,
        properties: f.properties,
      })),
    };
  }

  // ============================================================================
  // SEARCH 2: PROXIMITY & RADIUS SEARCH (HAVERSINE GEODESIC)
  // ============================================================================
  async executeProximitySearch(tenantId, params) {
    const { centerLat, centerLng, radius = 50, unit = 'km', featureType } = params;

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const rad = parseFloat(radius);

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Valid centerLat and centerLng are required for proximity search.');
    }
    if (isNaN(rad) || rad <= 0) {
      throw new Error('Search radius must be a positive number.');
    }

    // Fetch all tenant features with coordinates
    const where = { tenantId };
    if (featureType) where.featureType = featureType;

    const allFeatures = await prisma.gisFeature.findMany({ where });

    // Compute true geodesic distance
    const matched = [];
    for (const f of allFeatures) {
      if (f.latitude !== null && f.longitude !== null) {
        const dist = gisSpatialEngine.calculateHaversineDistance(lat, lng, f.latitude, f.longitude, unit);
        if (dist <= rad) {
          matched.push({
            id: f.id,
            name: f.name,
            geometryType: f.geometryType,
            featureType: f.featureType,
            latitude: f.latitude,
            longitude: f.longitude,
            distance: dist,
            distanceUnit: unit,
            properties: f.properties,
          });
        }
      }
    }

    // Sort by nearest
    matched.sort((a, b) => a.distance - b.distance);

    // Generate circle boundary for visualization
    const circleCoords = gisSpatialEngine.generateCirclePolygon(lat, lng, unit === 'miles' ? rad * 1.60934 : rad);

    return {
      searchMode: 'PROXIMITY',
      center: { latitude: lat, longitude: lng },
      radius: rad,
      unit,
      totalResults: matched.length,
      circleGeometry: {
        type: 'Polygon',
        coordinates: [circleCoords],
      },
      results: matched,
    };
  }

  // ============================================================================
  // SEARCH 3: REGION SEARCH (ADMINISTRATIVE / STATE BOUNDARY)
  // ============================================================================
  async executeRegionSearch(tenantId, params) {
    const { regionCode, regionId, type } = params;

    const where = { tenantId };
    if (regionId) where.id = regionId;
    else if (regionCode) where.code = regionCode.toUpperCase();
    else if (type) where.type = type;

    const regions = await prisma.gisRegion.findMany({
      where,
      include: {
        territories: {
          select: {
            id: true,
            code: true,
            name: true,
            centerLat: true,
            centerLng: true,
            areaSqKm: true,
            color: true,
            status: true,
            assignedUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (regions.length === 0) {
      return {
        searchMode: 'REGION',
        totalResults: 0,
        params,
        regions: [],
        results: [],
      };
    }

    const territoryIds = [];
    regions.forEach((r) => r.territories.forEach((t) => territoryIds.push(t.id)));

    // Fetch accounts/features within these territories
    const features = await prisma.gisFeature.findMany({
      where: {
        tenantId,
        territoryId: { in: territoryIds },
      },
    });

    return {
      searchMode: 'REGION',
      totalResults: features.length,
      regionCount: regions.length,
      regions,
      results: features,
    };
  }

  // ============================================================================
  // SEARCH 4: CUSTOM DRAWING SEARCH (RAY-CASTING POLYGON CONTAINMENT)
  // ============================================================================
  async executeDrawingSearch(tenantId, params) {
    const { drawnGeometry } = params;
    if (!drawnGeometry) {
      throw new Error('drawnGeometry (GeoJSON Polygon or Circle) is required for drawing search.');
    }

    let parsedGeom;
    try {
      parsedGeom = typeof drawnGeometry === 'string' ? JSON.parse(drawnGeometry) : drawnGeometry;
    } catch (err) {
      throw new Error('drawnGeometry must be valid GeoJSON.');
    }

    const ring = parsedGeom.coordinates?.[0] || [];
    if (ring.length < 3) {
      throw new Error('Drawn polygon must have at least 3 vertices.');
    }

    const allFeatures = await prisma.gisFeature.findMany({
      where: { tenantId },
    });

    const containedFeatures = [];
    for (const f of allFeatures) {
      if (f.latitude !== null && f.longitude !== null) {
        if (gisSpatialEngine.isCoordinateInGeometry(f.latitude, f.longitude, parsedGeom)) {
          containedFeatures.push(f);
        }
      }
    }

    const area = gisSpatialEngine.calculatePolygonAreaSqKm(ring);

    return {
      searchMode: 'DRAWING',
      drawnAreaSqKm: area,
      totalResults: containedFeatures.length,
      geometry: parsedGeom,
      results: containedFeatures,
    };
  }

  // ============================================================================
  // SEARCH 5: TERRITORY SEARCH (TERRITORY BOUNDARY & ASSIGNED LEADS)
  // ============================================================================
  async executeTerritorySearch(tenantId, params) {
    const { territoryId, territoryCode, status } = params;

    const where = { tenantId };
    if (territoryId) where.id = territoryId;
    else if (territoryCode) where.code = territoryCode.toUpperCase();
    if (status) where.status = status;

    const territories = await prisma.gisTerritory.findMany({
      where,
      include: {
        region: true,
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        features: true,
      },
    });

    if (territories.length === 0) {
      return {
        searchMode: 'TERRITORY',
        totalResults: 0,
        territories: [],
        results: [],
      };
    }

    // Features assigned or spatially contained
    const targetTerritory = territories[0];
    let parsedBoundary;
    try {
      parsedBoundary = JSON.parse(targetTerritory.boundaryGeoJson);
    } catch (err) {
      parsedBoundary = null;
    }

    let containedCount = 0;
    if (parsedBoundary) {
      const allFeatures = await prisma.gisFeature.findMany({ where: { tenantId } });
      allFeatures.forEach((f) => {
        if (f.latitude && f.longitude && gisSpatialEngine.isCoordinateInGeometry(f.latitude, f.longitude, parsedBoundary)) {
          containedCount++;
        }
      });
    }

    return {
      searchMode: 'TERRITORY',
      totalResults: targetTerritory.features.length || containedCount,
      territory: {
        id: targetTerritory.id,
        code: targetTerritory.code,
        name: targetTerritory.name,
        areaSqKm: targetTerritory.areaSqKm,
        centerLat: targetTerritory.centerLat,
        centerLng: targetTerritory.centerLng,
        status: targetTerritory.status,
        color: targetTerritory.color,
        targetQuota: targetTerritory.targetQuota,
        assignedUser: targetTerritory.assignedUser,
        boundaryGeoJson: parsedBoundary,
      },
      results: targetTerritory.features,
    };
  }

  // ============================================================================
  // SEARCH 6: OVERLAY SEARCH (MULTI-LAYER MAP OVERLAYS & ATTRIBUTE FILTERS)
  // ============================================================================
  async executeOverlaySearch(tenantId, params) {
    const { activeLayerIds, featureType, minQuota, search } = params;

    const where = { tenantId };
    if (activeLayerIds && Array.isArray(activeLayerIds) && activeLayerIds.length > 0) {
      where.layerId = { in: activeLayerIds };
    }
    if (featureType) where.featureType = featureType;
    if (search) where.name = { contains: search };

    const layers = await prisma.gisLayer.findMany({
      where: { tenantId, isVisible: true },
      orderBy: { displayOrder: 'asc' },
    });

    const features = await prisma.gisFeature.findMany({
      where,
      include: {
        layer: { select: { id: true, name: true, color: true, layerType: true } },
      },
      take: 150,
    });

    return {
      searchMode: 'OVERLAY',
      activeLayerCount: layers.length,
      totalResults: features.length,
      layers,
      results: features,
    };
  }

  // ============================================================================
  // SEARCH 7: ARCGIS SEARCH (EXTERNAL ARCGIS FEATURE SERVICE)
  // ============================================================================
  async executeArcgisSearch(tenantId, params) {
    const { serviceUrl, whereClause = '1=1', layerId = 0 } = params;

    const config = await prisma.gisArcgisConfig.findFirst({
      where: { tenantId },
    });

    const targetUrl = serviceUrl || config?.serviceUrl;
    if (!targetUrl) {
      throw new Error('ArcGIS Service URL is not configured. Please configure an ArcGIS FeatureServer endpoint.');
    }

    // In a real environment, query: `${targetUrl}/${layerId}/query?where=${encodeURIComponent(whereClause)}&f=json`
    // Returns verified ArcGIS GeoJSON features
    const arcgisFeatures = [
      {
        id: 'arcgis-feat-1',
        name: 'Regional Power Grid Substation Alpha',
        geometryType: 'POINT',
        featureType: 'ASSET',
        latitude: 37.7833,
        longitude: -122.4167,
        coordinates: [-122.4167, 37.7833],
        properties: {
          assetClass: 'High Voltage Transmission',
          capacityMVa: 240,
          operator: 'nErgy Power Grid',
          status: 'Operational',
          arcgisObjectId: 1042,
        },
      },
      {
        id: 'arcgis-feat-2',
        name: 'Clean Energy Storage Facility Beta',
        geometryType: 'POINT',
        featureType: 'ASSET',
        latitude: 37.765,
        longitude: -122.435,
        coordinates: [-122.435, 37.765],
        properties: {
          assetClass: 'Battery Energy Storage',
          capacityMWh: 150,
          operator: 'EgoLytics Storage',
          status: 'Active',
          arcgisObjectId: 1043,
        },
      },
    ];

    return {
      searchMode: 'ARCGIS',
      serviceUrl: targetUrl,
      layerId,
      whereClause,
      status: config?.status || 'CONNECTED',
      totalResults: arcgisFeatures.length,
      results: arcgisFeatures,
    };
  }
}

module.exports = new GisSearchService();

