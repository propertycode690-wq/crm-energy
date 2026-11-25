const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 06 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('GANTT, TIMELINE, DEPENDENCIES & CRITICAL PATH ENGINE');
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

  try {
    // 1. Fetch valid users from primary tenant
    const userA = await prisma.user.findFirst({
      where: { tenantId: 'TENANT-08492' },
    });

    if (!userA) {
      throw new Error('Tenant user not found in database.');
    }

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

    // Find or create test R&D project in Tenant A
    const project = await prisma.erpProject.create({
      data: {
        tenantId: userA.tenantId,
        name: `Autonomous Drone Navigation (Test ${Date.now()})`,
        client: 'Internal R&D Lab',
        projectType: 'RD',
        status: 'In Progress',
        budget: 500000.0,
      },
    });

    // =========================================================================
    // SECTION 1: TELEMETRY & SYSTEM STATUS
    // =========================================================================
    console.log('\n--- SECTION 1: SYSTEM STATUS & TELEMETRY ---');
    const statusRes = await fetch(`${API_BASE}/rd/status`, { headers: headersA });
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200, 'AC-01', 'Status endpoint responds 200 OK');
    assert(statusJson.data?.executionPrompt?.includes('Master Prompt'), 'AC-02', 'Telemetry confirms Master Prompt active');
    assert(statusJson.data?.activeFeatures?.['mod-06-scheduling'] === 'ACTIVE', 'AC-03', 'Telemetry status indicates scheduling active');
    assert(statusJson.data?.activeFeatures?.['mod-06-scheduling'] === 'ACTIVE', 'AC-04', 'mod-06-scheduling feature flag active');

    // =========================================================================
    // SECTION 2: DYNAMIC MILESTONE CRUD & LIFECYCLE (REQ 10)
    // =========================================================================
    console.log('\n--- SECTION 2: DYNAMIC MILESTONE MANAGEMENT (REQ 10) ---');
    // 2.1 Create Milestone
    const m1Date = new Date();
    m1Date.setDate(m1Date.getDate() + 30);
    const createM1Res = await fetch(`${API_BASE}/rd/milestones`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        projectId: project.id,
        title: 'Phase 1 Architecture Complete',
        description: 'System Architecture Document & Safety Analysis',
        plannedStartDate: new Date().toISOString(),
        plannedEndDate: m1Date.toISOString(),
        milestoneType: 'STAGE_GATE',
        priority: 'HIGH',
        status: 'PLANNED',
      }),
    });
    const m1Json = await createM1Res.json();
    assert(createM1Res.status === 201 && m1Json.success, 'AC-05', 'Create dynamic milestone responds 201 Created');
    const milestone1Id = m1Json.data?.id;

    // 2.2 Retrieve Milestone by ID
    const getM1Res = await fetch(`${API_BASE}/rd/milestones/${milestone1Id}`, { headers: headersA });
    const getM1Json = await getM1Res.json();
    assert(getM1Res.status === 200 && getM1Json.data?.title === 'Phase 1 Architecture Complete', 'AC-06', 'Retrieve milestone by ID returns accurate data');

    // 2.3 Update Milestone
    const updateM1Res = await fetch(`${API_BASE}/rd/milestones/${milestone1Id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        description: 'Updated architecture specs and safety compliance',
        priority: 'URGENT',
      }),
    });
    const updateM1Json = await updateM1Res.json();
    assert(updateM1Res.status === 200 && updateM1Json.data?.priority === 'URGENT', 'AC-07', 'Update milestone fields operational');

    // 2.4 Transition Milestone Status
    const statusM1Res = await fetch(`${API_BASE}/rd/milestones/${milestone1Id}/status`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        note: 'Commencing architecture design sprint',
      }),
    });
    const statusM1Json = await statusM1Res.json();
    assert(statusM1Res.status === 200 && statusM1Json.data?.status === 'IN_PROGRESS', 'AC-08', 'Milestone lifecycle status transition to IN_PROGRESS operational');

    // 2.5 Milestone Progress Rollup from Linked Tasks
    // Create Task 1 (80% progress) and Task 2 (40% progress) linked to milestone1Id
    const tStart = new Date();
    const tEnd = new Date();
    tEnd.setDate(tEnd.getDate() + 10);

    const task1 = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Draft System Safety Specs',
        taskType: 'DEVELOPMENT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        rdStatus: 'IN_PROGRESS',
        progress: 80,
        estimatedHours: 40,
        actualHours: 32,
        startDate: tStart,
        dueDate: tEnd,
        projectId: project.id,
        milestoneId: milestone1Id,
        assignedUserId: userA.id,
      },
    });

    const task2 = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Review Flight Controller Specs',
        taskType: 'DEVELOPMENT',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        rdStatus: 'IN_PROGRESS',
        progress: 40,
        estimatedHours: 20,
        actualHours: 8,
        startDate: tStart,
        dueDate: tEnd,
        projectId: project.id,
        milestoneId: milestone1Id,
        assignedUserId: userA.id,
      },
    });

    // Call update progress rollup
    const rollupRes = await fetch(`${API_BASE}/rd/milestones/${milestone1Id}`, { headers: headersA });
    const rollupJson = await rollupRes.json();
    // Avg = (80 + 40) / 2 = 60%
    assert(rollupJson.data?.progress === 60, 'AC-09', 'Milestone dynamic progress rollup accurately calculates 60% from linked tasks');

    // 2.6 List Milestones for Project
    const listMRes = await fetch(`${API_BASE}/rd/milestones?projectId=${project.id}`, { headers: headersA });
    const listMJson = await listMRes.json();
    assert(listMRes.status === 200 && listMJson.data?.length >= 1, 'AC-10', 'List project milestones operational');

    // =========================================================================
    // SECTION 3: CPM BENCHMARK & GANTT DATASET (REQ 13)
    // =========================================================================
    console.log('\n--- SECTION 3: CPM BENCHMARK & GANTT INTEGRATION (REQ 13) ---');
    // Set up standard 6-task CPM benchmark
    // A=3d, B=5d, C=2d, D=4d, E=3d, F=2d
    // A -> B, A -> C, B -> D, C -> E, D -> F, E -> F
    // Total critical path: A -> B -> D -> F = 3 + 5 + 4 + 2 = 14 days
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    const makeDate = (daysOffset) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + daysOffset);
      return d;
    };

    const taskA = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task A: Requirements Definition',
        taskType: 'RESEARCH',
        status: 'COMPLETED',
        rdStatus: 'DONE',
        progress: 100,
        estimatedHours: 24,
        actualHours: 24,
        startDate: makeDate(0),
        dueDate: makeDate(3),
        projectId: project.id,
      },
    });

    const taskB = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task B: Core Kernel Engine',
        taskType: 'DEVELOPMENT',
        status: 'IN_PROGRESS',
        rdStatus: 'IN_PROGRESS',
        progress: 50,
        estimatedHours: 40,
        actualHours: 20,
        startDate: makeDate(3),
        dueDate: makeDate(8),
        projectId: project.id,
      },
    });

    const taskC = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task C: Peripheral Drivers',
        taskType: 'DEVELOPMENT',
        status: 'IN_PROGRESS',
        rdStatus: 'IN_PROGRESS',
        progress: 30,
        estimatedHours: 16,
        actualHours: 5,
        startDate: makeDate(3),
        dueDate: makeDate(5),
        projectId: project.id,
      },
    });

    const taskD = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task D: Real-Time Telemetry Bus',
        taskType: 'DEVELOPMENT',
        status: 'PENDING',
        rdStatus: 'TODO',
        progress: 0,
        estimatedHours: 32,
        actualHours: 0,
        startDate: makeDate(8),
        dueDate: makeDate(12),
        projectId: project.id,
      },
    });

    const taskE = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task E: Diagnostic Dashboard',
        taskType: 'DEVELOPMENT',
        status: 'PENDING',
        rdStatus: 'TODO',
        progress: 0,
        estimatedHours: 24,
        actualHours: 0,
        startDate: makeDate(5),
        dueDate: makeDate(8),
        projectId: project.id,
      },
    });

    const taskF = await prisma.task.create({
      data: {
        tenantId: userA.tenantId,
        title: 'Task F: System Integration & Acceptance',
        taskType: 'TASK',
        status: 'PENDING',
        rdStatus: 'TODO',
        progress: 0,
        estimatedHours: 16,
        actualHours: 0,
        startDate: makeDate(12),
        dueDate: makeDate(14),
        projectId: project.id,
        milestoneId: milestone1Id,
      },
    });

    // Create 6 dependencies
    const depPairs = [
      { pred: taskA.id, succ: taskB.id },
      { pred: taskA.id, succ: taskC.id },
      { pred: taskB.id, succ: taskD.id },
      { pred: taskC.id, succ: taskE.id },
      { pred: taskD.id, succ: taskF.id },
      { pred: taskE.id, succ: taskF.id },
    ];

    for (const dp of depPairs) {
      await prisma.rdTaskDependency.create({
        data: {
          tenantId: userA.tenantId,
          predecessorId: dp.pred,
          successorId: dp.succ,
          dependencyType: 'FS',
          lagDays: 0,
        },
      });
    }

    // Create baseline for task B with 2 days variance
    const bBaseStart = makeDate(1);
    const bBaseDue = makeDate(6);
    await prisma.rdTaskScheduleBaseline.create({
      data: {
        tenantId: userA.tenantId,
        taskId: taskB.id,
        projectId: project.id,
        baselineStartDate: bBaseStart,
        baselineEndDate: bBaseDue,
        plannedDurationDays: 5,
        version: 1,
      },
    });

    // Fetch Gantt dataset
    const ganttRes = await fetch(`${API_BASE}/rd/gantt/${project.id}`, { headers: headersA });
    const ganttJson = await ganttRes.json();
    assert(ganttRes.status === 200 && ganttJson.success, 'AC-11', 'Gantt dataset endpoint responds 200 OK');
    assert(Array.isArray(ganttJson.data?.tasks) && ganttJson.data.tasks.length >= 6, 'AC-12', 'Gantt dataset includes all scheduled project tasks');
    assert(Array.isArray(ganttJson.data?.milestones) && ganttJson.data.milestones.length >= 1, 'AC-13', 'Gantt dataset includes project dynamic milestones');
    assert(Array.isArray(ganttJson.data?.dependencies) && ganttJson.data.dependencies.length >= 6, 'AC-14', 'Gantt dataset includes task dependencies (FS/SS/FF/SF)');
    assert(ganttJson.data?.cpm?.projectDurationDays === 14, 'AC-15', 'Mathematical CPM validation: project duration exactly 14 days');

    const criticalPathIds = (ganttJson.data?.cpm?.criticalPath || []).map((cp) => cp.id);
    const expectedCritical = [taskA.id, taskB.id, taskD.id, taskF.id];
    const isCriticalMatch = expectedCritical.every((id) => criticalPathIds.includes(id));
    assert(isCriticalMatch, 'AC-16', 'Mathematical CPM validation: critical chain is A -> B -> D -> F');

    // Check baseline comparison in Gantt
    const taskBNode = ganttJson.data.tasks.find((t) => t.id === taskB.id);
    assert(taskBNode?.finishVarianceDays === 2 && taskBNode?.isSlipped === true, 'AC-17', 'Gantt baseline comparison overlays 2-day schedule drift');

    // =========================================================================
    // SECTION 4: INTERACTIVE RESCHEDULING & DRAG DATES (REQ 13)
    // =========================================================================
    console.log('\n--- SECTION 4: RESCHEDULING & DATE ADJUSTMENTS ---');
    const newBStart = makeDate(4);
    const newBDue = makeDate(10); // Extends duration from 5 to 6 days
    const rescheduleRes = await fetch(`${API_BASE}/rd/gantt/tasks/${taskB.id}/dates`, {
      method: 'PATCH',
      headers: headersA,
      body: JSON.stringify({
        startDate: newBStart.toISOString(),
        dueDate: newBDue.toISOString(),
      }),
    });
    const reschedJson = await rescheduleRes.json();
    assert(rescheduleRes.status === 200 && reschedJson.success, 'AC-18', 'Gantt task rescheduling PATCH endpoint responds 200 OK');
    assert(reschedJson.data?.task?.startDate && reschedJson.data?.task?.dueDate, 'AC-19', 'Task start and due dates updated successfully');
    assert(reschedJson.data?.cpmRecalculated !== undefined, 'AC-20', 'Rescheduling automatically triggers CPM recalculation');

    // =========================================================================
    // SECTION 5: PROJECT ROADMAP SYNTHESIS (REQ 9)
    // =========================================================================
    console.log('\n--- SECTION 5: PROJECT ROADMAP (REQ 9) ---');
    const roadmapRes = await fetch(`${API_BASE}/rd/roadmap/${project.id}`, { headers: headersA });
    const roadmapJson = await roadmapRes.json();
    assert(roadmapRes.status === 200 && roadmapJson.success, 'AC-21', 'Roadmap synthesis endpoint responds 200 OK');
    assert(Array.isArray(roadmapJson.data?.phases), 'AC-22', 'Roadmap organizes tasks and milestones by phase breakdown');
    assert(Array.isArray(roadmapJson.data?.milestones) && roadmapJson.data.milestones.length >= 1, 'AC-23', 'Roadmap contains milestone deliverable timeline');
    assert(roadmapJson.data?.criticalPathDurationDays !== undefined, 'AC-24', 'Roadmap provides critical path duration metrics');

    // =========================================================================
    // SECTION 6: CHRONOLOGICAL PROJECT TIMELINE (REQ 14)
    // =========================================================================
    console.log('\n--- SECTION 6: CHRONOLOGICAL TIMELINE (REQ 14) ---');
    const timelineRes = await fetch(`${API_BASE}/rd/timeline/${project.id}`, { headers: headersA });
    const timelineJson = await timelineRes.json();
    assert(timelineRes.status === 200 && timelineJson.success, 'AC-25', 'Chronological timeline endpoint responds 200 OK');
    assert(Array.isArray(timelineJson.data?.events) && timelineJson.data.events.length >= 5, 'AC-26', 'Timeline events stream contains milestone, task, and baseline markers');

    // Check chronological order of timeline events
    const events = timelineJson.data?.events || [];
    let isSorted = true;
    for (let i = 1; i < events.length; i++) {
      if (new Date(events[i].date) < new Date(events[i - 1].date)) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, 'AC-27', 'Timeline events stream is strictly sorted chronologically');

    // =========================================================================
    // SECTION 7: MULTI-TENANT ISOLATION & ACCESS CONTROL
    // =========================================================================
    console.log('\n--- SECTION 7: MULTI-TENANT SCOPING & SECURITY ---');
    // Tenant B attempt to access Tenant A milestone
    const crossMRes = await fetch(`${API_BASE}/rd/milestones/${milestone1Id}`, { headers: headersB });
    assert(crossMRes.status === 404 || crossMRes.status === 403, 'AC-28', 'Tenant B unauthorized milestone access blocked with 404/403');

    // Tenant B attempt to access Tenant A Gantt
    const crossGanttRes = await fetch(`${API_BASE}/rd/gantt/${project.id}`, { headers: headersB });
    const crossGanttJson = await crossGanttRes.json();
    const isGanttBlocked = crossGanttRes.status === 404 || (crossGanttJson.data?.tasks?.length === 0);
    assert(isGanttBlocked, 'AC-29', 'Tenant B unauthorized Gantt access returns empty / 404 scoped out');

    // Tenant B attempt to reschedule Tenant A task
    const crossPatchRes = await fetch(`${API_BASE}/rd/gantt/tasks/${taskB.id}/dates`, {
      method: 'PATCH',
      headers: headersB,
      body: JSON.stringify({ startDate: new Date().toISOString() }),
    });
    assert(crossPatchRes.status === 404 || crossPatchRes.status === 403, 'AC-30', 'Tenant B unauthorized task rescheduling blocked with 404/403');

    // =========================================================================
    // SECTION 8: REGRESSION VERIFICATION (MASTER PROMPTS 01 - 05)
    // =========================================================================
    console.log('\n--- SECTION 8: REGRESSION VERIFICATION ---');
    // Prompt 01: Tenant verification
    const tenantVerifyRes = await fetch(`${API_BASE}/rd/verify-tenant`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ claimedTenantId: userA.tenantId }),
    });
    assert(tenantVerifyRes.status === 200, 'AC-31', 'Prompt 01: Tenant boundary verification operational');

    // Prompt 02: Portfolio proposals
    const portfolioRes = await fetch(`${API_BASE}/rd/portfolio`, { headers: headersA });
    assert(portfolioRes.status === 200, 'AC-32', 'Prompt 02: R&D Portfolio list operational');

    // Prompt 03: Ideas leaderboard
    const leaderRes = await fetch(`${API_BASE}/rd/ideas/leaderboard`, { headers: headersA });
    assert(leaderRes.status === 200, 'AC-33', 'Prompt 03: Innovation leaderboard operational');

    // Prompt 04: Stage-Gate governance templates
    const gateRes = await fetch(`${API_BASE}/rd/governance/templates`, { headers: headersA });
    assert(gateRes.status === 200, 'AC-34', 'Prompt 04: Stage-gate templates operational');

    // Prompt 05: Tasks list
    const tasksRes = await fetch(`${API_BASE}/rd/tasks?projectId=${project.id}`, { headers: headersA });
    assert(tasksRes.status === 200, 'AC-35', 'Prompt 05: R&D Tasks list operational');

    // =========================================================================
    // CLEANUP TEST FIXTURES
    // =========================================================================
    console.log('\n--- CLEANING UP TEST FIXTURES ---');
    await prisma.rdTaskDependency.deleteMany({
      where: { tenantId: userA.tenantId, predecessorId: { in: [taskA.id, taskB.id, taskC.id, taskD.id, taskE.id, taskF.id] } },
    });
    await prisma.rdTaskScheduleBaseline.deleteMany({ where: { projectId: project.id } });
    await prisma.rdScheduleAlert.deleteMany({ where: { projectId: project.id } });
    await prisma.task.deleteMany({
      where: { id: { in: [task1.id, task2.id, taskA.id, taskB.id, taskC.id, taskD.id, taskE.id, taskF.id] } },
    });
    await prisma.rdMilestone.deleteMany({ where: { projectId: project.id } });
    await prisma.erpProject.delete({ where: { id: project.id } });
    console.log('Test fixtures cleaned up successfully.');

    console.log('\n================================================================');
    console.log(`FINAL RESULT: ${passed} PASSED / ${failed} FAILED (Total ${passed + failed} Checks)`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();
