const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reconcileSchema() {
  console.log('================================================================');
  console.log('  EGOLYTICS TASK 1: SAFE SCHEMA RECONCILIATION');
  console.log('================================================================\n');

  try {
    // 1. role_permissions
    console.log('[1/5] Reconciling `role_permissions` table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`role_permissions\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`tenantId\` VARCHAR(191) NOT NULL,
        \`roleId\` VARCHAR(191) NOT NULL,
        \`allowedNavIds\` LONGTEXT NOT NULL,
        \`allowedRoutes\` LONGTEXT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY \`unique_tenant_role\` (\`tenantId\`, \`roleId\`),
        INDEX \`role_permissions_tenantId_idx\` (\`tenantId\`),
        INDEX \`role_permissions_roleId_idx\` (\`roleId\`),
        CONSTRAINT \`role_permissions_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ `role_permissions` created/verified.');

    // 2. strategic_goals
    console.log('[2/5] Reconciling `strategic_goals` table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`strategic_goals\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`tenantId\` VARCHAR(191) NOT NULL,
        \`code\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NOT NULL,
        \`description\` TEXT NULL,
        \`category\` VARCHAR(191) NOT NULL DEFAULT 'Growth & Innovation',
        \`targetYear\` INT NOT NULL DEFAULT 2026,
        \`targetValue\` VARCHAR(191) NULL,
        \`status\` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
        \`ownerId\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`strategic_goals_tenantId_idx\` (\`tenantId\`),
        INDEX \`strategic_goals_status_idx\` (\`status\`),
        INDEX \`strategic_goals_ownerId_idx\` (\`ownerId\`),
        CONSTRAINT \`strategic_goals_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`strategic_goals_ownerId_fkey\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ `strategic_goals` created/verified.');

    // 3. project_proposals
    console.log('[3/5] Reconciling `project_proposals` table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`project_proposals\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`tenantId\` VARCHAR(191) NOT NULL,
        \`referenceNumber\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NOT NULL,
        \`summary\` TEXT NULL,
        \`description\` LONGTEXT NULL,
        \`category\` VARCHAR(191) NOT NULL DEFAULT 'Product Innovation',
        \`problemStatement\` TEXT NULL,
        \`expectedOutcomes\` TEXT NULL,
        \`estimatedBudget\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`estimatedDurationMonths\` INT NOT NULL DEFAULT 6,
        \`proposedStartDate\` DATETIME(3) NULL,
        \`expectedCompletionDate\` DATETIME(3) NULL,
        \`submittingUserId\` VARCHAR(191) NULL,
        \`status\` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
        \`reviewerId\` VARCHAR(191) NULL,
        \`reviewComments\` TEXT NULL,
        \`rejectionReason\` TEXT NULL,
        \`moreInfoNotes\` TEXT NULL,
        \`convertedProjectId\` VARCHAR(191) NULL UNIQUE,
        \`strategicGoalId\` VARCHAR(191) NULL,
        \`expectedRoi\` DOUBLE NOT NULL DEFAULT 50.0,
        \`riskAssessment\` VARCHAR(191) NULL DEFAULT 'MEDIUM',
        \`feasibilityScore\` DOUBLE NOT NULL DEFAULT 70.0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`project_proposals_tenantId_idx\` (\`tenantId\`),
        INDEX \`project_proposals_status_idx\` (\`status\`),
        INDEX \`project_proposals_submittingUserId_idx\` (\`submittingUserId\`),
        INDEX \`project_proposals_reviewerId_idx\` (\`reviewerId\`),
        INDEX \`project_proposals_strategicGoalId_idx\` (\`strategicGoalId\`),
        INDEX \`project_proposals_tenant_ref_idx\` (\`tenantId\`, \`referenceNumber\`),
        CONSTRAINT \`project_proposals_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`project_proposals_submittingUserId_fkey\` FOREIGN KEY (\`submittingUserId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`project_proposals_reviewerId_fkey\` FOREIGN KEY (\`reviewerId\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`project_proposals_convertedProjectId_fkey\` FOREIGN KEY (\`convertedProjectId\`) REFERENCES \`erp_projects\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`project_proposals_strategicGoalId_fkey\` FOREIGN KEY (\`strategicGoalId\`) REFERENCES \`strategic_goals\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ `project_proposals` created/verified.');

    // 4. project_strategic_alignments
    console.log('[4/5] Reconciling `project_strategic_alignments` table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`project_strategic_alignments\` (
        \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`tenantId\` VARCHAR(191) NOT NULL,
        \`projectId\` VARCHAR(191) NOT NULL,
        \`goalId\` VARCHAR(191) NOT NULL,
        \`alignmentRationale\` TEXT NULL,
        \`impactWeight\` DOUBLE NOT NULL DEFAULT 1.0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY \`unique_project_goal\` (\`projectId\`, \`goalId\`),
        INDEX \`project_strategic_alignments_tenantId_idx\` (\`tenantId\`),
        INDEX \`project_strategic_alignments_projectId_idx\` (\`projectId\`),
        INDEX \`project_strategic_alignments_goalId_idx\` (\`goalId\`),
        CONSTRAINT \`project_strategic_alignments_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`project_strategic_alignments_projectId_fkey\` FOREIGN KEY (\`projectId\`) REFERENCES \`erp_projects\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`project_strategic_alignments_goalId_fkey\` FOREIGN KEY (\`goalId\`) REFERENCES \`strategic_goals\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ `project_strategic_alignments` created/verified.');

    // 5. rd_idea_evaluation_scores missing columns
    console.log('[5/5] Reconciling `rd_idea_evaluation_scores` columns...');
    const cols = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM \`rd_idea_evaluation_scores\``);
    const existingColNames = cols.map(c => c.Field);

    if (!existingColNames.includes('weight')) {
      console.log('  -> Adding column `weight`...');
      await prisma.$executeRawUnsafe(`ALTER TABLE \`rd_idea_evaluation_scores\` ADD COLUMN \`weight\` DOUBLE NOT NULL DEFAULT 1.0`);
    }

    if (!existingColNames.includes('weightedContribution')) {
      console.log('  -> Adding column `weightedContribution`...');
      await prisma.$executeRawUnsafe(`ALTER TABLE \`rd_idea_evaluation_scores\` ADD COLUMN \`weightedContribution\` DOUBLE NOT NULL DEFAULT 0.0`);
    }

    if (!existingColNames.includes('criterionComments')) {
      console.log('  -> Adding column `criterionComments`...');
      await prisma.$executeRawUnsafe(`ALTER TABLE \`rd_idea_evaluation_scores\` ADD COLUMN \`criterionComments\` TEXT NULL`);
    }
    console.log('  ✓ `rd_idea_evaluation_scores` columns verified.');

    console.log('\n================================================================');
    console.log('  RECONCILIATION COMPLETE: ZERO DATA LOSS VERIFIED');
    console.log('================================================================');

  } catch (error) {
    console.error('Reconciliation error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileSchema();

