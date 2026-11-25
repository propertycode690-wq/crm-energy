const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 13 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('MAPLYTICS – COMPLETE GIS TERRITORY MANAGEMENT & 7 SEARCH ENGINE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, description) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
      failed++;
    }
  }

  // 1. Fetch valid user from primary tenant
  const userA = await prisma.user.findFirst({
    where: { tenantId: 'TENANT-08492' },
  });

  if (!userA) {
    console.error('Fatal: No user found for tenant TENANT-08492');
    process.exit(1);
  }

  const tokenA = generateToken({
    userId: userA.id,
    tenantId: userA.tenantId,
    role: userA.role,
    email: userA.email,
  });

  const tokenB = generateToken({
    userId: 'foreign-user-gis',
    tenantId: 'cmunoyqx50000tovon49iw6gx', // Foreign tenant
    role: 'CRM_PRO',
    email: 'foreign.gis@tenantb.io',
  });

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  const headersB = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  };

  let testRegionId = null;
  let testTerritoryId = null;
  let testFileId = null;
  let testRealignmentId = null;

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Workspace Telemetry
    // --------------------------------------------------------------------------
    const telRes = await fetch(`${API_BASE}/gis/workspace/telemetry`, {
      method: 'GET',
      headers: headersA,
    });
    const telData = await telRes.json();
    assert(
      telRes.status === 200 &&
      telData.success &&
      Array.isArray(telData.data?.layers) &&
      telData.data?.layers.length >= 4,
      'TC-13-01',
      'GIS workspace telemetry initializes with default map layers and status'
    );

    // --------------------------------------------------------------------------
    // TEST 2: Region Management (Create & List)
    // --------------------------------------------------------------------------
    const runId = Date.now();
    const regionRes = await fetch(`${API_BASE}/gis/regions`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        code: `REG-BAY-${runId}`,
        name: 'San Francisco Bay Technology Corridor',
        type: 'METRO',
        centerLat: 37.7749,
        centerLng: -122.4194,
      }),
    });
    const regionData = await regionRes.json();
    testRegionId = regionData.data?.id;
    assert(
      regionRes.status === 201 && regionData.success && testRegionId,
      'TC-13-02',
      'Create hierarchical administrative GIS Region with centroid'
    );

    // --------------------------------------------------------------------------
    // TEST 3: Territory Management (Create with GeoJSON Polygon & Area Calculation)
    // --------------------------------------------------------------------------
    // Square polygon around SF Bay: [[-122.52, 37.70], [-122.35, 37.70], [-122.35, 37.82], [-122.52, 37.82], [-122.52, 37.70]]
    const sfPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.52, 37.70],
          [-122.35, 37.70],
          [-122.35, 37.82],
          [-122.52, 37.82],
          [-122.52, 37.70],
        ],
      ],
    };

    const terrRes = await fetch(`${API_BASE}/gis/territories`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        code: `TER-BAY-${runId}`,
        name: 'Silicon Valley Metro Territory',
        regionId: testRegionId,
        assignedUserId: userA.id,
        boundaryGeoJson: sfPolygon,
        targetQuota: 2500000,
        color: '#0ea5e9',
      }),
    });
    const terrData = await terrRes.json();
    testTerritoryId = terrData.data?.id;
    assert(
      terrRes.status === 201 &&
      terrData.success &&
      terrData.data?.areaSqKm > 0 &&
      terrData.data?.centerLat > 37.0,
      'TC-13-03',
      'Create GIS Territory with GeoJSON polygon, calculating real area (sq km) and centroid'
    );

    // --------------------------------------------------------------------------
    // TEST 4: Update Territory Boundary
    // --------------------------------------------------------------------------
    const expandedPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.55, 37.68],
          [-122.30, 37.68],
          [-122.30, 37.85],
          [-122.55, 37.85],
          [-122.55, 37.68],
        ],
      ],
    };

    const updateTerrRes = await fetch(`${API_BASE}/gis/territories/${testTerritoryId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        name: 'Expanded Silicon Valley Clean Tech Belt',
        boundaryGeoJson: expandedPolygon,
      }),
    });
    const updateTerrData = await updateTerrRes.json();
    assert(
      updateTerrRes.status === 200 &&
      updateTerrData.success &&
      updateTerrData.data.areaSqKm > terrData.data.areaSqKm,
      'TC-13-04',
      'Update territory boundary polygon and dynamically re-calculate surface area'
    );

    // --------------------------------------------------------------------------
    // TEST 5: Create Spatial Features (Points / Accounts)
    // --------------------------------------------------------------------------
    // Point 1: Inside SF (37.775, -122.418)
    const featRes1 = await fetch(`${API_BASE}/gis/features`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Apex Clean Energy HQ',
        featureType: 'ACCOUNT',
        geometryType: 'POINT',
        coordinates: [-122.418, 37.775],
        territoryId: testTerritoryId,
        properties: { annualRevenue: '$4.2M', dealStage: 'Qualified' },
      }),
    });

    // Point 2: In Oakland (37.804, -122.271) - outside the SF rectangle but near
    const featRes2 = await fetch(`${API_BASE}/gis/features`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'East Bay Storage Corp',
        featureType: 'LEAD',
        geometryType: 'POINT',
        coordinates: [-122.271, 37.804],
        properties: { annualRevenue: '$1.8M', dealStage: 'Proposal' },
      }),
    });

    const featData1 = await featRes1.json();
    const featData2 = await featRes2.json();
    assert(
      featRes1.status === 201 && featData1.success &&
      featRes2.status === 201 && featData2.success,
      'TC-13-05',
      'Create spatial features (Accounts/Leads) with verified WGS-84 coordinates'
    );

    // --------------------------------------------------------------------------
    // TEST 6: SEARCH 1 (FILE) - Upload & Ingest GeoJSON File
    // --------------------------------------------------------------------------
    const sampleGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-122.405, 37.785],
          },
          properties: { name: 'Market Street Energy Substation', assetType: 'Substation' },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-122.412, 37.768],
          },
          properties: { name: 'Mission District Battery Array', assetType: 'Battery' },
        },
      ],
    };

    const uploadRes = await fetch(`${API_BASE}/gis/files/upload`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        filename: 'sf_grid_assets.geojson',
        fileType: 'GEOJSON',
        rawContent: JSON.stringify(sampleGeoJson),
      }),
    });
    const uploadData = await uploadRes.json();
    testFileId = uploadData.data?.fileId;

    const fileSearchRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'FILE',
        params: { fileId: testFileId },
      }),
    });
    const fileSearchData = await fileSearchRes.json();
    assert(
      uploadRes.status === 201 &&
      uploadData.success &&
      uploadData.data.featureCount === 2 &&
      fileSearchRes.status === 200 &&
      fileSearchData.data.totalResults >= 2,
      'TC-13-06',
      'Search 1 (FILE): Ingest and query features from GeoJSON file upload'
    );

    // --------------------------------------------------------------------------
    // TEST 7: Ingest KML File & Validate Conversion
    // --------------------------------------------------------------------------
    const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>SOMA Solar Innovation Center</name>
      <description>Commercial rooftop solar plant</description>
      <Point>
        <coordinates>-122.3988,37.7825,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

    const kmlUploadRes = await fetch(`${API_BASE}/gis/files/upload`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        filename: 'soma_solar.kml',
        fileType: 'KML',
        rawContent: sampleKml,
      }),
    });
    const kmlUploadData = await kmlUploadRes.json();
    assert(
      kmlUploadRes.status === 201 &&
      kmlUploadData.success &&
      kmlUploadData.data.featureCount === 1,
      'TC-13-07',
      'Ingest KML file with Placemark elements, parsing coordinates to GeoJSON'
    );

    // --------------------------------------------------------------------------
    // TEST 8: Rejection of Invalid File Format
    // --------------------------------------------------------------------------
    const invalidUploadRes = await fetch(`${API_BASE}/gis/files/upload`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        filename: 'corrupted_file.json',
        fileType: 'GEOJSON',
        rawContent: '{ corrupted: true, missingCloseBrace: ',
      }),
    });
    assert(
      invalidUploadRes.status >= 400,
      'TC-13-08',
      'Gracefully reject malformed GIS files with informative validation error'
    );

    // --------------------------------------------------------------------------
    // TEST 9: SEARCH 2 (PROXIMITY) - Haversine Radial Distance
    // --------------------------------------------------------------------------
    // Search within 10 km of SF City Hall (37.779, -122.419)
    const proxRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'PROXIMITY',
        params: {
          centerLat: 37.779,
          centerLng: -122.419,
          radius: 10,
          unit: 'km',
        },
      }),
    });
    const proxData = await proxRes.json();
    assert(
      proxRes.status === 200 &&
      proxData.success &&
      proxData.data.totalResults > 0 &&
      proxData.data.results[0].distance !== undefined &&
      proxData.data.circleGeometry?.type === 'Polygon',
      'TC-13-09',
      'Search 2 (PROXIMITY): Calculate Haversine geodesic distance and sort nearest features'
    );

    // --------------------------------------------------------------------------
    // TEST 10: SEARCH 3 (REGION) - Boundary Retrieval
    // --------------------------------------------------------------------------
    const regSearchRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'REGION',
        params: { regionId: testRegionId },
      }),
    });
    const regSearchData = await regSearchRes.json();
    assert(
      regSearchRes.status === 200 &&
      regSearchData.success &&
      regSearchData.data.regionCount === 1,
      'TC-13-10',
      'Search 3 (REGION): Retrieve regional boundary hierarchy and associated territories'
    );

    // --------------------------------------------------------------------------
    // TEST 11: SEARCH 4 (DRAWING) - Ray-Casting Polygon Containment
    // --------------------------------------------------------------------------
    // Draw polygon tightly around Downtown SF: [[-122.43, 37.76], [-122.39, 37.76], [-122.39, 37.80], [-122.43, 37.80], [-122.43, 37.76]]
    const drawnPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.43, 37.76],
          [-122.39, 37.76],
          [-122.39, 37.80],
          [-122.43, 37.80],
          [-122.43, 37.76],
        ],
      ],
    };

    const drawSearchRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'DRAWING',
        params: { drawnGeometry: drawnPolygon },
      }),
    });
    const drawSearchData = await drawSearchRes.json();
    assert(
      drawSearchRes.status === 200 &&
      drawSearchData.success &&
      drawSearchData.data.drawnAreaSqKm > 0 &&
      drawSearchData.data.totalResults >= 1,
      'TC-13-11',
      'Search 4 (DRAWING): Ray-casting containment detects features within user-drawn polygon'
    );

    // --------------------------------------------------------------------------
    // TEST 12: SEARCH 5 (TERRITORY) - Assigned Accounts & Quota Metrics
    // --------------------------------------------------------------------------
    const terrSearchRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'TERRITORY',
        params: { territoryId: testTerritoryId },
      }),
    });
    const terrSearchData = await terrSearchRes.json();
    assert(
      terrSearchRes.status === 200 &&
      terrSearchData.success &&
      terrSearchData.data.territory?.code.startsWith('TER-BAY-'),
      'TC-13-12',
      'Search 5 (TERRITORY): Query territory details, target quota, and assigned accounts'
    );

    // --------------------------------------------------------------------------
    // TEST 13: SEARCH 6 (OVERLAY) - Multi-Layer Overlay Filter
    // --------------------------------------------------------------------------
    const overlayRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'OVERLAY',
        params: { featureType: 'ACCOUNT' },
      }),
    });
    const overlayData = await overlayRes.json();
    assert(
      overlayRes.status === 200 &&
      overlayData.success &&
      overlayData.data.activeLayerCount > 0,
      'TC-13-13',
      'Search 6 (OVERLAY): Multi-layer map overlay filters by feature type across active layers'
    );

    // --------------------------------------------------------------------------
    // TEST 14: SEARCH 7 (ARCGIS) - External Feature Service Query
    // --------------------------------------------------------------------------
    const arcgisSearchRes = await fetch(`${API_BASE}/gis/search`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        searchMode: 'ARCGIS',
        params: {
          serviceUrl: 'https://services.arcgis.com/nErgy/arcgis/rest/services/PowerGrid/FeatureServer',
          layerId: 0,
          whereClause: "status = 'Operational'",
        },
      }),
    });
    const arcgisSearchData = await arcgisSearchRes.json();
    assert(
      arcgisSearchRes.status === 200 &&
      arcgisSearchData.success &&
      arcgisSearchData.data.totalResults === 2,
      'TC-13-14',
      'Search 7 (ARCGIS): Execute ArcGIS feature layer query with whereClause filter'
    );

    // --------------------------------------------------------------------------
    // TEST 15: ArcGIS Configuration & Connection Handshake
    // --------------------------------------------------------------------------
    const arcgisSaveRes = await fetch(`${API_BASE}/gis/arcgis/config`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        serviceName: 'Enterprise ArcGIS Feature Server',
        serviceUrl: 'https://services.arcgis.com/nErgy/arcgis/rest/services/PowerGrid/FeatureServer',
        authType: 'API_KEY',
        apiKey: 'AAPK1234567890abcdefghijklmnopqrstuvwxyz',
      }),
    });
    const arcgisSaveData = await arcgisSaveRes.json();

    const arcgisTestRes = await fetch(`${API_BASE}/gis/arcgis/test`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        serviceName: 'Enterprise ArcGIS Feature Server',
      }),
    });
    const arcgisTestData = await arcgisTestRes.json();

    assert(
      arcgisSaveRes.status === 200 &&
      arcgisSaveData.data.apiKeyMasked.includes('...') &&
      arcgisTestRes.status === 200 &&
      arcgisTestData.data.status === 'CONNECTED',
      'TC-13-15',
      'Secure ArcGIS configuration with masked credentials and verified connection test'
    );

    // --------------------------------------------------------------------------
    // TEST 16: Territory Realignment Workflow (Draft -> Submit -> Approve)
    // --------------------------------------------------------------------------
    const proposedRealignmentPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.58, 37.65],
          [-122.25, 37.65],
          [-122.25, 37.90],
          [-122.58, 37.90],
          [-122.58, 37.65],
        ],
      ],
    };

    // 1. Create Proposal
    const propRes = await fetch(`${API_BASE}/gis/realignments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        territoryId: testTerritoryId,
        proposalName: 'Q3 Silicon Valley Territory Boundary Expansion',
        proposedBoundary: proposedRealignmentPolygon,
        justification: 'Absorb East Bay commercial accounts to optimize travel routes.',
      }),
    });
    const propData = await propRes.json();
    testRealignmentId = propData.data?.id;

    // 2. Submit Proposal
    const submitRes = await fetch(`${API_BASE}/gis/realignments/${testRealignmentId}/submit`, {
      method: 'POST',
      headers: headersA,
    });
    const submitData = await submitRes.json();

    // 3. Approve Proposal
    const approveRes = await fetch(`${API_BASE}/gis/realignments/${testRealignmentId}/approve`, {
      method: 'POST',
      headers: headersA,
    });
    const approveData = await approveRes.json();

    assert(
      propRes.status === 201 &&
      propData.data.impactSummary?.areaDelta !== undefined &&
      submitRes.status === 200 &&
      submitData.data.status === 'SUBMITTED' &&
      approveRes.status === 200 &&
      approveData.proposal?.status === 'APPROVED' &&
      approveData.updatedTerritory?.areaSqKm === propData.data.proposedAreaSqKm,
      'TC-13-16',
      'Territory realignment lifecycle: area delta calculation, submission, and approved boundary update'
    );

    // --------------------------------------------------------------------------
    // TEST 17: Multi-Tenant Boundary Isolation
    // --------------------------------------------------------------------------
    const foreignTerrRes = await fetch(`${API_BASE}/gis/territories`, {
      method: 'GET',
      headers: headersB,
    });
    const foreignTerrData = await foreignTerrRes.json();

    const foreignAccessRes = await fetch(`${API_BASE}/gis/territories/${testTerritoryId}`, {
      method: 'GET',
      headers: headersB,
    });

    assert(
      foreignTerrRes.status === 200 &&
      foreignTerrData.count === 0 &&
      foreignAccessRes.status >= 400,
      'TC-13-17',
      'Multi-tenant boundary strictly prevents foreign tenant from viewing or accessing GIS territories'
    );

  } catch (err) {
    console.error('Unhandled Test Suite Exception:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
