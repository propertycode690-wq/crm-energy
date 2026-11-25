const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Project Prioritization Engine
 * Handles algorithmic and manual ranking of research initiatives based on
 * ROI, strategic alignment, feasibility, and risk scores.
 */
class RdPrioritizationService {
  /**
   * Calculate composite priority score and breakdown
   */
  calculateScore(project, customWeights = {}) {
    const weights = {
      roi: customWeights.roi !== undefined ? customWeights.roi : 0.35,
      strategic: customWeights.strategic !== undefined ? customWeights.strategic : 0.25,
      feasibility: customWeights.feasibility !== undefined ? customWeights.feasibility : 0.20,
      risk: customWeights.risk !== undefined ? customWeights.risk : 0.20,
    };

    const roi = parseFloat(project.roiScore || 50.0);
    const feasibility = parseFloat(project.feasibilityScore || 70.0);
    const risk = parseFloat(project.riskScore || 30.0);

    // Calculate strategic alignment component based on linked goals
    let strategicAlignmentVal = 40.0;
    if (project.strategicAlignments && project.strategicAlignments.length > 0) {
      const maxWeight = Math.max(...project.strategicAlignments.map((a) => a.impactWeight || 1.0));
      strategicAlignmentVal = Math.min(100, 60.0 + maxWeight * 20.0);
    }

    const roiComponent = roi * weights.roi;
    const strategicComponent = strategicAlignmentVal * weights.strategic;
    const feasibilityComponent = feasibility * weights.feasibility;
    const riskComponent = (100.0 - risk) * weights.risk;

    const rawTotal = roiComponent + strategicComponent + feasibilityComponent + riskComponent;
    const compositeScore = parseFloat(Math.min(100, Math.max(0, rawTotal)).toFixed(1));

    let recommendedTier = 'MEDIUM';
    if (compositeScore >= 75) recommendedTier = 'CRITICAL';
    else if (compositeScore >= 60) recommendedTier = 'HIGH';
    else if (compositeScore <= 35) recommendedTier = 'LOW';

    return {
      compositeScore,
      recommendedTier,
      breakdown: {
        weights,
        roi: { value: roi, weight: weights.roi, component: parseFloat(roiComponent.toFixed(1)) },
        strategic: {
          value: strategicAlignmentVal,
          weight: weights.strategic,
          component: parseFloat(strategicComponent.toFixed(1)),
        },
        feasibility: {
          value: feasibility,
          weight: weights.feasibility,
          component: parseFloat(feasibilityComponent.toFixed(1)),
        },
        risk: {
          value: risk,
          inverseValue: 100 - risk,
          weight: weights.risk,
          component: parseFloat(riskComponent.toFixed(1)),
        },
      },
    };
  }

  /**
   * Get ranked prioritization list
   */
  async getPrioritizedProjects(tenantId, query = {}) {
    const { priority, strategicCategory, search } = query;

    const where = {
      tenantId,
      projectType: 'R_AND_D',
      isArchived: false,
    };

    if (priority && priority !== 'ALL') where.priority = priority;
    if (strategicCategory && strategicCategory !== 'ALL') where.strategicCategory = strategicCategory;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { client: { contains: search } },
        { manager: { contains: search } },
      ];
    }

    const projects = await prisma.erpProject.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { budget: 'desc' }],
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        strategicAlignments: {
          include: {
            goal: { select: { id: true, code: true, title: true } },
          },
        },
      },
    });

    const rankedList = projects
      .map((project) => {
        const scoreData = this.calculateScore(project);
        return {
          ...project,
          computedScore: scoreData.compositeScore,
          recommendedTier: scoreData.recommendedTier,
          scoreBreakdown: scoreData.breakdown,
        };
      })
      .sort((a, b) => b.computedScore - a.computedScore)
      .map((project, index) => ({
        ...project,
        rank: index + 1,
      }));

    return {
      count: rankedList.length,
      formula: 'Composite Score = (ROI × 0.35) + (Strategic Alignment × 0.25) + (Feasibility × 0.20) + ((100 - Risk) × 0.20)',
      projects: rankedList,
    };
  }

  /**
   * Update prioritization parameters or manual priority tier
   */
  async updatePrioritization(tenantId, projectId, data) {
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      include: { strategicAlignments: true },
    });

    if (!project) {
      const error = new Error('R&D Project not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.roiScore !== undefined) updateData.roiScore = parseFloat(data.roiScore);
    if (data.riskScore !== undefined) updateData.riskScore = parseFloat(data.riskScore);
    if (data.feasibilityScore !== undefined) updateData.feasibilityScore = parseFloat(data.feasibilityScore);

    // Compute updated composite score
    const merged = { ...project, ...updateData };
    const scoreData = this.calculateScore(merged);
    updateData.priorityScore = scoreData.compositeScore;

    // If manual priority wasn't explicitly changed, optionally set to recommended tier if requested
    if (!data.priority && data.autoTier) {
      updateData.priority = scoreData.recommendedTier;
    }

    const updated = await prisma.erpProject.update({
      where: { id: projectId },
      data: updateData,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        strategicAlignments: {
          include: { goal: true },
        },
      },
    });

    return {
      project: updated,
      scoreData,
      message: 'Project prioritization updated successfully.',
    };
  }

  /**
   * Batch recalculate priority scores across all R&D projects
   */
  async recalculateAll(tenantId, weights = {}) {
    const projects = await prisma.erpProject.findMany({
      where: { tenantId, projectType: 'R_AND_D' },
      include: { strategicAlignments: true },
    });

    const updates = [];
    for (const project of projects) {
      const scoreData = this.calculateScore(project, weights);
      updates.push(
        prisma.erpProject.update({
          where: { id: project.id },
          data: {
            priorityScore: scoreData.compositeScore,
          },
        })
      );
    }

    await prisma.$transaction(updates);

    return {
      updatedCount: projects.length,
      weightsApplied: weights,
      message: `Recalculated priority scores for ${projects.length} R&D projects.`,
    };
  }
}

module.exports = new RdPrioritizationService();
