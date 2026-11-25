const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster09Migration() {
  console.log('[Migration MP09] Starting additive migration for EgoLytics Master Prompt 09...');
  console.log('Requirements: 31 (Decisions), 32-33 (Risks & Matrix), 34 (Issues), 35 (Changes), 36 (Requirements), 37 (Scope/WBS), 38 (Deliverables), 39 (Quality), 40 (Budgets)');

  // 1. CREATE TABLE rd_decisions (Requirement 31)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_decisions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      decisionCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL',
      decisionType VARCHAR(50) NOT NULL DEFAULT 'CONTINUE',
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      problemStatement TEXT NULL,
      alternativesConsidered TEXT NULL,
      rationale TEXT NULL,
      expectedOutcome TEXT NULL,
      actualOutcome TEXT NULL,
      decisionDate DATETIME(3) NULL,
      deadline DATETIME(3) NULL,
      ownerId VARCHAR(191) NULL,
      decisionMakerId VARCHAR(191) NULL,
      gateReviewId VARCHAR(191) NULL,
      relatedRiskId VARCHAR(191) NULL,
      relatedIssueId VARCHAR(191) NULL,
      relatedRequirementId VARCHAR(191) NULL,
      relatedDeliverableId VARCHAR(191) NULL,
      relatedExperimentId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_dec_tenant (tenantId),
      INDEX idx_rd_dec_project (projectId),
      INDEX idx_rd_dec_status (status),
      INDEX idx_rd_dec_owner (ownerId),
      UNIQUE KEY uq_rd_dec_code (tenantId, decisionCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_decisions');

  // 2. CREATE TABLE rd_decision_histories (Requirement 31)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_decision_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      decisionId VARCHAR(191) NOT NULL,
      action VARCHAR(100) NOT NULL,
      previousStatus VARCHAR(50) NULL,
      newStatus VARCHAR(50) NULL,
      comments TEXT NULL,
      performedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_dechist_tenant (tenantId),
      INDEX idx_rd_dechist_dec (decisionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_decision_histories');

  // 3. CREATE TABLE rd_risks (Requirements 32, 33)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_risks (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      riskCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL_RISK',
      ownerId VARCHAR(191) NULL,
      identifiedDate DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      reviewDate DATETIME(3) NULL,
      source VARCHAR(255) NULL,
      probability INT NOT NULL DEFAULT 3,
      impact INT NOT NULL DEFAULT 3,
      riskScore INT NOT NULL DEFAULT 9,
      riskLevel VARCHAR(50) NOT NULL DEFAULT 'MODERATE',
      status VARCHAR(50) NOT NULL DEFAULT 'IDENTIFIED',
      mitigationStrategy TEXT NULL,
      contingencyPlan TEXT NULL,
      relatedTaskId VARCHAR(191) NULL,
      relatedMilestoneId VARCHAR(191) NULL,
      relatedExperimentId VARCHAR(191) NULL,
      relatedDeliverableId VARCHAR(191) NULL,
      relatedDecisionId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rsk_tenant (tenantId),
      INDEX idx_rd_rsk_project (projectId),
      INDEX idx_rd_rsk_score (riskScore),
      INDEX idx_rd_rsk_level (riskLevel),
      INDEX idx_rd_rsk_status (status),
      UNIQUE KEY uq_rd_rsk_code (tenantId, riskCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_risks');

  // 4. CREATE TABLE rd_risk_mitigations (Requirement 32)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_risk_mitigations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      riskId VARCHAR(191) NOT NULL,
      actionTitle VARCHAR(255) NOT NULL,
      description TEXT NULL,
      responsibleUserId VARCHAR(191) NULL,
      targetDate DATETIME(3) NULL,
      completedDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
      progress INT NOT NULL DEFAULT 0,
      relatedTaskId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rskmit_tenant (tenantId),
      INDEX idx_rd_rskmit_risk (riskId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_risk_mitigations');

  // 5. CREATE TABLE rd_risk_review_histories (Requirements 32, 33)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_risk_review_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      riskId VARCHAR(191) NOT NULL,
      previousProbability INT NOT NULL,
      newProbability INT NOT NULL,
      previousImpact INT NOT NULL,
      newImpact INT NOT NULL,
      previousScore INT NOT NULL,
      newScore INT NOT NULL,
      previousLevel VARCHAR(50) NOT NULL,
      newLevel VARCHAR(50) NOT NULL,
      reviewNotes TEXT NULL,
      reviewedById VARCHAR(191) NULL,
      reviewedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rskhist_tenant (tenantId),
      INDEX idx_rd_rskhist_risk (riskId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_risk_review_histories');

  // 6. CREATE TABLE rd_issues (Requirement 34)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_issues (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      issueCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL',
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      severity VARCHAR(50) NOT NULL DEFAULT 'MODERATE',
      status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
      reportedById VARCHAR(191) NULL,
      assignedToId VARCHAR(191) NULL,
      reportedDate DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      targetResolutionDate DATETIME(3) NULL,
      resolvedDate DATETIME(3) NULL,
      closedDate DATETIME(3) NULL,
      rootCause TEXT NULL,
      resolutionNotes TEXT NULL,
      relatedTaskId VARCHAR(191) NULL,
      relatedRiskId VARCHAR(191) NULL,
      relatedExperimentId VARCHAR(191) NULL,
      relatedDeliverableId VARCHAR(191) NULL,
      relatedQualityCheckpointId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_iss_tenant (tenantId),
      INDEX idx_rd_iss_project (projectId),
      INDEX idx_rd_iss_status (status),
      INDEX idx_rd_iss_assigned (assignedToId),
      UNIQUE KEY uq_rd_iss_code (tenantId, issueCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_issues');

  // 7. CREATE TABLE rd_issue_comments (Requirement 34)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_issue_comments (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      issueId VARCHAR(191) NOT NULL,
      authorId VARCHAR(191) NULL,
      comment TEXT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_isscom_tenant (tenantId),
      INDEX idx_rd_isscom_issue (issueId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_issue_comments');

  // 8. CREATE TABLE rd_change_requests (Requirement 35)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_change_requests (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      changeCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'SCOPE_CHANGE',
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      requestedById VARCHAR(191) NULL,
      reviewerId VARCHAR(191) NULL,
      approverId VARCHAR(191) NULL,
      reasonForChange TEXT NULL,
      proposedModification TEXT NULL,
      expectedBenefits TEXT NULL,
      potentialRisks TEXT NULL,
      scopeImpactDescription TEXT NULL,
      scheduleImpactDays INT NOT NULL DEFAULT 0,
      budgetImpactAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      affectedRequirements TEXT NULL,
      affectedTasks TEXT NULL,
      affectedDeliverables TEXT NULL,
      reviewComments TEXT NULL,
      decisionReason TEXT NULL,
      submittedAt DATETIME(3) NULL,
      reviewedAt DATETIME(3) NULL,
      decidedAt DATETIME(3) NULL,
      implementedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_cr_tenant (tenantId),
      INDEX idx_rd_cr_project (projectId),
      INDEX idx_rd_cr_status (status),
      UNIQUE KEY uq_rd_cr_code (tenantId, changeCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_change_requests');

  // 9. CREATE TABLE rd_requirements (Requirement 36)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_requirements (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      requirementCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      requirementType VARCHAR(50) NOT NULL DEFAULT 'FUNCTIONAL',
      category VARCHAR(100) NOT NULL DEFAULT 'CORE',
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      source VARCHAR(255) NULL,
      ownerId VARCHAR(191) NULL,
      targetDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      verificationMethod VARCHAR(50) NOT NULL DEFAULT 'TEST',
      relatedScopeItemId VARCHAR(191) NULL,
      relatedTaskId VARCHAR(191) NULL,
      relatedDeliverableId VARCHAR(191) NULL,
      relatedChangeRequestId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_req_tenant (tenantId),
      INDEX idx_rd_req_project (projectId),
      INDEX idx_rd_req_status (status),
      UNIQUE KEY uq_rd_req_code (tenantId, requirementCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_requirements');

  // 10. CREATE TABLE rd_requirement_criteria (Requirement 36)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_requirement_criteria (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      requirementId VARCHAR(191) NOT NULL,
      criterionDescription TEXT NOT NULL,
      expectedResult TEXT NULL,
      actualResult TEXT NULL,
      verificationStatus VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      verifiedById VARCHAR(191) NULL,
      verifiedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_reqcrit_tenant (tenantId),
      INDEX idx_rd_reqcrit_req (requirementId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_requirement_criteria');

  // 11. CREATE TABLE rd_scope_baselines (Requirement 37)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_scope_baselines (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      baselineCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      inScopeItems TEXT NULL,
      outScopeItems TEXT NULL,
      assumptions TEXT NULL,
      constraints TEXT NULL,
      dependencies TEXT NULL,
      version INT NOT NULL DEFAULT 1,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      ownerId VARCHAR(191) NULL,
      approvedById VARCHAR(191) NULL,
      approvedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_scpbase_tenant (tenantId),
      INDEX idx_rd_scpbase_project (projectId),
      UNIQUE KEY uq_rd_scpbase_code (tenantId, baselineCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_scope_baselines');

  // 12. CREATE TABLE rd_scope_items (Requirement 37 - WBS)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_scope_items (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      scopeBaselineId VARCHAR(191) NULL,
      wbsCode VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      parentItemId VARCHAR(191) NULL,
      level INT NOT NULL DEFAULT 1,
      sortOrder INT NOT NULL DEFAULT 0,
      ownerId VARCHAR(191) NULL,
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
      progress INT NOT NULL DEFAULT 0,
      plannedStart DATETIME(3) NULL,
      plannedFinish DATETIME(3) NULL,
      relatedTaskId VARCHAR(191) NULL,
      relatedDeliverableId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_wbs_tenant (tenantId),
      INDEX idx_rd_wbs_project (projectId),
      INDEX idx_rd_wbs_parent (parentItemId),
      UNIQUE KEY uq_rd_wbs_code (projectId, wbsCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_scope_items');

  // 13. CREATE TABLE rd_deliverables (Requirement 38)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_deliverables (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      deliverableCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'RESEARCH_REPORT',
      ownerId VARCHAR(191) NULL,
      responsibleTeam VARCHAR(100) NULL,
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      dueDate DATETIME(3) NULL,
      plannedSubmissionDate DATETIME(3) NULL,
      actualSubmissionDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
      acceptanceCriteria TEXT NULL,
      relatedRequirementId VARCHAR(191) NULL,
      relatedScopeItemId VARCHAR(191) NULL,
      relatedTaskId VARCHAR(191) NULL,
      relatedMilestoneId VARCHAR(191) NULL,
      documentId VARCHAR(191) NULL,
      reviewerId VARCHAR(191) NULL,
      reviewComments TEXT NULL,
      acceptedAt DATETIME(3) NULL,
      rejectedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_del_tenant (tenantId),
      INDEX idx_rd_del_project (projectId),
      INDEX idx_rd_del_status (status),
      UNIQUE KEY uq_rd_del_code (tenantId, deliverableCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_deliverables');

  // 14. CREATE TABLE rd_quality_checkpoints (Requirement 39)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_quality_checkpoints (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      checkpointCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'BENCHMARK_VERIFICATION',
      relatedDeliverableId VARCHAR(191) NULL,
      relatedRequirementId VARCHAR(191) NULL,
      assignedReviewerId VARCHAR(191) NULL,
      targetDate DATETIME(3) NULL,
      reviewedAt DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
      reviewDecisionNotes TEXT NULL,
      signOffUserId VARCHAR(191) NULL,
      signedOffAt DATETIME(3) NULL,
      relatedIssueId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_qc_tenant (tenantId),
      INDEX idx_rd_qc_project (projectId),
      INDEX idx_rd_qc_status (status),
      UNIQUE KEY uq_rd_qc_code (tenantId, checkpointCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_quality_checkpoints');

  // 15. CREATE TABLE rd_quality_criteria (Requirement 39)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_quality_criteria (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      checkpointId VARCHAR(191) NOT NULL,
      criterionDescription TEXT NOT NULL,
      expectedStandard TEXT NULL,
      actualMeasurement TEXT NULL,
      result VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      reviewerNotes TEXT NULL,
      verifiedById VARCHAR(191) NULL,
      verifiedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_qccrit_tenant (tenantId),
      INDEX idx_rd_qccrit_cp (checkpointId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_quality_criteria');

  // 16. CREATE TABLE rd_project_budgets (Requirement 40)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_project_budgets (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      budgetCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      financialPeriod VARCHAR(50) NOT NULL DEFAULT 'FY2026',
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      totalProposedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      totalApprovedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      allocatedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      spentAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      budgetOwnerId VARCHAR(191) NULL,
      preparedById VARCHAR(191) NULL,
      approvedById VARCHAR(191) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      approvalDate DATETIME(3) NULL,
      budgetNotes TEXT NULL,
      version INT NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bgt_tenant (tenantId),
      INDEX idx_rd_bgt_project (projectId),
      INDEX idx_rd_bgt_status (status),
      UNIQUE KEY uq_rd_bgt_code (tenantId, budgetCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_project_budgets');

  // 17. CREATE TABLE rd_budget_allocations (Requirement 40)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_budget_allocations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      budgetId VARCHAR(191) NOT NULL,
      category VARCHAR(100) NOT NULL,
      plannedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      approvedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      spentAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      description TEXT NULL,
      responsibleOwnerId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bgtalloc_tenant (tenantId),
      INDEX idx_rd_bgtalloc_bgt (budgetId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_budget_allocations');

  // 18. CREATE TABLE rd_budget_revisions (Requirement 40)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_budget_revisions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      budgetId VARCHAR(191) NOT NULL,
      revisionNumber INT NOT NULL,
      previousProposed DECIMAL(14, 2) NOT NULL,
      newProposed DECIMAL(14, 2) NOT NULL,
      previousApproved DECIMAL(14, 2) NOT NULL,
      newApproved DECIMAL(14, 2) NOT NULL,
      changeReason TEXT NULL,
      relatedChangeRequestId VARCHAR(191) NULL,
      approvedById VARCHAR(191) NULL,
      approvedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bgtrev_tenant (tenantId),
      INDEX idx_rd_bgtrev_bgt (budgetId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_budget_revisions');

  console.log('[Migration MP09 Complete] All 18 Decision, Risk, Issue & Financial Management tables created and verified successfully!');
}

runMaster09Migration()
  .catch((e) => {
    console.error('[Migration MP09 Failed]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
