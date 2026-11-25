const prisma = require('../config/prisma');

/**
 * EgoLytics Strategic Alignment Service
 * Manages organizational goals, innovation themes, and project-to-goal alignment tracking.
 */
class RdStrategyService {
  /**
   * Helper to generate goal code: GOAL-YYYY-XX
   */
  async generateGoalCode(tenantId) {
    const year = new Date().getFullYear();
    const count = await prisma.strategicGoal.count({ where: { tenantId } });
    return `GOAL-${year}-${String(count + 1).padStart(2, '0')}`;
  }

  /**
   * Get all strategic goals with linked project and proposal counts
   */
  async getGoals(tenantId, query = {}) {
    const { status, category, search } = query;

    const where = { tenantId };
    if (status && status !== 'ALL') where.status = status;
    if (category && category !== 'ALL') where.category = category;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const goals = await prisma.strategicGoal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projectAlignments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                progress: true,
                budget: true,
                spent: true,
                priority: true,
              },
            },
          },
        },
        proposals: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            status: true,
            estimatedBudget: true,
          },
        },
      },
    });

    // Compute goal rollups
    const enrichedGoals = goals.map((g) => {
      let linkedBudget = 0;
      let linkedSpent = 0;
      g.projectAlignments.forEach((pa) => {
        if (pa.project) {
          linkedBudget += parseFloat(pa.project.budget || 0);
          linkedSpent += parseFloat(pa.project.spent || 0);
        }
      });
      return {
        ...g,
        metrics: {
          linkedProjectsCount: g.projectAlignments.length,
          linkedProposalsCount: g.proposals.length,
          totalAllocatedBudget: linkedBudget,
          totalSpent: linkedSpent,
        },
      };
    });

    return enrichedGoals;
  }

  /**
   * Get goal by ID
   */
  async getGoalById(tenantId, goalId) {
    const goal = await prisma.strategicGoal.findFirst({
      where: { id: goalId, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        projectAlignments: {
          include: {
            project: true,
          },
        },
        proposals: true,
      },
    });

    if (!goal) {
      const error = new Error('Strategic goal not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return goal;
  }

  /**
   * Create strategic goal
   */
  async createGoal(tenantId, data, userId) {
    const code = data.code ? data.code.trim() : await this.generateGoalCode(tenantId);

    if (!data.title || data.title.trim() === '') {
      const error = new Error('Goal title is required.');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.strategicGoal.create({
      data: {
        tenantId,
        code,
        title: data.title.trim(),
        description: data.description || '',
        category: data.category || 'Growth & Innovation',
        targetYear: parseInt(data.targetYear, 10) || new Date().getFullYear(),
        targetValue: data.targetValue || '',
        status: data.status || 'ACTIVE',
        ownerId: data.ownerId || userId || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Update strategic goal
   */
  async updateGoal(tenantId, goalId, data) {
    await this.getGoalById(tenantId, goalId);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.targetYear !== undefined) updateData.targetYear = parseInt(data.targetYear, 10);
    if (data.targetValue !== undefined) updateData.targetValue = data.targetValue;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId || null;

    return await prisma.strategicGoal.update({
      where: { id: goalId },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Delete or deactivate strategic goal
   */
  async deleteGoal(tenantId, goalId) {
    await this.getGoalById(tenantId, goalId);

    return await prisma.strategicGoal.delete({
      where: { id: goalId },
    });
  }

  /**
   * Link an R&D Project to a Strategic Goal
   */
  async alignProject(tenantId, { projectId, goalId, alignmentRationale, impactWeight = 1.0 }) {
    // Verify project belongs to tenant
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) {
      const error = new Error('Project not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    // Verify goal belongs to tenant
    const goal = await prisma.strategicGoal.findFirst({
      where: { id: goalId, tenantId },
    });
    if (!goal) {
      const error = new Error('Strategic goal not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    // Upsert alignment
    const existing = await prisma.projectStrategicAlignment.findUnique({
      where: {
        projectId_goalId: {
          projectId,
          goalId,
        },
      },
    });

    if (existing) {
      return await prisma.projectStrategicAlignment.update({
        where: { id: existing.id },
        data: {
          alignmentRationale: alignmentRationale || existing.alignmentRationale,
          impactWeight: parseFloat(impactWeight) || existing.impactWeight,
        },
        include: { project: true, goal: true },
      });
    }

    return await prisma.projectStrategicAlignment.create({
      data: {
        tenantId,
        projectId,
        goalId,
        alignmentRationale: alignmentRationale || '',
        impactWeight: parseFloat(impactWeight) || 1.0,
      },
      include: { project: true, goal: true },
    });
  }

  /**
   * Remove project-goal alignment
   */
  async removeAlignment(tenantId, alignmentId) {
    const alignment = await prisma.projectStrategicAlignment.findFirst({
      where: { id: alignmentId, tenantId },
    });

    if (!alignment) {
      const error = new Error('Alignment record not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.projectStrategicAlignment.delete({
      where: { id: alignmentId },
    });
  }

  /**
   * Get Strategic Alignment Matrix
   */
  async getStrategyMatrix(tenantId) {
    const [goals, projects] = await Promise.all([
      prisma.strategicGoal.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: {
          projectAlignments: {
            include: { project: true },
          },
        },
      }),
      prisma.erpProject.findMany({
        where: { tenantId, projectType: 'R_AND_D', isArchived: false },
        include: {
          strategicAlignments: {
            include: { goal: true },
          },
        },
      }),
    ]);

    const totalPortfolioBudget = projects.reduce((sum, p) => sum + parseFloat(p.budget || 0), 0);

    const goalContributions = goals.map((goal) => {
      const linkedProjects = goal.projectAlignments.map((pa) => pa.project);
      const allocatedBudget = linkedProjects.reduce((sum, p) => sum + parseFloat(p.budget || 0), 0);
      const budgetSharePct =
        totalPortfolioBudget > 0 ? ((allocatedBudget / totalPortfolioBudget) * 100).toFixed(1) : '0.0';

      return {
        goalId: goal.id,
        code: goal.code,
        title: goal.title,
        category: goal.category,
        linkedProjectCount: linkedProjects.length,
        allocatedBudget,
        budgetSharePct,
        projects: goal.projectAlignments.map((pa) => ({
          id: pa.project.id,
          name: pa.project.name,
          budget: pa.project.budget,
          progress: pa.project.progress,
          status: pa.project.status,
          impactWeight: pa.impactWeight,
          alignmentRationale: pa.alignmentRationale,
        })),
      };
    });

    return {
      totalGoals: goals.length,
      totalProjects: projects.length,
      totalPortfolioBudget,
      goalContributions,
    };
  }
}

module.exports = new RdStrategyService();
