const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster13Migration() {
  console.log('[Migration MP13] Starting additive migration for Master Prompt 13: Maplytics GIS Territory Management...');

  const queries = [
    // 1. gis_regions
    `CREATE TABLE IF NOT EXISTS \`gis_regions\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`type\` VARCHAR(64) NOT NULL DEFAULT 'METRO',
      \`parentRegionId\` VARCHAR(191) NULL,
      \`boundaryGeoJson\` LONGTEXT NULL,
      \`centerLat\` DOUBLE NULL,
      \`centerLng\` DOUBLE NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_gis_region_code\` (\`tenantId\`, \`code\`),
      INDEX \`gis_regions_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_regions_type_idx\` (\`type\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. gis_territories
    `CREATE TABLE IF NOT EXISTS \`gis_territories\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`territoryId\` VARCHAR(191) NULL,
      \`code\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`regionId\` VARCHAR(191) NULL,
      \`assignedUserId\` VARCHAR(191) NULL,
      \`boundaryGeoJson\` LONGTEXT NOT NULL,
      \`centerLat\` DOUBLE NOT NULL DEFAULT 37.7749,
      \`centerLng\` DOUBLE NOT NULL DEFAULT -122.4194,
      \`areaSqKm\` DOUBLE NOT NULL DEFAULT 0.0,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      \`color\` VARCHAR(32) NOT NULL DEFAULT '#0ea5e9',
      \`targetQuota\` DOUBLE NOT NULL DEFAULT 0.0,
      \`metadata\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_gis_territory_code\` (\`tenantId\`, \`code\`),
      INDEX \`gis_territories_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_territories_regionId_idx\` (\`regionId\`),
      INDEX \`gis_territories_assignedUserId_idx\` (\`assignedUserId\`),
      INDEX \`gis_territories_status_idx\` (\`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. gis_layers
    `CREATE TABLE IF NOT EXISTS \`gis_layers\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`code\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`layerType\` VARCHAR(64) NOT NULL DEFAULT 'ACCOUNTS',
      \`isVisible\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`opacity\` DOUBLE NOT NULL DEFAULT 1.0,
      \`displayOrder\` INT NOT NULL DEFAULT 1,
      \`color\` VARCHAR(32) NOT NULL DEFAULT '#3b82f6',
      \`config\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_gis_layer_code\` (\`tenantId\`, \`code\`),
      INDEX \`gis_layers_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_layers_layerType_idx\` (\`layerType\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 4. gis_features
    `CREATE TABLE IF NOT EXISTS \`gis_features\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`layerId\` VARCHAR(191) NULL,
      \`territoryId\` VARCHAR(191) NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`featureType\` VARCHAR(64) NOT NULL DEFAULT 'ACCOUNT',
      \`geometryType\` VARCHAR(32) NOT NULL DEFAULT 'POINT',
      \`latitude\` DOUBLE NULL,
      \`longitude\` DOUBLE NULL,
      \`coordinates\` JSON NOT NULL,
      \`properties\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`gis_features_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_features_layerId_idx\` (\`layerId\`),
      INDEX \`gis_features_territoryId_idx\` (\`territoryId\`),
      INDEX \`gis_features_featureType_idx\` (\`featureType\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 5. gis_uploaded_files
    `CREATE TABLE IF NOT EXISTS \`gis_uploaded_files\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`uploadedById\` VARCHAR(191) NULL,
      \`filename\` VARCHAR(255) NOT NULL,
      \`fileType\` VARCHAR(32) NOT NULL DEFAULT 'GEOJSON',
      \`fileSizeBytes\` INT NOT NULL DEFAULT 0,
      \`featureCount\` INT NOT NULL DEFAULT 0,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'PARSED',
      \`errorMessage\` TEXT NULL,
      \`layerId\` VARCHAR(191) NULL,
      \`rawContent\` LONGTEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`gis_uploaded_files_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_uploaded_files_uploadedById_idx\` (\`uploadedById\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 6. gis_realignments
    `CREATE TABLE IF NOT EXISTS \`gis_realignments\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`territoryId\` VARCHAR(191) NOT NULL,
      \`proposalName\` VARCHAR(191) NOT NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      \`proposedByUserId\` VARCHAR(191) NULL,
      \`approvedByUserId\` VARCHAR(191) NULL,
      \`currentBoundary\` LONGTEXT NOT NULL,
      \`proposedBoundary\` LONGTEXT NOT NULL,
      \`currentAreaSqKm\` DOUBLE NOT NULL DEFAULT 0.0,
      \`proposedAreaSqKm\` DOUBLE NOT NULL DEFAULT 0.0,
      \`currentAssignedUserId\` VARCHAR(191) NULL,
      \`proposedAssignedUserId\` VARCHAR(191) NULL,
      \`impactSummary\` JSON NULL,
      \`justification\` TEXT NULL,
      \`decidedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX \`gis_realignments_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_realignments_territoryId_idx\` (\`territoryId\`),
      INDEX \`gis_realignments_status_idx\` (\`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 7. gis_arcgis_configs
    `CREATE TABLE IF NOT EXISTS \`gis_arcgis_configs\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`serviceName\` VARCHAR(191) NOT NULL,
      \`serviceUrl\` VARCHAR(512) NOT NULL,
      \`authType\` VARCHAR(32) NOT NULL DEFAULT 'API_KEY',
      \`apiKeyMasked\` VARCHAR(64) NULL,
      \`apiKeyEncrypted\` TEXT NULL,
      \`clientId\` VARCHAR(191) NULL,
      \`clientSecretEncrypted\` TEXT NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED',
      \`layerCount\` INT NOT NULL DEFAULT 0,
      \`lastTestedAt\` DATETIME(3) NULL,
      \`lastError\` TEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY \`unique_tenant_gis_arcgis\` (\`tenantId\`, \`serviceName\`),
      INDEX \`gis_arcgis_tenantId_idx\` (\`tenantId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 8. gis_audit_logs
    `CREATE TABLE IF NOT EXISTS \`gis_audit_logs\` (
      \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NULL,
      \`action\` VARCHAR(64) NOT NULL,
      \`entityType\` VARCHAR(64) NOT NULL,
      \`entityId\` VARCHAR(191) NOT NULL,
      \`details\` JSON NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX \`gis_audit_logs_tenantId_idx\` (\`tenantId\`),
      INDEX \`gis_audit_logs_action_idx\` (\`action\`),
      INDEX \`gis_audit_logs_createdAt_idx\` (\`createdAt\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    await prisma.$executeRawUnsafe(q);
    console.log(`[OK] Executed query ${i + 1}/${queries.length}`);
  }

  // Seed default layers and regions if not present
  const defaultLayers = [
    { code: 'LAYER-TERRITORIES', name: 'Territory Boundaries', layerType: 'TERRITORY_BOUNDARIES', color: '#0ea5e9', displayOrder: 1 },
    { code: 'LAYER-LEADS', name: 'Commercial Leads & Prospects', layerType: 'LEADS', color: '#10b981', displayOrder: 2 },
    { code: 'LAYER-ACCOUNTS', name: 'Enterprise Client Accounts', layerType: 'ACCOUNTS', color: '#f59e0b', displayOrder: 3 },
    { code: 'LAYER-UPLOADED', name: 'Uploaded GIS Layers', layerType: 'UPLOADED_FILE', color: '#8b5cf6', displayOrder: 4 },
    { code: 'LAYER-DRAWN', name: 'User Drawn Shapes', layerType: 'DRAWING', color: '#ec4899', displayOrder: 5 },
  ];

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    for (const dl of defaultLayers) {
      await prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO \`gis_layers\` (\`id\`, \`tenantId\`, \`code\`, \`name\`, \`layerType\`, \`isVisible\`, \`opacity\`, \`displayOrder\`, \`color\`)
         VALUES (UUID(), '${tenant.id}', '${dl.code}', '${dl.name}', '${dl.layerType}', 1, 1.0, ${dl.displayOrder}, '${dl.color}');`
      );
    }
  }

  // Integrity Check
  const userCount = await prisma.user.count();
  const tenantCount = await prisma.tenant.count();
  console.log(`[Integrity Check] Users: ${userCount}/14 | Tenants: ${tenantCount}/2`);

  await prisma.$disconnect();
  console.log('[Migration MP13] Additive migration for Master Prompt 13 completed successfully.');
}

runMaster13Migration().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});

