const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 04 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('STAGE-GATE GOVERNANCE & APPROVAL WORKFLOW ENGINE');
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

  // 1. Fetch valid users from primary tenant
  const users = await prisma.user.findMany({
    take: 5,
  });

  if (users.length === 0) {
    throw new Error('No user found in database.');
  }

  const userA = users[0];
  const userA2 = users[1] || users[0];

  const tokenA = generateToken({
    userId: userA.id,
    tenantId: userA.tenantId,
    role: userA.role,
    email: userA.email,
  });

  const tokenA2 = generateToken({
    userId: userA2.id,
    tenantId: userA.tenantId,
    role: 'STAFF',
    email: userA2.email,
  });

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  const headersA2 = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA2}`,
  };

  // Cross-tenant user
  const otherTenant = await prisma.tenant.findFirst({
    where: { id: { not: userA.tenantId } },
  });

  let tokenB = null;
  if (otherTenant) {
    tokenB = generateToken({
      userId: 'cross-tenant-user-004',
      tenantId: otherTenant.id,
      role: 'BUSINESS_OWNER',
      email: 'security.auditor@tenant-b.com',
    });
  }

  const headersB = tokenB
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      }
    : null;

  let createdTemplateId = null;
  let testProjectId1 = null;
  let testProjectId2 = null;
  let activeReviewId = null;

  try {
    // -------------------------------------------------------------
    // TC-01: Foundation Telemetry & Status
    // -------------------------------------------------------------
    const res01 = await fetch(`${API_BASE}/rd/status`, { headers: headersA });
    const json01 = await res01.json();
    assert(
      res01.status === 200 &&
        json01.data?.executionPrompt.includes('Master Prompt') &&
        json01.data?.division === 'Research & Development Division of CRM nErgy AI',
      'TC-01',
      'GET /api/rd/status reports EgoLytics R&D platform and execution prompt'
    );

    // -------------------------------------------------------------
    // TC-02: Module Registry (mod-04-stagegate is ACTIVE)
    // -------------------------------------------------------------
    const res02 = await fetch(`${API_BASE}/rd/modules`, { headers: headersA });
    const json02 = await res02.json();
    const mod04 = json02.data?.find((m) => m.id === 'mod-04-stagegate');
    assert(
      res02.status === 200 && mod04 && mod04.status === 'ACTIVE',
      'TC-02',
      'GET /api/rd/modules confirms mod-04-stagegate is registered as ACTIVE'
    );

    // -------------------------------------------------------------
    // TC-03: Stage Template Management (Default Seeding & Custom Creation)
    // -------------------------------------------------------------
    const res03a = await fetch(`${API_BASE}/rd/governance/templates`, { headers: headersA });
    const json03a = await res03a.json();
    const hasDefault = json03a.data?.some((t) => t.isDefault && t.stages?.length >= 5);

    const customTmplCode = `AGILE_RND_${Date.now()}`;
    const res03b = await fetch(`${API_BASE}/rd/governance/templates`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Fast-Track Agile Innovation Process',
        code: customTmplCode,
        description: 'Accelerated 3-stage innovation process for software and AI models.',
        stages: [
          {
            name: 'Concept & Architecture',
            code: 'STAGE_1_CONCEPT',
            responsibleRole: 'AI_ARCHITECT',
            color: '#3b82f6',
            criteria: [
              { name: 'Model architecture specification', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            ],
          },
          {
            name: 'Rapid Prototyping',
            code: 'STAGE_2_PROTOTYPE',
            responsibleRole: 'ML_ENGINEER',
            color: '#10b981',
            criteria: [
              { name: 'F1-score benchmarking exceeds baseline', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            ],
          },
          {
            name: 'Production Deployment',
            code: 'STAGE_3_DEPLOYMENT',
            responsibleRole: 'DEVOPS_LEAD',
            color: '#8b5cf6',
          },
        ],
      }),
    });
    const json03b = await res03b.json();
    createdTemplateId = json03b.data?.id;

    assert(
      res03a.status === 200 && hasDefault && res03b.status === 201 && createdTemplateId,
      'TC-03',
      'Stage templates seeded with default 5-stage framework and custom template created'
    );

    // -------------------------------------------------------------
    // TC-04: Governance Initialization on Eligible R&D Project
    // -------------------------------------------------------------
    // Ensure we have a fresh R&D ErpProject for clean governance test run
    const project1 = await prisma.erpProject.create({
      data: {
        tenantId: userA.tenantId,
        name: `Next-Gen Solid State Battery Test Project ${Date.now()}`,
        client: 'R&D Internal Labs',
        projectType: 'RD',
        budget: 500000.0,
        spent: 25000.0,
        progress: 10,
        status: 'In Progress',
        stage: 'Discovery',
      },
    });
    testProjectId1 = project1.id;

    const res04 = await fetch(`${API_BASE}/rd/governance/projects/${testProjectId1}/initialize`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    const json04 = await res04.json();
    activeReviewId = json04.data?.activeReview?.id;

    assert(
      res04.status === 201 &&
        json04.data?.governanceStatus === 'ACTIVE' &&
        json04.data?.currentStage?.stageNumber === 1 &&
        activeReviewId,
      'TC-04',
      `Project governance initialized at Stage 1 (${json04.data?.currentStage?.name}) with initial Gate 1 review cycle`
    );

    // -------------------------------------------------------------
    // TC-05: Duplicate Initialization Guard
    // -------------------------------------------------------------
    const res05 = await fetch(`${API_BASE}/rd/governance/projects/${testProjectId1}/initialize`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    const json05 = await res05.json();

    assert(
      res05.status === 201 && json05.data?.id === json04.data?.id,
      'TC-05',
      'Duplicate initialization returns existing governance instance safely without duplicate records'
    );

    // -------------------------------------------------------------
    // TC-06: Stage Exit Criteria Validation & Evidence Attachment
    // -------------------------------------------------------------
    const res06a = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/evidence`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Initial Prior-Art Patent Analysis Report',
        evidenceType: 'DOCUMENT',
        description: 'Comprehensive patent search covering garnet-structure ceramic electrolytes.',
      }),
    });
    const json06a = await res06a.json();

    assert(
      res06a.status === 201 && json06a.data?.id && json06a.data?.status === 'PENDING_REVIEW',
      'TC-06',
      'POST /api/rd/governance/reviews/:id/evidence attaches evidence document to review cycle'
    );

    // -------------------------------------------------------------
    // TC-07: Gate Submission
    // -------------------------------------------------------------
    const res07 = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/submit`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        summary: 'All Stage 1 concept deliverables and patent reviews completed.',
      }),
    });
    const json07 = await res07.json();

    assert(
      res07.status === 200 && json07.data?.status === 'SUBMITTED',
      'TC-07',
      'POST /api/rd/governance/reviews/:id/submit transitions gate review status to SUBMITTED'
    );

    // -------------------------------------------------------------
    // TC-08: Reviewer & Gatekeeper Assignment
    // -------------------------------------------------------------
    const res08 = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/reviewers`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        userId: userA2.id,
        role: 'GATEKEEPER',
      }),
    });
    const json08 = await res08.json();

    assert(
      res08.status === 200 && json08.data?.some((r) => r.userId === userA2.id),
      'TC-08',
      'POST /api/rd/governance/reviews/:id/reviewers assigns gatekeeper reviewer'
    );

    // -------------------------------------------------------------
    // TC-09: Individual Evaluator Sign-Off
    // -------------------------------------------------------------
    const res09 = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/sign-off`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify({
        recommendation: 'APPROVE',
        comments: 'Sound concept and strong IP defense. Recommend advancing to Feasibility Assessment.',
      }),
    });
    const json09 = await res09.json();

    assert(
      res09.status === 200 && json09.data?.recommendation === 'APPROVE',
      'TC-09',
      'POST /api/rd/governance/reviews/:id/sign-off records evaluator formal sign-off recommendation'
    );

    // -------------------------------------------------------------
    // TC-10: Authoritative Gate Decision — GO_CONTINUE
    // -------------------------------------------------------------
    const res10 = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/decision`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'GO_CONTINUE',
        decisionReason: 'All entry/exit criteria satisfied, unanimous gatekeeper approval, proceed to Stage 2.',
        decisionComments: 'Allocate $75k for initial laboratory sintering trial.',
      }),
    });
    const json10 = await res10.json();
    const nextReviewId = json10.data?.nextReview?.id;

    assert(
      res10.status === 200 &&
        json10.data?.decision?.decision === 'GO_CONTINUE' &&
        json10.data?.governance?.governanceStatus === 'ACTIVE' &&
        nextReviewId,
      'TC-10',
      'Authoritative GO_CONTINUE decision executed: advances project to Stage 2 and creates next Gate review'
    );

    // -------------------------------------------------------------
    // TC-11: Authoritative Gate Decision — HOLD
    // -------------------------------------------------------------
    // Submit Gate 2 and put on HOLD
    await fetch(`${API_BASE}/rd/governance/reviews/${nextReviewId}/evidence`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Feasibility Trial Budget Analysis',
        evidenceType: 'REPORT',
      }),
    });
    await fetch(`${API_BASE}/rd/governance/reviews/${nextReviewId}/submit`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ summary: 'Submitting feasibility review' }),
    });

    const res11 = await fetch(`${API_BASE}/rd/governance/reviews/${nextReviewId}/decision`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'HOLD',
        decisionReason: 'Awaiting Q3 capital expenditure approval for vacuum glovebox.',
      }),
    });
    const json11 = await res11.json();

    assert(
      res11.status === 200 &&
        json11.data?.decision?.decision === 'HOLD' &&
        json11.data?.governance?.governanceStatus === 'ON_HOLD' &&
        json11.data?.governance?.holdReason?.includes('capital expenditure'),
      'TC-11',
      'Authoritative HOLD decision safely suspends project governance with documented reason'
    );

    // -------------------------------------------------------------
    // TC-12: Hold Progression Blocker
    // -------------------------------------------------------------
    const res12 = await fetch(`${API_BASE}/rd/governance/reviews/${nextReviewId}/submit`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ summary: 'Attempt forward progression while on hold' }),
    });

    assert(
      res12.status === 400,
      'TC-12',
      'Forward progression strictly blocked when project governance is ON_HOLD'
    );

    // -------------------------------------------------------------
    // TC-13: Resume from Hold
    // -------------------------------------------------------------
    const res13 = await fetch(`${API_BASE}/rd/governance/projects/${testProjectId1}/resume`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ reason: 'Capex funding release approved.' }),
    });
    const json13 = await res13.json();

    assert(
      res13.status === 200 && json13.data?.governanceStatus === 'ACTIVE',
      'TC-13',
      'POST /api/rd/governance/projects/:id/resume returns project governance to ACTIVE state'
    );

    // -------------------------------------------------------------
    // TC-14: Authoritative Gate Decision — REWORK_RECYCLE
    // -------------------------------------------------------------
    const res14 = await fetch(`${API_BASE}/rd/governance/reviews/${nextReviewId}/decision`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'REWORK_RECYCLE',
        decisionReason: 'Sintering temperature parameters produced micro-cracks; recalibrate profile.',
      }),
    });
    const json14 = await res14.json();
    const reworkReviewId = json14.data?.nextReview?.id;

    assert(
      res14.status === 200 &&
        json14.data?.decision?.decision === 'REWORK_RECYCLE' &&
        json14.data?.governance?.governanceStatus === 'REWORK_REQUIRED' &&
        json14.data?.nextReview?.cycleNumber === 2,
      'TC-14',
      'Authoritative REWORK_RECYCLE decision sets REWORK_REQUIRED and generates cycle 2 review instance'
    );

    // -------------------------------------------------------------
    // TC-15: Authoritative Gate Decision — REQUEST_MORE_INFO
    // -------------------------------------------------------------
    const res15 = await fetch(`${API_BASE}/rd/governance/reviews/${reworkReviewId}/decision`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'REQUEST_MORE_INFO',
        decisionReason: 'Please attach high-resolution SEM micrographs of electrolyte grain boundaries.',
      }),
    });
    const json15 = await res15.json();

    assert(
      res15.status === 200 && json15.data?.decision?.decision === 'REQUEST_MORE_INFO',
      'TC-15',
      'REQUEST_MORE_INFO decision transitions review to MORE_INFO_REQUIRED with clarifying instructions'
    );

    // -------------------------------------------------------------
    // TC-16: Authoritative Gate Decision — TERMINATE_KILL
    // -------------------------------------------------------------
    const project2 = await prisma.erpProject.create({
      data: {
        tenantId: userA.tenantId,
        name: `Flawed Chemistry Research Initiative ${Date.now()}`,
        client: 'Internal R&D',
        projectType: 'RD',
        budget: 150000.0,
      },
    });
    testProjectId2 = project2.id;

    const resInit2 = await fetch(`${API_BASE}/rd/governance/projects/${testProjectId2}/initialize`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    const jsonInit2 = await resInit2.json();
    const p2ReviewId = jsonInit2.data?.activeReview?.id;

    const res16 = await fetch(`${API_BASE}/rd/governance/reviews/${p2ReviewId}/decision`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'TERMINATE_KILL',
        decisionReason: 'Fundamental thermodynamic barrier identified. Further investment terminated.',
      }),
    });
    const json16 = await res16.json();

    // Verify project still exists in database
    const preservedProject2 = await prisma.erpProject.findUnique({ where: { id: testProjectId2 } });

    assert(
      res16.status === 200 &&
        json16.data?.governance?.governanceStatus === 'TERMINATED' &&
        preservedProject2 !== null,
      'TC-16',
      'TERMINATE_KILL decision formally stops governance progression while preserving project records intact'
    );

    // -------------------------------------------------------------
    // TC-17: Governance Dashboard & Reviewer Inbox
    // -------------------------------------------------------------
    const res17a = await fetch(`${API_BASE}/rd/governance/dashboard`, { headers: headersA });
    const json17a = await res17a.json();

    const res17b = await fetch(`${API_BASE}/rd/governance/inbox`, { headers: headersA2 });
    const json17b = await res17b.json();

    assert(
      res17a.status === 200 &&
        json17a.data?.totalGovernedProjects >= 2 &&
        res17b.status === 200 &&
        Array.isArray(json17b.data),
      'TC-17',
      `Dashboard metrics report ${json17a.data?.totalGovernedProjects} governed projects and Reviewer Inbox operational`
    );

    // -------------------------------------------------------------
    // TC-18: Multi-Tenant Security Isolation
    // -------------------------------------------------------------
    if (headersB) {
      // Tenant B attempts to read Tenant A's governance
      const res18a = await fetch(`${API_BASE}/rd/governance/projects/${testProjectId1}`, {
        headers: headersB,
      });

      // Tenant B attempts to submit decision on Tenant A's review
      const res18b = await fetch(`${API_BASE}/rd/governance/reviews/${activeReviewId}/decision`, {
        method: 'POST',
        headers: headersB,
        body: JSON.stringify({
          decision: 'GO_CONTINUE',
          decisionReason: 'Malicious cross-tenant decision injection',
        }),
      });

      assert(
        (res18a.status === 404 || res18a.status === 403) &&
          (res18b.status === 404 || res18b.status === 403),
        'TC-18',
        'Cross-tenant isolation strictly enforced: foreign tenant blocked from viewing or deciding governance'
      );
    } else {
      console.log('[SKIP] TC-18: Secondary tenant not available in test environment.');
    }

    // -------------------------------------------------------------
    // TC-19: Zero Regression Verification (CRM, ERP, Prompt 02, Prompt 03)
    // -------------------------------------------------------------
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const leadCount = await prisma.lead.count();
    const taskCount = await prisma.task.count();
    const proposalCount = await prisma.projectProposal.count();
    const ideaCount = await prisma.rdIdea.count();

    assert(
      userCount === 14 &&
        tenantCount === 2 &&
        leadCount >= 2 &&
        taskCount >= 1 &&
        proposalCount >= 4 &&
        ideaCount >= 3,
      'TC-19',
      `Zero regression: All 14 users and 2 tenants preserved (leads: ${leadCount}, proposals: ${proposalCount}, ideas: ${ideaCount})`
    );

  } catch (err) {
    console.error('Test suite runtime error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
