const rdIntegrationService = require('../services/rdIntegrationService');

class RdIntegrationController {
  async getIntegrations(req, res, next) {
    try {
      const data = await rdIntegrationService.getIntegrations(req.user.tenantId);
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  async saveConfig(req, res, next) {
    try {
      const { provider } = req.params;
      const data = await rdIntegrationService.saveConfig(
        req.user.tenantId,
        req.user.userId,
        provider.toUpperCase(),
        req.body
      );
      return res.status(200).json({
        success: true,
        message: `${provider} configuration saved successfully.`,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const result = await rdIntegrationService.testConnection(
        req.user.tenantId,
        req.params.id
      );
      return res.status(200).json({
        success: result.success,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req, res, next) {
    try {
      const result = await rdIntegrationService.disconnect(
        req.user.tenantId,
        req.params.id
      );
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getLogs(req, res, next) {
    try {
      const data = await rdIntegrationService.getLogs(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  }

  async retryLog(req, res, next) {
    try {
      const result = await rdIntegrationService.retryLog(
        req.user.tenantId,
        req.params.id
      );
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdIntegrationController();

