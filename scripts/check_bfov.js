const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.bfovDiagram.count();
  console.log('Total diagrams via prisma.bfovDiagram.count():', count);

  const rawRows = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM bfov_diagrams');
  console.log('Total raw rows in bfov_diagrams:', rawRows[0].c);

  await prisma.$disconnect();
}

main().catch(console.error);

