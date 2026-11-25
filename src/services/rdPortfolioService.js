const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Portfolio Service
 * Handles multi-project portfolio management, rollups, program governance, and R&D projects.
 */
class RdPortfolioService {
  /**
   * Get R&D project portfolio with status rollups and metrics
   */
  async getPortfolio(tenantId, query = {}) {
    const {
      search,
      status,
      priority,
      strategicCategory,
      projectType = 'R_AND_D',
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = query;

    const where = {
      tenantId,
      isArchived: false,
    };

    if (projectType && projectType !== 'ALL') {
      where.projectType = projectType;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }

    if (strategicCategory && strategicCategory !== 'ALL') {
      where.strategicCategory = strategicCategory;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { client: { contains: search } },
        { manager: { contains: search } },
        { strategicCategory: { contains: search } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    // Fetch projects and total count in parallel
    const [projects, total] = await Promise.all([
      prisma.erpProject.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          intakeProposal: {
            select: { id: true, referenceNumber: true, title: true, status: true, expectedRoi: true },
          },
          strategicAlignments: {
            include: {
              goal: { select: { id: true, code: true, title: true, category: true } },
            },
          },
        },
      }),
      prisma.erpProject.count({ where }),
    ]);

    // Aggregate portfolio summary rollups
    const allTenantRdProjects = await prisma.erpProject.findMany({
      where: { tenantId, projectType: 'R_AND_D', isArchived: false },
      select: {
        budget: true,
        spent: true,
        progress: true,
        priority: true,
        status: true,
        priorityScore: true,
        roiScore: true,
        riskScore: true,
        strategicCategory: true,
      },
    });

    let totalBudget = 0;
    let totalSpent = 0;
    let sumProgress = 0;
    let sumRoi = 0;
    let sumRisk = 0;
    let sumPriority = 0;

    const statusCounts = {};
    const priorityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const categoryCounts = {};

    allTenantRdProjects.forEach((p) => {
      totalBudget += parseFloat(p.budget || 0);
      totalSpent += parseFloat(p.spent || 0);
      sumProgress += p.progress || 0;
      sumRoi += p.roiScore || 0;
      sumRisk += p.riskScore || 0;
      sumPriority += p.priorityScore || 0;

      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      if (priorityCounts[p.priority] !== undefined) {
        priorityCounts[p.priority] += 1;
      }
      if (p.strategicCategory) {
        categoryCounts[p.strategicCategory] = (categoryCounts[p.strategicCategory] || 0) + 1;
      }
    });

    const projectCount = allTenantRdProjects.length;

    const rollups = {
      totalProjects: projectCount,
      activeProjects: allTenantRdProjects.filter((p) => p.status === 'In Progress' || p.status === 'Planning').length,
      completedProjects: allTenantRdProjects.filter((p) => p.status === 'Completed').length,
      totalBudget,
      totalSpent,
      budgetVariance: totalBudget - totalSpent,
      budgetUtilization: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0.0',
      avgProgress: projectCount > 0 ? (sumProgress / projectCount).toFixed(1) : 0,
      avgRoiScore: projectCount > 0 ? (sumRoi / projectCount).toFixed(1) : 0,
      avgRiskScore: projectCount > 0 ? (sumRisk / projectCount).toFixed(1) : 0,
      avgPriorityScore: projectCount > 0 ? (sumPriority / projectCount).toFixed(1) : 0,
      statusBreakdown: statusCounts,
      priorityBreakdown: priorityCounts,
      categoryBreakdown: categoryCounts,
    };

    return {
      projects,
      rollups,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Get single R&D Project details
   */
  async getProjectById(tenantId, projectId) {
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        intakeProposal: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            status: true,
            category: true,
            summary: true,
            expectedRoi: true,
            riskAssessment: true,
          },
        },
        strategicAlignments: {
          include: {
            goal: true,
          },
        },
      },
    });

    if (!project) {
      const error = new Error('R&D Project not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return project;
  }

  /**
   * Create a direct R&D Project
   */
  async createRdProject(tenantId, data, userId) {
    const {
      name,
      client = 'Internal R&D Initiative',
      budget = 0,
      manager,
      deadline,
      startDate,
      priority = 'MEDIUM',
      priorityScore = 50.0,
      riskScore = 30.0,
      roiScore = 70.0,
      feasibilityScore = 70.0,
      strategicCategory = 'Core Innovation',
      stage = 'PLANNING',
      assignedUserId,
    } = data;

    if (!name || name.trim() === '') {
      const error = new Error('Project name is required.');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.erpProject.create({
      data: {
        tenantId,
        name: name.trim(),
        client: client.trim(),
        budget: parseFloat(budget) || 0,
        spent: 0,
        progress: 0,
        status: 'Planning',
        manager: manager || 'R&D Lead',
        deadline: deadline ? new Date(deadline) : null,
        startDate: startDate ? new Date(startDate) : new Date(),
        projectType: 'R_AND_D',
        priority,
        priorityScore: parseFloat(priorityScore) || 50.0,
        riskScore: parseFloat(riskScore) || 30.0,
        roiScore: parseFloat(roiScore) || 70.0,
        feasibilityScore: parseFloat(feasibilityScore) || 70.0,
        strategicCategory,
        stage,
        assignedUserId: assignedUserId || userId || null,
      },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Update an R&D Project
   */
  async updateRdProject(tenantId, projectId, data) {
    await this.getProjectById(tenantId, projectId); // Verify tenant scope

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.client !== undefined) updateData.client = data.client;
    if (data.budget !== undefined) updateData.budget = parseFloat(data.budget);
    if (data.spent !== undefined) updateData.spent = parseFloat(data.spent);
    if (data.progress !== undefined) updateData.progress = parseInt(data.progress, 10);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.manager !== undefined) updateData.manager = data.manager;
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.priorityScore !== undefined) updateData.priorityScore = parseFloat(data.priorityScore);
    if (data.riskScore !== undefined) updateData.riskScore = parseFloat(data.riskScore);
    if (data.roiScore !== undefined) updateData.roiScore = parseFloat(data.roiScore);
    if (data.feasibilityScore !== undefined) updateData.feasibilityScore = parseFloat(data.feasibilityScore);
    if (data.strategicCategory !== undefined) updateData.strategicCategory = data.strategicCategory;
    if (data.stage !== undefined) updateData.stage = data.stage;
    if (data.isArchived !== undefined) updateData.isArchived = Boolean(data.isArchived);
    if (data.assignedUserId !== undefined) updateData.assignedUserId = data.assignedUserId || null;

    return await prisma.erpProject.update({
      where: { id: projectId },
      data: updateData,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        strategicAlignments: {
          include: { goal: true },
        },
      },
    });
  }
}

module.exports = new RdPortfolioService();
