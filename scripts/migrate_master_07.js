const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster07Migration() {
  console.log('[Migration MP07] Starting additive migration for EgoLytics Master Prompt 07...');

  // 1. CREATE TABLE rd_research_objectives
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_objectives (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      researchQuestion TEXT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'APPLIED_RESEARCH',
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      ownerId VARCHAR(191) NULL,
      startDate DATETIME(3) NULL,
      targetDate DATETIME(3) NULL,
      completionDate DATETIME(3) NULL,
      successCriteria TEXT NULL,
      progress INT NOT NULL DEFAULT 0,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_obj_tenant (tenantId),
      INDEX idx_rd_obj_project (projectId),
      INDEX idx_rd_obj_status (status),
      INDEX idx_rd_obj_owner (ownerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_research_objectives');

  // 2. CREATE TABLE rd_hypotheses
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_hypotheses (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      objectiveId VARCHAR(191) NULL,
      hypothesisCode VARCHAR(64) NULL,
      title VARCHAR(255) NOT NULL,
      statement TEXT NOT NULL,
      description TEXT NULL,
      scientificRationale TEXT NULL,
      expectedOutcome TEXT NULL,
      hypothesisType VARCHAR(64) NOT NULL DEFAULT 'ALTERNATIVE_HYPOTHESIS',
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED',
      evaluationDecision VARCHAR(32) NULL,
      evaluationSummary TEXT NULL,
      supportingEvidence TEXT NULL,
      contradictoryEvidence TEXT NULL,
      conclusion TEXT NULL,
      evaluatedById VARCHAR(191) NULL,
      evaluationDate DATETIME(3) NULL,
      ownerId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_hyp_tenant (tenantId),
      INDEX idx_rd_hyp_project (projectId),
      INDEX idx_rd_hyp_obj (objectiveId),
      INDEX idx_rd_hyp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_hypotheses');

  // 3. CREATE TABLE rd_variables
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_variables (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NULL,
      name VARCHAR(191) NOT NULL,
      description TEXT NULL,
      variableType VARCHAR(32) NOT NULL DEFAULT 'INDEPENDENT',
      dataType VARCHAR(32) NOT NULL DEFAULT 'DECIMAL',
      unit VARCHAR(64) NULL,
      measurementMethod VARCHAR(255) NULL,
      expectedValue VARCHAR(191) NULL,
      \`minValue\` DOUBLE NULL,
      \`maxValue\` DOUBLE NULL,
      allowedValues JSON NULL,
      isRequired BOOLEAN NOT NULL DEFAULT true,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_var_tenant (tenantId),
      INDEX idx_rd_var_project (projectId),
      INDEX idx_rd_var_type (variableType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_variables');

  // 4. CREATE TABLE rd_experiment_protocols
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_protocols (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NULL,
      protocolCode VARCHAR(64) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      purpose TEXT NULL,
      methodology TEXT NULL,
      requiredMaterials TEXT NULL,
      equipmentDescription TEXT NULL,
      safetyInstructions TEXT NULL,
      expectedObservations TEXT NULL,
      expectedResults TEXT NULL,
      estimatedDurationMinutes INT NULL,
      version INT NOT NULL DEFAULT 1,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      isTemplate BOOLEAN NOT NULL DEFAULT false,
      ownerId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_proto_tenant (tenantId),
      INDEX idx_rd_proto_project (projectId),
      INDEX idx_rd_proto_status (status),
      INDEX idx_rd_proto_template (isTemplate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_protocols');

  // 5. CREATE TABLE rd_protocol_steps
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_protocol_steps (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      protocolId VARCHAR(191) NOT NULL,
      stepNumber INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      instructions TEXT NOT NULL,
      expectedAction TEXT NULL,
      expectedObservation TEXT NULL,
      durationMinutes INT NULL,
      isRequired BOOLEAN NOT NULL DEFAULT true,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_pstep_tenant (tenantId),
      INDEX idx_rd_pstep_proto (protocolId),
      INDEX idx_rd_pstep_num (stepNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_protocol_steps');

  // 6. CREATE TABLE rd_experiments
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiments (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      objectiveId VARCHAR(191) NULL,
      hypothesisId VARCHAR(191) NULL,
      protocolId VARCHAR(191) NULL,
      experimentCode VARCHAR(64) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      purpose TEXT NULL,
      experimentType VARCHAR(64) NOT NULL DEFAULT 'LABORATORY',
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
      plannedStartDate DATETIME(3) NULL,
      plannedEndDate DATETIME(3) NULL,
      actualStartDate DATETIME(3) NULL,
      actualEndDate DATETIME(3) NULL,
      ownerId VARCHAR(191) NULL,
      assignedResearcherIds JSON NULL,
      experimentalConditions JSON NULL,
      expectedOutcomes TEXT NULL,
      successCriteria TEXT NULL,
      taskId VARCHAR(191) NULL,
      milestoneId VARCHAR(191) NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_exp_tenant (tenantId),
      INDEX idx_rd_exp_project (projectId),
      INDEX idx_rd_exp_obj (objectiveId),
      INDEX idx_rd_exp_hyp (hypothesisId),
      INDEX idx_rd_exp_proto (protocolId),
      INDEX idx_rd_exp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiments');

  // 7. CREATE TABLE rd_experiment_runs
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_runs (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      experimentId VARCHAR(191) NOT NULL,
      runNumber INT NOT NULL,
      runCode VARCHAR(64) NULL,
      title VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
      protocolVersion INT NOT NULL DEFAULT 1,
      protocolSnapshot JSON NULL,
      conditionsSnapshot JSON NULL,
      operatorId VARCHAR(191) NULL,
      startedAt DATETIME(3) NULL,
      completedAt DATETIME(3) NULL,
      notes TEXT NULL,
      createdById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_run_tenant (tenantId),
      INDEX idx_rd_run_exp (experimentId),
      INDEX idx_rd_run_status (status),
      INDEX idx_rd_run_num (runNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_runs');

  // 8. CREATE TABLE rd_experiment_run_steps
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_run_steps (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      runId VARCHAR(191) NOT NULL,
      stepNumber INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      isCompleted BOOLEAN NOT NULL DEFAULT false,
      completedAt DATETIME(3) NULL,
      completedById VARCHAR(191) NULL,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_runstep_tenant (tenantId),
      INDEX idx_rd_runstep_run (runId),
      INDEX idx_rd_runstep_num (stepNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_run_steps');

  // 9. CREATE TABLE rd_experiment_observations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_observations (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      runId VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      observationType VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
      observedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      recordedById VARCHAR(191) NULL,
      stepNumber INT NULL,
      variableId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_obs_tenant (tenantId),
      INDEX idx_rd_obs_run (runId),
      INDEX idx_rd_obs_type (observationType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_observations');

  // 10. CREATE TABLE rd_experiment_measurements
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_measurements (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      runId VARCHAR(191) NOT NULL,
      variableId VARCHAR(191) NULL,
      variableNameSnapshot VARCHAR(191) NOT NULL,
      variableTypeSnapshot VARCHAR(32) NOT NULL DEFAULT 'DEPENDENT',
      recordedValue VARCHAR(255) NOT NULL,
      numericValue DOUBLE NULL,
      dataType VARCHAR(32) NOT NULL DEFAULT 'DECIMAL',
      unitSnapshot VARCHAR(64) NULL,
      measurementTime DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      measurementMethod VARCHAR(255) NULL,
      recordedById VARCHAR(191) NULL,
      stepNumber INT NULL,
      isAnomaly BOOLEAN NOT NULL DEFAULT false,
      notes TEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_meas_tenant (tenantId),
      INDEX idx_rd_meas_run (runId),
      INDEX idx_rd_meas_var (variableId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_measurements');

  // 11. CREATE TABLE rd_experiment_results
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_experiment_results (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      experimentId VARCHAR(191) NOT NULL,
      runId VARCHAR(191) NULL,
      summary TEXT NOT NULL,
      keyFindings TEXT NULL,
      expectedVsActual TEXT NULL,
      criteriaEvaluation TEXT NULL,
      deviations TEXT NULL,
      researcherConclusion TEXT NULL,
      isSuccessCriteriaMet BOOLEAN NOT NULL DEFAULT false,
      evaluatedById VARCHAR(191) NULL,
      evaluatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_res_tenant (tenantId),
      INDEX idx_rd_res_exp (experimentId),
      INDEX idx_rd_res_run (runId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_experiment_results');

  // 12. CREATE TABLE rd_research_evidences
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_evidences (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      objectiveId VARCHAR(191) NULL,
      hypothesisId VARCHAR(191) NULL,
      experimentId VARCHAR(191) NULL,
      runId VARCHAR(191) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      evidenceType VARCHAR(64) NOT NULL DEFAULT 'EXPERIMENTAL_DATA',
      source VARCHAR(255) NULL,
      fileUrl VARCHAR(512) NULL,
      fileType VARCHAR(64) NULL,
      fileSize INT NULL,
      recordedById VARCHAR(191) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_evi_tenant (tenantId),
      INDEX idx_rd_evi_project (projectId),
      INDEX idx_rd_evi_obj (objectiveId),
      INDEX idx_rd_evi_hyp (hypothesisId),
      INDEX idx_rd_evi_exp (experimentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_research_evidences');

  // 13. CREATE TABLE rd_research_outcomes
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_outcomes (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      objectiveId VARCHAR(191) NULL,
      hypothesisId VARCHAR(191) NULL,
      experimentId VARCHAR(191) NULL,
      title VARCHAR(255) NOT NULL,
      summary TEXT NOT NULL,
      outcomeCategory VARCHAR(64) NOT NULL DEFAULT 'SCIENTIFIC_DISCOVERY',
      supportingEvidenceSummary TEXT NULL,
      outcomeDate DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      recordedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_out_tenant (tenantId),
      INDEX idx_rd_out_project (projectId),
      INDEX idx_rd_out_obj (objectiveId),
      INDEX idx_rd_out_hyp (hypothesisId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_research_outcomes');

  // 14. CREATE TABLE rd_research_notes
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_notes (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      entityType VARCHAR(64) NOT NULL,
      entityId VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      authorId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_note_tenant (tenantId),
      INDEX idx_rd_note_project (projectId),
      INDEX idx_rd_note_target (entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created] rd_research_notes');

  console.log('[Migration MP07] All 14 Research & Experiment Management tables verified successfully.');
}

runMaster07Migration()
  .catch((err) => {
    console.error('[Migration MP07] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
