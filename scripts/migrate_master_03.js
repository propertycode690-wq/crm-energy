const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster03Migration() {
  console.log('[Migration MP03] Starting additive migration for Idea Management & Scoring...');

  const queries = [
    `CREATE TABLE IF NOT EXISTS \`rd_idea_categories\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`color\` VARCHAR(64) NULL DEFAULT '#3b82f6',
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`displayOrder\` INT NOT NULL DEFAULT 0,
      \`createdById\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_idea_category\` (\`tenantId\`, \`name\`),
      INDEX \`rd_idea_categories_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_idea_categories_isActive_idx\` (\`isActive\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_ideas\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`referenceNumber\` VARCHAR(191) NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`summary\` TEXT NULL,
      \`problemStatement\` TEXT NULL,
      \`proposedSolution\` TEXT NULL,
      \`description\` LONGTEXT NULL,
      \`expectedBenefits\` TEXT NULL,
      \`categoryId\` VARCHAR(191) NULL,
      \`tags\` TEXT NULL,
      \`status\` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
      \`rejectionReason\` TEXT NULL,
      \`moreInfoNotes\` TEXT NULL,
      \`authorId\` VARCHAR(191) NULL,
      \`voteCount\` INT NOT NULL DEFAULT 0,
      \`evaluationCount\` INT NOT NULL DEFAULT 0,
      \`compositeScore\` DOUBLE NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_ideas_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_ideas_status_idx\` (\`status\`),
      INDEX \`rd_ideas_authorId_idx\` (\`authorId\`),
      INDEX \`rd_ideas_categoryId_idx\` (\`categoryId\`),
      INDEX \`rd_ideas_compositeScore_idx\` (\`compositeScore\`),
      INDEX \`rd_ideas_tenant_ref_idx\` (\`tenantId\`, \`referenceNumber\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_votes\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`ideaId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_idea_user_vote\` (\`ideaId\`, \`userId\`),
      INDEX \`rd_idea_votes_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_idea_votes_ideaId_idx\` (\`ideaId\`),
      INDEX \`rd_idea_votes_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_comments\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`ideaId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`parentId\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_idea_comments_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_idea_comments_ideaId_idx\` (\`ideaId\`),
      INDEX \`rd_idea_comments_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_reviewers\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`ideaId\` VARCHAR(191) NOT NULL,
      \`reviewerId\` VARCHAR(191) NOT NULL,
      \`assignedById\` VARCHAR(191) NULL,
      \`status\` VARCHAR(64) NOT NULL DEFAULT 'PENDING',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_idea_reviewer\` (\`ideaId\`, \`reviewerId\`),
      INDEX \`rd_idea_reviewers_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_idea_reviewers_ideaId_idx\` (\`ideaId\`),
      INDEX \`rd_idea_reviewers_reviewerId_idx\` (\`reviewerId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_evaluation_rubrics\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`version\` INT NOT NULL DEFAULT 1,
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`scale\` VARCHAR(64) NOT NULL DEFAULT '1_TO_5',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_idea_rubrics_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_idea_rubrics_isActive_idx\` (\`isActive\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_evaluation_criteria\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`rubricId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`weight\` DOUBLE NOT NULL,
      \`direction\` VARCHAR(64) NOT NULL DEFAULT 'HIGHER_IS_BETTER',
      \`displayOrder\` INT NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_idea_crit_rubricId_idx\` (\`rubricId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_evaluations\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`ideaId\` VARCHAR(191) NOT NULL,
      \`evaluatorId\` VARCHAR(191) NOT NULL,
      \`rubricId\` VARCHAR(191) NOT NULL,
      \`rubricVersion\` INT NOT NULL DEFAULT 1,
      \`weightedScore\` DOUBLE NOT NULL DEFAULT 0.0,
      \`comments\` TEXT NULL,
      \`status\` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
      \`submittedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_idea_evaluator\` (\`ideaId\`, \`evaluatorId\`),
      INDEX \`rd_eval_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_eval_ideaId_idx\` (\`ideaId\`),
      INDEX \`rd_eval_evaluatorId_idx\` (\`evaluatorId\`),
      INDEX \`rd_eval_status_idx\` (\`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`rd_idea_evaluation_scores\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`evaluationId\` VARCHAR(191) NOT NULL,
      \`criterionId\` VARCHAR(191) NOT NULL,
      \`rawScore\` DOUBLE NOT NULL,
      \`normalizedScore\` DOUBLE NOT NULL,
      \`notes\` TEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_eval_criterion\` (\`evaluationId\`, \`criterionId\`),
      INDEX \`rd_score_evalId_idx\` (\`evaluationId\`),
      INDEX \`rd_score_criterionId_idx\` (\`criterionId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    await prisma.$executeRawUnsafe(queries[i]);
    console.log(`[MP03 Table Created] ${i + 1}/${queries.length}`);
  }

  console.log('[Migration MP03] Completed successfully.');
  await prisma.$disconnect();
}

runMaster03Migration().catch(console.error);

