const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Scoring & Evaluation Service
 * Requirement 4: Multi-criteria scoring rubrics, technical risk handling,
 * evaluator score submission, weighted composite aggregation, and ranked leaderboard.
 */
class RdScoringService {
  /**
   * Ensure default rubric exists for tenant
   */
  async ensureDefaultRubric(tenantId) {
    const existing = await prisma.rdIdeaEvaluationRubric.findFirst({
      where: { tenantId, isActive: true },
      include: { criteria: true },
    });

    if (existing && existing.criteria.length > 0) {
      return existing;
    }

    // Create default rubric: Feasibility (35%), Market Impact (40%), Technical Risk (25%)
    const rubric = await prisma.rdIdeaEvaluationRubric.create({
      data: {
        tenantId,
        name: 'Standard Innovation Evaluation Rubric',
        version: 1,
        isActive: true,
        scale: '1_TO_5',
        criteria: {
          create: [
            {
              name: 'Technical Feasibility',
              description: 'Scientific soundness, engineering viability, internal expertise, and resource readiness.',
              weight: 0.35,
              direction: 'HIGHER_IS_BETTER',
              displayOrder: 1,
            },
            {
              name: 'Market & Strategic Impact',
              description: 'Potential commercial value, strategic relevance, customer demand, and competitive edge.',
              weight: 0.40,
              direction: 'HIGHER_IS_BETTER',
              displayOrder: 2,
            },
            {
              name: 'Technical Risk & Uncertainty',
              description: 'Complexity, probability of unresolvable roadblocks, and technology gap. Lower risk is more desirable.',
              weight: 0.25,
              direction: 'LOWER_IS_BETTER',
              displayOrder: 3,
            },
          ],
        },
      },
      include: { criteria: true },
    });

    return rubric;
  }

