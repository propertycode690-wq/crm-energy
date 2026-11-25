const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster15Migration() {
  console.log('[Migration MP15] Starting additive migration for Master Prompt 15: BFOV Charts Advanced Features & AI Integration...');

  const queries = [
    // 1. bfov_diagram_comments
    `CREATE TABLE IF NOT EXISTS \`bfov_diagram_comments\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`diagramId\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`nodeId\` VARCHAR(191) NULL,
      \`isResolved\` TINYINT(1) NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`bfov_comments_diagramId_idx\` (\`diagramId\`),
      INDEX \`bfov_comments_tenantId_idx\` (\`tenantId\`),
      INDEX \`bfov_comments_userId_idx\` (\`userId\`),
      INDEX \`bfov_comments_nodeId_idx\` (\`nodeId\`),
      CONSTRAINT \`fk_bfov_comments_diagram\` FOREIGN KEY (\`diagramId\`) REFERENCES \`bfov_diagrams\`(\`id\` ) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_bfov_comments_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_bfov_comments_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. bfov_diagram_shares
    `CREATE TABLE IF NOT EXISTS \`bfov_diagram_shares\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`diagramId\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`sharedWithUserId\` VARCHAR(191) NULL,
      \`sharedWithEmail\` VARCHAR(191) NULL,
      \`role\` VARCHAR(32) NOT NULL DEFAULT 'VIEWER',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`bfov_shares_diagramId_idx\` (\`diagramId\`),
      INDEX \`bfov_shares_tenantId_idx\` (\`tenantId\`),
      INDEX \`bfov_shares_userId_idx\` (\`sharedWithUserId\`),
      CONSTRAINT \`fk_bfov_shares_diagram\` FOREIGN KEY (\`diagramId\`) REFERENCES \`bfov_diagrams\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_bfov_shares_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_bfov_shares_user\` FOREIGN KEY (\`sharedWithUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. bfov_ai_generations
    `CREATE TABLE IF NOT EXISTS \`bfov_ai_generations\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NULL,
      \`diagramId\` VARCHAR(191) NULL,
      \`prompt\` TEXT NOT NULL,
      \`diagramType\` VARCHAR(64) NOT NULL,
      \`engine\` VARCHAR(64) NOT NULL DEFAULT 'NATIVE_SYNTHESIS',
      \`rawResponse\` MEDIUMTEXT NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`bfov_ai_tenantId_idx\` (\`tenantId\`),
      INDEX \`bfov_ai_userId_idx\` (\`userId\`),
      INDEX \`bfov_ai_diagramId_idx\` (\`diagramId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      await prisma.$executeRawUnsafe(queries[i]);
      console.log(`[Migration MP15] Query ${i + 1}/${queries.length} executed successfully.`);
    } catch (e) {
      console.warn(`[Migration MP15] Query ${i + 1} notice:`, e.message);
    }
  }

  console.log('[Migration MP15] Additive migration for Master Prompt 15 completed successfully!');
  await prisma.$disconnect();
}

runMaster15Migration()
  .catch(async (e) => {
    console.error('[Migration MP15 FATAL]:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

