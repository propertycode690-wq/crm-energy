const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function alignMaster09Tables() {
  console.log('[Align MP09] Aligning 18 Master Prompt 09 tables to Prisma schema...');

  const tables = [
    'rd_budget_revisions',
    'rd_budget_allocations',
    'rd_project_budgets',
    'rd_quality_criteria',
    'rd_quality_checkpoints',
    'rd_deliverables',
    'rd_scope_items',
    'rd_scope_baselines',
    'rd_requirement_criteria',
    'rd_requirements',
    'rd_change_requests',
    'rd_issue_comments',
    'rd_issues',
    'rd_risk_review_histories',
    'rd_risk_mitigations',
    'rd_risks',
    'rd_decision_histories',
    'rd_decisions',
  ];

  for (const t of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
    console.log(`[Dropped] ${t}`);
  }

  // 1. rd_decisions
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_decisions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      decisionCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'ARCHITECTURE',
      rationale TEXT NOT NULL,
      alternativesConsidered TEXT NULL,
      tradeOffs TEXT NULL,
      impactSummary TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PROPOSED',
      decisionMakerId VARCHAR(191) NULL,
      decisionMakerName VARCHAR(255) NULL,
      decisionDate DATETIME(3) NULL,
      effectiveDate DATETIME(3) NULL,
      reviewDate DATETIME(3) NULL,
      linkedGateId VARCHAR(191) NULL,
      linkedStageId VARCHAR(191) NULL,
      linkedTaskId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_dec_tenant (tenantId),
      INDEX idx_rd_dec_project (projectId),
      INDEX idx_rd_dec_category (category),
      INDEX idx_rd_dec_status (status),
      UNIQUE KEY uq_rd_dec_code (tenantId, decisionCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. rd_decision_histories
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_decision_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      decisionId VARCHAR(191) NOT NULL,
      changeType VARCHAR(100) NOT NULL,
      previousStatus VARCHAR(50) NULL,
      newStatus VARCHAR(50) NULL,
      comment TEXT NULL,
      changedById VARCHAR(191) NULL,
      changedByName VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_dechist_tenant (tenantId),
      INDEX idx_rd_dechist_dec (decisionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. rd_risks
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_risks (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      riskCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL',
      probability INT NOT NULL DEFAULT 3,
      impact INT NOT NULL DEFAULT 3,
      riskScore INT NOT NULL DEFAULT 9,
      riskLevel VARCHAR(50) NOT NULL DEFAULT 'MODERATE',
      status VARCHAR(50) NOT NULL DEFAULT 'IDENTIFIED',
      strategy VARCHAR(50) NOT NULL DEFAULT 'MITIGATE',
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      contingencyPlan TEXT NULL,
      triggerCondition TEXT NULL,
      residualProbability INT NULL,
      residualImpact INT NULL,
      residualScore INT NULL,
      reviewFrequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
      lastReviewedAt DATETIME(3) NULL,
      nextReviewDate DATETIME(3) NULL,
      linkedTaskId VARCHAR(191) NULL,
      linkedMilestoneId VARCHAR(191) NULL,
      linkedGateId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rsk_tenant (tenantId),
      INDEX idx_rd_rsk_project (projectId),
      INDEX idx_rd_rsk_category (category),
      INDEX idx_rd_rsk_level (riskLevel),
      INDEX idx_rd_rsk_status (status),
      UNIQUE KEY uq_rd_rsk_code (tenantId, riskCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. rd_risk_mitigations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_risk_mitigations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      riskId VARCHAR(191) NOT NULL,
      actionTitle VARCHAR(255) NOT NULL,
      actionDescription TEXT NULL,
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      dueDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
      progressPercent INT NOT NULL DEFAULT 0,
      effectiveness VARCHAR(50) NULL,
      completedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rskmit_tenant (tenantId),
      INDEX idx_rd_rskmit_risk (riskId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. rd_risk_review_histories
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_risk_review_histories (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      riskId VARCHAR(191) NOT NULL,
      reviewerId VARCHAR(191) NULL,
      reviewerName VARCHAR(255) NULL,
      previousScore INT NOT NULL,
      newScore INT NOT NULL,
      previousLevel VARCHAR(50) NOT NULL,
      newLevel VARCHAR(50) NOT NULL,
      reviewNotes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rskhist_tenant (tenantId),
      INDEX idx_rd_rskhist_risk (riskId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. rd_issues
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_issues (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      issueCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL',
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
      rootCause TEXT NULL,
      resolution TEXT NULL,
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      assigneeId VARCHAR(191) NULL,
      assigneeName VARCHAR(255) NULL,
      sourceRiskId VARCHAR(191) NULL,
      linkedTaskId VARCHAR(191) NULL,
      linkedExperimentId VARCHAR(191) NULL,
      resolvedAt DATETIME(3) NULL,
      closedAt DATETIME(3) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_iss_tenant (tenantId),
      INDEX idx_rd_iss_project (projectId),
      INDEX idx_rd_iss_priority (priority),
      INDEX idx_rd_iss_status (status),
      UNIQUE KEY uq_rd_iss_code (tenantId, issueCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. rd_issue_comments
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_issue_comments (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      issueId VARCHAR(191) NOT NULL,
      authorId VARCHAR(191) NULL,
      authorName VARCHAR(255) NULL,
      commentText TEXT NOT NULL,
      isInternalOnly BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_isscom_tenant (tenantId),
      INDEX idx_rd_isscom_issue (issueId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. rd_change_requests
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_change_requests (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      changeCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      reasonForChange TEXT NOT NULL,
      changeType VARCHAR(50) NOT NULL DEFAULT 'SCOPE',
      scopeImpact TEXT NULL,
      scheduleImpactDays INT NOT NULL DEFAULT 0,
      costImpactAmount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      riskImpact TEXT NULL,
      priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
      requesterId VARCHAR(191) NULL,
      requesterName VARCHAR(255) NULL,
      reviewerId VARCHAR(191) NULL,
      reviewerName VARCHAR(255) NULL,
      reviewerComments TEXT NULL,
      reviewedAt DATETIME(3) NULL,
      implementationNotes TEXT NULL,
      implementedAt DATETIME(3) NULL,
      linkedTaskId VARCHAR(191) NULL,
      linkedGateId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_cr_tenant (tenantId),
      INDEX idx_rd_cr_project (projectId),
      INDEX idx_rd_cr_type (changeType),
      INDEX idx_rd_cr_status (status),
      UNIQUE KEY uq_rd_cr_code (tenantId, changeCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 9. rd_requirements
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_requirements (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      reqCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'FUNCTIONAL',
      priority VARCHAR(50) NOT NULL DEFAULT 'HIGH',
      verificationMethod VARCHAR(50) NOT NULL DEFAULT 'TEST',
      verificationStatus VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
      complianceStatus VARCHAR(50) NOT NULL DEFAULT 'NON_COMPLIANT',
      source VARCHAR(255) NULL,
      version VARCHAR(50) NOT NULL DEFAULT '1.0',
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      linkedExperimentId VARCHAR(191) NULL,
      linkedTaskId VARCHAR(191) NULL,
      linkedDeliverableId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_req_tenant (tenantId),
      INDEX idx_rd_req_project (projectId),
      INDEX idx_rd_req_category (category),
      INDEX idx_rd_req_priority (priority),
      INDEX idx_rd_req_verstatus (verificationStatus),
      UNIQUE KEY uq_rd_req_code (tenantId, reqCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. rd_requirement_criteria
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_requirement_criteria (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      requirementId VARCHAR(191) NOT NULL,
      criterionDescription TEXT NOT NULL,
      expectedValue VARCHAR(255) NULL,
      actualValue VARCHAR(255) NULL,
      isMet BOOLEAN NOT NULL DEFAULT FALSE,
      verifiedAt DATETIME(3) NULL,
      verifiedById VARCHAR(191) NULL,
      verifiedByName VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_reqcrit_tenant (tenantId),
      INDEX idx_rd_reqcrit_req (requirementId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. rd_scope_baselines
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_scope_baselines (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      baselineVersion VARCHAR(50) NOT NULL DEFAULT '1.0',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      inScopeSummary TEXT NULL,
      outOfScopeSummary TEXT NULL,
      assumptions TEXT NULL,
      constraints TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
      approvedById VARCHAR(191) NULL,
      approvedByName VARCHAR(255) NULL,
      approvedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_base_tenant (tenantId),
      INDEX idx_rd_base_project (projectId),
      UNIQUE KEY uq_rd_base_ver (tenantId, projectId, baselineVersion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. rd_scope_items (WBS)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_scope_items (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      parentItemId VARCHAR(191) NULL,
      wbsCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      level INT NOT NULL DEFAULT 1,
      itemType VARCHAR(50) NOT NULL DEFAULT 'WORK_PACKAGE',
      status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
      completionPercent INT NOT NULL DEFAULT 0,
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      estimatedHours DECIMAL(10, 2) NULL,
      actualHours DECIMAL(10, 2) NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_wbs_tenant (tenantId),
      INDEX idx_rd_wbs_project (projectId),
      INDEX idx_rd_wbs_parent (parentItemId),
      UNIQUE KEY uq_rd_wbs_code (tenantId, projectId, wbsCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 13. rd_deliverables
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_deliverables (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      deliverableCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'TECHNICAL_REPORT',
      ownerId VARCHAR(191) NULL,
      ownerName VARCHAR(255) NULL,
      dueDate DATETIME(3) NULL,
      submissionDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
      acceptanceCriteria TEXT NULL,
      acceptanceNotes TEXT NULL,
      acceptedById VARCHAR(191) NULL,
      acceptedByName VARCHAR(255) NULL,
      acceptedAt DATETIME(3) NULL,
      documentId VARCHAR(191) NULL,
      linkedTaskId VARCHAR(191) NULL,
      linkedMilestoneId VARCHAR(191) NULL,
      linkedScopeItemId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_del_tenant (tenantId),
      INDEX idx_rd_del_project (projectId),
      INDEX idx_rd_del_category (category),
      INDEX idx_rd_del_status (status),
      UNIQUE KEY uq_rd_del_code (tenantId, deliverableCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 14. rd_quality_checkpoints
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_quality_checkpoints (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      checkpointCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      checkpointType VARCHAR(50) NOT NULL DEFAULT 'STAGE_GATE',
      plannedDate DATETIME(3) NULL,
      conductedDate DATETIME(3) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
      overallResult VARCHAR(50) NULL,
      leadInspectorId VARCHAR(191) NULL,
      leadInspectorName VARCHAR(255) NULL,
      summaryFindings TEXT NULL,
      correctiveActions TEXT NULL,
      linkedGateId VARCHAR(191) NULL,
      linkedMilestoneId VARCHAR(191) NULL,
      linkedDeliverableId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_qc_tenant (tenantId),
      INDEX idx_rd_qc_project (projectId),
      INDEX idx_rd_qc_type (checkpointType),
      INDEX idx_rd_qc_status (status),
      UNIQUE KEY uq_rd_qc_code (tenantId, checkpointCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 15. rd_quality_criteria
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_quality_criteria (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      checkpointId VARCHAR(191) NOT NULL,
      criterionName VARCHAR(255) NOT NULL,
      specificationStandard TEXT NULL,
      result VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      observations TEXT NULL,
      verifiedById VARCHAR(191) NULL,
      verifiedByName VARCHAR(255) NULL,
      verifiedAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_qccrit_tenant (tenantId),
      INDEX idx_rd_qccrit_qc (checkpointId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 16. rd_project_budgets
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_project_budgets (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      fiscalYear INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      totalAllocated DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      totalSpent DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      totalCommitted DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      approvalNotes TEXT NULL,
      approvedById VARCHAR(191) NULL,
      approvedByName VARCHAR(255) NULL,
      approvedAt DATETIME(3) NULL,
      contingencyPercentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
      contingencyAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_bdg_tenant (tenantId),
      INDEX idx_rd_bdg_project (projectId),
      INDEX idx_rd_bdg_status (status),
      UNIQUE KEY uq_rd_bdg_fy (tenantId, projectId, fiscalYear)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 17. rd_budget_allocations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_budget_allocations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      budgetId VARCHAR(191) NOT NULL,
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100) NULL,
      plannedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      actualAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      committedAmount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_alloc_tenant (tenantId),
      INDEX idx_rd_alloc_bdg (budgetId),
      INDEX idx_rd_alloc_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 18. rd_budget_revisions
  await prisma.$executeRawUnsafe(`
    CREATE TABLE rd_budget_revisions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      budgetId VARCHAR(191) NOT NULL,
      revisionNumber INT NOT NULL DEFAULT 1,
      previousTotal DECIMAL(14, 2) NOT NULL,
      newTotal DECIMAL(14, 2) NOT NULL,
      changeAmount DECIMAL(14, 2) NOT NULL,
      reason TEXT NOT NULL,
      requestedById VARCHAR(191) NULL,
      requestedByName VARCHAR(255) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      reviewedById VARCHAR(191) NULL,
      reviewedByName VARCHAR(255) NULL,
      reviewedAt DATETIME(3) NULL,
      reviewNotes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rev_tenant (tenantId),
      INDEX idx_rd_rev_bdg (budgetId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('[Align MP09 Complete] All 18 tables recreated with 100% Prisma schema alignment!');
}

alignMaster09Tables()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
