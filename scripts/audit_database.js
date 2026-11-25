const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parsePrismaModels(content) {
  const models = {};
  const lines = content.split(/\r?\n/);
  let currentModel = null;
  let currentBody = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!currentModel) {
      const match = trimmed.match(/^model\s+(\w+)\s+\{/);
      if (match) {
        currentModel = match[1];
        currentBody = [];
        braceDepth = 1;
      }
    } else {
      // Count braces on this line (excluding comments)
      const cleanLine = line.replace(/\/\/.*$/, '');
      const openBraces = (cleanLine.match(/\{/g) || []).length;
      const closeBraces = (cleanLine.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      if (braceDepth <= 0) {
        // End of model
        const bodyText = currentBody.join('\n');
        const mapMatch = bodyText.match(/@@map\(\"([^\"]+)\"\)/);
        const tableName = mapMatch ? mapMatch[1] : currentModel;

        const fieldLines = currentBody
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('//') && !l.startsWith('@@'));

        const fields = [];
        for (const fl of fieldLines) {
          const parts = fl.split(/\s+/);
          if (parts.length >= 2) {
            const fieldName = parts[0];
            const fieldType = parts[1];
            const isRelation = fl.includes('@relation');
            const colMapMatch = fl.match(/@map\(\"([^\"]+)\"\)/);
            const columnName = colMapMatch ? colMapMatch[1] : fieldName;
            fields.push({ fieldName, fieldType, columnName, isRelation, raw: fl });
          }
        }

        models[currentModel] = {
          modelName: currentModel,
          tableName,
          fields,
          bodyText,
        };

        currentModel = null;
        currentBody = [];
        braceDepth = 0;
      } else {
        currentBody.push(line);
      }
    }
  }

  return models;
}

async function runAudit() {
  const auditResult = {
    timestamp: new Date().toISOString(),
    environment: {},
    schemaModelsCount: 0,
    physicalTablesCount: 0,
    matchedTables: [],
    missingPhysicalTables: [],
    unmappedPhysicalTables: [],
    columnDifferences: [],
    foreignKeyDrift: [],
    recordCounts: {},
    mp11_16_audit: [],
    multiTenancyAudit: [],
  };

  try {
    const versionRes = await prisma.$queryRawUnsafe('SELECT VERSION() as version');
    const dbNameRes = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
    auditResult.environment = {
      dbVersion: versionRes[0].version,
      dbName: dbNameRes[0].db,
      prismaVersion: require('@prisma/client/package.json').version,
      nodeVersion: process.version,
    };

    console.log('=== ENVIRONMENT ===');
    console.log('Database:', auditResult.environment.dbName, 'Version:', auditResult.environment.dbVersion);
    console.log('Prisma Client Version:', auditResult.environment.prismaVersion);

    const tablesRaw = await prisma.$queryRawUnsafe('SHOW TABLES');
    const dbKey = Object.keys(tablesRaw[0])[0];
    const physicalTables = tablesRaw.map(r => r[dbKey]);
    auditResult.physicalTablesCount = physicalTables.length;
    console.log('Physical Tables Count:', physicalTables.length);

    const physicalSchema = {};
    for (const table of physicalTables) {
      try {
        const colsRaw = await prisma.$queryRawUnsafe(`SHOW FULL COLUMNS FROM \`${table}\``);
        physicalSchema[table] = colsRaw.map(c => ({
          field: c.Field,
          type: c.Type,
          collation: c.Collation,
          null: c.Null,
          key: c.Key,
          default: c.Default,
          extra: c.Extra,
        }));

        const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM \`${table}\``);
        auditResult.recordCounts[table] = Number(countRes[0].count);
      } catch (err) {
        console.error(`Error inspecting table ${table}:`, err.message);
      }
    }

    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const prismaModels = parsePrismaModels(schemaContent);
    auditResult.schemaModelsCount = Object.keys(prismaModels).length;
    console.log('Prisma Models in Schema:', auditResult.schemaModelsCount);

    for (const [modelName, modelInfo] of Object.entries(prismaModels)) {
      const pTable = modelInfo.tableName;
      if (physicalTables.includes(pTable)) {
        auditResult.matchedTables.push({ modelName, tableName: pTable });

        const pCols = physicalSchema[pTable] || [];
        const pColNames = pCols.map(c => c.field);

        const scalarFields = modelInfo.fields.filter(f => {
          if (f.fieldType.endsWith('[]')) return false;
          if (prismaModels[f.fieldType.replace('?', '')]) return false;
          return true;
        });

        for (const sf of scalarFields) {
          if (!pColNames.includes(sf.columnName)) {
            auditResult.columnDifferences.push({
              modelName,
              tableName: pTable,
              missingColumn: sf.columnName,
              fieldType: sf.fieldType,
            });
          }
        }
      } else {
        auditResult.missingPhysicalTables.push({ modelName, tableName: pTable });
      }
    }

    const allMappedTableNames = Object.values(prismaModels).map(m => m.tableName);
    for (const pt of physicalTables) {
      if (!allMappedTableNames.includes(pt)) {
        auditResult.unmappedPhysicalTables.push(pt);
      }
    }

    const mp11_16_targets = [
      'RdConversation',
      'RdConversationParticipant',
      'RdMessage',
      'RdMessageAttachment',
      'RdContextComment',
      'RdMention',
      'RdNotification',
      'RdNotificationPreference',
      'RdCalendarEvent',
      'RdCalendarParticipant',
      'RdIntegrationConfig',
      'RdIntegrationLog',
      'RdKpi',
      'RdKpiHistory',
      'RdDashboardPreference',
      'GisRegion',
      'GisTerritory',
      'GisLayer',
      'GisFeature',
      'GisUploadedFile',
      'GisRealignment',
      'GisArcgisConfig',
      'GisAuditLog',
      'BfovDiagram',
      'BfovDiagramVersion',
      'BfovDiagramTemplate',
      'BfovDiagramComment',
      'BfovDiagramShare',
      'BfovAiGeneration',
      'RdIpAsset',
      'RdComplianceSop',
      'RdEnterpriseAuditLog',
      'RdApiKey',
    ];

    console.log('\n=== AUDIT MP11-16 FOCUS MODELS ===');
    for (const target of mp11_16_targets) {
      const mInfo = prismaModels[target];
      if (!mInfo) {
        auditResult.mp11_16_audit.push({
          model: target,
          prismaStatus: 'MISSING_IN_SCHEMA',
          dbStatus: 'UNKNOWN',
          issue: 'Model not defined in schema.prisma',
          finalStatus: 'CRITICAL',
        });
        console.log(`[!] ${target}: Missing in Prisma schema!`);
      } else {
        const tbl = mInfo.tableName;
        const exists = physicalTables.includes(tbl);
        const count = exists ? auditResult.recordCounts[tbl] : 0;
        const colDiffs = auditResult.columnDifferences.filter(cd => cd.tableName === tbl);

        let issue = 'None';
        let status = 'HEALTHY';
        if (!exists) {
          issue = `Physical table \`${tbl}\` does not exist in MariaDB`;
          status = 'MISSING_TABLE';
        } else if (colDiffs.length > 0) {
          issue = `Missing columns: ${colDiffs.map(c => c.missingColumn).join(', ')}`;
          status = 'COLUMN_MISMATCH';
        }

        auditResult.mp11_16_audit.push({
          model: target,
          tableName: tbl,
          prismaStatus: 'DEFINED',
          dbStatus: exists ? 'EXISTS' : 'MISSING',
          rowCount: count,
          issue,
          finalStatus: status,
        });

        console.log(`[${status}] ${target} (table: \`${tbl}\`) | DB: ${exists ? 'EXISTS' : 'MISSING'} | Rows: ${count} | Issue: ${issue}`);
      }
    }

    console.log('\n=== MULTI-TENANCY AUDIT ===');
    for (const [table, cols] of Object.entries(physicalSchema)) {
      const hasTenant = cols.some(c => c.field === 'tenantId');
      if (hasTenant) {
        const count = auditResult.recordCounts[table];
        auditResult.multiTenancyAudit.push({
          table,
          hasTenantId: true,
          rowCount: count,
        });
      }
    }
    console.log(`Tables with tenantId column: ${auditResult.multiTenancyAudit.length}`);

    console.log('\n=== AUDIT SUMMARY ===');
    console.log(`Matched Models/Tables: ${auditResult.matchedTables.length}`);
    console.log(`Missing Physical Tables: ${auditResult.missingPhysicalTables.length}`);
    console.log(`Column Differences: ${auditResult.columnDifferences.length}`);
    console.log(`Unmapped Physical Tables: ${auditResult.unmappedPhysicalTables.length}`);

    fs.writeFileSync(path.resolve(__dirname, '../audit_output.json'), JSON.stringify(auditResult, null, 2));
    console.log('Saved audit_output.json');

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runAudit();
