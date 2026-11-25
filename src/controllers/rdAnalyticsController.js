const rdAnalyticsService = require('../services/rdAnalyticsService');
const rdKpiService = require('../services/rdKpiService');
const rdReportingService = require('../services/rdReportingService');

class RdAnalyticsController {
  /**
   * GET /api/rd/analytics/executive
   */
  async getExecutiveOverview(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getExecutiveOverview(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/portfolio
   */
  async getPortfolioAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getPortfolioAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/innovation
   */
  async getInnovationAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getInnovationAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/execution
   */
  async getExecutionAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getExecutionAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/financial
   */
  async getFinancialAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getFinancialAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/resources
   */
  async getResourceAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getResourceAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/risks-decisions
   */
  async getRiskDecisionAnalytics(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdAnalyticsService.getRiskDecisionAnalytics(tenantId, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/kpis
   */
  async getKpis(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { category, status } = req.query;
      const data = await rdKpiService.getKpis(tenantId, { category, status });
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rd/analytics/kpis/recalculate
   */
  async recalculateKpis(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const data = await rdKpiService.recalculateAllKpis(tenantId);
      return res.json({ success: true, data, message: 'All R&D KPIs recalculated from live database telemetry' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/rd/analytics/kpis/:id/target
   */
  async updateKpiTarget(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const { targetValue, ownerId } = req.body;
      const data = await rdKpiService.updateKpiTarget(tenantId, id, targetValue, ownerId);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/kpis/:id/history
   */
  async getKpiHistory(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const data = await rdKpiService.getKpiHistory(tenantId, id);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/reports
   */
  async generateReport(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { reportType } = req.query;
      const report = await rdReportingService.generateReport(tenantId, reportType || 'PORTFOLIO_SUMMARY', req.query);
      return res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/export/csv
   */
  async exportCsv(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { reportType } = req.query;
      const file = await rdReportingService.exportReportCsv(tenantId, reportType || 'PORTFOLIO_SUMMARY', req.query);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.send(file.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/export/json
   */
  async exportJson(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const { reportType } = req.query;
      const file = await rdReportingService.exportReportJson(tenantId, reportType || 'PORTFOLIO_SUMMARY', req.query);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.send(file.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/analytics/preferences
   */
  async getPreferences(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { dashboardType } = req.query;
      const data = await rdReportingService.getDashboardPreferences(tenantId, userId, dashboardType);
      return res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/rd/analytics/preferences
   */
  async savePreferences(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { dashboardType, layoutConfig } = req.body;
      const data = await rdReportingService.saveDashboardPreferences(tenantId, userId, dashboardType, layoutConfig);
      return res.json({ success: true, data, message: 'Dashboard layout preferences saved successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/rd/analytics/preferences
   */
  async resetPreferences(req, res, next) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const { dashboardType } = req.query;
      const data = await rdReportingService.resetDashboardPreferences(tenantId, userId, dashboardType);
      return res.json({ success: true, data, message: 'Dashboard layout restored to system default' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdAnalyticsController();

