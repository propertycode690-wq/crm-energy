const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const { generateToken } = require('./src/utils/jwt');

const API_BASE = 'http://127.0.0.1:5002/api';

async function runTestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 11 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('COLLABORATION, COMMUNICATION & EXTERNAL INTEGRATIONS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, description) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
      failed++;
    }
  }

  // 1. Fetch valid users from primary tenant
  const userA = await prisma.user.findFirst({
    where: { tenantId: 'TENANT-08492' },
  });

  const otherUser = await prisma.user.findFirst({
    where: {
      tenantId: 'TENANT-08492',
      id: { not: userA.id },
    },
  });

  const tokenA = generateToken({
    userId: userA.id,
    tenantId: userA.tenantId,
    role: userA.role,
    email: userA.email,
  });

  const tokenB = generateToken({
    userId: 'foreign-user-001',
    tenantId: 'cmunoyqx50000tovon49iw6gx', // Foreign tenant
    role: 'CRM_PRO',
    email: 'foreign.user@tenantb.io',
  });

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  const headersB = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  };

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Create Project Channel Conversation
    // --------------------------------------------------------------------------
    const convRes = await fetch(`${API_BASE}/rd/collaboration/conversations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        type: 'PROJECT_CHANNEL',
        title: 'Quantum R&D Breakthrough Channel',
        topic: 'Discussing quantum battery chemical compositions and lab trials.',
        participantUserIds: [otherUser ? otherUser.id : userA.id],
      }),
    });
    const convData = await convRes.json();
    assert(convRes.status === 201 && convData.success && convData.data?.id, 'TC-11-01', 'Create project collaboration channel');
    const conversationId = convData.data?.id;

    // --------------------------------------------------------------------------
    // TEST 2: List Conversations
    // --------------------------------------------------------------------------
    const listRes = await fetch(`${API_BASE}/rd/collaboration/conversations`, {
      headers: headersA,
    });
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data) && listData.data.length > 0, 'TC-11-02', 'List tenant conversations with unread and participants');

    // --------------------------------------------------------------------------
    // TEST 3: Send Message with Record Link
    // --------------------------------------------------------------------------
    const msgRes = await fetch(`${API_BASE}/rd/collaboration/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        content: `Preliminary data ready. cc @${otherUser ? otherUser.name : 'Team'} on this!`,
        linkedRecordType: 'PROJECT',
        linkedRecordId: 'proj-001',
        attachments: [
          { fileName: 'spec.pdf', fileUrl: 'https://example.com/spec.pdf', fileSize: 1024 }
        ],
      }),
    });
    const msgData = await msgRes.json();
    assert(msgRes.status === 201 && msgData.success && msgData.data?.id, 'TC-11-03', 'Send message with @mentions and attachments');
    const messageId = msgData.data?.id;

    // --------------------------------------------------------------------------
    // TEST 4: Threaded Message Reply
    // --------------------------------------------------------------------------
    const replyRes = await fetch(`${API_BASE}/rd/collaboration/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        content: 'Acknowledged. I will review the spec today.',
        parentMessageId: messageId,
      }),
    });
    const replyData = await replyRes.json();
    assert(replyRes.status === 201 && replyData.data?.parentMessageId === messageId, 'TC-11-04', 'Post threaded message reply');

    // --------------------------------------------------------------------------
    // TEST 5: Edit & Pin Message
    // --------------------------------------------------------------------------
    const editRes = await fetch(`${API_BASE}/rd/collaboration/messages/${messageId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ content: 'Preliminary data updated with revised figures.' }),
    });
    const editData = await editRes.json();
    assert(editRes.status === 200 && editData.data?.isEdited === true, 'TC-11-05', 'Edit message content with isEdited timestamp');

    const pinRes = await fetch(`${API_BASE}/rd/collaboration/messages/${messageId}/pin`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ isPinned: true }),
    });
    const pinData = await pinRes.json();
    assert(pinRes.status === 200 && pinData.data?.isPinned === true, 'TC-11-06', 'Pin key discussion message');

    // --------------------------------------------------------------------------
    // TEST 6: Contextual Comments on Records
    // --------------------------------------------------------------------------
    const commentRes = await fetch(`${API_BASE}/rd/collaboration/comments`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        recordType: 'TASK',
        recordId: 'task-test-01',
        content: 'Investigated thermal runaway boundary conditions for this task.',
      }),
    });
    const commentData = await commentRes.json();
    assert(commentRes.status === 201 && commentData.success, 'TC-11-07', 'Post contextual comment on R&D task record');
    const commentId = commentData.data?.id;

    const getCommentsRes = await fetch(`${API_BASE}/rd/collaboration/comments?recordType=TASK&recordId=task-test-01`, {
      headers: headersA,
    });
    const getCommentsData = await getCommentsRes.json();
    assert(getCommentsRes.status === 200 && getCommentsData.data?.length > 0, 'TC-11-08', 'Fetch nested contextual comments for record');

    // --------------------------------------------------------------------------
    // TEST 7: Notifications & Preferences
    // --------------------------------------------------------------------------
    const notifRes = await fetch(`${API_BASE}/rd/collaboration/notifications`, {
      headers: headersA,
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200 && notifData.success, 'TC-11-09', 'Query in-app notifications and unread counters');

    const prefRes = await fetch(`${API_BASE}/rd/collaboration/preferences`, {
      headers: headersA,
    });
    const prefData = await prefRes.json();
    assert(prefRes.status === 200 && prefData.data?.userId === userA.id, 'TC-11-10', 'Read notification preferences');

    // --------------------------------------------------------------------------
    // TEST 8: Shared Calendar Event Creation & Conflict Detection
    // --------------------------------------------------------------------------
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(11, 0, 0, 0);

    const eventRes = await fetch(`${API_BASE}/rd/collaboration/calendar/events`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'R&D Stage-Gate 3 Review Meeting',
        description: 'Reviewing prototype verification results and lab experiments.',
        eventType: 'STAGE_GATE_MEETING',
        startTime: tomorrow.toISOString(),
        endTime: tomorrowEnd.toISOString(),
        participantUserIds: [otherUser ? otherUser.id : userA.id],
      }),
    });
    const eventData = await eventRes.json();
    assert(eventRes.status === 201 && eventData.success && eventData.data?.id, 'TC-11-11', 'Create shared collaborative calendar event');
    const eventId = eventData.data?.id;

    // Test conflict detection on overlapping slot
    const conflictRes = await fetch(`${API_BASE}/rd/collaboration/calendar/conflicts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        userIds: [userA.id],
        startTime: tomorrow.toISOString(),
        endTime: tomorrowEnd.toISOString(),
      }),
    });
    const conflictData = await conflictRes.json();
    assert(conflictRes.status === 200 && conflictData.hasConflicts === true, 'TC-11-12', 'Detect schedule conflict on overlapping meeting slot');

    // --------------------------------------------------------------------------
    // TEST 9: External Integrations (Slack / Teams Configuration & Logs)
    // --------------------------------------------------------------------------
    const intgRes = await fetch(`${API_BASE}/rd/collaboration/integrations`, {
      headers: headersA,
    });
    const intgData = await intgRes.json();
    assert(intgRes.status === 200 && Array.isArray(intgData.data) && intgData.data.length >= 2, 'TC-11-13', 'Query integration hub configurations (Slack & Teams)');

    const saveSlackRes = await fetch(`${API_BASE}/rd/collaboration/integrations/SLACK`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Enterprise Slack',
        webhookUrl: 'https://hooks.example-slack.com/services/mock-webhook',
        channelMapping: { general: '#rd-announcements' },
        eventsConfig: { PROJECT_CREATED: true, STAGE_GATE_SUBMITTED: true },
      }),
    });
    const saveSlackData = await saveSlackRes.json();
    assert(
      saveSlackRes.status === 200 &&
      saveSlackData.data?.maskedWebhookUrl &&
      !saveSlackData.data?.webhookUrl, // NEVER exposed
      'TC-11-14',
      'Save Slack configuration securely with masked credential display'
    );
    const slackConfigId = saveSlackData.data?.id;

    // Test integration connection test ping (validates failure safely when mock URL is offline)
    const testPingRes = await fetch(`${API_BASE}/rd/collaboration/integrations/${slackConfigId}/test`, {
      method: 'POST',
      headers: headersA,
    });
    const testPingData = await testPingRes.json();
    assert(testPingRes.status === 200 && testPingData.data?.status === 'ERROR', 'TC-11-15', 'Execute connection test and accurately record failure without false active claim');

    // Query audit logs
    const logsRes = await fetch(`${API_BASE}/rd/collaboration/integrations/logs`, {
      headers: headersA,
    });
    const logsData = await logsRes.json();
    assert(logsRes.status === 200 && logsData.data?.length > 0, 'TC-11-16', 'Retrieve integration audit event logs');

    // --------------------------------------------------------------------------
    // TEST 10: Multi-Tenant Boundary Security Isolation
    // --------------------------------------------------------------------------
    const foreignRes = await fetch(`${API_BASE}/rd/collaboration/conversations/${conversationId}/messages`, {
      headers: headersB, // Foreign Tenant Token
    });
    assert(foreignRes.status === 200 && foreignRes.headers && (await foreignRes.json()).messages?.length === 0, 'TC-11-17', 'Strict tenant isolation prevents foreign tenant from reading conversation messages');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`MASTER PROMPT 11 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTestSuite();

