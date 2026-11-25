const prisma = require('../config/prisma');

class RdAnalyticsService {
  /**
   * Helper to build project filtering where clause
   */
  _buildProjectWhere(tenantId, filters = {}) {
    const where = { tenantId, isArchived: false };

    if (filters.projectId) {
      where.id = filters.projectId;
    }
    if (filters.status) {
      where.status = { contains: filters.status };
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.category || filters.strategicCategory) {
      where.strategicCategory = filters.category || filters.strategicCategory;
    }
    if (filters.manager) {
      where.manager = { contains: filters.manager };
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  /**
   * Helper to build task filtering where clause
   */
  _buildTaskWhere(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  /**
   * 1. Executive R&D Dashboard Overview
   */
  async getExecutiveOverview(tenantId, filters = {}) {
    const projectWhere = this._buildProjectWhere(tenantId, filters);
    const taskWhere = this._buildTaskWhere(tenantId, filters);

    // Fetch projects
    const projects = await prisma.erpProject.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        budget: true,
        spent: true,
        progress: true,
        status: true,
        priority: true,
        riskScore: true,
        strategicCategory: true,
        stage: true,
        deadline: true,
      },
    });

    const totalProjects = projects.length;
    let activeProjects = 0;
    let completedProjects = 0;
    let delayedProjects = 0;
    let awaitingApproval = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalProgressSum = 0;
    let highRiskCount = 0;
    const now = new Date();

    projects.forEach((p) => {
      const budgetNum = Number(p.budget) || 0;
      const spentNum = Number(p.spent) || 0;
      totalBudget += budgetNum;
      totalSpent += spentNum;
      totalProgressSum += p.progress || 0;

      const normStatus = (p.status || '').toUpperCase();
      if (normStatus.includes('COMPLETE') || normStatus === 'CLOSED') {
        completedProjects++;
      } else if (normStatus.includes('APPROVAL') || normStatus.includes('REVIEW')) {
        awaitingApproval++;
      } else {
        activeProjects++;
      }

      if (p.deadline && new Date(p.deadline) < now && !normStatus.includes('COMPLETE')) {
        delayedProjects++;
      }

      if (Number(p.riskScore || 0) >= 60) {
        highRiskCount++;
      }
    });

    const averageProgress = totalProjects > 0 ? Math.round(totalProgressSum / totalProjects) : 0;
    const netVariance = totalBudget - totalSpent;
    const budgetUtilizationRate = totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0;

    // Fetch tasks metrics
    const totalTasks = await prisma.task.count({ where: taskWhere });
    const completedTasks = await prisma.task.count({
      where: {
        ...taskWhere,
        OR: [{ status: 'COMPLETED' }, { rdStatus: 'DONE' }],
      },
    });
    const overdueTasks = await prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: now },
        NOT: [{ status: 'COMPLETED' }, { rdStatus: 'DONE' }],
      },
    });

    const taskAdherenceRate = totalTasks > 0 ? Number((((totalTasks - overdueTasks) / totalTasks) * 100).toFixed(1)) : 100;

    // Innovation metrics
    const totalIdeas = await prisma.rdIdea.count({ where: { tenantId } });
    const approvedIdeas = await prisma.rdIdea.count({
      where: { tenantId, status: { in: ['APPROVED', 'CONVERTED_TO_PROJECT'] } },
    });

    // Governance & Decisions
    const totalGateReviews = await prisma.rdGateReview.count({ where: { tenantId } });
    const recentDecisions = await prisma.rdGateDecision.findMany({
      where: { tenantId },
      orderBy: { decidedAt: 'desc' },
      take: 5,
    });

    // Active schedule alerts
    const activeAlertsCount = await prisma.rdScheduleAlert.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    return {
      portfolio: {
        totalProjects,
        activeProjects,
        completedProjects,
        delayedProjects,
        awaitingApproval,
        averageProgress,
      },
      financial: {
        totalApprovedBudget: totalBudget,
        totalActualSpent: totalSpent,
        netVariance,
        budgetUtilizationRate,
        isOverrun: totalSpent > totalBudget,
      },
      execution: {
        totalTasks,
        completedTasks,
        overdueTasks,
        openTasks: totalTasks - completedTasks,
        taskCompletionRate: totalTasks > 0 ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) : 0,
        taskAdherenceRate,
        activeAlertsCount,
      },
      innovation: {
        totalIdeas,
        approvedIdeas,
        totalGateReviews,
        recentDecisionsCount: recentDecisions.length,
      },
      risks: {
        highRiskProjectsCount: highRiskCount,
        averageRiskScore: totalProjects > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.riskScore || 0), 0) / totalProjects) : 0,
      },
    };
  }

  /**
   * 2. Project Portfolio Analytics
   */
  async getPortfolioAnalytics(tenantId, filters = {}) {
    const projectWhere = this._buildProjectWhere(tenantId, filters);

    const projects = await prisma.erpProject.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        client: true,
        budget: true,
        spent: true,
        progress: true,
        status: true,
        priority: true,
        priorityScore: true,
        riskScore: true,
        roiScore: true,
        strategicCategory: true,
        stage: true,
        manager: true,
        deadline: true,
        startDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusCounts = {};
    const priorityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const categoryCounts = {};
    const stageCounts = {};
    const progressBuckets = { '0-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0 };

    const now = new Date();
    let onTrackCount = 0;
    let delayedCount = 0;

    const projectComparisons = projects.map((p) => {
      const budgetNum = Number(p.budget) || 0;
      const spentNum = Number(p.spent) || 0;
      const progress = p.progress || 0;
      const status = p.status || 'Planned';
      const stage = p.stage || 'IDEA';
      const cat = p.strategicCategory || 'General R&D';
      const prio = p.priority || 'MEDIUM';

      // Status aggregation
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Priority aggregation
      if (priorityCounts[prio] !== undefined) {
        priorityCounts[prio]++;
      } else {
        priorityCounts[prio] = 1;
      }

      // Category aggregation
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      // Stage aggregation
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;

      // Progress buckets
      if (progress <= 25) progressBuckets['0-25%']++;
      else if (progress <= 50) progressBuckets['26-50%']++;
      else if (progress <= 75) progressBuckets['51-75%']++;
      else progressBuckets['76-100%']++;

      // Delayed calculation
      const isCompleted = status.toUpperCase().includes('COMPLETE');
      const isDelayed = p.deadline && new Date(p.deadline) < now && !isCompleted;
      if (isDelayed) {
        delayedCount++;
      } else {
        onTrackCount++;
      }

      return {
        id: p.id,
        name: p.name,
        manager: p.manager || 'Unassigned',
        stage,
        strategicCategory: cat,
        status,
        priority: prio,
        progress,
        budget: budgetNum,
        spent: spentNum,
        variance: budgetNum - spentNum,
        riskScore: p.riskScore || 0,
        roiScore: p.roiScore || 0,
        deadline: p.deadline,
        isDelayed,
      };
    });

    return {
      total: projects.length,
      onTrackCount,
      delayedCount,
      distributions: {
        byStatus: statusCounts,
        byPriority: priorityCounts,
        byCategory: categoryCounts,
        byStage: stageCounts,
        byProgress: progressBuckets,
      },
      comparisons: projectComparisons,
    };
  }

  /**
   * 3. Research & Innovation Analytics
   */
  async getInnovationAnalytics(tenantId, filters = {}) {
    const ideas = await prisma.rdIdea.findMany({
      where: { tenantId },
      include: {
        category: true,
        evaluations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const statusCounts = {};
    const categoryCounts = {};
    let totalScoreSum = 0;
    let evaluatedCount = 0;

    ideas.forEach((idea) => {
      const st = idea.status || 'DRAFT';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const catName = idea.category?.name || 'Uncategorized';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;

      if (idea.compositeScore !== null && idea.compositeScore !== undefined && Number(idea.compositeScore) > 0) {
        totalScoreSum += Number(idea.compositeScore);
        evaluatedCount++;
      }
    });

    const averageCompositeScore = evaluatedCount > 0 ? Number((totalScoreSum / evaluatedCount).toFixed(1)) : 0;

    // Gate Reviews & Decisions
    const gateReviews = await prisma.rdGateReview.findMany({
      where: { tenantId },
      include: {
        decisions: true,
      },
    });

    const decisionBreakdown = {
      GO_CONTINUE: 0,
      HOLD: 0,
      REWORK_RECYCLE: 0,
      TERMINATE_KILL: 0,
      REQUEST_MORE_INFO: 0,
    };

    gateReviews.forEach((review) => {
      review.decisions.forEach((dec) => {
        const d = dec.decision || 'HOLD';
        if (decisionBreakdown[d] !== undefined) {
          decisionBreakdown[d]++;
        } else {
          decisionBreakdown[d] = 1;
        }
      });
    });

    // Funnel conversions
    const totalSubmitted = ideas.filter((i) => i.status !== 'DRAFT').length;
    const totalInReview = ideas.filter((i) => ['IN_REVIEW', 'EVALUATION', 'SUBMITTED'].includes(i.status)).length;
    const totalApproved = ideas.filter((i) => ['APPROVED', 'CONVERTED_TO_PROJECT'].includes(i.status)).length;
    const totalConverted = ideas.filter((i) => i.status === 'CONVERTED_TO_PROJECT').length;

    return {
      totalIdeas: ideas.length,
      evaluatedIdeasCount: evaluatedCount,
      averageCompositeScore,
      funnel: {
        drafts: ideas.filter((i) => i.status === 'DRAFT').length,
        submitted: totalSubmitted,
        inReview: totalInReview,
        approved: totalApproved,
        convertedToProject: totalConverted,
        conversionRate: totalSubmitted > 0 ? Number(((totalConverted / totalSubmitted) * 100).toFixed(1)) : 0,
      },
      distributions: {
        byStatus: statusCounts,
        byCategory: categoryCounts,
        byGateDecision: decisionBreakdown,
      },
      totalGateReviewsConducted: gateReviews.length,
    };
  }

  /**
   * 4. Project Execution Analytics (Tasks, CPM, Sprints, Blockers)
   */
  async getExecutionAnalytics(tenantId, filters = {}) {
    const taskWhere = this._buildTaskWhere(tenantId, filters);

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        status: true,
        rdStatus: true,
        priority: true,
        dueDate: true,
        startDate: true,
        estimatedHours: true,
        actualHours: true,
        progress: true,
        projectId: true,
        sprintId: true,
        assignedUserId: true,
      },
    });

    const totalTasks = tasks.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let todoCount = 0;
    let blockedCount = 0;
    let overdueCount = 0;
    let totalEstHours = 0;
    let totalActHours = 0;
    const now = new Date();

    tasks.forEach((t) => {
      totalEstHours += t.estimatedHours || 0;
      totalActHours += t.actualHours || 0;

      const norm = (t.rdStatus || t.status || '').toUpperCase();
      if (norm === 'DONE' || norm === 'COMPLETED') {
        completedCount++;
      } else if (norm === 'BLOCKED') {
        blockedCount++;
      } else if (norm === 'IN_PROGRESS') {
        inProgressCount++;
      } else {
        todoCount++;
      }

      if (t.dueDate && new Date(t.dueDate) < now && norm !== 'DONE' && norm !== 'COMPLETED') {
        overdueCount++;
      }
    });

    const completionRate = totalTasks > 0 ? Number(((completedCount / totalTasks) * 100).toFixed(1)) : 0;
    const scheduleAdherence = totalTasks > 0 ? Number((((totalTasks - overdueCount) / totalTasks) * 100).toFixed(1)) : 100;

    // Sprints analytics
    const sprints = await prisma.rdSprint.findMany({
      where: { tenantId },
      include: {
        tasks: { select: { id: true, rdStatus: true, status: true, estimatedHours: true } },
      },
    });

    const sprintSummaries = sprints.map((s) => {
      const sTasks = s.tasks || [];
      const sDone = sTasks.filter((t) => (t.rdStatus || t.status || '').toUpperCase() === 'DONE').length;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        capacityHours: s.capacityHours,
        totalTasks: sTasks.length,
        completedTasks: sDone,
        velocity: s.velocity || 0,
        completionRate: sTasks.length > 0 ? Math.round((sDone / sTasks.length) * 100) : 0,
      };
    });

    // Schedule alerts
    const alerts = await prisma.rdScheduleAlert.findMany({
      where: { tenantId },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });

    const alertCounts = {
      OVERDUE: 0,
      DUE_SOON: 0,
      CRITICAL_PATH_DELAY: 0,
      DEPENDENCY_BLOCKED: 0,
    };
    alerts.forEach((a) => {
      if (alertCounts[a.alertType] !== undefined) {
        alertCounts[a.alertType]++;
      }
    });

    return {
      summary: {
        totalTasks,
        completedCount,
        inProgressCount,
        todoCount,
        blockedCount,
        overdueCount,
        completionRate,
        scheduleAdherence,
        totalEstimatedHours: totalEstHours,
        totalActualHours: totalActHours,
        hoursVariance: totalEstHours - totalActHours,
      },
      distributions: {
        byStatus: {
          TODO: todoCount,
          IN_PROGRESS: inProgressCount,
          BLOCKED: blockedCount,
          COMPLETED: completedCount,
        },
        alertsByType: alertCounts,
      },
      sprints: sprintSummaries,
      recentAlerts: alerts.slice(0, 10),
    };
  }

  /**
   * 5. Financial Analytics
   */
  async getFinancialAnalytics(tenantId, filters = {}) {
    const projectWhere = this._buildProjectWhere(tenantId, filters);

    const projects = await prisma.erpProject.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        budget: true,
        spent: true,
        progress: true,
        strategicCategory: true,
        status: true,
      },
    });

    let totalApprovedBudget = 0;
    let totalActualSpent = 0;
    const categoryFinancials = {};
    const overrunProjects = [];

    const projectFinancials = projects.map((p) => {
      const budgetNum = Number(p.budget) || 0;
      const spentNum = Number(p.spent) || 0;
      const variance = budgetNum - spentNum;
      const utilization = budgetNum > 0 ? Number(((spentNum / budgetNum) * 100).toFixed(1)) : 0;
      const isOverrun = spentNum > budgetNum;

      totalApprovedBudget += budgetNum;
      totalActualSpent += spentNum;

      const cat = p.strategicCategory || 'General R&D';
      if (!categoryFinancials[cat]) {
        categoryFinancials[cat] = { budget: 0, spent: 0 };
      }
      categoryFinancials[cat].budget += budgetNum;
      categoryFinancials[cat].spent += spentNum;

      if (isOverrun) {
        overrunProjects.push({
          id: p.id,
          name: p.name,
          budget: budgetNum,
          spent: spentNum,
          overrunAmount: spentNum - budgetNum,
          overrunPercent: budgetNum > 0 ? Number((((spentNum - budgetNum) / budgetNum) * 100).toFixed(1)) : 100,
        });
      }

      return {
        id: p.id,
        name: p.name,
        budget: budgetNum,
        spent: spentNum,
        variance,
        utilization,
        isOverrun,
        status: p.status,
      };
    });

    const netVariance = totalApprovedBudget - totalActualSpent;
    const overallUtilization = totalApprovedBudget > 0 ? Number(((totalActualSpent / totalApprovedBudget) * 100).toFixed(1)) : 0;

    return {
      summary: {
        totalApprovedBudget,
        totalActualSpent,
        netVariance,
        overallUtilization,
        overrunCount: overrunProjects.length,
        hasOverrun: overrunProjects.length > 0,
      },
      categoryBreakdown: categoryFinancials,
      overrunProjects,
      projectList: projectFinancials,
    };
  }

  /**
   * 6. Resource Analytics (Workload & Capacity)
   */
  async getResourceAnalytics(tenantId, filters = {}) {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedTasks: {
          where: filters.projectId ? { projectId: filters.projectId } : {},
          select: {
            id: true,
            title: true,
            status: true,
            rdStatus: true,
            estimatedHours: true,
            actualHours: true,
          },
        },
      },
    });

    const standardMonthlyCapacityHours = 160;
    let totalAssignedHours = 0;
    let totalActualLoggedHours = 0;

    const userWorkloads = users.map((u) => {
      const userTasks = u.assignedTasks || [];
      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter((t) => (t.rdStatus || t.status || '').toUpperCase() === 'DONE').length;
      const estimatedHours = userTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const actualHours = userTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

      totalAssignedHours += estimatedHours;
      totalActualLoggedHours += actualHours;

      const allocationRate = Number(((estimatedHours / standardMonthlyCapacityHours) * 100).toFixed(1));
      const isOverAllocated = allocationRate > 100;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        totalTasks,
        completedTasks,
        activeTasks: totalTasks - completedTasks,
        estimatedHours,
        actualHours,
        allocationRate,
        isOverAllocated,
      };
    });

    const totalCapacity = users.length * standardMonthlyCapacityHours;
    const overallTeamUtilization = totalCapacity > 0 ? Number(((totalAssignedHours / totalCapacity) * 100).toFixed(1)) : 0;

    return {
      summary: {
        totalTeamMembers: users.length,
        totalCapacityHours: totalCapacity,
        totalAssignedHours,
        totalActualLoggedHours,
        overallTeamUtilization,
        overAllocatedMembersCount: userWorkloads.filter((w) => w.isOverAllocated).length,
      },
      workloads: userWorkloads,
    };
  }

  /**
   * 7. Risk & Decision Analytics
   */
  async getRiskDecisionAnalytics(tenantId, filters = {}) {
    const projectWhere = this._buildProjectWhere(tenantId, filters);

    const projects = await prisma.erpProject.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        riskScore: true,
        status: true,
        manager: true,
      },
      orderBy: { riskScore: 'desc' },
    });

    const severityBuckets = {
      LOW: 0, // 0-30
      MEDIUM: 0, // 31-60
      HIGH: 0, // 61-80
      CRITICAL: 0, // 81-100
    };

    const highRiskProjects = [];

    projects.forEach((p) => {
      const score = Number(p.riskScore) || 0;
      if (score <= 30) severityBuckets.LOW++;
      else if (score <= 60) severityBuckets.MEDIUM++;
      else if (score <= 80) {
        severityBuckets.HIGH++;
        highRiskProjects.push(p);
      } else {
        severityBuckets.CRITICAL++;
        highRiskProjects.push(p);
      }
    });

    // Gate decisions
    const decisions = await prisma.rdGateDecision.findMany({
      where: { tenantId },
      orderBy: { decidedAt: 'desc' },
      take: 50,
    });

    const decisionDistribution = {
      GO_CONTINUE: 0,
      HOLD: 0,
      REWORK_RECYCLE: 0,
      TERMINATE_KILL: 0,
      REQUEST_MORE_INFO: 0,
    };

    decisions.forEach((d) => {
      if (decisionDistribution[d.decision] !== undefined) {
        decisionDistribution[d.decision]++;
      }
    });

    return {
      risks: {
        totalEvaluatedProjects: projects.length,
        highRiskCount: highRiskProjects.length,
        severityDistribution: severityBuckets,
        topHighRiskProjects: highRiskProjects.slice(0, 5),
      },
      decisions: {
        totalDecisionsRecorded: decisions.length,
        decisionDistribution,
        recentDecisions: decisions.slice(0, 10),
      },
    };
  }
}

module.exports = new RdAnalyticsService();

