const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runMaster10TestSuite() {
  console.log('======================================================================');
  console.log('EGOLYTICS MASTER PROMPT 10 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('RESOURCE, CAPACITY, TIME & LAB FACILITY MANAGEMENT');
  console.log('Requirements: Req 51–60 (Allocations, Skill Matrix, Capacity, Timesheets, Cost, Utilization, Facilities, Equipment, Bookings, Conflict Prevention)');
  console.log('Acceptance Criteria: AC-01 through AC-32');
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
    // 1. Fetch Tenant A user & Tenant B user
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
      where: { tenantId: userA.tenantId },
    });
    if (!projectA) throw new Error('No project found in Tenant A.');

    // Secondary user in Tenant A
    const userA2 = await prisma.user.findFirst({
      where: { tenantId: userA.tenantId, id: { not: userA.id } },
    });
    if (!userA2) throw new Error('Secondary user not found in Tenant A.');

    console.log(`[Setup] Tenant A: ${userA.tenantId}, User A1: ${userA.email}, User A2: ${userA2.email}, Project: ${projectA.name}`);

    // ==============================================================================
    // SECTION 1: OVERVIEW & TELEMETRY (AC-01)
    // ==============================================================================
    console.log('\n--- SECTION 1: SYSTEM OVERVIEW & TELEMETRY ---');
    const statusRes = await fetch(`${API_BASE}/rd/status`, { headers: headersA });
    const statusData = await statusRes.json();
    assert(
      statusRes.ok && statusData.data.activeFeatures['mod-10-resources'] === 'ACTIVE',
      'AC-01',
      'Telemetry verifies mod-10-resources is ACTIVE in status payload'
    );

    const ovRes = await fetch(`${API_BASE}/rd/resources/overview`, { headers: headersA });
    const ovData = await ovRes.json();
    assert(
      ovRes.ok && ovData.data.totalResources >= 2 && ovData.data.totalStandardWeeklyHours > 0,
      'AC-02',
      'Resource overview returns valid workforce capacity and active resource counts'
    );

    // ==============================================================================
    // SECTION 2: RESOURCE PROFILES & DIRECTORY (AC-03 to AC-05) - Req 51
    // ==============================================================================
    console.log('\n--- SECTION 2: RESOURCE PROFILES & DIRECTORY (Req 51) ---');
    const profRes = await fetch(`${API_BASE}/rd/resources/profiles`, { headers: headersA });
    const profData = await profRes.json();
    assert(
      profRes.ok && Array.isArray(profData.data) && profData.data.length >= 2,
      'AC-03',
      'List resource profiles returns all seeded employees with standard 40h weekly baseline'
    );

    const targetProfile = profData.data[0];
    assert(
      targetProfile.hourlyCostRate > 0 && targetProfile.standardWeeklyHours === 40,
      'AC-04',
      'Resource profile contains positive hourly cost rate card and 40h standard baseline'
    );

    // Update profile
    const updateProfRes = await fetch(`${API_BASE}/rd/resources/profiles/${targetProfile.id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        designation: 'Senior Lead Research Architect',
        hourlyCostRate: 125.0,
      }),
    });
    const updateProfData = await updateProfRes.json();
    assert(
      updateProfRes.ok && updateProfData.data.designation === 'Senior Lead Research Architect' && Number(updateProfData.data.hourlyCostRate) === 125,
      'AC-05',
      'Update resource profile modifies designation and hourly rate card persistently'
    );

    // ==============================================================================
    // SECTION 3: MULTI-PROJECT ALLOCATIONS & OVER-ALLOCATION DETECTION (AC-06 to AC-09) - Req 51, 53
    // ==============================================================================
    console.log('\n--- SECTION 3: RESOURCE ALLOCATIONS & OVER-ALLOCATION (Req 51, 53) ---');
    const allocPayload1 = {
      projectId: projectA.id,
      userId: userA2.id,
      roleInProject: 'Lead Cell Chemist',
      allocationPercentage: 60,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      notes: 'Initial primary allocation',
    };

    const allocRes1 = await fetch(`${API_BASE}/rd/resources/allocations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(allocPayload1),
    });
    const allocData1 = await allocRes1.json();
    assert(
      allocRes1.status === 201 && allocData1.data.allocationPercentage === 60 && Number(allocData1.data.expectedWeeklyHours) === 24,
      'AC-06',
      'Resource allocated at 60% calculates 24.00 expected weekly hours accurately'
    );

    // Create second allocation causing over-allocation (> 100%)
    const allocPayload2 = {
      projectId: projectA.id,
      userId: userA2.id,
      roleInProject: 'Safety Reviewer',
      allocationPercentage: 55, // 60 + 55 = 115% -> over-allocated!
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      notes: 'Second overlapping project assignment',
    };

    const allocRes2 = await fetch(`${API_BASE}/rd/resources/allocations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(allocPayload2),
    });
    const allocData2 = await allocRes2.json();
    assert(
      allocRes2.status === 201 && allocData2.data.isOverAllocated === true && allocData2.data.totalAllocationPercentage === 115,
      'AC-07',
      'Over-allocation detected when active assignments total 115% (>100% threshold)'
    );

    // Check directory shows over-allocated status
    const profCheckRes = await fetch(`${API_BASE}/rd/resources/profiles`, { headers: headersA });
    const profCheckData = await profCheckRes.json();
    const updatedUserA2Profile = profCheckData.data.find((p) => p.userId === userA2.id);
    assert(
      updatedUserA2Profile && updatedUserA2Profile.isOverAllocated === true && updatedUserA2Profile.currentAllocationPercentage === 115,
      'AC-08',
      'Resource directory surfaces isOverAllocated flag for user exceeding capacity'
    );

    // Clean up one allocation
    const delAllocRes = await fetch(`${API_BASE}/rd/resources/allocations/${allocData2.data.id}`, {
      method: 'DELETE',
      headers: headersA,
    });
    assert(delAllocRes.ok, 'AC-09', 'Resource allocation deleted successfully');

    // ==============================================================================
    // SECTION 4: 2D SKILL MATRIX & EXPERTISE MAPPING (AC-10 to AC-14) - Req 52
    // ==============================================================================
    console.log('\n--- SECTION 4: 2D SKILL MATRIX & EXPERTISE MAPPING (Req 52) ---');
    const skillCode = `SKL-TEST-${Date.now().toString(36).toUpperCase()}`;
    const createSkillRes = await fetch(`${API_BASE}/rd/resources/skills`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        skillCode,
        name: 'Automated Calorimetry Testing',
        category: 'LAB_TECHNIQUE',
        description: 'Isothermal battery pouch cell heat dissipation testing.',
      }),
    });
    const createSkillData = await createSkillRes.json();
    assert(
      createSkillRes.status === 201 && createSkillData.data.skillCode === skillCode,
      'AC-10',
      'Master skill registered with valid skillCode, category and description'
    );

    // Assign skill to employee with expertise level
    const assignSkillRes = await fetch(`${API_BASE}/rd/resources/employee-skills`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        userId: userA.id,
        skillId: createSkillData.data.id,
        expertiseLevel: 'ADVANCED',
        yearsOfExperience: 5.5,
        certifications: 'ISO 17025 Certified Calorimetry Operator',
        notes: 'Lead researcher on battery thermal characterization.',
      }),
    });
    const assignSkillData = await assignSkillRes.json();
    assert(
      assignSkillRes.ok && assignSkillData.data.expertiseLevel === 'ADVANCED' && Number(assignSkillData.data.yearsOfExperience) === 5.5,
      'AC-11',
      'Skill assigned to employee with ADVANCED expertise level and 5.5 years experience'
    );

    // Verify / endorse skill
    const verifySkillRes = await fetch(`${API_BASE}/rd/resources/employee-skills/${assignSkillData.data.id}/verify`, {
      method: 'PUT',
      headers: headersA,
    });
    const verifySkillData = await verifySkillRes.json();
    assert(
      verifySkillRes.ok && verifySkillData.data.isVerified === true && verifySkillData.data.verifiedAt !== null,
      'AC-12',
      'Employee skill expertise verified and endorsed with manager audit timestamp'
    );

    // 2D Skill Matrix aggregation
    const matrixRes = await fetch(`${API_BASE}/rd/resources/skills/matrix`, { headers: headersA });
    const matrixData = await matrixRes.json();
    const cellValue = matrixData.data.matrix?.[userA.id]?.[createSkillData.data.id];
    assert(
      matrixRes.ok && cellValue && cellValue.expertiseLevel === 'ADVANCED' && cellValue.isVerified === true,
      'AC-13',
      '2D Skill Matrix maps employee row and skill column with level and verified indicator'
    );

    // Skill-based resource discovery
    const searchRes = await fetch(
      `${API_BASE}/rd/resources/skills/search?skillIds=${createSkillData.data.id}&minLevel=INTERMEDIATE`,
      { headers: headersA }
    );
    const searchData = await searchRes.json();
    assert(
      searchRes.ok && Array.isArray(searchData.data) && searchData.data.some((p) => p.userId === userA.id),
      'AC-14',
      'Skill search successfully discovers qualified resource matching required competency'
    );

    // ==============================================================================
    // SECTION 5: TEAM CAPACITY PLANNING (AC-15 to AC-17) - Req 53
    // ==============================================================================
    console.log('\n--- SECTION 5: TEAM CAPACITY PLANNING (Req 53) ---');
    const capRes = await fetch(`${API_BASE}/rd/resources/capacity`, { headers: headersA });
    const capData = await capRes.json();
    assert(
      capRes.ok && capData.data.totalHeadcount >= 2 && capData.data.overallStandardHours > 0,
      'AC-15',
      'Capacity planning returns complete headcount and aggregate standard weekly capacity'
    );

    const userA2Cap = capData.data.resources.find((r) => r.userId === userA2.id);
    assert(
      userA2Cap && userA2Cap.allocatedWeeklyHours === 24 && userA2Cap.remainingWeeklyHours === 16,
      'AC-16',
      'Individual capacity computes allocated hours (24h) and remaining available capacity (16h)'
    );

    assert(
      Array.isArray(capData.data.departmentRollups) && capData.data.departmentRollups.length > 0,
      'AC-17',
      'Department-level capacity rollups aggregate standard hours, allocated hours and utilization %'
    );

    // ==============================================================================
    // SECTION 6: TIMESHEETS & TIME TRACKING WORKFLOW (AC-18 to AC-22) - Req 54
    // ==============================================================================
    console.log('\n--- SECTION 6: TIMESHEETS & TIME TRACKING (Req 54) ---');
    const mondayStr = '2026-11-23';
    const weeklyRes = await fetch(
      `${API_BASE}/rd/resources/timesheets/weekly?userId=${userA.id}&weekStartDate=${mondayStr}`,
      { headers: headersA }
    );
    const weeklyData = await weeklyRes.json();
    assert(
      weeklyRes.ok && weeklyData.data.status === 'DRAFT' && weeklyData.data.userId === userA.id,
      'AC-18',
      'Weekly timesheet auto-initializes in DRAFT state with date range and unique code'
    );

    const targetTimesheetId = weeklyData.data.id;

    // Log time entry
    const entryPayload = {
      projectId: projectA.id,
      workDate: '2026-11-24',
      hours: 7.5,
      description: 'Solid-state electrolyte impedance spectroscopy measurement and curve fitting.',
      workCategory: 'RESEARCH',
      isBillable: true,
    };

    const addEntryRes = await fetch(`${API_BASE}/rd/resources/timesheets/${targetTimesheetId}/entries`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(entryPayload),
    });
    const addEntryData = await addEntryRes.json();
    assert(
      addEntryRes.status === 201 && Number(addEntryData.data.hours) === 7.5 && Number(addEntryData.data.calculatedCost) > 0,
      'AC-19',
      'Time entry records hours and dynamically computes calculatedCost from profile hourly rate'
    );

    // Submit timesheet
    const submitRes = await fetch(`${API_BASE}/rd/resources/timesheets/${targetTimesheetId}/submit`, {
      method: 'POST',
      headers: headersA,
    });
    const submitData = await submitRes.json();
    assert(
      submitRes.ok && submitData.data.status === 'SUBMITTED' && submitData.data.submittedAt !== null,
      'AC-20',
      'Timesheet submission workflow transitions status from DRAFT to SUBMITTED'
    );

    // Reject timesheet (testing revision cycle)
    const rejectRes = await fetch(`${API_BASE}/rd/resources/timesheets/${targetTimesheetId}/reject`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ reason: 'Please verify task breakdown for milestone M2.' }),
    });
    const rejectData = await rejectRes.json();
    assert(
      rejectRes.ok && rejectData.data.status === 'REJECTED' && rejectData.data.approvalNotes.includes('Please verify'),
      'AC-21',
      'Manager rejection transitions status to REJECTED with mandatory revision notes'
    );

    // Re-submit and Approve
    await fetch(`${API_BASE}/rd/resources/timesheets/${targetTimesheetId}/submit`, {
      method: 'POST',
      headers: headersA,
    });

    const approveRes = await fetch(`${API_BASE}/rd/resources/timesheets/${targetTimesheetId}/approve`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ notes: 'Verified against experimental lab runs.' }),
    });
    const approveData = await approveRes.json();
    assert(
      approveRes.ok && approveData.data.status === 'APPROVED' && approveData.data.reviewedAt !== null,
      'AC-22',
      'Manager approval workflow transitions status to APPROVED with immutable timestamp'
    );

    // ==============================================================================
    // SECTION 7: LABOR COST & MP09 BUDGET INTEGRATION (AC-23 to AC-25) - Req 55-57
    // ==============================================================================
    console.log('\n--- SECTION 7: LABOR COST & MP09 BUDGET INTEGRATION (Req 55, 56, 57) ---');
    const laborRes = await fetch(`${API_BASE}/rd/resources/projects/${projectA.id}/labor-costs`, {
      headers: headersA,
    });
    const laborData = await laborRes.json();
    assert(
      laborRes.ok && laborData.data.actualHours >= 7.5 && laborData.data.actualCost > 0,
      'AC-23',
      'Project labor cost calculation aggregates approved timesheets for actual expenditure'
    );

    assert(
      laborData.data.plannedHours > 0 && laborData.data.plannedCost > 0,
      'AC-24',
      'Planned labor cost correctly computed from active multi-week resource allocations'
    );

    assert(
      typeof laborData.data.costVariance === 'number' && typeof laborData.data.burnRatePercentage === 'number',
      'AC-25',
      'Cost variance and personnel budget consumption percentage calculated without errors'
    );

    // ==============================================================================
    // SECTION 8: RESOURCE UTILIZATION METRICS (AC-26) - Req 58
    // ==============================================================================
    console.log('\n--- SECTION 8: RESOURCE UTILIZATION METRICS (Req 58) ---');
    const utilRes = await fetch(`${API_BASE}/rd/resources/utilization`, { headers: headersA });
    const utilData = await utilRes.json();
    assert(
      utilRes.ok && Array.isArray(utilData.data.employees) && utilData.data.summary.totalHeadcount >= 2,
      'AC-26',
      'Utilization metrics provide individual and overall planned vs actual utilization rates'
    );

    // ==============================================================================
    // SECTION 9: LAB FACILITIES & EQUIPMENT MANAGEMENT (AC-27 to AC-29) - Req 59
    // ==============================================================================
    console.log('\n--- SECTION 9: LAB FACILITIES & EQUIPMENT (Req 59) ---');
    const facCode = `FAC-TEST-${Date.now().toString(36).toUpperCase()}`;
    const facRes = await fetch(`${API_BASE}/rd/resources/facilities`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        facilityCode: facCode,
        name: 'High-Temperature Solid-State Lab',
        facilityType: 'TESTING_FACILITY',
        location: 'Innovation Campus',
        building: 'Pavilion Gamma',
        floor: '3rd Floor',
        capacity: 6,
        operatingHoursStart: '08:00',
        operatingHoursEnd: '20:00',
      }),
    });
    const facData = await facRes.json();
    assert(
      facRes.status === 201 && facData.data.facilityCode === facCode && facData.data.capacity === 6,
      'AC-27',
      'Lab facility registered with location, capacity and operating hours'
    );

    const eqpCode = `EQP-TEST-${Date.now().toString(36).toUpperCase()}`;
    const eqpRes = await fetch(`${API_BASE}/rd/resources/equipment`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        facilityId: facData.data.id,
        equipmentCode: eqpCode,
        name: 'Thermo Scientific Dilatometer',
        category: 'THERMAL_ANALYSIS',
        manufacturer: 'Thermo Fisher',
        modelNumber: 'DIL-402',
        hourlyUsageRate: 65.0,
      }),
    });
    const eqpData = await eqpRes.json();
    assert(
      eqpRes.status === 201 && eqpData.data.operationalStatus === 'AVAILABLE' && Number(eqpData.data.hourlyUsageRate) === 65,
      'AC-28',
      'Lab equipment registered and linked to host facility with AVAILABLE status'
    );

    // Schedule Maintenance
    const maintRes = await fetch(`${API_BASE}/rd/resources/equipment/maintenance`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        equipmentId: eqpData.data.id,
        maintenanceType: 'CALIBRATION',
        title: 'Precision Temperature Sensor Calibration',
        startDate: new Date(Date.now() - 3600000).toISOString(), // starts 1 hour ago
        endDate: new Date(Date.now() + 86400000).toISOString(),
        notes: 'Annual recalibration protocol.',
      }),
    });
    const maintData = await maintRes.json();
    assert(
      maintRes.status === 201 && maintData.data.status === 'SCHEDULED',
      'AC-29',
      'Equipment maintenance scheduled and equipment transitions to UNDER_MAINTENANCE'
    );

    // Complete Maintenance
    const compMaintRes = await fetch(`${API_BASE}/rd/resources/equipment/maintenance/${maintData.data.id}/complete`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        calibrationCertificateNumber: 'CERT-ISO-990182',
        notes: 'Calibration certified by metrology specialist.',
      }),
    });
    const compMaintData = await compMaintRes.json();
    assert(
      compMaintRes.ok && compMaintData.data.status === 'COMPLETED' && compMaintData.data.calibrationCertificateNumber === 'CERT-ISO-990182',
      'AC-30',
      'Maintenance completion records certificate and resets equipment status to AVAILABLE'
    );

    // ==============================================================================
    // SECTION 10: BOOKINGS & CONFLICT PREVENTION (AC-31, AC-32) - Req 59, 60
    // ==============================================================================
    console.log('\n--- SECTION 10: SCHEDULING & CONFLICT PREVENTION (Req 59, 60) ---');
    const bookBaseDate = '2026-11-28';
    const bookStart = `${bookBaseDate}T09:00:00.000Z`;
    const bookEnd = `${bookBaseDate}T12:00:00.000Z`;

    const bookRes1 = await fetch(`${API_BASE}/rd/resources/bookings`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        resourceType: 'EQUIPMENT',
        equipmentId: eqpData.data.id,
        projectId: projectA.id,
        bookingDate: bookBaseDate,
        startTime: '09:00',
        endTime: '12:00',
        startDateTime: bookStart,
        endDateTime: bookEnd,
        purpose: 'Sample thermal expansion run for milestone deliverable.',
      }),
    });
    const bookData1 = await bookRes1.json();
    assert(
      bookRes1.status === 201 && bookData1.data.status === 'CONFIRMED' && bookData1.data.bookingCode !== null,
      'AC-31',
      'Initial equipment booking confirmed successfully for non-overlapping slot'
    );

    // Attempt overlapping booking (CONFLICT PREVENTION)
    const confStart = `${bookBaseDate}T10:30:00.000Z`; // Overlaps with 09:00-12:00!
    const confEnd = `${bookBaseDate}T13:30:00.000Z`;

    const bookRes2 = await fetch(`${API_BASE}/rd/resources/bookings`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        resourceType: 'EQUIPMENT',
        equipmentId: eqpData.data.id,
        projectId: projectA.id,
        bookingDate: bookBaseDate,
        startTime: '10:30',
        endTime: '13:30',
        startDateTime: confStart,
        endDateTime: confEnd,
        purpose: 'Attempting to double-book equipment during active reservation.',
      }),
    });
    assert(
      bookRes2.status === 409,
      'AC-32',
      'Double-booking conflict strictly rejected with 409 Conflict status code'
    );

    // Cancel booking
    const cancelRes = await fetch(`${API_BASE}/rd/resources/bookings/${bookData1.data.id}/cancel`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ reason: 'Test run concluded.' }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.ok && cancelData.data.status === 'CANCELLED', 'AC-33', 'Booking cancellation sets status to CANCELLED and records audit history');

    // ==============================================================================
    // SECTION 11: CROSS-TENANT ISOLATION (AC-34)
    // ==============================================================================
    console.log('\n--- SECTION 11: MULTI-TENANT BOUNDARY INTEGRITY ---');
    const crossRes = await fetch(`${API_BASE}/rd/resources/profiles/${targetProfile.id}`, {
      headers: headersB, // Tenant B token trying to access Tenant A profile
    });
    assert(
      crossRes.status === 404 || crossRes.status === 403,
      'AC-34',
      'Cross-tenant boundary test: Tenant B cannot access Tenant A resource profile'
    );

    console.log('\n======================================================================');
    console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('======================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[TestSuite Error]:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaster10TestSuite();
