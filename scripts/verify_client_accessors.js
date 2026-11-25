const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAccessors() {
  const models = [
    'rdConversation',
    'rdConversationParticipant',
    'rdMessage',
    'rdMessageAttachment',
    'rdContextComment',
    'rdMention',
    'rdNotification',
    'rdNotificationPreference',
    'rdCalendarEvent',
    'rdCalendarParticipant',
    'rdIntegrationConfig',
    'rdIntegrationLog',
    'rdKpi',
    'rdKpiHistory',
    'rdDashboardPreference',
    'gisRegion',
    'gisTerritory',
    'gisLayer',
    'gisFeature',
    'gisUploadedFile',
    'gisRealignment',
    'gisArcgisConfig',
    'gisAuditLog',
    'bfovDiagram',
    'bfovDiagramVersion',
    'bfovDiagramTemplate',
    'bfovDiagramComment',
    'bfovDiagramShare',
    'bfovAiGeneration',
    'rdIpAsset',
    'rdComplianceSop',
    'rdEnterpriseAuditLog',
    'rdApiKey',
    // MP06-10
    'rdMilestone',
    'rdResearchObjective',
    'rdHypothesis',
    'rdExperiment',
    'rdNotebook',
    'rdResearchNote',
    'rdDecision',
    'rdRisk',
    'rdIssue',
    'rdResourceProfile',
    'rdTimesheet',
    'rdFacility',
  ];

  console.log('=== VERIFYING PRISMA CLIENT MODEL ACCESSORS ===');
  let missing = 0;
  for (const m of models) {
    if (typeof prisma[m] === 'object' && typeof prisma[m].findMany === 'function') {
      const count = await prisma[m].count();
      console.log(`[PASS] prisma.${m}: Available (records: ${count})`);
    } else {
      console.error(`[FAIL] prisma.${m}: NOT FOUND on PrismaClient!`);
      missing++;
    }
  }

  console.log(`\nVerification Summary: ${models.length - missing}/${models.length} Accessors Operational`);
  await prisma.$disconnect();
}

verifyAccessors().catch(console.error);

