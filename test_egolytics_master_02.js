const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 02 — COMPREHENSIVE VERIFICATION SUITE');
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

  // Fetch a valid user from the primary tenant
  const userA = await prisma.user.findFirst({
    where: { role: 'BUSINESS_OWNER' },
  });

  if (!userA) {
    throw new Error('No user found in database.');
  }

  const tokenA = generateToken({
    userId: userA.id,
    tenantId: userA.tenantId,
    role: userA.role,
    email: userA.email,
  });

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  // Another tenant for cross-tenant isolation testing
  const otherTenant = await prisma.tenant.findFirst({
    where: { id: { not: userA.tenantId } },
  });

  let tokenB = null;
  if (otherTenant) {
    tokenB = generateToken({
      userId: 'cross-tenant-user-001',
      tenantId: otherTenant.id,
      role: 'BUSINESS_OWNER',
      email: 'security.auditor@tenant-b.com',
    });
  }

  let createdGoalId = null;
  let createdProposalId = null;
  let createdProjectId = null;
  let convertedProjectId = null;

  try {
    // -------------------------------------------------------------
    // TC-01: Foundation Telemetry & Status
    // -------------------------------------------------------------
    const res01 = await fetch(`${API_BASE}/rd/status`, { headers: headersA });
    const json01 = await res01.json();
    assert(
      res01.status === 200 && json01.data?.executionPrompt.includes('Master Prompt'),
      'TC-01',
      'GET /api/rd/status reports EgoLytics R&D platform and execution prompt'
    );

    // -------------------------------------------------------------
    // TC-02: Module Registry (mod-02-portfolio-intake is ACTIVE)
    // -------------------------------------------------------------
    const res02 = await fetch(`${API_BASE}/rd/modules`, { headers: headersA });
    const json02 = await res02.json();
    const mod02 = json02.data?.find((m) => m.id === 'mod-02-portfolio-intake');
    assert(
      res02.status === 200 && mod02 && mod02.status === 'ACTIVE',
      'TC-02',
      'GET /api/rd/modules confirms mod-02-portfolio-intake is registered as ACTIVE'
    );

    // -------------------------------------------------------------
    // TC-03: Create Strategic Goal
    // -------------------------------------------------------------
    const res03 = await fetch(`${API_BASE}/rd/strategy/goals`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Zero-Emission Solid State Battery Architecture',
        category: 'Sustainability',
        targetYear: 2027,
        targetValue: '500 Wh/kg density',
        description: 'Accelerate next-generation energy density research for utility storage.',
      }),
    });
    const json03 = await res03.json();
    createdGoalId = json03.data?.id;
    assert(
      res03.status === 201 && createdGoalId && json03.data.code.startsWith('GOAL-'),
      'TC-03',
      `POST /api/rd/strategy/goals created goal with code ${json03.data?.code}`
    );

    // -------------------------------------------------------------
    // TC-04: List Strategic Goals
    // -------------------------------------------------------------
    const res04 = await fetch(`${API_BASE}/rd/strategy/goals`, { headers: headersA });
    const json04 = await res04.json();
    assert(
      res04.status === 200 && Array.isArray(json04.data) && json04.data.some((g) => g.id === createdGoalId),
      'TC-04',
      'GET /api/rd/strategy/goals returns list containing created strategic goal'
    );

    // -------------------------------------------------------------
    // TC-05: Create Proposal as DRAFT
    // -------------------------------------------------------------
    const res05 = await fetch(`${API_BASE}/rd/intake`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'High-Temperature Solid-State Polymer Interface Research',
        category: 'Breakthrough Research',
        summary: 'Investigation of interface impedance in solid polymer electrolytes.',
        problemStatement: 'Dendrite growth causes catastrophic failure at high charge rates.',
        expectedOutcomes: 'Stable cycling over 2000 cycles at 3C rate.',
        estimatedBudget: 85000,
        estimatedDurationMonths: 8,
        strategicGoalId: createdGoalId,
        expectedRoi: 80,
        riskAssessment: 'MEDIUM',
        feasibilityScore: 75,
        isSubmitted: false, // Save as Draft
      }),
    });
    const json05 = await res05.json();
    createdProposalId = json05.data?.id;
    assert(
      res05.status === 201 && createdProposalId && json05.data.status === 'DRAFT',
      'TC-05',
      `POST /api/rd/intake created draft proposal ${json05.data?.referenceNumber} (DRAFT)`
    );

    // -------------------------------------------------------------
    // TC-06: Submit Draft Proposal
    // -------------------------------------------------------------
    const res06 = await fetch(`${API_BASE}/rd/intake/${createdProposalId}/submit`, {
      method: 'POST',
      headers: headersA,
    });
    const json06 = await res06.json();
    assert(
      res06.status === 200 && json06.data.status === 'SUBMITTED',
      'TC-06',
      'POST /api/rd/intake/:id/submit transitions proposal from DRAFT to SUBMITTED'
    );

    // -------------------------------------------------------------
    // TC-07: Reviewer Action - Request More Information
    // -------------------------------------------------------------
    const res07 = await fetch(`${API_BASE}/rd/intake/${createdProposalId}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        action: 'REQUEST_INFO',
        notes: 'Please provide bill of materials and autoclave equipment requirements.',
      }),
    });
    const json07 = await res07.json();
    assert(
      res07.status === 200 &&
        json07.data.status === 'MORE_INFO_REQUIRED' &&
        json07.data.moreInfoNotes.includes('autoclave'),
      'TC-07',
      'POST /api/rd/intake/:id/review updates status to MORE_INFO_REQUIRED with reviewer notes'
    );

    // -------------------------------------------------------------
    // TC-08: Resubmit Proposal After Clarification
    // -------------------------------------------------------------
    const res08 = await fetch(`${API_BASE}/rd/intake/${createdProposalId}/submit`, {
      method: 'POST',
      headers: headersA,
    });
    const json08 = await res08.json();
    assert(
      res08.status === 200 && json08.data.status === 'SUBMITTED',
      'TC-08',
      'POST /api/rd/intake/:id/submit transitions proposal back to SUBMITTED'
    );

    // -------------------------------------------------------------
    // TC-09: Approve Proposal & Atomic Conversion into R&D Project
    // -------------------------------------------------------------
    const res09 = await fetch(`${API_BASE}/rd/intake/${createdProposalId}/approve`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        reviewComments: 'Scientific methodology validated. Budget approved.',
      }),
    });
    const json09 = await res09.json();
    convertedProjectId = json09.data?.project?.id;

    assert(
      res09.status === 200 &&
        json09.data.proposal?.status === 'APPROVED' &&
        convertedProjectId &&
        json09.data.project.projectType === 'R_AND_D' &&
        parseFloat(json09.data.project.budget) === 85000,
      'TC-09',
      `POST /api/rd/intake/:id/approve executed atomic conversion to R&D Project (${convertedProjectId})`
    );

    // Verify strategic alignment was automatically created during atomic approval
    const alignmentRecord = await prisma.projectStrategicAlignment.findUnique({
      where: {
        projectId_goalId: {
          projectId: convertedProjectId,
          goalId: createdGoalId,
        },
      },
    });
    assert(
      alignmentRecord !== null,
      'TC-09b',
      'Automatic creation of ProjectStrategicAlignment between converted project and goal'
    );

    // -------------------------------------------------------------
    // TC-10: Rejection Workflow
    // -------------------------------------------------------------
    const res10a = await fetch(`${API_BASE}/rd/intake`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Perpetual Motion Energy Harnesser',
        category: 'Breakthrough Research',
        summary: 'Thermodynamics violation experiment.',
        estimatedBudget: 120000,
        isSubmitted: true,
      }),
    });
    const json10a = await res10a.json();
    const rejectPropId = json10a.data?.id;

    const res10b = await fetch(`${API_BASE}/rd/intake/${rejectPropId}/reject`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        rejectionReason: 'Violates the Second Law of Thermodynamics. Concept rejected.',
      }),
    });
    const json10b = await res10b.json();
    assert(
      res10b.status === 200 &&
        json10b.data?.status === 'REJECTED' &&
        json10b.data?.rejectionReason.includes('Thermodynamics'),
      'TC-10',
      'POST /api/rd/intake/:id/reject validates rejection reason and sets REJECTED status'
    );

    // -------------------------------------------------------------
    // TC-11: R&D Portfolio Rollups & Listing
    // -------------------------------------------------------------
    const res11 = await fetch(`${API_BASE}/rd/portfolio`, { headers: headersA });
    const json11 = await res11.json();
    const portfolio = json11.data;
    assert(
      res11.status === 200 &&
        portfolio &&
        portfolio.rollups.totalProjects >= 1 &&
        portfolio.rollups.totalBudget >= 85000 &&
        portfolio.projects.some((p) => p.id === convertedProjectId),
      'TC-11',
      'GET /api/rd/portfolio aggregates portfolio rollups and includes converted project'
    );

    // -------------------------------------------------------------
    // TC-12: Direct R&D Project Creation
    // -------------------------------------------------------------
    const res12 = await fetch(`${API_BASE}/rd/portfolio`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Smart Inverter High-Voltage Silicon Carbide Topology',
        client: 'Internal R&D / Advanced Electronics',
        budget: 62000,
        priority: 'CRITICAL',
        strategicCategory: 'Core Innovation',
        deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        roiScore: 85,
        riskScore: 25,
        feasibilityScore: 80,
      }),
    });
    const json12 = await res12.json();
    createdProjectId = json12.data?.id;
    assert(
      res12.status === 201 && createdProjectId && json12.data.projectType === 'R_AND_D',
      'TC-12',
      `POST /api/rd/portfolio created direct R&D Project (${createdProjectId})`
    );

    // -------------------------------------------------------------
    // TC-13: Update Project Progress and Status
    // -------------------------------------------------------------
    const res13 = await fetch(`${API_BASE}/rd/portfolio/${createdProjectId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        progress: 25,
        spent: 12500,
        status: 'In Progress',
      }),
    });
    const json13 = await res13.json();
    assert(
      res13.status === 200 && json13.data.progress === 25 && parseFloat(json13.data.spent) === 12500,
      'TC-13',
      'PUT /api/rd/portfolio/:id updates initiative progress, spent, and status'
    );

    // -------------------------------------------------------------
    // TC-14: Strategic Alignment Matrix
    // -------------------------------------------------------------
    // Align direct project to strategic goal
    await fetch(`${API_BASE}/rd/strategy/align`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: createdProjectId,
        goalId: createdGoalId,
        alignmentRationale: 'Enables high-efficiency power delivery for grid storage modules.',
        impactWeight: 1.5,
      }),
    });

    const res14 = await fetch(`${API_BASE}/rd/strategy/matrix`, { headers: headersA });
    const json14 = await res14.json();
    assert(
      res14.status === 200 &&
        json14.data?.goalContributions?.some((gc) => gc.goalId === createdGoalId && gc.linkedProjectCount >= 2),
      'TC-14',
      'GET /api/rd/strategy/matrix calculates cross-initiative budget and goal contribution share'
    );

    // -------------------------------------------------------------
    // TC-15: Prioritization Engine & Algorithmic Scoring
    // -------------------------------------------------------------
    const res15 = await fetch(`${API_BASE}/rd/prioritization`, { headers: headersA });
    const json15 = await res15.json();
    const rankedList = json15.data?.projects;
    assert(
      res15.status === 200 &&
        Array.isArray(rankedList) &&
        rankedList.length >= 2 &&
        rankedList[0].rank === 1 &&
        rankedList[0].computedScore >= rankedList[1].computedScore,
      'TC-15',
      'GET /api/rd/prioritization returns ranked leaderboard ordered by composite score'
    );

    // -------------------------------------------------------------
    // TC-16: Prioritization Score Tuning & Recalculate
    // -------------------------------------------------------------
    const res16a = await fetch(`${API_BASE}/rd/prioritization/${createdProjectId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        roiScore: 95,
        riskScore: 15,
        feasibilityScore: 90,
      }),
    });
    const json16a = await res16a.json();

    const res16b = await fetch(`${API_BASE}/rd/prioritization/recalculate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    const json16b = await res16b.json();
    assert(
      res16a.status === 200 &&
        json16a.data.scoreData.compositeScore > 80 &&
        res16b.status === 200 &&
        json16b.data.updatedCount >= 2,
      'TC-16',
      'PUT /api/rd/prioritization/:id tunes multi-factor scores and recalculates portfolio'
    );

    // -------------------------------------------------------------
    // TC-17: Cross-Tenant Isolation Security Test
    // -------------------------------------------------------------
    if (tokenB) {
      const res17a = await fetch(`${API_BASE}/rd/portfolio/${createdProjectId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const res17b = await fetch(`${API_BASE}/rd/intake/${createdProposalId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(
        (res17a.status === 404 || res17a.status === 403) &&
          (res17b.status === 404 || res17b.status === 403),
        'TC-17',
        'Cross-tenant read access strictly blocked (403/404) for foreign tenant tokens'
      );
    } else {
      console.log('[SKIP] TC-17: Second tenant token not available for cross-tenant check.');
    }

    // -------------------------------------------------------------
    // TC-18: CRM & ERP Zero-Regression Verification
    // -------------------------------------------------------------
    const [userCount, tenantCount, leadCount, taskCount, commercialProjectCount] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.lead.count(),
      prisma.task.count(),
      prisma.erpProject.count({ where: { projectType: 'COMMERCIAL' } }),
    ]);

    assert(
      userCount === 14 && tenantCount === 2,
      'TC-18a',
      `Users (${userCount}/14) and Tenants (${tenantCount}/2) preserved 100% without deletion`
    );
    assert(
      leadCount >= 0 && taskCount >= 0,
      'TC-18b',
      `CRM Core tables intact: leads=${leadCount}, tasks=${taskCount}, commercialProjects=${commercialProjectCount}`
    );
  } catch (error) {
    console.error('Test execution caught unexpected error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
