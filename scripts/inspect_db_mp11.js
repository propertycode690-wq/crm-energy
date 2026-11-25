const prisma = require('../src/config/prisma');

async function testMP11() {
  try {
    const u = await prisma.user.count();
    const c = await prisma.rdConversation.count();
    const m = await prisma.rdMessage.count();
    const com = await prisma.rdContextComment.count();
    const cal = await prisma.rdCalendarEvent.count();
    const intg = await prisma.rdIntegrationConfig.count();
    console.log('✅ MP11_MODELS_READY:', {
      users: u,
      conversations: c,
      messages: m,
      contextComments: com,
      calendarEvents: cal,
      integrations: intg
    });
  } catch (err) {
    console.error('❌ MP11 Model Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testMP11();

