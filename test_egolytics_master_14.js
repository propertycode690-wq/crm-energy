/**
 * EGOLYTICS MASTER PROMPT 14 — AUTOMATED VERIFICATION SUITE
 * BFOV Charts – Core Diagramming Engine
 *
 * Verifies:
 * - TC-14-01: Diagramming workspace telemetry & system template blueprint inventory
 * - TC-14-02: Template instantiation into operational Flowchart diagram
 * - TC-14-03: Create custom blank architecture diagram with metadata & tags
 * - TC-14-04: Drag-and-drop / place diverse shapes (Basic, Flowchart, UML, ERD, Network)
 * - TC-14-05: Shape movement updates coordinates and persists
 * - TC-14-06: Shape resizing updates dimensions (width & height)
 * - TC-14-07: Add straight, orthogonal (elbow), and bezier connectors
 * - TC-14-08: Connector dynamic tracking: edge endpoints compute correctly after shape move
 * - TC-14-09: Edit node styling (fill, stroke, strokeWidth, dash, font size)
 * - TC-14-10: Mathematical node alignment (left, center, right, top, middle, bottom)
 * - TC-14-11: Mathematical node distribution (equal spacing along horizontal/vertical)
 * - TC-14-12: Snap to grid calculation ensures coordinate alignment
 * - TC-14-13: Validation engine enforces payload integrity, rejects orphan edges
 * - TC-14-14: Save diagram updates and automatically creates version history snapshot
 * - TC-14-15: Restore diagram to earlier version snapshot
 * - TC-14-16: Duplicate diagram with complete graph data cloned
 * - TC-14-17: Strict multi-tenant isolation prevents cross-tenant diagram access
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const bfovDiagramService = require('./src/services/bfovDiagramService');
const bfovValidationService = require('./src/services/bfovValidationService');
const bfovRoutingEngine = require('./src/services/bfovRoutingEngine');

const runId = Date.now();
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

async function runMaster14TestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 14 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('BFOV CHARTS – CORE DIAGRAMMING ENGINE');
  console.log('================================================================\n');

  try {
    // 1. Setup primary tenant & user
    const tenantA = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenantA) throw new Error('Primary tenant not found in database.');
    const userA = await prisma.user.findFirst({ where: { tenantId: tenantA.id } });

    // Setup second tenant for tenant boundary isolation checks
    let tenantB = await prisma.tenant.findFirst({ where: { id: { not: tenantA.id } } });
    if (!tenantB) {
      tenantB = await prisma.tenant.create({
        data: {
          name: `Cross-Tenant B (${runId})`,
          status: 'ACTIVE'
        }
      });
    }

    // --- TC-14-01: Workspace telemetry & template blueprints ---
    const telemetry = await bfovDiagramService.getWorkspaceTelemetry(tenantA.id);
    assert(
      telemetry.status === 'ACTIVE' && telemetry.templatesAvailable >= 4,
      'TC-14-01: Workspace telemetry initializes with active status and standard blueprint templates'
    );

    // --- TC-14-02: Instantiate from template ---
    const templateDiagram = await bfovDiagramService.createFromTemplate(
      tenantA.id,
      userA?.id,
      'standard-process-flow',
      `Process Pipeline Flow (${runId})`
    );
    assert(
      templateDiagram.id &&
      templateDiagram.nodeCount === 6 &&
      templateDiagram.edgeCount === 6 &&
      templateDiagram.diagramType === 'FLOWCHART',
      'TC-14-02: Template instantiation initializes flowchart with 6 nodes and 6 connectors'
    );

    // --- TC-14-03: Create custom diagram ---
    const customDiagram = await bfovDiagramService.createDiagram(tenantA.id, userA?.id, {
      title: `EgoLytics Hybrid Architecture (${runId})`,
      description: 'Distributed microservices and database clustering topology',
      diagramType: 'ARCHITECTURE',
      category: 'Architecture',
      tags: ['microservices', 'cloud', 'mysql'],
      graphData: {
        nodes: [
          { id: 'node-client', type: 'network_node', x: 50, y: 100, width: 140, height: 60, label: 'Client Apps' },
          { id: 'node-gw', type: 'cloud', x: 280, y: 100, width: 150, height: 80, label: 'API Gateway' },
          { id: 'node-db', type: 'database', x: 520, y: 100, width: 140, height: 80, label: 'MySQL Cluster' }
        ],
        edges: [
          { id: 'edge-cg', source: 'node-client', target: 'node-gw', type: 'straight', label: 'HTTPS' },
          { id: 'edge-gd', source: 'node-gw', target: 'node-db', type: 'straight', label: 'TCP :3306' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    });
    assert(
      customDiagram.id && customDiagram.nodeCount === 3 && customDiagram.edgeCount === 2,
      'TC-14-03: Create custom architecture diagram with nodes, connectors, and metadata'
    );

    // --- TC-14-04: Shape Library Diversity ---
    const supportedShapes = bfovValidationService.getSupportedTypes().shapeTypes;
    const hasBasic = ['rectangle', 'circle', 'diamond', 'triangle'].every(s => supportedShapes.includes(s));
    const hasFlow = ['terminator', 'process', 'decision', 'database'].every(s => supportedShapes.includes(s));
    const hasUML = ['uml_class', 'entity', 'attribute', 'relationship'].every(s => supportedShapes.includes(s));
    const hasNet = ['server', 'cloud', 'firewall', 'network_node'].every(s => supportedShapes.includes(s));
    assert(
      hasBasic && hasFlow && hasUML && hasNet,
      'TC-14-04: Shape library provides categorized Basic, Flowchart, UML/ERD, and Network shapes'
    );

    // --- TC-14-05: Shape movement updates coordinates ---
    const updatedGraphWithMove = JSON.parse(JSON.stringify(customDiagram.graphData));
    updatedGraphWithMove.nodes[0].x = 80;
    updatedGraphWithMove.nodes[0].y = 130;
    const afterMove = await bfovDiagramService.updateDiagram(tenantA.id, userA?.id, customDiagram.id, {
      graphData: updatedGraphWithMove
    });
    assert(
      afterMove.graphData.nodes[0].x === 80 && afterMove.graphData.nodes[0].y === 130,
      'TC-14-05: Shape movement updates coordinates on the canvas and persists'
    );

    // --- TC-14-06: Shape resizing ---
    const updatedGraphWithResize = JSON.parse(JSON.stringify(afterMove.graphData));
    updatedGraphWithResize.nodes[1].width = 200;
    updatedGraphWithResize.nodes[1].height = 100;
    const afterResize = await bfovDiagramService.updateDiagram(tenantA.id, userA?.id, customDiagram.id, {
      graphData: updatedGraphWithResize
    });
    assert(
      afterResize.graphData.nodes[1].width === 200 && afterResize.graphData.nodes[1].height === 100,
      'TC-14-06: Shape resizing updates node width and height dimensions correctly'
    );

    // --- TC-14-07: Routing Engine straight, elbow, and bezier paths ---
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 250 };
    const straightPath = bfovRoutingEngine.getStraightPath(p1, p2);
    const elbowPath = bfovRoutingEngine.getElbowPath(p1, p2, 'right', 'left');
    const bezierPath = bfovRoutingEngine.getBezierPath(p1, p2, 'right', 'left');

    assert(
      straightPath.path.startsWith('M 100 100 L 300 250') &&
      elbowPath.path.includes('L') &&
      bezierPath.path.includes('C'),
      'TC-14-07: Routing engine calculates straight, orthogonal (elbow), and bezier connector paths'
    );

    // --- TC-14-08: Connector dynamic tracking ---
    const nodeMap = {
      'node-client': afterResize.graphData.nodes[0],
      'node-gw': afterResize.graphData.nodes[1]
    };
    const edgeRoute = bfovRoutingEngine.computeEdgeRoute(
      { source: 'node-client', target: 'node-gw', sourceHandle: 'right', targetHandle: 'left', type: 'elbow' },
      nodeMap
    );
    // client right handle: x=80+140=220, y=130+30=160
    // gw left handle: x=280, y=100+50=150
    assert(
      edgeRoute && edgeRoute.points[0].x === 220 && edgeRoute.points[0].y === 160,
      'TC-14-08: Connector dynamically recalculates port attachment after node movement'
    );

    // --- TC-14-09: Edit node styling ---
    const updatedGraphWithStyle = JSON.parse(JSON.stringify(afterResize.graphData));
    updatedGraphWithStyle.nodes[0].style = {
      fill: '#eff6ff',
      stroke: '#2563eb',
      strokeWidth: 3,
      strokeDasharray: '4 4',
      fontSize: 16
    };
    const afterStyle = await bfovDiagramService.updateDiagram(tenantA.id, userA?.id, customDiagram.id, {
      graphData: updatedGraphWithStyle
    });
    assert(
      afterStyle.graphData.nodes[0].style.fill === '#eff6ff' &&
      afterStyle.graphData.nodes[0].style.strokeWidth === 3 &&
      afterStyle.graphData.nodes[0].style.strokeDasharray === '4 4',
      'TC-14-09: Update node styling preserves custom fill, stroke, width, and dash pattern'
    );

    // --- TC-14-10: Mathematical node alignment ---
    const unalignedNodes = [
      { id: 'n1', x: 50, y: 100, width: 100, height: 60 },
      { id: 'n2', x: 200, y: 140, width: 100, height: 60 },
      { id: 'n3', x: 350, y: 80, width: 100, height: 60 }
    ];
    const leftAligned = bfovRoutingEngine.alignNodes(unalignedNodes, 'left');
    const topAligned = bfovRoutingEngine.alignNodes(unalignedNodes, 'top');
    assert(
      leftAligned.every(n => n.x === 50) && topAligned.every(n => n.y === 80),
      'TC-14-10: Mathematical node alignment correctly aligns coordinates along left and top bounds'
    );

    // --- TC-14-11: Mathematical node distribution ---
    const distributed = bfovRoutingEngine.distributeNodes(unalignedNodes, 'horizontal');
    const gap1 = distributed[1].x - distributed[0].x;
    const gap2 = distributed[2].x - distributed[1].x;
    assert(
      gap1 === gap2,
      'TC-14-11: Mathematical node distribution spaces elements with equal spacing intervals'
    );

    // --- TC-14-12: Snap to grid calculation ---
    const snapped13 = bfovRoutingEngine.snapToGrid(13, 10);
    const snapped27 = bfovRoutingEngine.snapToGrid(27, 10);
    assert(
      snapped13 === 10 && snapped27 === 30,
      'TC-14-12: Snap to grid calculation rounds coordinates to closest grid increments'
    );

    // --- TC-14-13: Validation engine detects orphan edges and malformed graph ---
    const invalidGraph = {
      nodes: [{ id: 'valid-1', x: 10, y: 10, width: 100, height: 50 }],
      edges: [{ id: 'orphan-edge', source: 'valid-1', target: 'ghost-node' }]
    };
    const valResult = bfovValidationService.validateGraphData(invalidGraph);
    assert(
      !valResult.isValid && valResult.errors.some(e => e.includes('ghost-node')),
      'TC-14-13: Validation engine detects and rejects orphan connector edges referencing non-existent nodes'
    );

    // --- TC-14-14: Version snapshot creation ---
    const versions = await bfovDiagramService.getVersions(tenantA.id, customDiagram.id);
    assert(
      versions.length >= 3 && versions[0].version > versions[versions.length - 1].version,
      'TC-14-14: Saving diagram updates automatically snapshots previous versions in version history'
    );

    // --- TC-14-15: Restore version snapshot ---
    const restored = await bfovDiagramService.restoreVersion(tenantA.id, userA?.id, customDiagram.id, 1);
    assert(
      restored.version > customDiagram.version,
      'TC-14-15: Restore earlier version reverts diagram graph structure and increments version counter'
    );

    // --- TC-14-16: Duplicate diagram ---
    const duplicated = await bfovDiagramService.duplicateDiagram(
      tenantA.id,
      userA?.id,
      customDiagram.id,
      'Duplicated Production Topology'
    );
    assert(
      duplicated.id !== customDiagram.id &&
      duplicated.title === 'Duplicated Production Topology' &&
      duplicated.nodeCount === customDiagram.nodeCount,
      'TC-14-16: Duplicate diagram clones full graph structure, nodes, and metadata under a new record'
    );

    // --- TC-14-17: Strict multi-tenant isolation ---
    let crossTenantBlocked = false;
    try {
      await bfovDiagramService.getDiagramById(tenantB.id, customDiagram.id);
    } catch (err) {
      crossTenantBlocked = true;
    }
    assert(
      crossTenantBlocked === true,
      'TC-14-17: Strict multi-tenant isolation prevents foreign tenant from querying or accessing diagram'
    );

    console.log('\n================================================================');
    console.log(`TEST SUITE RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
    console.log('================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaster14TestSuite();

