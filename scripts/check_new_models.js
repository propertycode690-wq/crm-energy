const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNew() {
  const models = ['rolePermission', 'strategicGoal', 'projectProposal', 'projectStrategicAlignment'];
  for (const m of models) {
    if (prisma[m]) {
      const c = await prisma[m].count();
      console.log(`[PASS] Accessor prisma.${m}: EXISTS (count: ${c})`);
    } else {
      console.log(`[FAIL] Accessor prisma.${m}: NOT FOUND`);
    }
  }
  await prisma.$disconnect();
}

checkNew().catch(console.error);

