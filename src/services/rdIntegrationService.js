const prisma = require('../config/prisma');

class RdIntegrationService {
  /**
   * Helper to mask sensitive webhook URLs for safe frontend display
   */
  maskWebhookUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 2) {
        return `${parsed.origin}/${pathParts[0]}/.../${pathParts[pathParts.length - 1].slice(-4).padStart(8, '*')}`;
      }
      return `${parsed.origin}/.../${parsed.pathname.slice(-4).padStart(8, '*')}`;
    } catch {
      return url.length > 12 ? `${url.substring(0, 8)}...${url.slice(-4)}` : '********';
    }
  }

  /**
   * List all available integrations with connection status, sync telemetry & masked credentials
   */
  async getIntegrations(tenantId) {
    const configs = await prisma.rdIntegrationConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const providers = ['SLACK', 'TEAMS', 'GENERIC_WEBHOOK'];
    const results = providers.map((p) => {
      const existing = configs.find((c) => c.provider === p);
      if (existing) {
        return {
          id: existing.id,
          provider: existing.provider,
          name: existing.name,
          status: existing.status, // ACTIVE, INACTIVE, ERROR, DISCONNECTED
          isConfigured: Boolean(existing.webhookUrl),
          maskedWebhookUrl: this.maskWebhookUrl(existing.webhookUrl),
          channelMapping: existing.channelMapping || {},
          eventsConfig: existing.eventsConfig || {},
          lastSyncAt: existing.lastSyncAt,
          errorMessage: existing.errorMessage,
          updatedAt: existing.updatedAt,
        };
      }

      // Default unconfigured placeholder
      return {
        id: null,
        provider: p,
        name: p === 'SLACK' ? 'Slack Workspace' : p === 'TEAMS' ? 'Microsoft Teams' : 'Custom Webhook Relay',
        status: 'DISCONNECTED',
        isConfigured: false,
        maskedWebhookUrl: null,
        channelMapping: {},
        eventsConfig: {
          PROJECT_CREATED: true,
          TASK_OVERDUE: true,
          STAGE_GATE_SUBMITTED: true,
          DECISION_RECORDED: true,
          CALENDAR_EVENT: false,
        },
        lastSyncAt: null,
        errorMessage: null,
        updatedAt: null,
      };
    });

    return results;
  }

  /**
   * Save or update integration configuration
   */
  async saveConfig(tenantId, userId, provider, data) {
    const { name, webhookUrl, channelMapping, eventsConfig } = data;

    const existing = await prisma.rdIntegrationConfig.findFirst({
      where: { tenantId, provider },
    });

    let config;
    if (existing) {
      config = await prisma.rdIntegrationConfig.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          webhookUrl: webhookUrl !== undefined ? webhookUrl : existing.webhookUrl,
          channelMapping: channelMapping !== undefined ? channelMapping : existing.channelMapping,
          eventsConfig: eventsConfig !== undefined ? eventsConfig : existing.eventsConfig,
          status: webhookUrl ? 'INACTIVE' : 'DISCONNECTED', // Set to INACTIVE until test passes
          errorMessage: null,
        },
      });
    } else {
      config = await prisma.rdIntegrationConfig.create({
        data: {
          tenantId,
          provider,
          name: name || `${provider} Integration`,
          webhookUrl: webhookUrl || null,
          channelMapping: channelMapping || {},
          eventsConfig: eventsConfig || {
            PROJECT_CREATED: true,
            TASK_OVERDUE: true,
            STAGE_GATE_SUBMITTED: true,
            DECISION_RECORDED: true,
          },
          status: webhookUrl ? 'INACTIVE' : 'DISCONNECTED',
          createdById: userId,
        },
      });
    }

    return {
      ...config,
      maskedWebhookUrl: this.maskWebhookUrl(config.webhookUrl),
      webhookUrl: undefined, // Never expose raw URL
    };
  }

  /**
   * Test external integration connection & log result
   */
  async testConnection(tenantId, configId) {
    const config = await prisma.rdIntegrationConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) throw new Error('Integration configuration not found.');
    if (!config.webhookUrl) {
      throw new Error('Cannot test integration: Webhook URL is not configured.');
    }

    let isSuccess = false;
    let errorDetails = null;
    let payloadSummary = `Connection verification ping from EgoLytics R&D for ${config.provider}`;

    try {
      // Validate URL format
      const url = new URL(config.webhookUrl);

      // Perform actual test ping using fetch with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const testPayload = {
        text: `[EgoLytics R&D] Connection Test Verification • ${new Date().toISOString()}`,
        channel: config.channelMapping?.general || '#general',
        source: 'CRM nErgy EgoLytics R&D Management System',
      };

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 200 || response.status === 204) {
        isSuccess = true;
      } else {
        const errorText = await response.text();
        errorDetails = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
      }
    } catch (err) {
      errorDetails = err.name === 'AbortError' ? 'Connection timed out after 6000ms.' : err.message;
    }

    const now = new Date();
    // Update config status
    const updated = await prisma.rdIntegrationConfig.update({
      where: { id: configId },
      data: {
        status: isSuccess ? 'ACTIVE' : 'ERROR',
        lastSyncAt: now,
        errorMessage: isSuccess ? null : errorDetails,
      },
    });

    // Write audit log
    await prisma.rdIntegrationLog.create({
      data: {
        tenantId,
        configId,
        provider: config.provider,
        event: 'CONNECTION_TEST',
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        payloadSummary,
        errorDetails,
      },
    });

    return {
      success: isSuccess,
      status: updated.status,
      message: isSuccess
        ? `Successfully connected and verified ${config.provider} integration.`
        : `Connection test failed: ${errorDetails}`,
      lastSyncAt: now,
    };
  }

  /**
   * Disconnect an integration
   */
  async disconnect(tenantId, configId) {
    const config = await prisma.rdIntegrationConfig.findFirst({
      where: { id: configId, tenantId },
    });
    if (!config) throw new Error('Integration not found.');

    const updated = await prisma.rdIntegrationConfig.update({
      where: { id: configId },
      data: {
        status: 'DISCONNECTED',
        errorMessage: null,
      },
    });

    await prisma.rdIntegrationLog.create({
      data: {
        tenantId,
        configId,
        provider: config.provider,
        event: 'SYNC_EVENT',
        status: 'SUCCESS',
        payloadSummary: 'Integration manually disconnected by user.',
      },
    });

    return {
      success: true,
      status: updated.status,
      message: `${config.provider} integration disconnected successfully.`,
    };
  }

  /**
   * Dispatch an outgoing event notification to Slack / Teams / Webhooks
   */
  async dispatchEvent(tenantId, eventType, data = {}) {
    const activeConfigs = await prisma.rdIntegrationConfig.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    const results = [];

    for (const config of activeConfigs) {
      const events = config.eventsConfig || {};
      if (events[eventType] === false) continue; // Event disabled in preferences

      let payload;
      const title = data.title || `EgoLytics Event: ${eventType}`;
      const message = data.message || '';

      if (config.provider === 'SLACK') {
        payload = {
          text: `*[EgoLytics R&D]* ${title}\n${message}`,
          channel: config.channelMapping?.[eventType] || config.channelMapping?.default || '#general',
        };
      } else if (config.provider === 'TEAMS') {
        payload = {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          summary: title,
          themeColor: "0076D7",
          title: `[EgoLytics R&D] ${title}`,
          text: message,
        };
      } else {
        payload = {
          event: eventType,
          tenantId,
          timestamp: new Date().toISOString(),
          data,
        };
      }

      try {
        if (config.webhookUrl) {
          const res = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const success = res.ok;
          await prisma.rdIntegrationLog.create({
            data: {
              tenantId,
              configId: config.id,
              provider: config.provider,
              event: 'NOTIFICATION_SENT',
              status: success ? 'SUCCESS' : 'FAILED',
              payloadSummary: title,
              errorDetails: success ? null : `Status ${res.status}`,
            },
          });
          results.push({ provider: config.provider, success });
        }
      } catch (err) {
        await prisma.rdIntegrationLog.create({
          data: {
            tenantId,
            configId: config.id,
            provider: config.provider,
            event: 'NOTIFICATION_SENT',
            status: 'FAILED',
            payloadSummary: title,
            errorDetails: err.message,
          },
        });
        results.push({ provider: config.provider, success: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Fetch integration audit logs
   */
  async getLogs(tenantId, query = {}) {
    const { configId, limit = 50 } = query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    return prisma.rdIntegrationLog.findMany({
      where: {
        tenantId,
        ...(configId ? { configId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Retry a failed integration event
   */
  async retryLog(tenantId, logId) {
    const log = await prisma.rdIntegrationLog.findFirst({
      where: { id: logId, tenantId },
      include: { config: true },
    });

    if (!log) throw new Error('Integration log not found.');
    if (!log.config || !log.config.webhookUrl) {
      throw new Error('Associated integration webhook is not available.');
    }

    return this.testConnection(tenantId, log.configId);
  }
}

module.exports = new RdIntegrationService();

