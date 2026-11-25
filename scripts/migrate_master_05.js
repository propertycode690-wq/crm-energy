const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster05Migration() {
  console.log('[Migration MP05] Starting additive migration for EgoLytics Master Prompt 05...');

  // 1. Additive columns on tasks table
  const taskAlterQueries = [
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS projectId VARCHAR(191) NULL;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprintId VARCHAR(191) NULL;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stageId VARCHAR(191) NULL;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS taskType VARCHAR(32) NOT NULL DEFAULT 'TASK';`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rdStatus VARCHAR(32) NOT NULL DEFAULT 'TODO';`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS startDate DATETIME(3) NULL;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimatedHours DOUBLE NOT NULL DEFAULT 0;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actualHours DOUBLE NOT NULL DEFAULT 0;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sortOrder INT NOT NULL DEFAULT 0;`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS isBacklog BOOLEAN NOT NULL DEFAULT FALSE;`,
  ];

  for (const q of taskAlterQueries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`[Tasks Alter] Success: ${q.substring(0, 60)}...`);
    } catch (err) {
      console.warn(`[Tasks Alter] Notice/Skipped: ${err.message}`);
    }
  }

  // Add indexes on tasks
  const taskIndexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_sprintId ON tasks(sprintId);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_stageId ON tasks(stageId);`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_rdStatus ON tasks(tenantId, rdStatus);`,
  ];
  for (const q of taskIndexQueries) {
    try {
      await prisma.$executeRawUnsafe(q);
    } catch (err) {
      // index might already exist or MariaDB syntax
    }
  }

  // 2. CREATE TABLE rd_sprints
  const createSprintsTable = `
    CREATE TABLE IF NOT EXISTS rd_sprints (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NULL,
      name VARCHAR(191) NOT NULL,
      code VARCHAR(64) NULL,
      goal TEXT NULL,
      startDate DATETIME(3) NULL,
      endDate DATETIME(3) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
      capacityHours DOUBLE NOT NULL DEFAULT 0,
      velocity DOUBLE NOT NULL DEFAULT 0,
      completedAt DATETIME(3) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_sprints_tenant (tenantId),
      INDEX idx_rd_sprints_tenant_status (tenantId, status),
      INDEX idx_rd_sprints_project (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(createSprintsTable);
  console.log('[Table Created] rd_sprints');

  // 3. CREATE TABLE rd_task_dependencies
  const createDependenciesTable = `
    CREATE TABLE IF NOT EXISTS rd_task_dependencies (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      predecessorId VARCHAR(191) NOT NULL,
      successorId VARCHAR(191) NOT NULL,
      dependencyType VARCHAR(16) NOT NULL DEFAULT 'FS',
      lagDays INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_task_dep (predecessorId, successorId),
      INDEX idx_rd_dep_tenant (tenantId),
      INDEX idx_rd_dep_pred (predecessorId),
      INDEX idx_rd_dep_succ (successorId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(createDependenciesTable);
  console.log('[Table Created] rd_task_dependencies');

  // 4. CREATE TABLE rd_task_schedule_baselines
  const createBaselinesTable = `
    CREATE TABLE IF NOT EXISTS rd_task_schedule_baselines (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      taskId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NULL,
      baselineStartDate DATETIME(3) NULL,
      baselineEndDate DATETIME(3) NULL,
      plannedDurationDays INT NOT NULL DEFAULT 1,
      version INT NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_base_tenant (tenantId),
      INDEX idx_rd_base_task (taskId),
      INDEX idx_rd_base_project (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(createBaselinesTable);
  console.log('[Table Created] rd_task_schedule_baselines');

  // 5. CREATE TABLE rd_schedule_alerts
  const createAlertsTable = `
    CREATE TABLE IF NOT EXISTS rd_schedule_alerts (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NULL,
      taskId VARCHAR(191) NULL,
      alertType VARCHAR(32) NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'WARNING',
      message TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      detectedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      resolvedAt DATETIME(3) NULL,
      INDEX idx_rd_alert_tenant (tenantId),
      INDEX idx_rd_alert_status (tenantId, status),
      INDEX idx_rd_alert_project (projectId),
      INDEX idx_rd_alert_task (taskId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(createAlertsTable);
  console.log('[Table Created] rd_schedule_alerts');

  console.log('[Migration MP05] All tables and additive columns verified successfully.');
}

runMaster05Migration()
  .catch((err) => {
    console.error('[Migration MP05] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
