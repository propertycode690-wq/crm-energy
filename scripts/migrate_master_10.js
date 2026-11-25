const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster10Migration() {
  console.log('[Migration MP10] Starting additive migration for EgoLytics Master Prompt 10...');
  console.log('Requirements: 51 (Allocations), 52 (Skills & Matrix), 53 (Capacity Planning), 54 (Timesheets & Time Tracking), 55-57 (Cost & Budget Integration), 58 (Utilization), 59 (Facilities & Equipment), 60 (Scheduling Dependencies)');

  // 1. rd_resource_profiles
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_resource_profiles (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      employeeCode VARCHAR(191) NOT NULL,
      department VARCHAR(100) NOT NULL DEFAULT 'R&D Operations',
      designation VARCHAR(100) NOT NULL DEFAULT 'Research Engineer',
      standardWeeklyHours DECIMAL(5,2) NOT NULL DEFAULT 40.00,
      hourlyCostRate DECIMAL(10,2) NOT NULL DEFAULT 75.00,
      employmentStatus VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_resprof_tenant (tenantId),
      INDEX idx_rd_resprof_user (userId),
      INDEX idx_rd_resprof_dept (department),
      UNIQUE KEY uq_rd_resprof_user (tenantId, userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_resource_profiles');

  // 2. rd_resource_allocations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_resource_allocations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      roleInProject VARCHAR(100) NOT NULL DEFAULT 'Researcher',
      allocationPercentage INT NOT NULL DEFAULT 50,
      startDate DATETIME(3) NOT NULL,
      endDate DATETIME(3) NOT NULL,
      expectedWeeklyHours DECIMAL(6,2) NOT NULL DEFAULT 20.00,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      notes TEXT NULL,
      assignedById VARCHAR(191) NULL,
      assignedByName VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_resalloc_tenant (tenantId),
      INDEX idx_rd_resalloc_proj (projectId),
      INDEX idx_rd_resalloc_user (userId),
      INDEX idx_rd_resalloc_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_resource_allocations');

  // 3. rd_skills
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_skills (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      skillCode VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'SCIENTIFIC_RESEARCH',
      description TEXT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_skl_tenant (tenantId),
      INDEX idx_rd_skl_cat (category),
      INDEX idx_rd_skl_active (isActive),
      UNIQUE KEY uq_rd_skl_code (tenantId, skillCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_skills');

  // 4. rd_employee_skills
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_employee_skills (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      skillId VARCHAR(191) NOT NULL,
      expertiseLevel VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE',
      yearsOfExperience DECIMAL(4,1) NULL DEFAULT 1.0,
      certifications TEXT NULL,
      isVerified BOOLEAN NOT NULL DEFAULT FALSE,
      verifiedById VARCHAR(191) NULL,
      verifiedByName VARCHAR(255) NULL,
      verifiedAt DATETIME(3) NULL,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_empskl_tenant (tenantId),
      INDEX idx_rd_empskl_user (userId),
      INDEX idx_rd_empskl_skill (skillId),
      INDEX idx_rd_empskl_level (expertiseLevel),
      UNIQUE KEY uq_rd_empskl (tenantId, userId, skillId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_employee_skills');

  // 5. rd_timesheets
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_timesheets (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      timesheetCode VARCHAR(191) NOT NULL,
      weekStartDate DATETIME(3) NOT NULL,
      weekEndDate DATETIME(3) NOT NULL,
      totalHours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      submittedAt DATETIME(3) NULL,
      reviewedById VARCHAR(191) NULL,
      reviewedByName VARCHAR(255) NULL,
      reviewedAt DATETIME(3) NULL,
      approvalNotes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_tms_tenant (tenantId),
      INDEX idx_rd_tms_user (userId),
      INDEX idx_rd_tms_status (status),
      INDEX idx_rd_tms_dates (weekStartDate, weekEndDate),
      UNIQUE KEY uq_rd_tms_code (tenantId, timesheetCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_timesheets');

  // 6. rd_time_entries
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_time_entries (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      timesheetId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      taskId VARCHAR(191) NULL,
      experimentId VARCHAR(191) NULL,
      workDate DATETIME(3) NOT NULL,
      hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      description TEXT NOT NULL,
      workCategory VARCHAR(100) NOT NULL DEFAULT 'RESEARCH',
      isBillable BOOLEAN NOT NULL DEFAULT TRUE,
      hourlyCostRate DECIMAL(10,2) NOT NULL DEFAULT 75.00,
      calculatedCost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_tmentry_tenant (tenantId),
      INDEX idx_rd_tmentry_sheet (timesheetId),
      INDEX idx_rd_tmentry_user (userId),
      INDEX idx_rd_tmentry_proj (projectId),
      INDEX idx_rd_tmentry_task (taskId),
      INDEX idx_rd_tmentry_date (workDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_time_entries');

  // 7. rd_timesheet_histories
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_timesheet_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      timesheetId VARCHAR(191) NOT NULL,
      action VARCHAR(100) NOT NULL,
      previousStatus VARCHAR(50) NULL,
      newStatus VARCHAR(50) NULL,
      comments TEXT NULL,
      performedById VARCHAR(191) NULL,
      performedByName VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_tmshist_tenant (tenantId),
      INDEX idx_rd_tmshist_sheet (timesheetId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_timesheet_histories');

  // 8. rd_facilities
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_facilities (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      facilityCode VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      facilityType VARCHAR(100) NOT NULL DEFAULT 'CHEMISTRY_LAB',
      description TEXT NULL,
      location VARCHAR(255) NOT NULL DEFAULT 'Main Campus',
      building VARCHAR(100) NOT NULL DEFAULT 'Building A',
      floor VARCHAR(50) NOT NULL DEFAULT '1st Floor',
      capacity INT NOT NULL DEFAULT 10,
      operatingHoursStart VARCHAR(10) NOT NULL DEFAULT '08:00',
      operatingHoursEnd VARCHAR(10) NOT NULL DEFAULT '20:00',
      facilityManagerId VARCHAR(191) NULL,
      facilityManagerName VARCHAR(255) NULL,
      availabilityStatus VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
      accessRestrictions TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_fac_tenant (tenantId),
      INDEX idx_rd_fac_type (facilityType),
      INDEX idx_rd_fac_status (availabilityStatus),
      UNIQUE KEY uq_rd_fac_code (tenantId, facilityCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_facilities');

  // 9. rd_lab_equipment
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_lab_equipment (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      facilityId VARCHAR(191) NOT NULL,
      equipmentCode VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'SPECTROSCOPY',
      description TEXT NULL,
      manufacturer VARCHAR(255) NULL,
      modelNumber VARCHAR(255) NULL,
      serialNumber VARCHAR(255) NULL,
      operationalStatus VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
      calibrationDueDate DATETIME(3) NULL,
      maintenanceDueDate DATETIME(3) NULL,
      hourlyUsageRate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      usageRestrictions TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_eqp_tenant (tenantId),
      INDEX idx_rd_eqp_fac (facilityId),
      INDEX idx_rd_eqp_status (operationalStatus),
      INDEX idx_rd_eqp_cat (category),
      UNIQUE KEY uq_rd_eqp_code (tenantId, equipmentCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_lab_equipment');

  // 10. rd_equipment_maintenances
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_equipment_maintenances (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      equipmentId VARCHAR(191) NOT NULL,
      maintenanceType VARCHAR(100) NOT NULL DEFAULT 'PREVENTATIVE',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      startDate DATETIME(3) NOT NULL,
      endDate DATETIME(3) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
      performedById VARCHAR(191) NULL,
      performedByName VARCHAR(255) NULL,
      calibrationCertificateNumber VARCHAR(255) NULL,
      notes TEXT NULL,
      completedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_eqpmaint_tenant (tenantId),
      INDEX idx_rd_eqpmaint_eqp (equipmentId),
      INDEX idx_rd_eqpmaint_dates (startDate, endDate),
      INDEX idx_rd_eqpmaint_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_equipment_maintenances');

  // 11. rd_facility_bookings
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_facility_bookings (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      bookingCode VARCHAR(191) NOT NULL,
      resourceType VARCHAR(50) NOT NULL DEFAULT 'FACILITY',
      facilityId VARCHAR(191) NULL,
      equipmentId VARCHAR(191) NULL,
      projectId VARCHAR(191) NOT NULL,
      experimentId VARCHAR(191) NULL,
      taskId VARCHAR(191) NULL,
      requestedById VARCHAR(191) NOT NULL,
      requestedByName VARCHAR(255) NULL,
      bookingDate DATETIME(3) NOT NULL,
      startTime VARCHAR(10) NOT NULL,
      endTime VARCHAR(10) NOT NULL,
      startDateTime DATETIME(3) NOT NULL,
      endDateTime DATETIME(3) NOT NULL,
      purpose TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
      approvedById VARCHAR(191) NULL,
      approvedByName VARCHAR(255) NULL,
      rejectionReason TEXT NULL,
      cancellationReason TEXT NULL,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bk_tenant (tenantId),
      INDEX idx_rd_bk_fac (facilityId),
      INDEX idx_rd_bk_eqp (equipmentId),
      INDEX idx_rd_bk_proj (projectId),
      INDEX idx_rd_bk_user (requestedById),
      INDEX idx_rd_bk_dates (startDateTime, endDateTime),
      INDEX idx_rd_bk_status (status),
      UNIQUE KEY uq_rd_bk_code (tenantId, bookingCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_facility_bookings');

  // 12. rd_booking_histories
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_booking_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      bookingId VARCHAR(191) NOT NULL,
      action VARCHAR(100) NOT NULL,
      previousStatus VARCHAR(50) NULL,
      newStatus VARCHAR(50) NULL,
      notes TEXT NULL,
      performedById VARCHAR(191) NULL,
      performedByName VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bkhist_tenant (tenantId),
      INDEX idx_rd_bkhist_bk (bookingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_booking_histories');

  // Seed default Resource Profiles for existing 14 Users if missing
  const users = await prisma.user.findMany();
  console.log(`[Seed Check] Syncing Resource Profiles for ${users.length} existing users...`);
  let seeded = 0;
  for (let idx = 0; idx < users.length; idx++) {
    const u = users[idx];
    const exists = await prisma.$queryRawUnsafe(`SELECT id FROM rd_resource_profiles WHERE tenantId = ? AND userId = ?`, u.tenantId, u.id);
    if (!exists || exists.length === 0) {
      const empCode = `EMP-${String(idx + 101).padStart(3, '0')}`;
      let dept = 'Scientific Research';
      let desig = 'Senior Research Scientist';
      let rate = 85.00;

      if (u.role === 'BUSINESS_OWNER' || u.role === 'SUPER_ADMIN') {
        dept = 'Executive R&D Leadership';
        desig = 'R&D Director';
        rate = 150.00;
      } else if (u.role === 'ADMIN_1' || u.role === 'ADMIN_2') {
        dept = 'Laboratory Operations';
        desig = 'Lab Operations Manager';
        rate = 110.00;
      } else if (idx % 3 === 0) {
        dept = 'Materials & Electrochemistry';
        desig = 'Principal Investigator';
        rate = 95.00;
      } else if (idx % 3 === 1) {
        dept = 'Software & Embedded Systems';
        desig = 'Lead Firmware Engineer';
        rate = 90.00;
      }

      const cuid = 'cresprof' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      await prisma.$executeRawUnsafe(`
        INSERT INTO rd_resource_profiles (id, tenantId, userId, employeeCode, department, designation, standardWeeklyHours, hourlyCostRate, employmentStatus)
        VALUES (?, ?, ?, ?, ?, ?, 40.00, ?, 'ACTIVE')
      `, cuid, u.tenantId, u.id, empCode, dept, desig, rate);
      seeded++;
    }
  }
  console.log(`[Seed Complete] Synchronized ${seeded} resource profiles linked to existing users.`);

  console.log('[Migration MP10 Complete] All 12 Resource, Capacity, Time & Lab Facility tables verified successfully!');
}

runMaster10Migration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
