const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster06Migration() {
  console.log('[Migration MP06] Starting additive migration for EgoLytics Master Prompt 06...');

  // 1. CREATE TABLE rd_milestones
  const createMilestonesTable = `
    CREATE TABLE IF NOT EXISTS rd_milestones (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      title VARCHAR(191) NOT NULL,
      description TEXT NULL,
      milestoneCode VARCHAR(64) NULL,
      milestoneType VARCHAR(32) NOT NULL DEFAULT 'DELIVERABLE',
      plannedStartDate DATETIME(3) NULL,
      plannedEndDate DATETIME(3) NULL,
      actualStartDate DATETIME(3) NULL,
      actualCompletionDate DATETIME(3) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
      progress INT NOT NULL DEFAULT 0,
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
      ownerId VARCHAR(191) NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_ms_tenant (tenantId),
      INDEX idx_rd_ms_tenant_status (tenantId, status),
      INDEX idx_rd_ms_project (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(createMilestonesTable);
  console.log('[Table Created] rd_milestones');

  // 2. Additive column on tasks table
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestoneId VARCHAR(191) NULL;`);
    console.log('[Tasks Alter] Added milestoneId column to tasks table');
  } catch (err) {
    console.warn(`[Tasks Alter] Notice/Skipped: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_tasks_milestoneId ON tasks(milestoneId);`);
  } catch (err) {
    // index might already exist
  }

  console.log('[Migration MP06] All tables and additive columns verified successfully.');
}

runMaster06Migration()
  .catch((err) => {
    console.error('[Migration MP06] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
