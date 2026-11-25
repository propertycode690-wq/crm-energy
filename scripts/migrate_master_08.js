const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function runMaster08Migration() {
  console.log('[Migration MP08] Starting additive migration for EgoLytics Master Prompt 08 (ELN & Research Documentation)...');

  // 1. CREATE TABLE rd_notebooks
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_notebooks (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      notebookCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'LABORATORY',
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      tags TEXT NULL,
      ownerId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_nb_tenant (tenantId),
      INDEX idx_rd_nb_project (projectId),
      INDEX idx_rd_nb_owner (ownerId),
      INDEX idx_rd_nb_status (status),
      UNIQUE KEY uq_rd_nb_code (tenantId, notebookCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_notebooks');

  // 2. CREATE TABLE rd_notebook_contributors
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_notebook_contributors (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      notebookId VARCHAR(191) NOT NULL,
      userId VARCHAR(191) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'CONTRIBUTOR',
      addedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_nbc_tenant (tenantId),
      INDEX idx_rd_nbc_notebook (notebookId),
      INDEX idx_rd_nbc_user (userId),
      UNIQUE KEY uq_rd_nbc_user (notebookId, userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_notebook_contributors');

  // 3. ADD EXTENSION COLUMNS TO rd_research_notes
  const existingColumns = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rd_research_notes';
  `);
  const colNames = existingColumns.map(c => c.COLUMN_NAME);

  const addColumnIfNotExists = async (colName, colDef) => {
    if (!colNames.includes(colName)) {
      console.log(`[Extending rd_research_notes] Adding column: ${colName}`);
      await prisma.$executeRawUnsafe(`ALTER TABLE rd_research_notes ADD COLUMN ${colName} ${colDef};`);
    }
  };

  await addColumnIfNotExists('notebookId', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('entryNumber', 'VARCHAR(50) NULL');
  await addColumnIfNotExists('category', "VARCHAR(100) NOT NULL DEFAULT 'RESEARCH_OBSERVATION'");
  await addColumnIfNotExists('status', "VARCHAR(50) NOT NULL DEFAULT 'DRAFT'");
  await addColumnIfNotExists('researchDate', 'DATETIME(3) NULL');
  await addColumnIfNotExists('tags', 'TEXT NULL');
  await addColumnIfNotExists('objectiveId', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('hypothesisId', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('experimentId', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('runId', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('finalizedAt', 'DATETIME(3) NULL');
  await addColumnIfNotExists('finalizedById', 'VARCHAR(191) NULL');
  await addColumnIfNotExists('version', 'INT NOT NULL DEFAULT 1');
  console.log('[Table Extended] rd_research_notes verified with ELN columns.');

  // 4. CREATE TABLE rd_research_note_versions
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_note_versions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      noteId VARCHAR(191) NOT NULL,
      versionNumber INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      changeSummary VARCHAR(500) NULL,
      savedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_rnv_tenant (tenantId),
      INDEX idx_rd_rnv_note (noteId),
      UNIQUE KEY uq_rd_rnv_version (noteId, versionNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_research_note_versions');

  // 5. CREATE TABLE rd_research_documents
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_research_documents (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      notebookId VARCHAR(191) NULL,
      noteId VARCHAR(191) NULL,
      experimentId VARCHAR(191) NULL,
      runId VARCHAR(191) NULL,
      hypothesisId VARCHAR(191) NULL,
      objectiveId VARCHAR(191) NULL,
      documentCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'RESEARCH_REPORT',
      tags TEXT NULL,
      originalFilename VARCHAR(255) NOT NULL,
      fileExtension VARCHAR(50) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      fileSize INT NOT NULL DEFAULT 0,
      storagePath VARCHAR(500) NOT NULL,
      fileChecksum VARCHAR(128) NULL,
      currentVersion INT NOT NULL DEFAULT 1,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      uploadedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_doc_tenant (tenantId),
      INDEX idx_rd_doc_project (projectId),
      INDEX idx_rd_doc_notebook (notebookId),
      INDEX idx_rd_doc_category (category),
      INDEX idx_rd_doc_uploader (uploadedById),
      INDEX idx_rd_doc_status (status),
      UNIQUE KEY uq_rd_doc_code (tenantId, documentCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_research_documents');

  // 6. CREATE TABLE rd_document_versions
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_document_versions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      documentId VARCHAR(191) NOT NULL,
      versionNumber INT NOT NULL,
      versionLabel VARCHAR(50) NOT NULL DEFAULT 'v1.0',
      originalFilename VARCHAR(255) NOT NULL,
      fileExtension VARCHAR(50) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      fileSize INT NOT NULL DEFAULT 0,
      storagePath VARCHAR(500) NOT NULL,
      fileChecksum VARCHAR(128) NULL,
      revisionSummary VARCHAR(500) NULL,
      isCurrent BOOLEAN NOT NULL DEFAULT FALSE,
      uploadedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_docver_tenant (tenantId),
      INDEX idx_rd_docver_doc (documentId),
      INDEX idx_rd_docver_current (isCurrent),
      UNIQUE KEY uq_rd_docver_num (documentId, versionNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_document_versions');

  // 7. CREATE TABLE rd_document_links
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_document_links (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      documentId VARCHAR(191) NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId VARCHAR(191) NOT NULL,
      linkType VARCHAR(50) NOT NULL DEFAULT 'SUPPORTING_DOCUMENT',
      linkedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_doclnk_tenant (tenantId),
      INDEX idx_rd_doclnk_doc (documentId),
      INDEX idx_rd_doclnk_entity (entityType, entityId),
      UNIQUE KEY uq_rd_doclnk (documentId, entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_document_links');

  // 8. CREATE TABLE rd_datasets
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_datasets (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      projectId VARCHAR(191) NOT NULL,
      datasetCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'EXPERIMENTAL_DATASET',
      dataFormat VARCHAR(50) NOT NULL DEFAULT 'CSV',
      dataSource VARCHAR(255) NULL,
      collectionDate DATETIME(3) NULL,
      notebookId VARCHAR(191) NULL,
      noteId VARCHAR(191) NULL,
      experimentId VARCHAR(191) NULL,
      runId VARCHAR(191) NULL,
      tags TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      ownerId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_ds_tenant (tenantId),
      INDEX idx_rd_ds_project (projectId),
      INDEX idx_rd_ds_category (category),
      INDEX idx_rd_ds_status (status),
      UNIQUE KEY uq_rd_ds_code (tenantId, datasetCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_datasets');

  // 9. CREATE TABLE rd_dataset_files
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_dataset_files (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      datasetId VARCHAR(191) NOT NULL,
      fileName VARCHAR(255) NOT NULL,
      originalFilename VARCHAR(255) NOT NULL,
      fileExtension VARCHAR(50) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      fileSize INT NOT NULL DEFAULT 0,
      storagePath VARCHAR(500) NOT NULL,
      fileChecksum VARCHAR(128) NULL,
      rowCount INT NULL,
      columnCount INT NULL,
      schemaDescription TEXT NULL,
      uploadedById VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_rd_dsf_tenant (tenantId),
      INDEX idx_rd_dsf_dataset (datasetId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_dataset_files');

  // 10. CREATE TABLE rd_knowledge_records
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rd_knowledge_records (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      tenantId VARCHAR(191) NOT NULL,
      knowledgeCode VARCHAR(191) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      content LONGTEXT NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'RESEARCH_FINDING',
      tags TEXT NULL,
      sourceProjectId VARCHAR(191) NULL,
      sourceNotebookId VARCHAR(191) NULL,
      sourceExperimentId VARCHAR(191) NULL,
      sourceNoteId VARCHAR(191) NULL,
      sourceEvidenceId VARCHAR(191) NULL,
      sourceOutcomeId VARCHAR(191) NULL,
      accessLevel VARCHAR(50) NOT NULL DEFAULT 'TENANT_WIDE',
      status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
      authorId VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_rd_kb_tenant (tenantId),
      INDEX idx_rd_kb_category (category),
      INDEX idx_rd_kb_source_proj (sourceProjectId),
      INDEX idx_rd_kb_status (status),
      UNIQUE KEY uq_rd_kb_code (tenantId, knowledgeCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[Table Created/Verified] rd_knowledge_records');

  console.log('[Migration MP08 Complete] All 10 ELN & Research Documentation entities created and verified!');
}

runMaster08Migration()
  .catch((e) => {
    console.error('[Migration MP08 Failed]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
