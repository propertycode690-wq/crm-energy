const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runMaster09TestSuite() {
  console.log('======================================================================');
  console.log('EGOLYTICS MASTER PROMPT 09 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('DECISION, RISK, ISSUE & FINANCIAL MANAGEMENT');
  console.log('Requirements: Req 31–40 (Decisions, Risks, Issues, Changes, Reqs, WBS, Deliverables, Quality, Budgets)');
  console.log('Acceptance Criteria: AC-01 through AC-46');
  console.log('======================================================================\n');

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

  try {
    // 1. Fetch Tenant A user
    const userA = await prisma.user.findFirst({
      where: { tenantId: 'TENANT-08492' },
    });
    if (!userA) throw new Error('Tenant A user not found.');

    const tokenA = generateToken({
      userId: userA.id,
      tenantId: userA.tenantId,
      role: userA.role,
      email: userA.email,
    });

    const tokenB = generateToken({
      userId: 'foreign-user-001',
      tenantId: 'cmunoyqx50000tovon49iw6gx',
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

    // Find Project in Tenant A
    const projectA = await prisma.erpProject.findFirst({
      where: { tenantId: 'TENANT-08492' },
    });
    if (!projectA) throw new Error('Project not found in Tenant A.');

    console.log(`[Context] Tenant A: ${userA.tenantId}, User: ${userA.email}, Project: ${projectA.name}\n`);

    // Ensure idempotent test environment
    await prisma.rdBudgetRevision.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdBudgetAllocation.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdProjectBudget.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdQualityCriterion.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdQualityCheckpoint.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdDeliverable.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdScopeItem.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdScopeBaseline.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdRequirementCriterion.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdRequirement.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdChangeRequest.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdIssueComment.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdIssue.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdRiskReviewHistory.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdRiskMitigation.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdRisk.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdDecisionHistory.deleteMany({ where: { tenantId: userA.tenantId } });
    await prisma.rdDecision.deleteMany({ where: { tenantId: userA.tenantId } });

    // ==========================================================================
    // REQ 31: DECISION LOGS (AC-01 - AC-05)
    // ==========================================================================
    console.log('--- SECTION 1: DECISION LOGS (Req 31) ---');

    // AC-01: Create architectural decision proposal
    const createDecRes = await fetch(`${API_BASE}/rd/governance-ops/decisions`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Adopt Event-Driven Telemetry Architecture',
        category: 'ARCHITECTURE',
        rationale: 'Decouple sensor data ingestion pipeline from synchronous relational persistence.',
        alternativesConsidered: 'Direct polling of MySQL; Redis queue without pub/sub.',
        tradeOffs: 'Higher initial complexity for 10x throughput and zero UI lockup.',
        impactSummary: 'Reduces latency by 65% across real-time experiment monitors.',
      }),
    });
    const decData = await createDecRes.json();
    assert(
      createDecRes.status === 201 && decData.success && decData.data?.decisionCode?.startsWith('DEC-'),
      'AC-01',
      `Decision created with auto-code ${decData.data?.decisionCode}`
    );

    const decisionId = decData.data.id;

    // AC-02: Unique code and initial history
    const getDecRes = await fetch(`${API_BASE}/rd/governance-ops/decisions/${decisionId}`, {
      headers: headersA,
    });
    const getDecData = await getDecRes.json();
    assert(
      getDecData.success && getDecData.data.histories?.length >= 1,
      'AC-02',
      `Decision has initial audit history record (${getDecData.data.histories?.[0]?.changeType})`
    );

    // AC-03: Update decision content and verify history
    const updateDecRes = await fetch(`${API_BASE}/rd/governance-ops/decisions/${decisionId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        impactSummary: 'Reduces latency by 72% across all connected instruments.',
        comment: 'Updated benchmark figures from prototype run.',
      }),
    });
    const updateDecData = await updateDecRes.json();
    assert(
      updateDecData.success && updateDecData.data.histories?.length >= 2,
      'AC-03',
      'Decision content updated with audit history trail appended'
    );

    // AC-04: Status transition PROPOSED -> APPROVED
    const approveDecRes = await fetch(`${API_BASE}/rd/governance-ops/decisions/${decisionId}/status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        status: 'APPROVED',
        comment: 'Architecture Board approved after review of benchmarks.',
      }),
    });
    const approveDecData = await approveDecRes.json();
    assert(
      approveDecData.success && approveDecData.data.status === 'APPROVED' && approveDecData.data.decisionDate !== null,
      'AC-04',
      'Decision approved with decisionDate recorded and status updated'
    );

    // AC-05: List decisions with filters
    const listDecRes = await fetch(`${API_BASE}/rd/governance-ops/decisions?projectId=${projectA.id}&category=ARCHITECTURE`, {
      headers: headersA,
    });
    const listDecData = await listDecRes.json();
    assert(
      listDecData.success && Array.isArray(listDecData.data) && listDecData.data.some(d => d.id === decisionId),
      'AC-05',
      `Decision listed and filtered by category ARCHITECTURE (Count: ${listDecData.data.length})`
    );

    // ==========================================================================
    // REQ 32 & 33: RISK REGISTERS, SCORING & 5X5 MATRIX (AC-06 - AC-12)
    // ==========================================================================
    console.log('\n--- SECTION 2: RISK REGISTERS, SCORING & 5X5 MATRIX (Req 32 & 33) ---');

    // AC-06: Create risk with probability and impact
    const createRiskRes = await fetch(`${API_BASE}/rd/governance-ops/risks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Thermal Runaway during Battery High-Discharge Test',
        category: 'TECHNICAL',
        probability: 4,
        impact: 5,
        strategy: 'MITIGATE',
        contingencyPlan: 'Activate automated N2 fire suppression and isolate cell chamber.',
        triggerCondition: 'Cell casing temperature exceeds 65°C.',
      }),
    });
    const riskData = await createRiskRes.json();
    assert(
      createRiskRes.status === 201 && riskData.success && riskData.data.riskCode?.startsWith('RSK-'),
      'AC-06',
      `Risk registered with auto-code ${riskData.data?.riskCode}`
    );

    const riskId = riskData.data.id;

    // AC-07 & AC-08: Risk scoring formula P * I and level mapping
    assert(
      riskData.data.riskScore === 20 && riskData.data.riskLevel === 'CRITICAL',
      'AC-07',
      `Risk score calculated: 4 * 5 = ${riskData.data.riskScore}`
    );
    assert(
      riskData.data.riskLevel === 'CRITICAL',
      'AC-08',
      'Risk level correctly classified as CRITICAL (score >= 17)'
    );

    // Test other boundary risk levels
    const createLowRiskRes = await fetch(`${API_BASE}/rd/governance-ops/risks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Minor Specimen Label Smudge Risk',
        probability: 2,
        impact: 2,
        strategy: 'ACCEPT',
      }),
    });
    const lowRiskData = await createLowRiskRes.json();
    assert(
      lowRiskData.data.riskScore === 4 && lowRiskData.data.riskLevel === 'LOW',
      'AC-08b',
      `Low risk boundary verified: 2 * 2 = 4 (LOW)`
    );

    // AC-09: Add risk mitigation action
    const addMitRes = await fetch(`${API_BASE}/rd/governance-ops/risks/${riskId}/mitigations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        actionTitle: 'Install Secondary Infrared Thermocouple Cut-off',
        actionDescription: 'Hardware-level interlock cutting current if temp > 60°C.',
        ownerName: 'Dr. John Safety',
        status: 'IN_PROGRESS',
        progressPercent: 50,
        effectiveness: 'HIGH',
      }),
    });
    const mitData = await addMitRes.json();
    assert(
      addMitRes.status === 201 && mitData.success && mitData.data.id,
      'AC-09',
      `Mitigation action added: ${mitData.data.actionTitle}`
    );

    // AC-10: Review risk and score reassessment
    const reviewRiskRes = await fetch(`${API_BASE}/rd/governance-ops/risks/${riskId}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        newProbability: 2,
        newImpact: 4,
        residualProbability: 2,
        residualImpact: 3,
        reviewNotes: 'Mitigation cut-off tested successfully; probability reduced to 2.',
      }),
    });
    const reviewRiskData = await reviewRiskRes.json();
    assert(
      reviewRiskData.success && reviewRiskData.data.riskScore === 8 && reviewRiskData.data.riskLevel === 'MODERATE' && reviewRiskData.data.residualScore === 6,
      'AC-10',
      `Risk reassessed: new score 2*4=8 (MODERATE), residual score 6, review history logged`
    );

    // AC-11 & AC-12: 5x5 Risk Matrix distribution
    const matrixRes = await fetch(`${API_BASE}/rd/governance-ops/risks/matrix?projectId=${projectA.id}`, {
      headers: headersA,
    });
    const matrixData = await matrixRes.json();
    assert(
      matrixData.success && matrixData.data.grid && Object.keys(matrixData.data.grid).length === 25,
      'AC-11',
      `5x5 Risk Matrix generated with exactly 25 grid cells`
    );
    assert(
      matrixData.data.summary?.total >= 2 && matrixData.data.summary?.moderate >= 1,
      'AC-12',
      `Matrix summary accurate: Total=${matrixData.data.summary?.total}, Moderate=${matrixData.data.summary?.moderate}`
    );

    // ==========================================================================
    // REQ 34: ISSUE TRACKING & RESOLUTION (AC-13 - AC-17)
    // ==========================================================================
    console.log('\n--- SECTION 3: ISSUE TRACKING & RESOLUTION (Req 34) ---');

    // AC-13: Create issue
    const createIssueRes = await fetch(`${API_BASE}/rd/governance-ops/issues`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Spectrometer Calibration Drift at High Temperatures',
        category: 'TECHNICAL',
        priority: 'HIGH',
        severity: 'MAJOR',
        rootCause: 'Optical bench thermal expansion under continuous run cycles.',
        sourceRiskId: riskId,
      }),
    });
    const issueData = await createIssueRes.json();
    assert(
      createIssueRes.status === 201 && issueData.success && issueData.data.issueCode?.startsWith('ISS-'),
      'AC-13',
      `Issue logged with code ${issueData.data.issueCode}`
    );

    const issueId = issueData.data.id;

    // AC-14: Add comments
    const commentRes = await fetch(`${API_BASE}/rd/governance-ops/issues/${issueId}/comments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        commentText: 'Bench recalibrated with invar spacer. Testing thermal stability.',
        isInternalOnly: true,
      }),
    });
    const commentData = await commentRes.json();
    assert(
      commentRes.status === 201 && commentData.success && commentData.data.commentText,
      'AC-14',
      'Issue comment added with internal visibility flag'
    );

    // AC-15: Resolve issue
    const resolveIssueRes = await fetch(`${API_BASE}/rd/governance-ops/issues/${issueId}/status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        status: 'RESOLVED',
        resolution: 'Installed thermally compensated optics assembly. Drift reduced to <0.01nm.',
      }),
    });
    const resolveData = await resolveIssueRes.json();
    assert(
      resolveData.success && resolveData.data.status === 'RESOLVED' && resolveData.data.resolvedAt !== null,
      'AC-15',
      'Issue resolved with resolution text and resolvedAt timestamp'
    );

    // AC-16: Close issue
    const closeIssueRes = await fetch(`${API_BASE}/rd/governance-ops/issues/${issueId}/status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    const closeData = await closeIssueRes.json();
    assert(
      closeData.success && closeData.data.status === 'CLOSED' && closeData.data.closedAt !== null,
      'AC-16',
      'Issue closed with closedAt timestamp'
    );

    // AC-17: List issues
    const listIssueRes = await fetch(`${API_BASE}/rd/governance-ops/issues?projectId=${projectA.id}`, {
      headers: headersA,
    });
    const listIssueData = await listIssueRes.json();
    assert(
      listIssueData.success && listIssueData.data.some(i => i.id === issueId),
      'AC-17',
      `Issue list verified for project (Total: ${listIssueData.data.length})`
    );

    // ==========================================================================
    // REQ 35: CHANGE MANAGEMENT & IMPACT ASSESSMENT (AC-18 - AC-22)
    // ==========================================================================
    console.log('\n--- SECTION 4: CHANGE MANAGEMENT (Req 35) ---');

    // AC-18 & AC-19: Create change request with multi-dimensional impact
    const createCrRes = await fetch(`${API_BASE}/rd/governance-ops/change-requests`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Incorporate Automated Gas Chromatography Ingestion',
        reasonForChange: 'Manual data entry is introducing sample labeling variance.',
        changeType: 'SCOPE',
        scopeImpact: 'Adds automated instrument parser and validation pipeline.',
        scheduleImpactDays: 7,
        costImpactAmount: 4500.00,
        riskImpact: 'Minimal risk; improves data fidelity.',
        priority: 'MEDIUM',
      }),
    });
    const crData = await createCrRes.json();
    assert(
      createCrRes.status === 201 && crData.success && crData.data.changeCode?.startsWith('CR-'),
      'AC-18',
      `Change request submitted with code ${crData.data?.changeCode}`
    );
    assert(
      crData.data.scheduleImpactDays === 7 && Number(crData.data.costImpactAmount) === 4500,
      'AC-19',
      'Change request impacts recorded: 7 days, $4,500.00'
    );

    const crId = crData.data.id;

    // AC-20: Review change request (Approve)
    const reviewCrRes = await fetch(`${API_BASE}/rd/governance-ops/change-requests/${crId}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'APPROVED',
        comments: 'Change justified by quality gains. Budget reallocation approved.',
      }),
    });
    const reviewCrData = await reviewCrRes.json();
    assert(
      reviewCrData.success && reviewCrData.data.status === 'APPROVED' && reviewCrData.data.reviewedAt !== null,
      'AC-20',
      'Change request approved with reviewer details and reviewedAt timestamp'
    );

    // AC-21: Rejection workflow test
    const createRejCr = await fetch(`${API_BASE}/rd/governance-ops/change-requests`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Upgrade Lab Furniture to Ergonomic Standing Desks',
        reasonForChange: 'Ergonomic improvement.',
        changeType: 'RESOURCE',
        costImpactAmount: 12000,
      }),
    });
    const rejCrData = await createRejCr.json();
    const rejRes = await fetch(`${API_BASE}/rd/governance-ops/change-requests/${rejCrData.data.id}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'REJECTED',
        comments: 'Non-critical expense deferred to next fiscal year.',
      }),
    });
    const rejData = await rejRes.json();
    assert(
      rejData.success && rejData.data.status === 'REJECTED',
      'AC-21',
      'Change request rejection workflow confirmed'
    );

    // AC-22: Implement change request
    const implCrRes = await fetch(`${API_BASE}/rd/governance-ops/change-requests/${crId}/implement`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        notes: 'GC instrument parser deployed and integrated with ELN.',
      }),
    });
    const implCrData = await implCrRes.json();
    assert(
      implCrData.success && implCrData.data.status === 'IMPLEMENTED' && implCrData.data.implementedAt !== null,
      'AC-22',
      'Change request marked IMPLEMENTED with implementation timestamp'
    );

    // ==========================================================================
    // REQ 36: REQUIREMENTS MANAGEMENT & TRACEABILITY (AC-23 - AC-27)
    // ==========================================================================
    console.log('\n--- SECTION 5: REQUIREMENTS MANAGEMENT & TRACEABILITY (Req 36) ---');

    // AC-23: Create requirement
    const createReqRes = await fetch(`${API_BASE}/rd/governance-ops/requirements`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Electrolyte Energy Density Threshold',
        category: 'PERFORMANCE',
        priority: 'MUST_HAVE',
        verificationMethod: 'TEST',
        description: 'Battery cell electrolyte must sustain energy density >= 450 Wh/kg.',
        criteria: [
          { criterionDescription: 'Specific energy measurement at 0.5C discharge >= 450 Wh/kg' },
          { criterionDescription: 'Cyclic retention >= 80% after 500 charge cycles' },
        ],
      }),
    });
    const reqData = await createReqRes.json();
    assert(
      createReqRes.status === 201 && reqData.success && reqData.data.reqCode?.startsWith('REQ-') && reqData.data.criteria?.length === 2,
      'AC-23',
      `Requirement created with code ${reqData.data?.reqCode} and 2 criteria`
    );

    const reqId = reqData.data.id;
    const criterion1 = reqData.data.criteria[0];
    const criterion2 = reqData.data.criteria[1];

    // AC-24: Add criterion
    const addCritRes = await fetch(`${API_BASE}/rd/governance-ops/requirements/${reqId}/criteria`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        criterionDescription: 'Operating temperature range between -20°C and 55°C without crystallization',
      }),
    });
    const addCritData = await addCritRes.json();
    assert(
      addCritRes.status === 201 && addCritData.success && addCritData.data.id,
      'AC-24',
      'Additional acceptance criterion attached to requirement'
    );
    const criterion3 = addCritData.data;

    // AC-25 & AC-26: Verify criteria and auto-compute requirement status
    await fetch(`${API_BASE}/rd/governance-ops/criteria/${criterion1.id}/verify`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ isMet: true, actualValue: '462 Wh/kg' }),
    });
    await fetch(`${API_BASE}/rd/governance-ops/criteria/${criterion2.id}/verify`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ isMet: true, actualValue: '84.2% retention' }),
    });
    const finalVerifyRes = await fetch(`${API_BASE}/rd/governance-ops/criteria/${criterion3.id}/verify`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ isMet: true, actualValue: 'Tested -22°C to +58°C clear' }),
    });
    assert(finalVerifyRes.status === 200, 'AC-25', 'All 3 acceptance criteria verified with empirical values');

    const checkReqRes = await fetch(`${API_BASE}/rd/governance-ops/requirements/${reqId}`, {
      headers: headersA,
    });
    const checkReqData = await checkReqRes.json();
    assert(
      checkReqData.data.verificationStatus === 'PASSED' && checkReqData.data.complianceStatus === 'COMPLIANT',
      'AC-26',
      'Requirement auto-rolled up to verificationStatus: PASSED and complianceStatus: COMPLIANT'
    );

    // AC-27: Traceability matrix
    const traceRes = await fetch(`${API_BASE}/rd/governance-ops/requirements/traceability?projectId=${projectA.id}`, {
      headers: headersA,
    });
    const traceData = await traceRes.json();
    const traceItem = traceData.data?.find(r => r.id === reqId);
    assert(
      traceData.success && traceItem && traceItem.completionPercent === 100 && traceItem.totalCriteria === 3,
      'AC-27',
      `Traceability matrix accurately computes 100% completion across 3 verified criteria`
    );

    // ==========================================================================
    // REQ 37: SCOPE BASELINES & WORK BREAKDOWN STRUCTURE (WBS) (AC-28 - AC-32)
    // ==========================================================================
    console.log('\n--- SECTION 6: SCOPE BASELINES & WBS (Req 37) ---');

    // AC-28: Create scope baseline
    const createBaseRes = await fetch(`${API_BASE}/rd/governance-ops/scope/baselines`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        baselineVersion: '1.0',
        title: 'FY2026 Core R&D Scope Baseline',
        inScopeSummary: 'Anode/cathode synthesis, pouch cell fabrication, and safety certification testing.',
        outOfScopeSummary: 'High-volume commercial pack assembly; retail consumer packaging.',
        assumptions: 'Raw lithium salt purity remains above 99.8%.',
        constraints: 'Facility power capacity capped at 250 kW.',
        status: 'APPROVED',
      }),
    });
    const baseData = await createBaseRes.json();
    assert(
      createBaseRes.status === 201 && baseData.success && baseData.data.baselineVersion === '1.0',
      'AC-28',
      `Scope baseline v1.0 established and approved`
    );

    // AC-29 & AC-30: Create hierarchical WBS items (Phase 1.0 -> Work Package 1.1 -> Sub-task 1.1.1)
    const createRootWbs = await fetch(`${API_BASE}/rd/governance-ops/scope/wbs`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        wbsCode: '1.0',
        title: 'Phase 1: Materials Synthesis & Characterization',
        itemType: 'PHASE',
        level: 1,
        completionPercent: 40,
      }),
    });
    const rootWbsData = await createRootWbs.json();

    const createChildWbs = await fetch(`${API_BASE}/rd/governance-ops/scope/wbs`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        parentItemId: rootWbsData.data.id,
        wbsCode: '1.1',
        title: 'Cathode Slurry Formulation',
        itemType: 'WORK_PACKAGE',
        level: 2,
        completionPercent: 70,
      }),
    });
    const childWbsData = await createChildWbs.json();

    assert(
      rootWbsData.success && childWbsData.success && childWbsData.data.parentItemId === rootWbsData.data.id,
      'AC-29',
      `Hierarchical WBS nodes created: Phase ${rootWbsData.data.wbsCode} -> Work Package ${childWbsData.data.wbsCode}`
    );

    const getWbsRes = await fetch(`${API_BASE}/rd/governance-ops/scope/wbs?projectId=${projectA.id}`, {
      headers: headersA,
    });
    const getWbsData = await getWbsRes.json();
    const rootNode = getWbsData.data?.tree?.find(n => n.id === rootWbsData.data.id);
    assert(
      getWbsData.success && rootNode && rootNode.children?.length >= 1,
      'AC-30',
      `WBS hierarchy tree returns nested children under root node (Children count: ${rootNode?.children?.length})`
    );

    // AC-31: Update WBS node progress
    const updateWbsRes = await fetch(`${API_BASE}/rd/governance-ops/scope/wbs/${childWbsData.data.id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ completionPercent: 100 }),
    });
    const updateWbsData = await updateWbsRes.json();
    assert(
      updateWbsData.success && updateWbsData.data.completionPercent === 100 && updateWbsData.data.status === 'COMPLETED',
      'AC-31',
      'WBS node 100% completion automatically transitioned status to COMPLETED'
    );

    // AC-32: Deletion safety check
    const deleteRootRes = await fetch(`${API_BASE}/rd/governance-ops/scope/wbs/${rootWbsData.data.id}`, {
      method: 'DELETE',
      headers: headersA,
    });
    const deleteRootData = await deleteRootRes.json();
    assert(
      deleteRootRes.status !== 200 || !deleteRootData.success,
      'AC-32',
      'Safety check enforced: Cannot delete WBS node with active child sub-items'
    );

    // ==========================================================================
    // REQ 38: DELIVERABLE TRACKING & ELN BINDING (AC-33 - AC-37)
    // ==========================================================================
    console.log('\n--- SECTION 7: DELIVERABLES TRACKING (Req 38) ---');

    // AC-33: Create deliverable
    const createDelRes = await fetch(`${API_BASE}/rd/governance-ops/deliverables`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Thermal Dissipation & Stress Benchmark Report',
        category: 'TECHNICAL_REPORT',
        dueDate: '2026-12-15',
        acceptanceCriteria: 'Comprehensive FEA modeling report with validation against physical thermocouple sensors.',
      }),
    });
    const delData = await createDelRes.json();
    assert(
      createDelRes.status === 201 && delData.success && delData.data.deliverableCode?.startsWith('DEL-'),
      'AC-33',
      `Deliverable registered with code ${delData.data?.deliverableCode}`
    );

    const deliverableId = delData.data.id;

    // AC-34: Submit deliverable
    const submitDelRes = await fetch(`${API_BASE}/rd/governance-ops/deliverables/${deliverableId}/submit`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({}),
    });
    const submitDelData = await submitDelRes.json();
    assert(
      submitDelData.success && submitDelData.data.status === 'SUBMITTED' && submitDelData.data.submissionDate !== null,
      'AC-34',
      'Deliverable submitted for review with submissionDate recorded'
    );

    // AC-35: Review and accept deliverable
    const acceptDelRes = await fetch(`${API_BASE}/rd/governance-ops/deliverables/${deliverableId}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'ACCEPTED',
        notes: 'Technical findings reviewed and accepted by Principal Scientist.',
      }),
    });
    const acceptDelData = await acceptDelRes.json();
    assert(
      acceptDelData.success && acceptDelData.data.status === 'ACCEPTED' && acceptDelData.data.acceptedAt !== null,
      'AC-35',
      'Deliverable accepted with acceptedAt timestamp and review notes'
    );

    // AC-36: Deliverable rejection workflow
    const createRejDel = await fetch(`${API_BASE}/rd/governance-ops/deliverables`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Draft Schematics Document',
        category: 'DESIGN_BLUEPRINT',
      }),
    });
    const rejDelData = await createRejDel.json();
    const rejDelRes = await fetch(`${API_BASE}/rd/governance-ops/deliverables/${rejDelData.data.id}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'REJECTED',
        notes: 'Incomplete pinout diagram. Resubmission required.',
      }),
    });
    const rejDelResult = await rejDelRes.json();
    assert(
      rejDelResult.success && rejDelResult.data.status === 'REJECTED',
      'AC-36',
      'Deliverable rejection workflow verified'
    );

    // AC-37: List deliverables
    const listDelRes = await fetch(`${API_BASE}/rd/governance-ops/deliverables?projectId=${projectA.id}`, {
      headers: headersA,
    });
    const listDelData = await listDelRes.json();
    assert(
      listDelData.success && listDelData.data.length >= 2,
      'AC-37',
      `Deliverables listed and filtered (Count: ${listDelData.data.length})`
    );

    // ==========================================================================
    // REQ 39: QUALITY CHECKPOINTS (AC-38 - AC-41)
    // ==========================================================================
    console.log('\n--- SECTION 8: QUALITY CHECKPOINTS (Req 39) ---');

    // AC-38: Create quality checkpoint
    const createQcRes = await fetch(`${API_BASE}/rd/governance-ops/quality-checkpoints`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Gate 2 Pre-Fabrication Quality Inspection',
        checkpointType: 'STAGE_GATE',
        plannedDate: '2026-11-30',
        criteria: [
          { criterionName: 'Anode foil thickness tolerance', specificationStandard: '25um +/- 1.5um' },
          { criterionName: 'Surface roughness measurement', specificationStandard: 'Ra < 0.3um' },
        ],
      }),
    });
    const qcData = await createQcRes.json();
    assert(
      createQcRes.status === 201 && qcData.success && qcData.data.checkpointCode?.startsWith('QC-') && qcData.data.criteria?.length === 2,
      'AC-38',
      `Quality checkpoint created with code ${qcData.data?.checkpointCode} and 2 criteria`
    );

    const qcId = qcData.data.id;

    // AC-39: Add and evaluate criteria
    const evalCritRes = await fetch(`${API_BASE}/rd/governance-ops/quality-criteria/${qcData.data.criteria[0].id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        result: 'PASS',
        observations: 'Foil measured 24.8um across all 10 sampling points.',
      }),
    });
    const evalCritData = await evalCritRes.json();
    assert(
      evalCritData.success && evalCritData.data.result === 'PASS',
      'AC-39',
      'Quality criterion inspection evaluated with PASS and observations'
    );

    // AC-40: Conduct checkpoint PASS
    const conductPassRes = await fetch(`${API_BASE}/rd/governance-ops/quality-checkpoints/${qcId}/conduct`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        overallResult: 'PASS',
        summaryFindings: 'All dimensional and material specs meet Grade-A tolerances.',
      }),
    });
    const conductPassData = await conductPassRes.json();
    assert(
      conductPassData.success && conductPassData.data.checkpoint?.status === 'PASSED' && conductPassData.data.checkpoint?.overallResult === 'PASS',
      'AC-40',
      'Quality checkpoint successfully conducted with overallResult: PASS'
    );

    // AC-41: Checkpoint FAIL with automated issue creation
    const createFailQc = await fetch(`${API_BASE}/rd/governance-ops/quality-checkpoints`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        title: 'Separator Porosity & Tear Resistance Inspection',
        checkpointType: 'AUDIT',
      }),
    });
    const failQcData = await createFailQc.json();
    const conductFailRes = await fetch(`${API_BASE}/rd/governance-ops/quality-checkpoints/${failQcData.data.id}/conduct`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        overallResult: 'FAIL',
        summaryFindings: 'Separator membrane ruptured at 15 MPa (Specification requires 25 MPa).',
        correctiveActions: 'Quarantine roll batch #8821 and contact membrane vendor.',
        spawnIssueIfFail: true,
      }),
    });
    const conductFailData = await conductFailRes.json();
    assert(
      conductFailData.success && conductFailData.data.checkpoint?.status === 'FAILED' && conductFailData.data.issue?.issueCode?.startsWith('ISS-'),
      'AC-41',
      `Quality failure automatically created linked issue ${conductFailData.data.issue?.issueCode}`
    );

    // ==========================================================================
    // REQ 40: BUDGET PLANNING, ALLOCATIONS & FINANCIAL CONTROLS (AC-42 - AC-46)
    // ==========================================================================
    console.log('\n--- SECTION 9: BUDGET PLANNING & FINANCIAL CONTROLS (Req 40) ---');

    // AC-42: Create project budget
    const createBudgetRes = await fetch(`${API_BASE}/rd/governance-ops/budgets`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: projectA.id,
        fiscalYear: 2027,
        currency: 'USD',
        totalAllocated: 250000,
        contingencyPercentage: 10,
        allocations: [
          { category: 'PERSONNEL', plannedAmount: 120000, notes: 'Principal Scientists & Research Engineers' },
          { category: 'LAB_EQUIPMENT', plannedAmount: 60000, notes: 'Laser micromachining workstation lease' },
          { category: 'MATERIALS_CONSUMABLES', plannedAmount: 40000, notes: 'Reagents, solvents, substrate foils' },
        ],
      }),
    });
    const budgetData = await createBudgetRes.json();
    assert(
      createBudgetRes.status === 201 && budgetData.success && Number(budgetData.data.totalAllocated) === 250000 && Number(budgetData.data.contingencyAmount) === 25000,
      'AC-42',
      `Budget established for FY2027: $250,000.00 with 10% contingency ($25,000.00)`
    );

    const budgetId = budgetData.data.id;

    // AC-43: Add category allocation
    const addAllocRes = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}/allocations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        category: 'SOFTWARE_LICENSES',
        plannedAmount: 15000,
        notes: 'COMSOL Multiphysics battery simulation licenses',
      }),
    });
    const allocData = await addAllocRes.json();
    assert(
      addAllocRes.status === 201 && allocData.success && allocData.data.category === 'SOFTWARE_LICENSES',
      'AC-43',
      'Category allocation added: SOFTWARE_LICENSES ($15,000.00)'
    );

    // AC-44: Financial control validation: total planned allocation cannot exceed total budget
    const overAllocRes = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}/allocations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        category: 'THIRD_PARTY_SERVICES',
        plannedAmount: 100000, // 120k + 60k + 40k + 15k = 235k. Adding 100k would exceed 250k!
      }),
    });
    const overAllocData = await overAllocRes.json();
    assert(
      overAllocRes.status !== 200 || !overAllocData.success,
      'AC-44',
      'Financial control enforced: Allocation sum cannot exceed total allocated budget'
    );

    // AC-45: Budget approval workflow
    const approveBudgetRes = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}/approve`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        approvalNotes: 'Executive board approved FY2027 research budget.',
      }),
    });
    const approveBudgetData = await approveBudgetRes.json();
    assert(
      approveBudgetData.success && approveBudgetData.data.status === 'APPROVED' && approveBudgetData.data.approvedAt !== null,
      'AC-45',
      'Budget approved with approvedAt timestamp and approval notes'
    );

    // AC-46: Budget revision workflow
    const reqRevRes = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}/revisions`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        newTotal: 320000,
        reason: 'Scope expansion from change request CR-2026-001 requiring additional hardware.',
      }),
    });
    const revData = await reqRevRes.json();
    assert(
      reqRevRes.status === 201 && revData.success && Number(revData.data.changeAmount) === 70000,
      'AC-46a',
      'Budget revision requested: +$70,000.00 expansion'
    );

    const approveRevRes = await fetch(`${API_BASE}/rd/governance-ops/revisions/${revData.data.id}/review`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        decision: 'APPROVED',
        reviewNotes: 'Board ratified revision based on verified client milestones.',
      }),
    });
    const approveRevData = await approveRevRes.json();

    const getRefreshedBudget = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}`, {
      headers: headersA,
    });
    const refreshedBudget = await getRefreshedBudget.json();
    assert(
      approveRevData.success && Number(refreshedBudget.data.totalAllocated) === 320000 && refreshedBudget.data.status === 'REVISED',
      'AC-46b',
      'Budget revision approved: Parent budget totalAllocated updated to $320,000.00 and status marked REVISED'
    );

    // Financial Summary & Utilization KPIs
    const summaryRes = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}/summary`, {
      headers: headersA,
    });
    const summaryData = await summaryRes.json();
    assert(
      summaryData.success && summaryData.data.totalAllocated === 320000 && summaryData.data.categoryBreakdown,
      'AC-46c',
      'Financial summary reports category breakdowns and utilization metrics'
    );

    // ==========================================================================
    // MULTI-TENANT ISOLATION & TELEMETRY
    // ==========================================================================
    console.log('\n--- SECTION 10: MULTI-TENANT ISOLATION & TELEMETRY ---');

    // Tenant B cannot access Tenant A's decision
    const tenantBIsoDec = await fetch(`${API_BASE}/rd/governance-ops/decisions/${decisionId}`, {
      headers: headersB,
    });
    assert(
      tenantBIsoDec.status === 404 || tenantBIsoDec.status === 500,
      'AC-ISO-1',
      `Tenant B blocked from accessing Tenant A decision ${decisionId} (Status: ${tenantBIsoDec.status})`
    );

    // Tenant B cannot access Tenant A's budget
    const tenantBIsoBudget = await fetch(`${API_BASE}/rd/governance-ops/budgets/${budgetId}`, {
      headers: headersB,
    });
    assert(
      tenantBIsoBudget.status === 404 || tenantBIsoBudget.status === 500,
      'AC-ISO-2',
      `Tenant B blocked from accessing Tenant A budget ${budgetId} (Status: ${tenantBIsoBudget.status})`
    );

    // Telemetry status
    const statusRes = await fetch(`${API_BASE}/rd/status`, {
      headers: headersA,
    });
    const statusData = await statusRes.json();
    assert(
      statusData.success &&
      statusData.data.executionPrompt === 'Master Prompt 09 of 16' &&
      statusData.data.status === 'ACTIVE_GOVERNANCE_RISK_FINANCIAL' &&
      statusData.data.activeFeatures['mod-09-governance'] === 'ACTIVE',
      'AC-TEL',
      'Telemetry reports Master Prompt 09 of 16: ACTIVE_GOVERNANCE_RISK_FINANCIAL'
    );

    // Database integrity
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    assert(
      userCount === 14 && tenantCount === 2,
      'AC-DATA-PRESERVED',
      `All 14 users and 2 tenants preserved without data corruption (Users: ${userCount}, Tenants: ${tenantCount})`
    );

    console.log('\n======================================================================');
    console.log(`MASTER PROMPT 09 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[TestSuite Error]:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaster09TestSuite();
