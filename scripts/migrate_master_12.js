const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster12Migration() {
  console.log('[Migration MP12] Starting additive migration for Master Prompt 12: Dashboard, Reporting & Analytics Engine...');

  const queries = [
    // 1. rd_kpis
    `CREATE TABLE IF NOT EXISTS \`rd_kpis\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`calculationFormula\` TEXT NULL,
      \`category\` VARCHAR(64) NOT NULL DEFAULT 'PORTFOLIO',
      \`targetValue\` DOUBLE NOT NULL DEFAULT 0.0,
      \`currentValue\` DOUBLE NOT NULL DEFAULT 0.0,
      \`unit\` VARCHAR(32) NOT NULL DEFAULT 'PERCENT',
      \`measurementPeriod\` VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'ON_TRACK',
      \`trend\` VARCHAR(32) NOT NULL DEFAULT 'STABLE',
      \`ownerId\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_kpi_code\` (\`tenantId\`, \`code\`),
      INDEX \`rd_kpis_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_kpis_category_idx\` (\`category\`),
      INDEX \`rd_kpis_status_idx\` (\`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. rd_kpi_history
    `CREATE TABLE IF NOT EXISTS \`rd_kpi_history\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`kpiId\` VARCHAR(191) NOT NULL,
      \`period\` VARCHAR(64) NOT NULL,
      \`targetValue\` DOUBLE NOT NULL,
      \`actualValue\` DOUBLE NOT NULL,
      \`variance\` DOUBLE NOT NULL DEFAULT 0.0,
      \`notes\` TEXT NULL,
      \`recordedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`rd_kpi_history_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_kpi_history_kpiId_idx\` (\`kpiId\`),
      INDEX \`rd_kpi_history_recordedAt_idx\` (\`recordedAt\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. rd_dashboard_preferences
    `CREATE TABLE IF NOT EXISTS \`rd_dashboard_preferences\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`dashboardType\` VARCHAR(64) NOT NULL DEFAULT 'EXECUTIVE',
      \`layoutConfig\` JSON NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_user_dashboard_pref\` (\`tenantId\`, \`userId\`, \`dashboardType\`),
      INDEX \`rd_dash_pref_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_dash_pref_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    await prisma.$executeRawUnsafe(q);
    console.log(`[OK] Executed query ${i + 1}/${queries.length}`);
  }

  // Verify Data Preservation
  const userCount = await prisma.user.count();
  const tenantCount = await prisma.tenant.count();
  console.log(`[Integrity Check] Users: ${userCount}/14 | Tenants: ${tenantCount}/2`);

  await prisma.$disconnect();
  console.log('[Migration MP12] Finished additive migration successfully.');
}

runMaster12Migration().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});

