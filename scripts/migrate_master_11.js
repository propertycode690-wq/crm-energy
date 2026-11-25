const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function runMaster11Migration() {
  console.log('[Migration MP11] Starting additive migration for Master Prompt 11: Collaboration, Communication & Integrations...');

  const queries = [
    // 1. rd_conversations
    `CREATE TABLE IF NOT EXISTS \`rd_conversations\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NULL,
      \`type\` VARCHAR(64) NOT NULL DEFAULT 'PROJECT_CHANNEL',
      \`title\` VARCHAR(255) NOT NULL,
      \`topic\` TEXT NULL,
      \`isPrivate\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`isArchived\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`createdById\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_conversations_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_conversations_projectId_idx\` (\`projectId\`),
      INDEX \`rd_conversations_type_idx\` (\`type\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 2. rd_conversation_participants
    `CREATE TABLE IF NOT EXISTS \`rd_conversation_participants\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`conversationId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`role\` VARCHAR(64) NOT NULL DEFAULT 'MEMBER',
      \`isMuted\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`lastReadAt\` DATETIME(3) NULL,
      \`joinedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_conv_part_unique\` (\`conversationId\`, \`userId\`),
      INDEX \`rd_conversation_participants_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_conversation_participants_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 3. rd_messages
    `CREATE TABLE IF NOT EXISTS \`rd_messages\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`conversationId\` VARCHAR(191) NOT NULL,
      \`senderId\` VARCHAR(191) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`messageType\` VARCHAR(32) NOT NULL DEFAULT 'TEXT',
      \`parentMessageId\` VARCHAR(191) NULL,
      \`isPinned\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`isEdited\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`editedAt\` DATETIME(3) NULL,
      \`isDeleted\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`linkedRecordType\` VARCHAR(64) NULL,
      \`linkedRecordId\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_messages_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_messages_conversationId_idx\` (\`conversationId\`),
      INDEX \`rd_messages_senderId_idx\` (\`senderId\`),
      INDEX \`rd_messages_parentMessageId_idx\` (\`parentMessageId\`),
      INDEX \`rd_messages_linkedRecord_idx\` (\`linkedRecordType\`, \`linkedRecordId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 4. rd_message_attachments
    `CREATE TABLE IF NOT EXISTS \`rd_message_attachments\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`messageId\` VARCHAR(191) NOT NULL,
      \`fileName\` VARCHAR(255) NOT NULL,
      \`fileUrl\` TEXT NOT NULL,
      \`fileType\` VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
      \`fileSize\` INT NOT NULL DEFAULT 0,
      \`uploadedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_message_attachments_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_message_attachments_messageId_idx\` (\`messageId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 5. rd_context_comments
    `CREATE TABLE IF NOT EXISTS \`rd_context_comments\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`recordType\` VARCHAR(64) NOT NULL,
      \`recordId\` VARCHAR(191) NOT NULL,
      \`authorId\` VARCHAR(191) NOT NULL,
      \`content\` TEXT NOT NULL,
      \`parentCommentId\` VARCHAR(191) NULL,
      \`isEdited\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`isDeleted\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_context_comments_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_context_comments_record_idx\` (\`recordType\`, \`recordId\`),
      INDEX \`rd_context_comments_authorId_idx\` (\`authorId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 6. rd_mentions
    `CREATE TABLE IF NOT EXISTS \`rd_mentions\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`sourceType\` VARCHAR(32) NOT NULL,
      \`sourceId\` VARCHAR(191) NOT NULL,
      \`mentionedUserId\` VARCHAR(191) NOT NULL,
      \`createdById\` VARCHAR(191) NOT NULL,
      \`isRead\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_mentions_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_mentions_mentionedUserId_idx\` (\`mentionedUserId\`),
      INDEX \`rd_mentions_source_idx\` (\`sourceType\`, \`sourceId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 7. rd_notifications
    `CREATE TABLE IF NOT EXISTS \`rd_notifications\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`type\` VARCHAR(64) NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`linkUrl\` VARCHAR(255) NULL,
      \`recordType\` VARCHAR(64) NULL,
      \`recordId\` VARCHAR(191) NULL,
      \`isRead\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`readAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_notifications_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_notifications_userId_isRead_idx\` (\`userId\`, \`isRead\`),
      INDEX \`rd_notifications_createdAt_idx\` (\`createdAt\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 8. rd_notification_preferences
    `CREATE TABLE IF NOT EXISTS \`rd_notification_preferences\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`emailNotifications\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`inAppNotifications\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`mentionNotifications\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`calendarNotifications\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`slackSync\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`teamsSync\` BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`rd_notif_pref_user_key\` (\`userId\`),
      INDEX \`rd_notification_preferences_tenantId_idx\` (\`tenantId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 9. rd_calendar_events
    `CREATE TABLE IF NOT EXISTS \`rd_calendar_events\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`projectId\` VARCHAR(191) NULL,
      \`createdById\` VARCHAR(191) NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`description\` TEXT NULL,
      \`eventType\` VARCHAR(64) NOT NULL DEFAULT 'PROJECT_MEETING',
      \`location\` VARCHAR(255) NULL,
      \`meetingUrl\` VARCHAR(255) NULL,
      \`startTime\` DATETIME(3) NOT NULL,
      \`endTime\` DATETIME(3) NOT NULL,
      \`allDay\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`isRecurring\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`recurrenceRule\` VARCHAR(191) NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_calendar_events_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_calendar_events_projectId_idx\` (\`projectId\`),
      INDEX \`rd_calendar_events_time_idx\` (\`startTime\`, \`endTime\`),
      INDEX \`rd_calendar_events_eventType_idx\` (\`eventType\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 10. rd_calendar_participants
    `CREATE TABLE IF NOT EXISTS \`rd_calendar_participants\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`eventId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NULL,
      \`email\` VARCHAR(191) NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      \`isHost\` BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (\`id\`),
      INDEX \`rd_calendar_participants_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_calendar_participants_eventId_idx\` (\`eventId\`),
      INDEX \`rd_calendar_participants_userId_idx\` (\`userId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 11. rd_integration_configs
    `CREATE TABLE IF NOT EXISTS \`rd_integration_configs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`provider\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'INACTIVE',
      \`webhookUrl\` TEXT NULL,
      \`channelMapping\` JSON NULL,
      \`eventsConfig\` JSON NULL,
      \`lastSyncAt\` DATETIME(3) NULL,
      \`errorMessage\` TEXT NULL,
      \`createdById\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_integration_configs_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_integration_configs_provider_status_idx\` (\`provider\`, \`status\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,

    // 12. rd_integration_logs
    `CREATE TABLE IF NOT EXISTS \`rd_integration_logs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tenantId\` VARCHAR(191) NOT NULL,
      \`configId\` VARCHAR(191) NOT NULL,
      \`provider\` VARCHAR(64) NOT NULL,
      \`event\` VARCHAR(64) NOT NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
      \`payloadSummary\` TEXT NULL,
      \`errorDetails\` TEXT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`rd_integration_logs_tenantId_idx\` (\`tenantId\`),
      INDEX \`rd_integration_logs_configId_idx\` (\`configId\`),
      INDEX \`rd_integration_logs_createdAt_idx\` (\`createdAt\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`[OK] Executed query ${i + 1}/${queries.length}`);
    } catch (err) {
      console.error(`[ERR] Query ${i + 1} failed:`, err.message);
      throw err;
    }
  }

  // Verify Data Preservation
  const userCount = await prisma.user.count();
  const tenantCount = await prisma.tenant.count();
  const leadCount = await prisma.lead.count();
  console.log(`[Integrity Check] Users: ${userCount}/14 | Tenants: ${tenantCount}/2 | Leads: ${leadCount}/2`);

  await prisma.$disconnect();
  console.log('[Migration MP11] Finished additive migration successfully.');
}

runMaster11Migration().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});

