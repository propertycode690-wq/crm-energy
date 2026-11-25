const prisma = require('../config/prisma');
const rdAnalyticsService = require('./rdAnalyticsService');

class RdReportingService {
  /**
   * Helper to escape CSV cell (RFC-4180 standard)
   */
  _escapeCsv(value) {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * Generate structured report data based on requested type
   */
  async generateReport(tenantId, reportType = 'PORTFOLIO_SUMMARY', filters = {}) {
    const timestamp = new Date().toISOString();

    switch (reportType.toUpperCase()) {
      case 'EXECUTIVE_SUMMARY': {
        const data = await rdAnalyticsService.getExecutiveOverview(tenantId, filters);
        return {
          reportType: 'EXECUTIVE_SUMMARY',
          title: 'Executive R&D Operations & Telemetry Summary',
          generatedAt: timestamp,
          summary: data,
          columns: ['Metric Group', 'Metric Name', 'Value', 'Unit / Note'],
          rows: [
            ['Portfolio', 'Total Projects', data.portfolio.totalProjects, 'Count'],
            ['Portfolio', 'Active Projects', data.portfolio.activeProjects, 'Count'],
            ['Portfolio', 'Completed Projects', data.portfolio.completedProjects, 'Count'],
            ['Portfolio', 'Delayed Projects', data.portfolio.delayedProjects, 'Count'],
            ['Portfolio', 'Average Progress', `${data.portfolio.averageProgress}%`, 'Percentage'],
            ['Financial', 'Total Approved Budget', `$${data.financial.totalApprovedBudget.toLocaleString()}`, 'USD'],
            ['Financial', 'Total Actual Spent', `$${data.financial.totalActualSpent.toLocaleString()}`, 'USD'],
            ['Financial', 'Net Budget Variance', `$${data.financial.netVariance.toLocaleString()}`, 'USD'],
            ['Financial', 'Budget Utilization', `${data.financial.budgetUtilizationRate}%`, 'Percentage'],
            ['Execution', 'Total Tasks', data.execution.totalTasks, 'Count'],
            ['Execution', 'Completed Tasks', data.execution.completedTasks, 'Count'],
            ['Execution', 'Overdue Tasks', data.execution.overdueTasks, 'Count'],
            ['Execution', 'Schedule Adherence', `${data.execution.taskAdherenceRate}%`, 'Percentage'],
            ['Innovation', 'Total Ideas Submitted', data.innovation.totalIdeas, 'Count'],
            ['Innovation', 'Ideas Approved/Converted', data.innovation.approvedIdeas, 'Count'],
            ['Innovation', 'Gate Reviews Conducted', data.innovation.totalGateReviews, 'Count'],
            ['Risk', 'High Risk Projects (>60)', data.risks.highRiskProjectsCount, 'Count'],
            ['Risk', 'Average Risk Score', data.risks.averageRiskScore, '0-100 scale'],
          ],
        };
      }

      case 'PORTFOLIO_SUMMARY': {
        const data = await rdAnalyticsService.getPortfolioAnalytics(tenantId, filters);
        const rows = data.comparisons.map((p) => [
          p.id,
          p.name,
          p.strategicCategory,
          p.stage,
          p.status,
          p.priority,
          `${p.progress}%`,
          `$${p.budget.toLocaleString()}`,
          `$${p.spent.toLocaleString()}`,
          `$${p.variance.toLocaleString()}`,
          p.riskScore,
          p.roiScore,
          p.manager,
          p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : 'N/A',
          p.isDelayed ? 'DELAYED' : 'ON_TRACK',
        ]);

        return {
          reportType: 'PORTFOLIO_SUMMARY',
          title: 'R&D Project Portfolio & Performance Report',
          generatedAt: timestamp,
          totalProjects: data.total,
          distributions: data.distributions,
          columns: [
            'Project ID',
            'Project Name',
            'Category',
            'Stage',
            'Status',
            'Priority',
            'Progress',
            'Approved Budget',
            'Actual Spent',
            'Budget Variance',
            'Risk Score',
            'ROI Score',
            'Manager',
            'Target Deadline',
            'Delivery Status',
          ],
          rows,
        };
      }

      case 'EXECUTION_DELIVERY': {
        const data = await rdAnalyticsService.getExecutionAnalytics(tenantId, filters);
        const taskWhere = rdAnalyticsService._buildTaskWhere(tenantId, filters);
        const tasks = await prisma.task.findMany({
          where: taskWhere,
          include: {
            project: { select: { name: true } },
            assignedUser: { select: { name: true, email: true } },
          },
          orderBy: { dueDate: 'asc' },
        });

        const rows = tasks.map((t) => [
          t.id,
          t.title,
          t.project?.name || 'Unassigned',
          t.assignedUser?.name || 'Unassigned',
          t.rdStatus || t.status,
          t.priority,
          t.estimatedHours || 0,
          t.actualHours || 0,
          `${t.progress || 0}%`,
          t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : 'N/A',
          t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : 'N/A',
        ]);

        return {
          reportType: 'EXECUTION_DELIVERY',
          title: 'R&D Task Execution, Schedule & Sprints Report',
          generatedAt: timestamp,
          summary: data.summary,
          columns: [
            'Task ID',
            'Task Title',
            'Project',
            'Assignee',
            'Status',
            'Priority',
            'Estimated Hours',
            'Actual Hours',
            'Progress',
            'Start Date',
            'Due Date',
          ],
          rows,
        };
      }

      case 'INNOVATION_FUNNEL': {
        const data = await rdAnalyticsService.getInnovationAnalytics(tenantId, filters);
        const ideas = await prisma.rdIdea.findMany({
          where: { tenantId },
          include: { category: true, submitter: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        });

        const rows = ideas.map((idea) => [
          idea.id,
          idea.referenceNumber,
          idea.title,
          idea.category?.name || 'Uncategorized',
          idea.status,
          idea.compositeScore !== null ? idea.compositeScore : 'N/A',
          idea.submitter?.name || 'Anonymous',
          new Date(idea.createdAt).toISOString().split('T')[0],
        ]);

        return {
          reportType: 'INNOVATION_FUNNEL',
          title: 'R&D Innovation Pipeline, Scoring & Stage-Gate Decisions',
          generatedAt: timestamp,
          funnelSummary: data.funnel,
          columns: [
            'Idea ID',
            'Ref Code',
            'Idea Title',
            'Category',
            'Status',
            'Composite Score',
            'Submitter',
            'Submission Date',
          ],
          rows,
        };
      }

      case 'FINANCIAL_PERFORMANCE': {
        const data = await rdAnalyticsService.getFinancialAnalytics(tenantId, filters);
        const rows = data.projectList.map((p) => [
          p.id,
          p.name,
          p.status,
          `$${p.budget.toLocaleString()}`,
          `$${p.spent.toLocaleString()}`,
          `$${p.variance.toLocaleString()}`,
          `${p.utilization}%`,
          p.isOverrun ? 'OVERRUN' : 'WITHIN_BUDGET',
        ]);

        return {
          reportType: 'FINANCIAL_PERFORMANCE',
          title: 'R&D Capital Expenditure, Budget Variance & Overrun Analysis',
          generatedAt: timestamp,
          summary: data.summary,
          columns: [
            'Project ID',
            'Project Name',
            'Status',
            'Approved Budget',
            'Actual Expenditure',
            'Variance (Surplus/Deficit)',
            'Utilization Rate',
            'Overrun State',
          ],
          rows,
        };
      }

      case 'RISK_DECISION_LOG': {
        const data = await rdAnalyticsService.getRiskDecisionAnalytics(tenantId, filters);
        const gateDecisions = await prisma.rdGateDecision.findMany({
          where: { tenantId },
          include: {
            maker: { select: { name: true } },
          },
          orderBy: { decidedAt: 'desc' },
        });

        const rows = gateDecisions.map((d) => [
          d.id,
          d.projectId,
          d.gateId,
          d.decision,
          d.decisionReason || '',
          d.maker?.name || 'Governance Committee',
          new Date(d.decidedAt).toISOString(),
        ]);

        return {
          reportType: 'RISK_DECISION_LOG',
          title: 'R&D Governance Gate Decisions & Risk Register Log',
          generatedAt: timestamp,
          riskSummary: data.risks,
          columns: [
            'Decision ID',
            'Project ID',
            'Gate Stage',
            'Formal Decision',
            'Justification / Reason',
            'Decision Maker',
            'Timestamp',
          ],
          rows,
        };
      }

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Export report directly to RFC-4180 CSV
   */
  async exportReportCsv(tenantId, reportType, filters = {}) {
    const report = await this.generateReport(tenantId, reportType, filters);
    const headerLine = report.columns.map((col) => this._escapeCsv(col)).join(',');
    const dataLines = report.rows.map((row) => row.map((cell) => this._escapeCsv(cell)).join(','));

    const csvContent = [
      `# EgoLytics R&D Analytics Report: ${report.title}`,
      `# Generated At: ${report.generatedAt}`,
      `# Tenant ID: ${tenantId}`,
      headerLine,
      ...dataLines,
    ].join('\r\n');

    return {
      filename: `Egolytics_${reportType.toLowerCase()}_${Date.now()}.csv`,
      contentType: 'text/csv',
      data: csvContent,
    };
  }

  /**
   * Export report directly to JSON
   */
  async exportReportJson(tenantId, reportType, filters = {}) {
    const report = await this.generateReport(tenantId, reportType, filters);
    return {
      filename: `Egolytics_${reportType.toLowerCase()}_${Date.now()}.json`,
      contentType: 'application/json',
      data: JSON.stringify(report, null, 2),
    };
  }

  /**
   * Default layout widgets for custom dashboard
   */
  getDefaultDashboardLayout(dashboardType = 'EXECUTIVE') {
    switch (dashboardType.toUpperCase()) {
      case 'EXECUTIVE':
        return [
          { widgetId: 'kpi-summary-cards', title: 'Key Performance Indicators', enabled: true, order: 1, width: 'full' },
          { widgetId: 'portfolio-status-chart', title: 'Portfolio Status Distribution', enabled: true, order: 2, width: 'half' },
          { widgetId: 'financial-variance-chart', title: 'Capital Budget vs Expenditure', enabled: true, order: 3, width: 'half' },
          { widgetId: 'execution-adherence', title: 'Schedule Adherence & Task Velocity', enabled: true, order: 4, width: 'half' },
          { widgetId: 'innovation-funnel', title: 'Innovation Pipeline & Gate Progression', enabled: true, order: 5, width: 'half' },
          { widgetId: 'risk-severity-matrix', title: 'Project Risk Profile & Severity', enabled: true, order: 6, width: 'full' },
        ];
      case 'PORTFOLIO':
        return [
          { widgetId: 'portfolio-metrics', title: 'Portfolio Overview', enabled: true, order: 1, width: 'full' },
          { widgetId: 'stage-distribution', title: 'Stage Distribution', enabled: true, order: 2, width: 'half' },
          { widgetId: 'category-distribution', title: 'Category Distribution', enabled: true, order: 3, width: 'half' },
          { widgetId: 'project-comparisons', title: 'Project Comparison Grid', enabled: true, order: 4, width: 'full' },
        ];
      default:
        return [
          { widgetId: 'standard-metrics', title: 'Telemetry Overview', enabled: true, order: 1, width: 'full' },
        ];
    }
  }

  /**
   * Get user dashboard preferences
   */
  async getDashboardPreferences(tenantId, userId, dashboardType = 'EXECUTIVE') {
    const pref = await prisma.rdDashboardPreference.findUnique({
      where: {
        tenantId_userId_dashboardType: {
          tenantId,
          userId,
          dashboardType: dashboardType.toUpperCase(),
        },
      },
    });

    if (pref && pref.layoutConfig) {
      return {
        dashboardType: pref.dashboardType,
        layoutConfig: pref.layoutConfig,
        isCustom: true,
        updatedAt: pref.updatedAt,
      };
    }

    return {
      dashboardType: dashboardType.toUpperCase(),
      layoutConfig: this.getDefaultDashboardLayout(dashboardType),
      isCustom: false,
      updatedAt: null,
    };
  }

  /**
   * Save user dashboard layout preferences
   */
  async saveDashboardPreferences(tenantId, userId, dashboardType = 'EXECUTIVE', layoutConfig) {
    if (!layoutConfig || !Array.isArray(layoutConfig)) {
      throw new Error('layoutConfig must be an array of widget layout objects');
    }

    const typeUpper = dashboardType.toUpperCase();
    const updated = await prisma.rdDashboardPreference.upsert({
      where: {
        tenantId_userId_dashboardType: {
          tenantId,
          userId,
          dashboardType: typeUpper,
        },
      },
      create: {
        tenantId,
        userId,
        dashboardType: typeUpper,
        layoutConfig,
      },
      update: {
        layoutConfig,
      },
    });

    return {
      dashboardType: updated.dashboardType,
      layoutConfig: updated.layoutConfig,
      isCustom: true,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Reset user dashboard layout preferences to default
   */
  async resetDashboardPreferences(tenantId, userId, dashboardType = 'EXECUTIVE') {
    const typeUpper = dashboardType.toUpperCase();
    await prisma.rdDashboardPreference.deleteMany({
      where: {
        tenantId,
        userId,
        dashboardType: typeUpper,
      },
    });

    return {
      dashboardType: typeUpper,
      layoutConfig: this.getDefaultDashboardLayout(dashboardType),
      isCustom: false,
    };
  }
}

module.exports = new RdReportingService();

