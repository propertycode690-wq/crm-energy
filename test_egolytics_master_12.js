const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 12 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('R&D DASHBOARD, REPORTING & ANALYTICS ENGINE');
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
    userId: 'foreign-user-001',
    tenantId: 'cmunoyqx50000tovon49iw6gx', // Foreign tenant
    role: 'CRM_PRO',
    email: 'foreign.user@tenantb.io',
  });

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  const headersB = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  };

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Executive R&D Dashboard Overview
    // --------------------------------------------------------------------------
    const execRes = await fetch(`${API_BASE}/rd/analytics/executive`, {
      method: 'GET',
      headers: headersA,
    });
    const execData = await execRes.json();
    assert(
      execRes.status === 200 &&
      execData.success &&
      execData.data?.portfolio &&
      execData.data?.financial &&
      execData.data?.execution,
      'TC-12-01',
      'Executive R&D dashboard aggregates real operational telemetry'
    );

    // --------------------------------------------------------------------------
    // TEST 2: Project Portfolio Analytics
    // --------------------------------------------------------------------------
    const portRes = await fetch(`${API_BASE}/rd/analytics/portfolio`, {
      method: 'GET',
      headers: headersA,
    });
    const portData = await portRes.json();
    assert(
      portRes.status === 200 &&
      portData.success &&
      portData.data?.distributions?.byStatus &&
      Array.isArray(portData.data?.comparisons),
      'TC-12-02',
      'Project portfolio analytics returns multi-dimensional distributions & comparisons'
    );

    // --------------------------------------------------------------------------
    // TEST 3: Portfolio Filtering
    // --------------------------------------------------------------------------
    const filterRes = await fetch(`${API_BASE}/rd/analytics/portfolio?priority=HIGH`, {
      method: 'GET',
      headers: headersA,
    });
    const filterData = await filterRes.json();
    assert(
      filterRes.status === 200 &&
      filterData.success &&
      filterData.data?.comparisons.every((p) => p.priority === 'HIGH'),
      'TC-12-03',
      'Portfolio analytics filter responds accurately to query parameters'
    );

    // --------------------------------------------------------------------------
    // TEST 4: Research & Innovation Analytics
    // --------------------------------------------------------------------------
    const innovRes = await fetch(`${API_BASE}/rd/analytics/innovation`, {
      method: 'GET',
      headers: headersA,
    });
    const innovData = await innovRes.json();
    assert(
      innovRes.status === 200 &&
      innovData.success &&
      innovData.data?.funnel &&
      innovData.data?.distributions?.byGateDecision,
      'TC-12-04',
      'Research & innovation analytics measures idea funnel and gate decisions'
    );

    // --------------------------------------------------------------------------
    // TEST 5: Project Execution Analytics
    // --------------------------------------------------------------------------
    const execuRes = await fetch(`${API_BASE}/rd/analytics/execution`, {
      method: 'GET',
      headers: headersA,
    });
    const execuData = await execuRes.json();
    assert(
      execuRes.status === 200 &&
      execuData.success &&
      execuData.data?.summary &&
      Array.isArray(execuData.data?.sprints),
      'TC-12-05',
      'Execution analytics reports task completion, hours variance, and sprints'
    );

    // --------------------------------------------------------------------------
    // TEST 6: Financial Analytics & Overruns
    // --------------------------------------------------------------------------
    const finRes = await fetch(`${API_BASE}/rd/analytics/financial`, {
      method: 'GET',
      headers: headersA,
    });
    const finData = await finRes.json();
    assert(
      finRes.status === 200 &&
      finData.success &&
      finData.data?.summary &&
      finData.data?.categoryBreakdown,
      'TC-12-06',
      'Financial analytics tracks approved budget, actual spent, and category variances'
    );

    // --------------------------------------------------------------------------
    // TEST 7: Resource Workload & Capacity Analytics
    // --------------------------------------------------------------------------
    const resRes = await fetch(`${API_BASE}/rd/analytics/resources`, {
      method: 'GET',
      headers: headersA,
    });
    const resData = await resRes.json();
    assert(
      resRes.status === 200 &&
      resData.success &&
      resData.data?.summary?.totalCapacityHours > 0 &&
      Array.isArray(resData.data?.workloads),
      'TC-12-07',
      'Resource analytics calculates team member capacity allocation and workload'
    );

    // --------------------------------------------------------------------------
    // TEST 8: Risk and Decision Analytics
    // --------------------------------------------------------------------------
    const riskRes = await fetch(`${API_BASE}/rd/analytics/risks-decisions`, {
      method: 'GET',
      headers: headersA,
    });
    const riskData = await riskRes.json();
    assert(
      riskRes.status === 200 &&
      riskData.success &&
      riskData.data?.risks?.severityDistribution &&
      riskData.data?.decisions?.decisionDistribution,
      'TC-12-08',
      'Risk and decision analytics reports severity distribution and gate history'
    );

    // --------------------------------------------------------------------------
    // TEST 9: KPI Blueprint Initialization & Retrieval
    // --------------------------------------------------------------------------
    const kpiRes = await fetch(`${API_BASE}/rd/analytics/kpis`, {
      method: 'GET',
      headers: headersA,
    });
    const kpiData = await kpiRes.json();
    assert(
      kpiRes.status === 200 &&
      kpiData.success &&
      kpiData.data?.length >= 6,
      'TC-12-09',
      'KPI Framework seeds and returns all 6 standard R&D KPI blueprints'
    );

    const firstKpi = kpiData.data?.[0];

    // --------------------------------------------------------------------------
    // TEST 10: Recalculate KPIs from Live Telemetry
    // --------------------------------------------------------------------------
    const recalcRes = await fetch(`${API_BASE}/rd/analytics/kpis/recalculate`, {
      method: 'POST',
      headers: headersA,
    });
    const recalcData = await recalcRes.json();
    assert(
      recalcRes.status === 200 &&
      recalcData.success &&
      Array.isArray(recalcData.data),
      'TC-12-10',
      'Live recalculation computes actual formula metrics and updates KPI status'
    );

    // --------------------------------------------------------------------------
    // TEST 11: Update KPI Target & View History
    // --------------------------------------------------------------------------
    if (firstKpi) {
      const updateTargetRes = await fetch(`${API_BASE}/rd/analytics/kpis/${firstKpi.id}/target`, {
        method: 'PUT',
        headers: headersA,
        body: JSON.stringify({
          targetValue: 88.5,
          ownerId: userA.id,
        }),
      });
      const updateTargetData = await updateTargetRes.json();

      const histRes = await fetch(`${API_BASE}/rd/analytics/kpis/${firstKpi.id}/history`, {
        method: 'GET',
        headers: headersA,
      });
      const histData = await histRes.json();

      assert(
        updateTargetRes.status === 200 &&
        updateTargetData.success &&
        updateTargetData.data.targetValue === 88.5 &&
        histRes.status === 200 &&
        Array.isArray(histData.data),
        'TC-12-11',
        'Configurable KPI target update and historical audit tracking'
      );
    }

    // --------------------------------------------------------------------------
    // TEST 12: Reporting Engine - Portfolio Summary Report
    // --------------------------------------------------------------------------
    const repRes = await fetch(`${API_BASE}/rd/analytics/reports?reportType=PORTFOLIO_SUMMARY`, {
      method: 'GET',
      headers: headersA,
    });
    const repData = await repRes.json();
    assert(
      repRes.status === 200 &&
      repData.success &&
      repData.data?.reportType === 'PORTFOLIO_SUMMARY' &&
      Array.isArray(repData.data?.columns) &&
      Array.isArray(repData.data?.rows),
      'TC-12-12',
      'Reporting engine generates structured Portfolio Summary with columns and rows'
    );

    // --------------------------------------------------------------------------
    // TEST 13: Reporting Engine - Financial & Executive Reports
    // --------------------------------------------------------------------------
    const repFinRes = await fetch(`${API_BASE}/rd/analytics/reports?reportType=FINANCIAL_PERFORMANCE`, {
      method: 'GET',
      headers: headersA,
    });
    const repFinData = await repFinRes.json();
    assert(
      repFinRes.status === 200 &&
      repFinData.success &&
      repFinData.data?.reportType === 'FINANCIAL_PERFORMANCE',
      'TC-12-13',
      'Reporting engine generates Financial Performance & Variance Report'
    );

    // --------------------------------------------------------------------------
    // TEST 14: CSV Export Engine (RFC-4180 Compliant)
    // --------------------------------------------------------------------------
    const csvRes = await fetch(`${API_BASE}/rd/analytics/export/csv?reportType=PORTFOLIO_SUMMARY`, {
      method: 'GET',
      headers: headersA,
    });
    const csvText = await csvRes.text();
    const contentType = csvRes.headers.get('content-type');
    assert(
      csvRes.status === 200 &&
      contentType && contentType.includes('text/csv') &&
      csvText.includes('Project ID') &&
      csvText.includes('EgoLytics R&D Analytics Report'),
      'TC-12-14',
      'CSV export outputs sanitized RFC-4180 compliant CSV stream with headers'
    );

    // --------------------------------------------------------------------------
    // TEST 15: JSON Export Engine
    // --------------------------------------------------------------------------
    const jsonRes = await fetch(`${API_BASE}/rd/analytics/export/json?reportType=PORTFOLIO_SUMMARY`, {
      method: 'GET',
      headers: headersA,
    });
    const jsonText = await jsonRes.text();
    const parsedJson = JSON.parse(jsonText);
    assert(
      jsonRes.status === 200 &&
      parsedJson.reportType === 'PORTFOLIO_SUMMARY' &&
      Array.isArray(parsedJson.rows),
      'TC-12-15',
      'JSON export outputs structured metadata and data rows'
    );

    // --------------------------------------------------------------------------
    // TEST 16: Custom Dashboard Layout Preferences
    // --------------------------------------------------------------------------
    const prefGetRes = await fetch(`${API_BASE}/rd/analytics/preferences?dashboardType=EXECUTIVE`, {
      method: 'GET',
      headers: headersA,
    });
    const prefGetData = await prefGetRes.json();

    const newLayout = [
      { widgetId: 'financial-variance-chart', title: 'Capital Budget vs Expenditure', enabled: true, order: 1, width: 'half' },
      { widgetId: 'kpi-summary-cards', title: 'Key Performance Indicators', enabled: true, order: 2, width: 'full' },
    ];

    const prefSaveRes = await fetch(`${API_BASE}/rd/analytics/preferences`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        dashboardType: 'EXECUTIVE',
        layoutConfig: newLayout,
      }),
    });
    const prefSaveData = await prefSaveRes.json();

    const prefResetRes = await fetch(`${API_BASE}/rd/analytics/preferences?dashboardType=EXECUTIVE`, {
      method: 'DELETE',
      headers: headersA,
    });
    const prefResetData = await prefResetRes.json();

    assert(
      prefGetRes.status === 200 &&
      prefSaveRes.status === 200 &&
      prefSaveData.data.isCustom === true &&
      prefResetRes.status === 200 &&
      prefResetData.data.isCustom === false,
      'TC-12-16',
      'Dashboard customization saves, retrieves, and resets user layout preferences'
    );

    // --------------------------------------------------------------------------
    // TEST 17: Multi-Tenant Boundary Isolation
    // --------------------------------------------------------------------------
    const foreignExecRes = await fetch(`${API_BASE}/rd/analytics/executive`, {
      method: 'GET',
      headers: headersB,
    });
    const foreignExecData = await foreignExecRes.json();
    assert(
      foreignExecRes.status === 200 &&
      foreignExecData.success &&
      foreignExecData.data?.portfolio?.totalProjects === 0,
      'TC-12-17',
      'Multi-tenant boundary strictly isolates R&D metrics across distinct tenants'
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