  /**
   * Get active rubric for tenant
   */
  async getActiveRubric(tenantId) {
    let rubric = await prisma.rdIdeaEvaluationRubric.findFirst({
      where: { tenantId, isActive: true },
      include: {
        criteria: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!rubric) {
      rubric = await this.ensureDefaultRubric(tenantId);
    }

    return rubric;
  }

  /**
   * Get all rubrics (historical versions included)
   */
  async getRubrics(tenantId) {
    await this.ensureDefaultRubric(tenantId);
    return await prisma.rdIdeaEvaluationRubric.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        criteria: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { evaluations: true },
        },
      },
    });
  }

  /**
   * Create or update rubric with weight validation and versioning
   */
  async configureRubric(tenantId, data, userId) {
    const { name, scale = '1_TO_5', criteria } = data;

    if (!name || name.trim() === '') {
      const error = new Error('Rubric name is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      const error = new Error('At least one evaluation criterion is required.');
      error.statusCode = 400;
      throw error;
    }

    // Weight validation: sum of active weights must equal 1.0 (100%)
    let sumWeight = 0;
    for (const c of criteria) {
      const w = parseFloat(c.weight);
      if (isNaN(w) || w <= 0) {
        const error = new Error(`Criterion "${c.name}" must have a positive weight.`);
        error.statusCode = 400;
        throw error;
      }
      sumWeight += w;
    }

    // Allow small floating point tolerance (0.999 to 1.001)
    if (Math.abs(sumWeight - 1.0) > 0.005) {
      const error = new Error(`Total criteria weights must equal 100% (1.0). Current sum: ${(sumWeight * 100).toFixed(1)}%`);
      error.statusCode = 400;
      throw error;
    }

    // Check existing active rubric
    const currentActive = await prisma.rdIdeaEvaluationRubric.findFirst({
      where: { tenantId, isActive: true },
      include: { _count: { select: { evaluations: true } } },
    });

    const nextVersion = currentActive ? currentActive.version + 1 : 1;

    // Use transaction to deactivate old and activate new versioned rubric
    return await prisma.$transaction(async (tx) => {
      if (currentActive) {
        await tx.rdIdeaEvaluationRubric.update({
          where: { id: currentActive.id },
          data: { isActive: false },
        });
      }

      const newRubric = await tx.rdIdeaEvaluationRubric.create({
        data: {
          tenantId,
          name: name.trim(),
          version: nextVersion,
          scale,
          isActive: true,
          criteria: {
            create: criteria.map((c, idx) => ({
              name: c.name.trim(),
              description: c.description || '',
              weight: parseFloat(c.weight),
              direction: c.direction || 'HIGHER_IS_BETTER',
              displayOrder: c.displayOrder !== undefined ? parseInt(c.displayOrder, 10) : idx + 1,
            })),
          },
        },
        include: { criteria: true },
      });

      return newRubric;
    });
  }

  /**
   * Normalize raw score to 0-100 scale with direction inversion
   */
  normalizeScore(rawScore, scale, direction) {
    let normalized = 0;
    const raw = parseFloat(rawScore);

    if (scale === '1_TO_5') {
      // 1 maps to 0, 5 maps to 100
      const boundedRaw = Math.min(5, Math.max(1, raw));
      normalized = ((boundedRaw - 1) / 4) * 100;
    } else {
      // Default 0 to 100
      normalized = Math.min(100, Math.max(0, raw));
    }

    // Invert score if lower is better (e.g. Technical Risk)
    if (direction === 'LOWER_IS_BETTER') {
      normalized = 100 - normalized;
    }

    return parseFloat(normalized.toFixed(2));
  }

  /**
   * Get an evaluator's submission for an idea
   */
  async getEvaluation(tenantId, ideaId, evaluatorId) {
    return await prisma.rdIdeaEvaluation.findUnique({
      where: {
        ideaId_evaluatorId: { ideaId, evaluatorId },
      },
      include: {
        rubric: { include: { criteria: true } },
        scores: {
          include: { criterion: true },
        },
      },
    });
  }

  /**
   * Submit an evaluation (Draft or Final)
   */
  async submitEvaluation(tenantId, ideaId, data, evaluatorId) {
    const { scores, comments, isDraft = false } = data;

    const idea = await prisma.rdIdea.findFirst({
      where: { id: ideaId, tenantId },
    });
    if (!idea) {
      const error = new Error('Idea not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    if (['REJECTED', 'ARCHIVED'].includes(idea.status)) {
      const error = new Error(`Cannot evaluate an idea in ${idea.status} status.`);
      error.statusCode = 400;
      throw error;
    }

    const activeRubric = await this.getActiveRubric(tenantId);
    if (!activeRubric || !activeRubric.criteria || activeRubric.criteria.length === 0) {
      const error = new Error('No active evaluation rubric configured.');
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(scores) || scores.length === 0) {
      const error = new Error('Scores must be provided for evaluation.');
      error.statusCode = 400;
      throw error;
    }

    // Check all criteria scored if final submission
    if (!isDraft) {
      for (const crit of activeRubric.criteria) {
        const found = scores.find((s) => s.criterionId === crit.id);
        if (!found || found.rawScore === undefined || found.rawScore === null) {
          const error = new Error(`Score required for criterion "${crit.name}".`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Calculate normalized and weighted scores
    let totalWeightedScore = 0;
    const computedScores = [];

    for (const scoreItem of scores) {
      const criterion = activeRubric.criteria.find((c) => c.id === scoreItem.criterionId);
      if (!criterion) continue;

      const raw = parseFloat(scoreItem.rawScore);
      const normalized = this.normalizeScore(raw, activeRubric.scale, criterion.direction);
      const weightedContribution = parseFloat((normalized * criterion.weight).toFixed(2));
      totalWeightedScore += weightedContribution;

      computedScores.push({
        criterionId: criterion.id,
        rawScore: raw,
        normalizedScore: normalized,
        weight: criterion.weight,
        weightedContribution,
        criterionComments: scoreItem.comments || '',
      });
    }

    const finalWeightedScore = parseFloat(Math.min(100, Math.max(0, totalWeightedScore)).toFixed(2));

    // Atomic transaction for evaluation upsert and idea score aggregation
    return await prisma.$transaction(async (tx) => {
      // 1. Upsert evaluation record
      const evaluation = await tx.rdIdeaEvaluation.upsert({
        where: {
          ideaId_evaluatorId: { ideaId, evaluatorId },
        },
        create: {
          tenantId,
          ideaId,
          evaluatorId,
          rubricId: activeRubric.id,
          rubricVersion: activeRubric.version,
          weightedScore: finalWeightedScore,
          comments: comments || '',
          status: isDraft ? 'DRAFT' : 'SUBMITTED',
          submittedAt: isDraft ? null : new Date(),
        },
        update: {
          rubricId: activeRubric.id,
          rubricVersion: activeRubric.version,
          weightedScore: finalWeightedScore,
          comments: comments || '',
          status: isDraft ? 'DRAFT' : 'SUBMITTED',
          submittedAt: isDraft ? null : new Date(),
        },
      });

      // 2. Re-create / upsert score items
      for (const cs of computedScores) {
        await tx.rdIdeaEvaluationScore.upsert({
          where: {
            evaluationId_criterionId: {
              evaluationId: evaluation.id,
              criterionId: cs.criterionId,
            },
          },
          create: {
            evaluationId: evaluation.id,
            criterionId: cs.criterionId,
            rawScore: cs.rawScore,
            normalizedScore: cs.normalizedScore,
            weight: cs.weight,
            weightedContribution: cs.weightedContribution,
            criterionComments: cs.criterionComments,
          },
          update: {
            rawScore: cs.rawScore,
            normalizedScore: cs.normalizedScore,
            weight: cs.weight,
            weightedContribution: cs.weightedContribution,
            criterionComments: cs.criterionComments,
          },
        });
      }

      let compositeScore = null;
      let evalCount = 0;

      // 3. If submitted, update reviewer assignment status and compute composite score
      if (!isDraft) {
        await tx.rdIdeaReviewer.updateMany({
          where: { ideaId, reviewerId: evaluatorId },
          data: { status: 'COMPLETED' },
        });

        // Compute multi-evaluator average score
        const completedEvaluations = await tx.rdIdeaEvaluation.findMany({
          where: { ideaId, status: 'SUBMITTED' },
          select: { weightedScore: true },
        });

        evalCount = completedEvaluations.length;
        const sumScore = completedEvaluations.reduce((sum, e) => sum + e.weightedScore, 0);
        compositeScore = evalCount > 0 ? parseFloat((sumScore / evalCount).toFixed(2)) : null;

        await tx.rdIdea.update({
          where: { id: ideaId },
          data: {
            evaluationCount: evalCount,
            compositeScore,
            // If in SUBMITTED status and receiving evaluation, optionally progress to UNDER_REVIEW
            status: idea.status === 'SUBMITTED' ? 'UNDER_REVIEW' : idea.status,
          },
        });

        await tx.activity.create({
          data: {
            tenantId,
            userId: evaluatorId,
            type: 'STATUS_CHANGED',
            title: `Evaluation Submitted: ${idea.referenceNumber}`,
            description: `Evaluator submitted score (${finalWeightedScore}/100) for idea "${idea.title}".`,
            metadata: { ideaId, evaluationId: evaluation.id, score: finalWeightedScore },
          },
        });
      }

      return {
        evaluation,
        finalWeightedScore,
        computedScores,
        compositeScore,
        totalEvaluations: evalCount,
      };
    });
  }

  /**
   * Ranked Leaderboard
   * Ideas ranked by composite evaluation score (ideas with no evaluations show isEvaluated: false)
   */
  async getLeaderboard(tenantId, query = {}) {
    const { categoryId, status, search, limit = 50 } = query;

    const where = {
      tenantId,
      status: { notIn: ['ARCHIVED'] },
    };

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { referenceNumber: { contains: search } },
        { title: { contains: search } },
        { summary: { contains: search } },
      ];
    }

    const ideas = await prisma.rdIdea.findMany({
      where,
      take: parseInt(limit, 10),
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true, color: true } },
        evaluations: {
          where: { status: 'SUBMITTED' },
          include: {
            evaluator: { select: { id: true, name: true } },
            scores: { include: { criterion: true } },
          },
        },
      },
    });

    // Partition into evaluated and unevaluated
    const evaluatedIdeas = ideas.filter((i) => i.compositeScore !== null && i.compositeScore !== undefined);
    const unevaluatedIdeas = ideas.filter((i) => i.compositeScore === null || i.compositeScore === undefined);

    // Sort evaluated ideas by compositeScore desc, then by createdAt asc, then referenceNumber asc
    evaluatedIdeas.sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Assign rank numbers strictly to evaluated ideas
    const rankedEvaluated = evaluatedIdeas.map((idea, index) => ({
      ...idea,
      rank: index + 1,
      isEvaluated: true,
      displayScore: `${idea.compositeScore.toFixed(1)} / 100`,
    }));

    const unevaluatedList = unevaluatedIdeas.map((idea) => ({
      ...idea,
      rank: null,
      isEvaluated: false,
      displayScore: 'Not Evaluated',
    }));

    const combinedList = [...rankedEvaluated, ...unevaluatedList];

    return {
      total: combinedList.length,
      evaluatedCount: rankedEvaluated.length,
      unevaluatedCount: unevaluatedList.length,
      leaderboard: combinedList,
    };
  }
}

module.exports = new RdScoringService();
