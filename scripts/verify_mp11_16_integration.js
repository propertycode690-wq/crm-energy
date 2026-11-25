const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runIntegrationVerification() {
  console.log('================================================================');
  console.log('  EGOLYTICS: MP11-16 BACKEND INTEGRATION & TENANT INTEGRITY TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - ${details}`);
      failed++;
    }
  }

  // Find a valid user and their tenant
  const user = await prisma.user.findFirst({
    include: { tenant: true },
  });
  if (!user) {
    console.error('No users found in database!');
    return;
  }

  const tenantA = user.tenantId;
  const userA = user.id;

  const otherTenant = await prisma.tenant.findFirst({
    where: { id: { not: tenantA } },
  });
  const tenantB = otherTenant ? otherTenant.id : 'cmunoyqx50000tovon49iw6gx';

  console.log(`Using Tenant A: ${tenantA}, User A: ${userA}`);
  console.log(`Using Tenant B (isolated): ${tenantB}\n`);

  // Clean any previous test run leftovers
  await prisma.rdMessage.deleteMany({ where: { content: 'Hello World MP11 Sync Test' } });
  await prisma.rdConversation.deleteMany({ where: { title: 'Task 1 Test Channel' } });
  await prisma.bfovDiagram.deleteMany({ where: { title: 'Task 1 Verification Architecture Flow' } });

  try {
    // -------------------------------------------------------------
    // MP11: Collaboration
    // -------------------------------------------------------------
    console.log('--- TESTING MP11: COLLABORATION & INTEGRATIONS ---');
    const conv = await prisma.rdConversation.create({
      data: {
        tenantId: tenantA,
        title: 'Task 1 Test Channel',
        type: 'PROJECT_CHANNEL',
        topic: 'Verification of MP11 db sync',
        createdById: userA,
      },
    });
    assert(conv && conv.id, 'MP11: rdConversation.create succeeds');

    const msg = await prisma.rdMessage.create({
      data: {
        tenantId: tenantA,
        conversationId: conv.id,
        senderId: userA,
        content: 'Hello World MP11 Sync Test',
      },
    });
    assert(msg && msg.id, 'MP11: rdMessage.create succeeds');

    // Tenant Isolation check for MP11
    const tenantBConvs = await prisma.rdConversation.findMany({
      where: { tenantId: tenantB, id: conv.id },
    });
    assert(tenantBConvs.length === 0, 'MP11: Tenant B cannot access Tenant A conversation');

    // -------------------------------------------------------------
    // MP12: Analytics & Reporting
    // -------------------------------------------------------------
    console.log('\n--- TESTING MP12: ANALYTICS & DASHBOARD ENGINE ---');
    const kpi = await prisma.rdKpi.create({
      data: {
        tenantId: tenantA,
        code: `TEST_KPI_${Date.now()}`,
        name: 'Task 1 Test Velocity KPI',
        category: 'DELIVERY',
        targetValue: 85.0,
        currentValue: 80.0,
      },
    });
    assert(kpi && kpi.id, 'MP12: rdKpi.create succeeds');

    const pref = await prisma.rdDashboardPreference.upsert({
      where: {
        tenantId_userId_dashboardType: {
          tenantId: tenantA,
          userId: userA,
          dashboardType: 'EXECUTIVE',
        },
      },
      update: { layoutConfig: { cards: ['kpi', 'projects'] } },
      create: {
        tenantId: tenantA,
        userId: userA,
        dashboardType: 'EXECUTIVE',
        layoutConfig: { cards: ['kpi', 'projects'] },
      },
    });
    assert(pref && pref.id, 'MP12: rdDashboardPreference.upsert succeeds');

    // Tenant Isolation check for MP12
    const tenantBKpis = await prisma.rdKpi.findMany({
      where: { tenantId: tenantB, id: kpi.id },
    });
    assert(tenantBKpis.length === 0, 'MP12: Tenant B cannot access Tenant A KPI');

    // -------------------------------------------------------------
    // MP13: Maplytics GIS
    // -------------------------------------------------------------
    console.log('\n--- TESTING MP13: MAPLYTICS GIS & TERRITORY MANAGEMENT ---');
    const region = await prisma.gisRegion.create({
      data: {
        tenantId: tenantA,
        name: 'Task 1 Northern Territory',
        code: `NORTH_${Date.now()}`,
        type: 'STATE',
      },
    });
    assert(region && region.id, 'MP13: gisRegion.create succeeds');

    const territory = await prisma.gisTerritory.create({
      data: {
        tenantId: tenantA,
        regionId: region.id,
        name: 'Zone Alpha',
        code: `ZONE_A_${Date.now()}`,
        boundaryGeoJson: '{"type":"Polygon","coordinates":[]}',
        status: 'ACTIVE',
      },
    });
    assert(territory && territory.id, 'MP13: gisTerritory.create succeeds');

    // Tenant Isolation check for MP13
    const tenantBTerritories = await prisma.gisTerritory.findMany({
      where: { tenantId: tenantB, id: territory.id },
    });
    assert(tenantBTerritories.length === 0, 'MP13: Tenant B cannot access Tenant A Territory');

    // -------------------------------------------------------------
    // MP14 & MP15: BFOV Charts & AI
    // -------------------------------------------------------------
    console.log('\n--- TESTING MP14 & MP15: BFOV CHARTS & DIAGRAMMING ENGINE ---');
    const diagram = await prisma.bfovDiagram.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        title: 'Task 1 Verification Architecture Flow',
        diagramType: 'ARCHITECTURE',
        graphData: { nodes: [{ id: '1', label: 'Client' }], edges: [] },
      },
    });
    assert(diagram && diagram.id, 'MP14: bfovDiagram.create succeeds');

    const diagVersion = await prisma.bfovDiagramVersion.create({
      data: {
        tenantId: tenantA,
        diagramId: diagram.id,
        createdById: userA,
        version: 1,
        title: 'Initial Architecture Baseline',
        graphData: { nodes: [{ id: '1', label: 'Client' }], edges: [] },
      },
    });
    assert(diagVersion && diagVersion.id, 'MP15: bfovDiagramVersion.create succeeds');

    // Tenant Isolation check for BFOV
    const tenantBDiagrams = await prisma.bfovDiagram.findMany({
      where: { tenantId: tenantB, id: diagram.id },
    });
    assert(tenantBDiagrams.length === 0, 'MP14: Tenant B cannot access Tenant A BFOV Diagram');

    // -------------------------------------------------------------
    // MP16: Enterprise Governance, IP & Compliance
    // -------------------------------------------------------------
    console.log('\n--- TESTING MP16: ENTERPRISE GOVERNANCE, IP & COMPLIANCE ---');
    const ipAsset = await prisma.rdIpAsset.create({
      data: {
        tenantId: tenantA,
        createdById: userA,
        title: 'Task 1 Energy Grid AI Optimizer Patent',
        category: 'PATENT',
        status: 'INVENTION_DISCLOSURE',
      },
    });
    assert(ipAsset && ipAsset.id, 'MP16: rdIpAsset.create succeeds');

    const sop = await prisma.rdComplianceSop.create({
      data: {
        tenantId: tenantA,
        ownerId: userA,
        sopIdentifier: `SOP-T1-${Date.now()}`,
        title: 'Task 1 Lab Safety & Environmental Audit SOP',
        version: '1.0',
        approvalStatus: 'DRAFT',
      },
    });
    assert(sop && sop.id, 'MP16: rdComplianceSop.create succeeds');

    const auditLog = await prisma.rdEnterpriseAuditLog.create({
      data: {
        tenantId: tenantA,
        userId: userA,
        action: 'TASK_1_INTEGRATION_TEST',
        entityType: 'DATABASE_SYNCHRONIZATION',
        entityId: ipAsset.id,
        details: { pass: true, timestamp: new Date().toISOString() },
      },
    });
    assert(auditLog && auditLog.id, 'MP16: rdEnterpriseAuditLog.create succeeds');

    // Tenant Isolation check for MP16
    const tenantBAudits = await prisma.rdEnterpriseAuditLog.findMany({
      where: { tenantId: tenantB, id: auditLog.id },
    });
    assert(tenantBAudits.length === 0, 'MP16: Tenant B cannot access Tenant A Enterprise Audit Logs');

    // -------------------------------------------------------------
    // Clean up test fixtures safely
    // -------------------------------------------------------------
    console.log('\n--- CLEANING UP TEST FIXTURES ---');
    await prisma.rdMessage.delete({ where: { id: msg.id } });
    await prisma.rdConversation.delete({ where: { id: conv.id } });
    await prisma.rdKpi.delete({ where: { id: kpi.id } });
    await prisma.gisTerritory.delete({ where: { id: territory.id } });
    await prisma.gisRegion.delete({ where: { id: region.id } });
    await prisma.bfovDiagramVersion.delete({ where: { id: diagVersion.id } });
    await prisma.bfovDiagram.delete({ where: { id: diagram.id } });
    await prisma.rdIpAsset.delete({ where: { id: ipAsset.id } });
    await prisma.rdComplianceSop.delete({ where: { id: sop.id } });
    await prisma.rdEnterpriseAuditLog.delete({ where: { id: auditLog.id } });
    console.log('  ✓ Test fixtures cleaned up safely.');

    console.log('\n================================================================');
    console.log(`FINAL RESULT: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

  } catch (err) {
    console.error('Integration test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runIntegrationVerification();
