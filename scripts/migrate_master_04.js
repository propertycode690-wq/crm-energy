const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runAdditiveMigration() {
  console.log('--- Starting Additive Migration for Master Prompt 04 Stage-Gate Models ---');

  const queries = [
    // 1. rd_stage_templates
    `CREATE TABLE IF NOT EXISTS \`rd_stage_templates\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`version\` INT NOT NULL DEFAULT 1,
      \`isDefault\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdById\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_stage_templates_tenantId_code_key\` (\`tenantId\`, \`code\`),
      INDEX \`rd_stage_templates_tenantId_isActive_idx\` (\`tenantId\`, \`isActive\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. rd_innovation_stages
    `CREATE TABLE IF NOT EXISTS \`rd_innovation_stages\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`templateId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`stageNumber\` INT NOT NULL DEFAULT 1,
      \`description\` TEXT NULL,
      \`expectedDeliverables\` TEXT NULL,
      \`responsibleRole\` VARCHAR(191) NULL DEFAULT 'RD_LEAD',
      \`color\` VARCHAR(191) NOT NULL DEFAULT '#3b82f6',
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_innovation_stages_templateId_stageNumber_key\` (\`templateId\`, \`stageNumber\`),
      INDEX \`rd_innovation_stages_tenantId_templateId_idx\` (\`tenantId\`, \`templateId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. rd_stage_criteria
    `CREATE TABLE IF NOT EXISTS \`rd_stage_criteria\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`stageId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`type\` VARCHAR(191) NOT NULL DEFAULT 'EXIT',
      \`isMandatory\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`evidenceRequired\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`sortOrder\` INT NOT NULL DEFAULT 1,
      \`validationRule\` TEXT NULL,
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_stage_criteria_stageId_type_idx\` (\`stageId\`, \`type\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 4. rd_decision_gates
    `CREATE TABLE IF NOT EXISTS \`rd_decision_gates\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`stageId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`gateOrder\` INT NOT NULL DEFAULT 1,
      \`approvalPolicy\` VARCHAR(191) NOT NULL DEFAULT 'ALL_MUST_APPROVE',
      \`requiredSignOffCount\` INT NOT NULL DEFAULT 1,
      \`reviewInstructions\` TEXT NULL,
      \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_decision_gates_stageId_key\` (\`stageId\`),
      INDEX \`rd_decision_gates_tenantId_idx\` (\`tenantId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 5. rd_project_governances
    `CREATE TABLE IF NOT EXISTS \`rd_project_governances\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NOT NULL,
      \`templateId\` VARCHAR(191) NOT NULL,
      \`templateVersion\` INT NOT NULL DEFAULT 1,
      \`currentStageId\` VARCHAR(191) NULL,
      \`currentGateId\` VARCHAR(191) NULL,
      \`governanceStatus\` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
      \`holdReason\` TEXT NULL,
      \`terminationReason\` TEXT NULL,
      \`originIdeaId\` VARCHAR(191) NULL,
      \`originProposalId\` VARCHAR(191) NULL,
      \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`lastTransitionAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`completedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_project_governances_projectId_key\` (\`projectId\`),
      INDEX \`rd_project_governances_tenantId_governanceStatus_idx\` (\`tenantId\`, \`governanceStatus\`),
      INDEX \`rd_project_governances_projectId_idx\` (\`projectId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 6. rd_project_stage_histories
    `CREATE TABLE IF NOT EXISTS \`rd_project_stage_histories\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`governanceId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NOT NULL,
      \`fromStageId\` VARCHAR(191) NULL,
      \`toStageId\` VARCHAR(191) NULL,
      \`fromStageName\` VARCHAR(191) NULL,
      \`toStageName\` VARCHAR(191) NULL,
      \`triggerGateId\` VARCHAR(191) NULL,
      \`triggerDecisionId\` VARCHAR(191) NULL,
      \`eventType\` VARCHAR(191) NOT NULL,
      \`actorId\` VARCHAR(191) NULL,
      \`actorName\` VARCHAR(191) NULL,
      \`reason\` TEXT NULL,
      \`notes\` TEXT NULL,
      \`metadata\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_project_stage_histories_governanceId_idx\` (\`governanceId\`),
      INDEX \`rd_project_stage_histories_projectId_idx\` (\`projectId\`),
      INDEX \`rd_project_stage_histories_createdAt_idx\` (\`createdAt\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 7. rd_gate_reviews
    `CREATE TABLE IF NOT EXISTS \`rd_gate_reviews\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`governanceId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NOT NULL,
      \`gateId\` VARCHAR(191) NOT NULL,
      \`stageId\` VARCHAR(191) NOT NULL,
      \`cycleNumber\` INT NOT NULL DEFAULT 1,
      \`status\` VARCHAR(191) NOT NULL DEFAULT 'READY_FOR_REVIEW',
      \`submittedById\` VARCHAR(191) NULL,
      \`submittedAt\` DATETIME(3) NULL,
      \`summary\` TEXT NULL,
      \`notes\` TEXT NULL,
      \`moreInfoRequestedNotes\` TEXT NULL,
      \`moreInfoResponse\` TEXT NULL,
      \`criteriaCompletedCount\` INT NOT NULL DEFAULT 0,
      \`criteriaTotalCount\` INT NOT NULL DEFAULT 0,
      \`allCriteriaMet\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_gate_reviews_tenantId_status_idx\` (\`tenantId\`, \`status\`),
      INDEX \`rd_gate_reviews_governanceId_idx\` (\`governanceId\`),
      INDEX \`rd_gate_reviews_gateId_idx\` (\`gateId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 8. rd_gate_reviewers
    `CREATE TABLE IF NOT EXISTS \`rd_gate_reviewers\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`reviewId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`role\` VARCHAR(191) NOT NULL DEFAULT 'GATEKEEPER',
      \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
      \`assignedById\` VARCHAR(191) NULL,
      \`assignedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_gate_review_user\` (\`reviewId\`, \`userId\`),
      INDEX \`rd_gate_reviewers_reviewId_idx\` (\`reviewId\`),
      INDEX \`rd_gate_reviewers_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 9. rd_gate_sign_offs
    `CREATE TABLE IF NOT EXISTS \`rd_gate_sign_offs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`reviewId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`recommendation\` VARCHAR(191) NOT NULL,
      \`comments\` TEXT NULL,
      \`signedOffAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_gate_review_signoff_user\` (\`reviewId\`, \`userId\`),
      INDEX \`rd_gate_sign_offs_reviewId_idx\` (\`reviewId\`),
      INDEX \`rd_gate_sign_offs_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 10. rd_gate_decisions
    `CREATE TABLE IF NOT EXISTS \`rd_gate_decisions\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`reviewId\` VARCHAR(191) NOT NULL,
      \`governanceId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NOT NULL,
      \`gateId\` VARCHAR(191) NOT NULL,
      \`decision\` VARCHAR(191) NOT NULL,
      \`decisionReason\` TEXT NOT NULL,
      \`decisionComments\` TEXT NULL,
      \`decisionMakerId\` VARCHAR(191) NOT NULL,
      \`decidedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_gate_decisions_governanceId_idx\` (\`governanceId\`),
      INDEX \`rd_gate_decisions_reviewId_idx\` (\`reviewId\`),
      INDEX \`rd_gate_decisions_gateId_idx\` (\`gateId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 11. rd_gate_evidence
    `CREATE TABLE IF NOT EXISTS \`rd_gate_evidence\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`reviewId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NOT NULL,
      \`criterionId\` VARCHAR(191) NULL,
      \`title\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`evidenceType\` VARCHAR(191) NOT NULL DEFAULT 'DOCUMENT',
      \`fileUrl\` VARCHAR(191) NULL,
      \`fileSize\` INT NULL,
      \`uploadedById\` VARCHAR(191) NOT NULL,
      \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING_REVIEW',
      \`reviewerNotes\` TEXT NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`rd_gate_evidence_reviewId_idx\` (\`reviewId\`),
      INDEX \`rd_gate_evidence_projectId_idx\` (\`projectId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 12. rd_gate_review_comments
    `CREATE TABLE IF NOT EXISTS \`rd_gate_review_comments\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`reviewId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_gate_review_comments_reviewId_idx\` (\`reviewId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`[OK] Executed query ${i + 1}/${queries.length}`);
    } catch (err) {
      console.error(`[ERR] Query ${i + 1} failed:`, err.message);
      throw err;
    }
  }

  // Verify core data preservation
  const userCount = await prisma.user.count();
  const tenantCount = await prisma.tenant.count();
  console.log(`Preserved Users: ${userCount}/14 | Preserved Tenants: ${tenantCount}/2`);

  await prisma.$disconnect();
  console.log('--- Migration Finished Successfully ---');
}

runAdditiveMigration().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});
