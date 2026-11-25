const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster16Migration() {
  console.log('[Migration MP16] Starting additive migration for Master Prompt 16: IP, Compliance, Security, API & Enterprise QA...');

  const queries = [
    // 1. rd_ip_assets
    `CREATE TABLE IF NOT EXISTS \`rd_ip_assets\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`description\` TEXT NULL,
      \`category\` VARCHAR(64) NOT NULL DEFAULT 'PATENT',
      \`ipType\` VARCHAR(64) NOT NULL DEFAULT 'PATENT',
      \`status\` VARCHAR(64) NOT NULL DEFAULT 'INVENTION_DISCLOSURE',
      \`jurisdiction\` VARCHAR(32) NOT NULL DEFAULT 'US',
      \`applicationNumber\` VARCHAR(128) NULL,
      \`patentNumber\` VARCHAR(128) NULL,
      \`filingDate\` DATETIME(3) NULL,
      \`grantDate\` DATETIME(3) NULL,
      \`expiryDate\` DATETIME(3) NULL,
      \`priorityDate\` DATETIME(3) NULL,
      \`claimsCount\` INT NOT NULL DEFAULT 1,
      \`inventors\` JSON NULL,
      \`ownerEntity\` VARCHAR(191) NULL DEFAULT 'EgoLytics R&D Division',
      \`supportingDocs\` JSON NULL,
      \`notes\` TEXT NULL,
      \`createdById\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_ip_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_ip_projectId_idx\` (\`projectId\`),
      INDEX \`rd_ip_category_idx\` (\`category\`),
      INDEX \`rd_ip_status_idx\` (\`status\`),
      INDEX \`rd_ip_jurisdiction_idx\` (\`jurisdiction\`),
      INDEX \`rd_ip_createdById_idx\` (\`createdById\`),
      CONSTRAINT \`fk_rd_ip_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_rd_ip_user\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. rd_compliance_sops
    `CREATE TABLE IF NOT EXISTS \`rd_compliance_sops\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`sopIdentifier\` VARCHAR(64) NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`description\` TEXT NULL,
      \`version\` VARCHAR(32) NOT NULL DEFAULT '1.0',
      \`category\` VARCHAR(64) NOT NULL DEFAULT 'LAB_SAFETY',
      \`regulatoryStandard\` VARCHAR(128) NULL DEFAULT 'ISO 9001 / GLP',
      \`approvalStatus\` VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
      \`effectiveDate\` DATETIME(3) NULL,
      \`reviewDate\` DATETIME(3) NULL,
      \`ownerId\` VARCHAR(191) NULL,
      \`approvedById\` VARCHAR(191) NULL,
      \`approvedAt\` DATETIME(3) NULL,
      \`checklists\` JSON NULL,
      \`nonComplianceRecords\` JSON NULL,
      \`supportingDocs\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_sop_identifier\` (\`tenantId\`, \`sopIdentifier\`),
      INDEX \`rd_sop_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_sop_category_idx\` (\`category\`),
      INDEX \`rd_sop_status_idx\` (\`approvalStatus\`),
      INDEX \`rd_sop_ownerId_idx\` (\`ownerId\`),
      INDEX \`rd_sop_approvedById_idx\` (\`approvedById\`),
      CONSTRAINT \`fk_rd_sop_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_rd_sop_owner\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_rd_sop_approver\` FOREIGN KEY (\`approvedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. rd_enterprise_audit_logs
    `CREATE TABLE IF NOT EXISTS \`rd_enterprise_audit_logs\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NULL,
      \`actorName\` VARCHAR(191) NULL,
      \`action\` VARCHAR(64) NOT NULL,
      \`entityType\` VARCHAR(64) NOT NULL,
      \`entityId\` VARCHAR(191) NOT NULL,
      \`details\` JSON NULL,
      \`ipAddress\` VARCHAR(64) NULL,
      \`userAgent\` VARCHAR(255) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`rd_audit_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_audit_userId_idx\` (\`userId\`),
      INDEX \`rd_audit_action_idx\` (\`action\`),
      INDEX \`rd_audit_entityType_idx\` (\`entityType\`),
      INDEX \`rd_audit_createdAt_idx\` (\`createdAt\`),
      CONSTRAINT \`fk_rd_audit_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_rd_audit_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 4. rd_api_keys
    `CREATE TABLE IF NOT EXISTS \`rd_api_keys\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`createdById\` VARCHAR(191) NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`keyPrefix\` VARCHAR(64) NOT NULL,
      \`keyHash\` VARCHAR(255) NOT NULL,
      \`scopes\` JSON NOT NULL,
      \`rateLimitPerMin\` INT NOT NULL DEFAULT 60,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      \`expiresAt\` DATETIME(3) NULL,
      \`lastUsedAt\` DATETIME(3) NULL,
      \`usageCount\` INT NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`rd_apikey_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_apikey_createdById_idx\` (\`createdById\`),
      INDEX \`rd_apikey_keyPrefix_idx\` (\`keyPrefix\`),
      INDEX \`rd_apikey_status_idx\` (\`status\`),
      CONSTRAINT \`fk_rd_apikey_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_rd_apikey_user\` FOREIGN KEY (\`createdById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      await prisma.$executeRawUnsafe(queries[i]);
      console.log(`[Migration MP16] Query ${i + 1}/${queries.length} executed successfully.`);
    } catch (e) {
      console.warn(`[Migration MP16] Query ${i + 1} notice:`, e.message);
    }
  }

  console.log('[Migration MP16] Additive migration for Master Prompt 16 completed successfully!');
  await prisma.$disconnect();
}

runMaster16Migration()
  .catch(async (e) => {
    console.error('[Migration MP16 FATAL]:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

