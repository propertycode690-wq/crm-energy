const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 03 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('IDEA MANAGEMENT & INNOVATION SCORING ENGINE');
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

  const headersB = tokenB ? {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  } : null;

  let createdCategoryId = null;
  let createdRubricId = null;
  let createdIdeaId1 = null;
  let createdIdeaId2 = null;
  let createdIdeaId3 = null;

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
    // TC-02: Module Registry (mod-03-ideation is ACTIVE)
    // -------------------------------------------------------------
    const res02 = await fetch(`${API_BASE}/rd/modules`, { headers: headersA });
    const json02 = await res02.json();
    const mod03 = json02.data?.find((m) => m.id === 'mod-03-ideation');
    assert(
      res02.status === 200 && mod03 && mod03.status === 'ACTIVE',
      'TC-02',
      'GET /api/rd/modules confirms mod-03-ideation is registered as ACTIVE'
    );

    // -------------------------------------------------------------
    // TC-03: Category Management (Creation and Listing)
    // -------------------------------------------------------------
    const catName = `Nanotech & Composites ${Date.now()}`;
    const res03a = await fetch(`${API_BASE}/rd/ideas/categories`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: catName,
        description: 'Advanced graphene and nanomaterial research',
        color: '#8b5cf6',
      }),
    });
    const json03a = await res03a.json();
    createdCategoryId = json03a.data?.id;

    const res03b = await fetch(`${API_BASE}/rd/ideas/categories`, { headers: headersA });
    const json03b = await res03b.json();
    const hasCat = json03b.data?.some((c) => c.id === createdCategoryId);

    assert(
      res03a.status === 201 && createdCategoryId && hasCat,
      'TC-03',
      'POST /api/rd/ideas/categories creates category and GET lists it'
    );

    // -------------------------------------------------------------
    // TC-04: Rubric Configuration and Weight Validation
    // -------------------------------------------------------------
    // First, test invalid weights (sum != 1.0)
    const res04_invalid = await fetch(`${API_BASE}/rd/ideas/rubrics`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Invalid Rubric',
        scale: '1_TO_5',
        criteria: [
          { name: 'Feasibility', weight: 0.30, direction: 'HIGHER_IS_BETTER' },
          { name: 'Market Impact', weight: 0.40, direction: 'HIGHER_IS_BETTER' },
        ],
      }),
    });
    const json04_inv = await res04_invalid.json();
    const rejectedInvalidWeight = res04_invalid.status === 400 && json04_inv.message?.includes('1.0');

    // Now test valid rubric (weights: Feasibility 0.35, Market Impact 0.40, Technical Risk 0.25 -> sum 1.0)
    const res04_valid = await fetch(`${API_BASE}/rd/ideas/rubrics`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: `R&D Innovation Standard Rubric ${Date.now()}`,
        scale: '1_TO_5',
        isDefault: true,
        criteria: [
          { name: 'Technical Feasibility', weight: 0.35, direction: 'HIGHER_IS_BETTER', sortOrder: 1 },
          { name: 'Market Impact Potential', weight: 0.40, direction: 'HIGHER_IS_BETTER', sortOrder: 2 },
          { name: 'Technical & Execution Risk', weight: 0.25, direction: 'LOWER_IS_BETTER', sortOrder: 3 },
        ],
      }),
    });
    const json04_val = await res04_valid.json();
    createdRubricId = json04_val.data?.id;

    assert(
      rejectedInvalidWeight && res04_valid.status === 201 && createdRubricId,
      'TC-04',
      'Rubric validates criteria weight sum = 1.0 strictly and creates active rubric'
    );

    // -------------------------------------------------------------
    // TC-05: Idea Capture (Create Draft Idea)
    // -------------------------------------------------------------
    const res05 = await fetch(`${API_BASE}/rd/ideas`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'High-Temperature Solid State Electrolyte',
        summary: 'Novel ceramic electrolyte capable of operating at 80°C without dendrite formation',
        problemStatement: 'Current lithium-ion cells suffer degradation and thermal runaway at high discharge rates.',
        proposedSolution: 'Employ thin-film ceramic garnet electrolyte with atomic-layer-deposited interfacial buffer.',
        expectedImpact: '40% increase in energy density and eliminates fire hazard.',
        categoryId: createdCategoryId,
        tags: ['SolidState', 'EnergyStorage', 'BatteryTech'],
        contributorName: 'Dr. Jane Vance',
        contributorEmail: 'jane.vance@rd-research.org',
        targetHorizon: 'H2_MEDIUM_TERM',
      }),
    });
    const json05 = await res05.json();
    createdIdeaId1 = json05.data?.id;

    assert(
      res05.status === 201 &&
      createdIdeaId1 &&
      json05.data.status === 'DRAFT' &&
      (json05.data.referenceNumber || json05.data.code)?.startsWith('IDEA-'),
      'TC-05',
      `POST /api/rd/ideas creates idea in DRAFT state with generated code (${json05.data?.referenceNumber || json05.data?.code})`
    );

    // -------------------------------------------------------------
    // TC-06: Idea Submission to SUBMITTED
    // -------------------------------------------------------------
    const res06 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/submit`, {
      method: 'POST',
      headers: headersA,
    });
    const json06 = await res06.json();

    assert(
      res06.status === 200 && json06.data?.status === 'SUBMITTED',
      'TC-06',
      'POST /api/rd/ideas/:id/submit transitions idea state from DRAFT to SUBMITTED'
    );

    // -------------------------------------------------------------
    // TC-07: Community Upvoting
    // -------------------------------------------------------------
    const res07 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/vote`, {
      method: 'POST',
      headers: headersA,
    });
    const json07 = await res07.json();

    assert(
      res07.status === 200 && json07.data?.voteCount === 1 && json07.data?.hasVoted === true,
      'TC-07',
      'POST /api/rd/ideas/:id/vote successfully records upvote and increments voteCount to 1'
    );

    // -------------------------------------------------------------
    // TC-08: Strict Duplicate Vote Prevention (1 vote per user per idea)
    // -------------------------------------------------------------
    const res08 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/vote`, {
      method: 'POST',
      headers: headersA,
    });
    const json08 = await res08.json();

    assert(
      res08.status === 400 && json08.message?.includes('already upvoted'),
      'TC-08',
      'POST /api/rd/ideas/:id/vote prevents duplicate vote from the same user'
    );

    // -------------------------------------------------------------
    // TC-09: Vote Removal (Toggle Off and Re-Vote)
    // -------------------------------------------------------------
    const res09a = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/vote`, {
      method: 'DELETE',
      headers: headersA,
    });
    const json09a = await res09a.json();

    // Re-vote to leave 1 vote
    await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/vote`, {
      method: 'POST',
      headers: headersA,
    });

    assert(
      res09a.status === 200 && json09a.data?.voteCount === 0 && json09a.data?.hasVoted === false,
      'TC-09',
      'DELETE /api/rd/ideas/:id/vote removes upvote cleanly and updates voteCount'
    );

    // -------------------------------------------------------------
    // TC-10: Threaded / Contributor Comments
    // -------------------------------------------------------------
    const res10a = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/comments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        content: 'Have you verified conductivity across 100+ thermal cycles in dry-room conditions?',
      }),
    });
    const json10a = await res10a.json();

    const res10b = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}`, {
      headers: headersA,
    });
    const json10b = await res10b.json();
    const commentFound = json10b.data?.comments?.some((c) => c.id === json10a.data?.id);

    assert(
      res10a.status === 201 && commentFound,
      'TC-10',
      'POST /api/rd/ideas/:id/comments records comment and persists under idea discussion'
    );

    // -------------------------------------------------------------
    // TC-11: Reviewer Assignment
    // -------------------------------------------------------------
    const res11 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/reviewers`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        userId: userA2.id,
        role: 'TECHNICAL_EVALUATOR',
      }),
    });
    const json11 = await res11.json();

    assert(
      res11.status === 200 && (json11.data?.userId === userA2.id || json11.data?.reviewerId === userA2.id),
      'TC-11',
      'POST /api/rd/ideas/:id/reviewers assigns reviewer to idea'
    );

    // -------------------------------------------------------------
    // TC-12: Directional Scoring by Evaluator 1
    // Criteria:
    // 1. Feasibility (weight 0.35, HIGHER_IS_BETTER): raw = 4 / 5 -> norm = (4-1)/4 * 100 = 75
    // 2. Market Impact (weight 0.40, HIGHER_IS_BETTER): raw = 5 / 5 -> norm = (5-1)/4 * 100 = 100
    // 3. Technical Risk (weight 0.25, LOWER_IS_BETTER): raw = 2 / 5 -> norm = 100 - (2-1)/4 * 100 = 75
    // Evaluator 1 Weighted Score: (75 * 0.35) + (100 * 0.40) + (75 * 0.25) = 26.25 + 40 + 18.75 = 85.00
    // -------------------------------------------------------------
    const rubricCriteria = json04_val.data.criteria;
    const cFeas = rubricCriteria.find((c) => c.name.includes('Feasibility'));
    const cMkt = rubricCriteria.find((c) => c.name.includes('Market'));
    const cRisk = rubricCriteria.find((c) => c.name.includes('Risk'));

    const evalPayload1 = {
      rubricId: createdRubricId,
      scores: [
        { criterionId: cFeas.id, rawScore: 4, comment: 'High feasibility with existing lab tooling' },
        { criterionId: cMkt.id, rawScore: 5, comment: 'Huge automotive OEM demand' },
        { criterionId: cRisk.id, rawScore: 2, comment: 'Moderate-low interfacial resistance risk' },
      ],
      recommendation: 'STRONG_PROCEED',
      generalFeedback: 'Outstanding potential. Meets all safety specs.',
    };

    const res12 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/evaluation`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(evalPayload1),
    });
    const json12 = await res12.json();
    const eval1Weighted = parseFloat(json12.data?.evaluation?.weightedScore || 0);

    assert(
      res12.status === 200 && Math.abs(eval1Weighted - 85.00) < 0.05,
      'TC-12',
      `Directional scoring verified for Evaluator 1: raw risk 2/5 inverted to 75.0, total weighted = ${eval1Weighted} (expected 85.00)`
    );

    // -------------------------------------------------------------
    // TC-13: Multi-Evaluator Composite Score Aggregation
    // Evaluator 2 Scores:
    // Feasibility: 3/5 -> norm = 50.0
    // Market Impact: 4/5 -> norm = 75.0
    // Technical Risk: 1/5 (lowest risk) -> norm = 100 - (1-1)/4 * 100 = 100.0
    // Evaluator 2 Weighted Score: (50 * 0.35) + (75 * 0.40) + (100 * 0.25) = 17.5 + 30.0 + 25.0 = 72.50
    // Expected Composite Score: Mean of (85.00 + 72.50) / 2 = 78.75
    // -------------------------------------------------------------
    const evalPayload2 = {
      rubricId: createdRubricId,
      scores: [
        { criterionId: cFeas.id, rawScore: 3, comment: 'Needs new sintering furnace' },
        { criterionId: cMkt.id, rawScore: 4, comment: 'Solid market traction' },
        { criterionId: cRisk.id, rawScore: 1, comment: 'Extremely well-understood chemistries' },
      ],
      recommendation: 'PROCEED_WITH_CONDITIONS',
      generalFeedback: 'Agree with direction, need thermal test validation.',
    };

    const res13 = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/evaluation`, {
      method: 'POST',
      headers: headersA2,
      body: JSON.stringify(evalPayload2),
    });
    const json13 = await res13.json();
    const compositeScore = parseFloat(json13.data?.compositeScore || 0);

    assert(
      res13.status === 200 &&
      Math.abs(compositeScore - 78.75) < 0.05 &&
      json13.data?.totalEvaluations === 2,
      'TC-13',
      `Multi-evaluator composite score aggregation: mean of (85.00, 72.50) = ${compositeScore} (expected 78.75)`
    );

    // -------------------------------------------------------------
    // TC-14: Ranked Leaderboard & Unevaluated Flag Verification
    // -------------------------------------------------------------
    // Create Idea 2: High scoring idea
    const resIdea2 = await fetch(`${API_BASE}/rd/ideas`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Quantum Dot Photovoltaic Layer',
        summary: 'Direct infrared absorption solar cell overlay',
        problemStatement: 'Solar cells cannot convert infrared spectrum efficiently.',
        proposedSolution: 'Colloidal lead sulfide quantum dot layer.',
        expectedImpact: 'Double tandem cell efficiency to 38%.',
        categoryId: createdCategoryId,
        tags: ['Solar', 'QuantumDots', 'Photovoltaics'],
        contributorName: 'Dr. Michael Chen',
        contributorEmail: 'm.chen@rd-research.org',
      }),
    });
    const jsonIdea2 = await resIdea2.json();
    createdIdeaId2 = jsonIdea2.data.id;
    await fetch(`${API_BASE}/rd/ideas/${createdIdeaId2}/submit`, { method: 'POST', headers: headersA });

    // Score Idea 2: 5/5 on Feasibility (100), 5/5 on Market (100), 1/5 on Risk (100) -> 100.00
    await fetch(`${API_BASE}/rd/ideas/${createdIdeaId2}/evaluation`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        rubricId: createdRubricId,
        scores: [
          { criterionId: cFeas.id, rawScore: 5 },
          { criterionId: cMkt.id, rawScore: 5 },
          { criterionId: cRisk.id, rawScore: 1 },
        ],
        recommendation: 'STRONG_PROCEED',
      }),
    });

    // Create Idea 3: Unevaluated idea
    const resIdea3 = await fetch(`${API_BASE}/rd/ideas`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Untested Bio-Polymer Hydrogel',
        summary: 'Biodegradable sealant for subsea casing',
        problemStatement: 'Subsea joints degrade in salt water.',
        proposedSolution: 'Alginate matrix cross-linked with calcium ions.',
        expectedImpact: 'Extends marine equipment lifespan by 3 years.',
        categoryId: createdCategoryId,
        tags: ['Marine', 'Polymer'],
        contributorName: 'Sarah Jenkins',
      }),
    });
    const jsonIdea3 = await resIdea3.json();
    createdIdeaId3 = jsonIdea3.data.id;

    const resLeaderboard = await fetch(`${API_BASE}/rd/ideas/leaderboard`, { headers: headersA });
    const jsonLeaderboard = await resLeaderboard.json();
    const rankedList = jsonLeaderboard.data?.leaderboard || [];

    const idea2Rank = rankedList.findIndex((item) => item.id === createdIdeaId2);
    const idea1Rank = rankedList.findIndex((item) => item.id === createdIdeaId1);
    const idea3Entry = rankedList.find((item) => item.id === createdIdeaId3);

    assert(
      idea2Rank !== -1 &&
      idea1Rank !== -1 &&
      idea2Rank < idea1Rank &&
      idea3Entry &&
      idea3Entry.isEvaluated === false &&
      idea3Entry.compositeScore === null,
      'TC-14',
      'Leaderboard correctly ranks highest score first (Idea 2 > Idea 1) and flags unevaluated idea as isEvaluated: false with null score'
    );

    // -------------------------------------------------------------
    // TC-15: Idea Lifecycle Status Transitions
    // DRAFT -> SUBMITTED -> UNDER_REVIEW -> MORE_INFO_REQUIRED -> ACCEPTED_FOR_INCUBATION
    // -------------------------------------------------------------
    const res15a = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/status`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        notes: 'Assigned to technical reviewers for detailed scoring.',
      }),
    });
    const json15a = await res15a.json();

    const res15b = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/status`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        status: 'MORE_INFO_REQUIRED',
        notes: 'Please submit XRD diffraction patterns for the electrolyte interface.',
      }),
    });
    const json15b = await res15b.json();

    const res15c = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/status`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        status: 'ACCEPTED_FOR_INCUBATION',
        notes: 'Clarification received and accepted. Approved for Master Prompt 02 Project Intake transition.',
      }),
    });
    const json15c = await res15c.json();

    assert(
      json15a.data?.status === 'UNDER_REVIEW' &&
      json15b.data?.status === 'MORE_INFO_REQUIRED' &&
      json15c.data?.status === 'ACCEPTED_FOR_INCUBATION',
      'TC-15',
      'Lifecycle state transitions verified: UNDER_REVIEW -> MORE_INFO_REQUIRED -> ACCEPTED_FOR_INCUBATION'
    );

    // -------------------------------------------------------------
    // TC-16: Innovation Pipeline Funnel
    // -------------------------------------------------------------
    const res16 = await fetch(`${API_BASE}/rd/ideas/pipeline`, { headers: headersA });
    const json16 = await res16.json();
    const stageBreakdown = json16.data?.stageBreakdown || [];
    const acceptedStage = stageBreakdown.find((s) => s.status === 'ACCEPTED_FOR_INCUBATION');

    assert(
      res16.status === 200 &&
      json16.data?.totalIdeas >= 3 &&
      acceptedStage &&
      acceptedStage.count >= 1,
      'TC-16',
      `Innovation Pipeline funnel verified: ${json16.data?.totalIdeas} total ideas with stage breakdown and percentage metrics`
    );

    // -------------------------------------------------------------
    // TC-17: Multi-Tenant Data Isolation
    // -------------------------------------------------------------
    if (headersB) {
      // Attempt to access Tenant A's idea using Tenant B's credentials
      const res17a = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}`, {
        headers: headersB,
      });
      // Attempt to vote on Tenant A's idea using Tenant B's credentials
      const res17b = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/vote`, {
        method: 'POST',
        headers: headersB,
      });
      // Attempt to submit evaluation using Tenant B's credentials
      const res17c = await fetch(`${API_BASE}/rd/ideas/${createdIdeaId1}/evaluation`, {
        method: 'POST',
        headers: headersB,
        body: JSON.stringify(evalPayload1),
      });

      assert(
        res17a.status === 404 && (res17b.status === 404 || res17b.status === 403) && (res17c.status === 404 || res17c.status === 403),
        'TC-17',
        'Cross-tenant isolation strictly enforced: Tenant B blocked from reading, voting on, or evaluating Tenant A ideas'
      );
    } else {
      console.log('[SKIP] TC-17: Only 1 tenant found in test environment.');
    }

    // -------------------------------------------------------------
    // TC-18: CRM & ERP Zero-Regression Verification
    // -------------------------------------------------------------
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const leadCount = await prisma.lead.count();
    const taskCount = await prisma.task.count();
    const proposalCount = await prisma.projectProposal.count();

    assert(
      userCount === 14 && tenantCount === 2 && leadCount >= 0 && proposalCount >= 0,
      'TC-18',
      `Zero regression: All 14 users and 2 tenants preserved intact (leads: ${leadCount}, tasks: ${taskCount}, proposals: ${proposalCount})`
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
