const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Idea Management Service
 * Requirements 3, 61, 62: Idea Capture, Categorization, Voting, Comments, Lifecycle & Pipeline.
 */
class RdIdeaService {
  /**
   * Sequential reference code generator: IDEA-YYYY-XXXX
   */
  async generateReferenceNumber(tenantId) {
    const year = new Date().getFullYear();
    const count = await prisma.rdIdea.count({ where: { tenantId } });
    const seq = String(count + 1).padStart(4, '0');
    return `IDEA-${year}-${seq}`;
  }

  /**
   * Seed default categories for a tenant if none exist
   */
  async ensureDefaultCategories(tenantId, userId) {
    const count = await prisma.rdIdeaCategory.count({ where: { tenantId } });
    if (count === 0) {
      const defaults = [
        { name: 'Product Innovation', description: 'New product concepts, feature enhancements, and hardware/software capabilities.', color: '#3b82f6', displayOrder: 1 },
        { name: 'Process Improvement', description: 'Internal workflow optimizations, automation, and efficiency initiatives.', color: '#10b981', displayOrder: 2 },
        { name: 'Technology Innovation', description: 'Novel scientific methodologies, algorithms, and technical architectures.', color: '#8b5cf6', displayOrder: 3 },
        { name: 'Sustainability & ESG', description: 'Clean energy, carbon footprint reduction, and renewable efficiency.', color: '#059669', displayOrder: 4 },
        { name: 'Customer Experience', description: 'User experience breakthroughs, interface designs, and service innovations.', color: '#f59e0b', displayOrder: 5 },
      ];

      for (const cat of defaults) {
        await prisma.rdIdeaCategory.create({
          data: {
            tenantId,
            name: cat.name,
            description: cat.description,
            color: cat.color,
            displayOrder: cat.displayOrder,
            createdById: userId || null,
          },
        });
      }
    }
  }

  /**
   * Get ideas with multi-criteria filtering, search, and pagination
   */
  async getIdeas(tenantId, query = {}, userId = null) {
    const {
      status,
      categoryId,
      tag,
      search,
      authorId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    await this.ensureDefaultCategories(tenantId, userId);

    const where = { tenantId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = categoryId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    if (search) {
      where.OR = [
        { referenceNumber: { contains: search } },
        { title: { contains: search } },
        { summary: { contains: search } },
        { problemStatement: { contains: search } },
        { proposedSolution: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    // Build orderBy safely
    let orderBy = {};
    if (sortBy === 'compositeScore') {
      orderBy = { compositeScore: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy === 'voteCount') {
      orderBy = { voteCount: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' };
    } else {
      orderBy = { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' };
    }

    const [ideas, total] = await Promise.all([
      prisma.rdIdea.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
          category: { select: { id: true, name: true, color: true } },
          reviewers: {
            include: {
              reviewer: { select: { id: true, name: true, email: true } },
            },
          },
          _count: {
            select: { comments: true, votes: true, evaluations: true },
          },
        },
      }),
      prisma.rdIdea.count({ where }),
    ]);

    // Check which ideas the current user has upvoted
    let userVotedIdeaIds = new Set();
    if (userId) {
      const userVotes = await prisma.rdIdeaVote.findMany({
        where: {
          tenantId,
          userId,
          ideaId: { in: ideas.map((i) => i.id) },
        },
        select: { ideaId: true },
      });
      userVotedIdeaIds = new Set(userVotes.map((v) => v.ideaId));
    }

    const enrichedIdeas = ideas.map((i) => ({
      ...i,
      hasUserVoted: userVotedIdeaIds.has(i.id),
      commentsCount: i._count.comments,
      evaluationsCount: i.evaluationCount,
    }));

    return {
      ideas: enrichedIdeas,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Get single idea details
   */
  async getIdeaById(tenantId, id, userId = null) {
    const idea = await prisma.rdIdea.findFirst({
      where: { id, tenantId },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
        category: true,
        reviewers: {
          include: {
            reviewer: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true } },
          },
        },
        evaluations: {
          where: { status: 'SUBMITTED' },
          include: {
            evaluator: { select: { id: true, name: true, email: true } },
            rubric: { select: { id: true, name: true, version: true, scale: true } },
            scores: {
              include: {
                criterion: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!idea) {
      const error = new Error('Research idea not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    let hasUserVoted = false;
    if (userId) {
      const vote = await prisma.rdIdeaVote.findUnique({
        where: {
          ideaId_userId: { ideaId: id, userId },
        },
      });
      hasUserVoted = !!vote;
    }

    return {
      ...idea,
      hasUserVoted,
    };
  }

  /**
   * Create Idea (DRAFT or SUBMITTED)
   */
  async createIdea(tenantId, data, userId) {
    if (!data.title || data.title.trim() === '') {
      const error = new Error('Idea title is required.');
      error.statusCode = 400;
      throw error;
    }

    await this.ensureDefaultCategories(tenantId, userId);

    const referenceNumber = await this.generateReferenceNumber(tenantId);
    const status = data.isSubmitted ? 'SUBMITTED' : (data.status || 'DRAFT');

    const idea = await prisma.rdIdea.create({
      data: {
        tenantId,
        referenceNumber,
        title: data.title.trim(),
        summary: data.summary || '',
        problemStatement: data.problemStatement || '',
        proposedSolution: data.proposedSolution || '',
        description: data.description || '',
        expectedBenefits: data.expectedBenefits || '',
        categoryId: data.categoryId || null,
        tags: Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''),
        status,
        authorId: userId || null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
      },
    });

    // Audit log
    await prisma.activity.create({
      data: {
        tenantId,
        userId,
        type: 'STATUS_CHANGED',
        title: `Idea Created: ${idea.referenceNumber}`,
        description: `Idea "${idea.title}" created with status ${idea.status}.`,
        metadata: { ideaId: idea.id, referenceNumber: idea.referenceNumber },
      },
    });

    return idea;
  }

  /**
   * Update Idea (Draft or Authorized modification)
   */
  async updateIdea(tenantId, id, data, userId) {
    const existing = await this.getIdeaById(tenantId, id, userId);

    if (['ACCEPTED_FOR_INCUBATION', 'REJECTED', 'ARCHIVED'].includes(existing.status) && !data.overrideStatus) {
      const error = new Error(`Cannot edit an idea in ${existing.status} status.`);
      error.statusCode = 400;
      throw error;
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.problemStatement !== undefined) updateData.problemStatement = data.problemStatement;
    if (data.proposedSolution !== undefined) updateData.proposedSolution = data.proposedSolution;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.expectedBenefits !== undefined) updateData.expectedBenefits = data.expectedBenefits;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.tags !== undefined) {
      updateData.tags = Array.isArray(data.tags) ? data.tags.join(',') : data.tags;
    }

    const updated = await prisma.rdIdea.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
      },
    });

    return updated;
  }

  /**
   * Submit Draft Idea
   */
  async submitIdea(tenantId, id, userId) {
    const existing = await this.getIdeaById(tenantId, id, userId);

    if (existing.status !== 'DRAFT' && existing.status !== 'MORE_INFO_REQUIRED') {
      const error = new Error(`Only ideas in DRAFT or MORE_INFO_REQUIRED status can be submitted.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.rdIdea.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        moreInfoNotes: existing.status === 'MORE_INFO_REQUIRED' ? existing.moreInfoNotes : null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
      },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId,
        type: 'STATUS_CHANGED',
        title: `Idea Submitted: ${existing.referenceNumber}`,
        description: `Idea "${existing.title}" submitted to ideation pipeline.`,
        metadata: { ideaId: id },
      },
    });

    return updated;
  }

  /**
   * Update Lifecycle Status (Review, Request More Info, Accept for Incubation, Reject, Archive)
   */
  async updateIdeaStatus(tenantId, id, data, userId) {
    const existing = await this.getIdeaById(tenantId, id, userId);
    const status = data.status;
    const rejectionReason = data.rejectionReason || data.reason || '';
    const moreInfoNotes = data.moreInfoNotes || data.notes || '';

    const validStatuses = [
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'MORE_INFO_REQUIRED',
      'ACCEPTED_FOR_INCUBATION',
      'REJECTED',
      'ARCHIVED',
    ];

    if (!validStatuses.includes(status)) {
      const error = new Error(`Invalid status specified: ${status}`);
      error.statusCode = 400;
      throw error;
    }

    if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim() === '')) {
      const error = new Error('Rejection reason is required when rejecting an idea.');
      error.statusCode = 400;
      throw error;
    }

    if (status === 'MORE_INFO_REQUIRED' && (!moreInfoNotes || moreInfoNotes.trim() === '')) {
      const error = new Error('Clarification notes are required when requesting more information.');
      error.statusCode = 400;
      throw error;
    }

    const updateData = { status };
    if (rejectionReason) updateData.rejectionReason = rejectionReason.trim();
    if (moreInfoNotes) updateData.moreInfoNotes = moreInfoNotes.trim();

    const updated = await prisma.rdIdea.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true } },
        category: true,
      },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId,
        type: 'STATUS_CHANGED',
        title: `Idea Status Changed: ${existing.referenceNumber}`,
        description: `Idea "${existing.title}" moved to ${status}.`,
        metadata: { ideaId: id, status, rejectionReason, moreInfoNotes },
      },
    });

    return updated;
  }

  /**
   * Live Dashboard Metrics
   */
  async getDashboardMetrics(tenantId) {
    const ideas = await prisma.rdIdea.findMany({
      where: { tenantId },
      select: {
        status: true,
        voteCount: true,
        compositeScore: true,
      },
    });

    const statusCounts = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      MORE_INFO_REQUIRED: 0,
      ACCEPTED_FOR_INCUBATION: 0,
      REJECTED: 0,
      ARCHIVED: 0,
    };

    let totalVotes = 0;
    let evaluatedScoresSum = 0;
    let evaluatedIdeasCount = 0;

    ideas.forEach((i) => {
      if (statusCounts[i.status] !== undefined) {
        statusCounts[i.status] += 1;
      }
      totalVotes += i.voteCount || 0;
      if (i.compositeScore !== null && i.compositeScore !== undefined) {
        evaluatedScoresSum += i.compositeScore;
        evaluatedIdeasCount += 1;
      }
    });

    const avgEvaluationScore =
      evaluatedIdeasCount > 0 ? parseFloat((evaluatedScoresSum / evaluatedIdeasCount).toFixed(1)) : null;

    return {
      totalIdeas: ideas.length,
      statusCounts,
      totalVotes,
      evaluatedIdeasCount,
      avgEvaluationScore,
      activePipelineCount:
        statusCounts.SUBMITTED + statusCounts.UNDER_REVIEW + statusCounts.MORE_INFO_REQUIRED,
      acceptanceRate:
        ideas.length > 0
          ? ((statusCounts.ACCEPTED_FOR_INCUBATION / (statusCounts.ACCEPTED_FOR_INCUBATION + statusCounts.REJECTED || 1)) * 100).toFixed(1)
          : '0.0',
    };
  }

  /**
   * Innovation Pipeline / Funnel
   */
  async getPipeline(tenantId) {
    const metrics = await this.getDashboardMetrics(tenantId);
    const total = metrics.totalIdeas;

    const stages = [
      { id: 'DRAFT', label: 'Drafting', count: metrics.statusCounts.DRAFT, color: '#94a3b8' },
      { id: 'SUBMITTED', label: 'Submitted', count: metrics.statusCounts.SUBMITTED, color: '#3b82f6' },
      { id: 'UNDER_REVIEW', label: 'Under Review', count: metrics.statusCounts.UNDER_REVIEW, color: '#f59e0b' },
      { id: 'MORE_INFO_REQUIRED', label: 'Clarifications', count: metrics.statusCounts.MORE_INFO_REQUIRED, color: '#8b5cf6' },
      { id: 'ACCEPTED_FOR_INCUBATION', label: 'Incubation Selected', count: metrics.statusCounts.ACCEPTED_FOR_INCUBATION, color: '#10b981' },
      { id: 'REJECTED', label: 'Rejected', count: metrics.statusCounts.REJECTED, color: '#ef4444' },
      { id: 'ARCHIVED', label: 'Archived', count: metrics.statusCounts.ARCHIVED, color: '#64748b' },
    ];

    const funnel = stages.map((s) => ({
      ...s,
      percentage: total > 0 ? parseFloat(((s.count / total) * 100).toFixed(1)) : 0,
    }));

    const stageBreakdown = funnel.map((s) => ({
      status: s.id,
      label: s.label,
      count: s.count,
      percentage: s.percentage,
      color: s.color,
    }));

    return {
      totalIdeas: total,
      funnel,
      stageBreakdown,
    };
  }

  /**
   * Voting (Atomic with 1 vote/user constraint)
   */
  async voteIdea(tenantId, ideaId, userId) {
    const idea = await prisma.rdIdea.findFirst({
      where: { id: ideaId, tenantId },
    });

    if (!idea) {
      const error = new Error('Idea not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    if (idea.status === 'ARCHIVED') {
      const error = new Error('Voting is disabled on archived ideas.');
      error.statusCode = 400;
      throw error;
    }

    // Check if user already voted
    const existingVote = await prisma.rdIdeaVote.findUnique({
      where: {
        ideaId_userId: { ideaId, userId },
      },
    });

    if (existingVote) {
      const error = new Error('You have already upvoted this idea.');
      error.statusCode = 400;
      throw error;
    }

    // Atomic transaction: create vote and increment idea voteCount
    const result = await prisma.$transaction(async (tx) => {
      const vote = await tx.rdIdeaVote.create({
        data: {
          tenantId,
          ideaId,
          userId,
        },
      });

      const updatedIdea = await tx.rdIdea.update({
        where: { id: ideaId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      });

      return { vote, voteCount: updatedIdea.voteCount };
    });

    return {
      success: true,
      data: {
        voteCount: result.voteCount,
        hasVoted: true,
      },
      message: 'Vote registered successfully.',
    };
  }

  /**
   * Remove Vote
   */
  async unvoteIdea(tenantId, ideaId, userId) {
    const existingVote = await prisma.rdIdeaVote.findUnique({
      where: {
        ideaId_userId: { ideaId, userId },
      },
    });

    if (!existingVote) {
      const idea = await prisma.rdIdea.findUnique({ where: { id: ideaId }, select: { voteCount: true } });
      return {
        success: true,
        data: {
          voteCount: idea ? idea.voteCount : 0,
          hasVoted: false,
        },
        message: 'No active vote found to remove.',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.rdIdeaVote.delete({
        where: { id: existingVote.id },
      });

      const updatedIdea = await tx.rdIdea.update({
        where: { id: ideaId },
        data: { voteCount: { decrement: 1 } },
        select: { voteCount: true },
      });

      return { voteCount: Math.max(0, updatedIdea.voteCount) };
    });

    return {
      success: true,
      data: {
        voteCount: result.voteCount,
        hasVoted: false,
      },
      message: 'Vote removed successfully.',
    };
  }

  /**
   * Comments
   */
  async getComments(tenantId, ideaId) {
    return await prisma.rdIdeaComment.findMany({
      where: { tenantId, ideaId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async addComment(tenantId, ideaId, { content, parentId }, userId) {
    if (!content || content.trim() === '') {
      const error = new Error('Comment content is required.');
      error.statusCode = 400;
      throw error;
    }

    const comment = await prisma.rdIdeaComment.create({
      data: {
        tenantId,
        ideaId,
        userId,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return comment;
  }

  async deleteComment(tenantId, commentId, userId) {
    const comment = await prisma.rdIdeaComment.findFirst({
      where: { id: commentId, tenantId },
    });

    if (!comment) {
      const error = new Error('Comment not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    // Only comment author or admin can delete
    if (comment.userId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !['BUSINESS_OWNER', 'SUPER_ADMIN'].includes(user.role)) {
        const error = new Error('Unauthorized to delete this comment.');
        error.statusCode = 403;
        throw error;
      }
    }

    return await prisma.rdIdeaComment.delete({
      where: { id: commentId },
    });
  }

  /**
   * Categories
   */
  async getCategories(tenantId, userId = null) {
    await this.ensureDefaultCategories(tenantId, userId);
    return await prisma.rdIdeaCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { ideas: true } },
      },
    });
  }

  async createCategory(tenantId, data, userId) {
    if (!data.name || data.name.trim() === '') {
      const error = new Error('Category name is required.');
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate
    const existing = await prisma.rdIdeaCategory.findFirst({
      where: { tenantId, name: data.name.trim() },
    });
    if (existing) {
      const error = new Error(`Category "${data.name.trim()}" already exists.`);
      error.statusCode = 400;
      throw error;
    }

    return await prisma.rdIdeaCategory.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description || '',
        color: data.color || '#3b82f6',
        displayOrder: parseInt(data.displayOrder, 10) || 0,
        createdById: userId || null,
      },
    });
  }

  async updateCategory(tenantId, id, data) {
    const cat = await prisma.rdIdeaCategory.findFirst({ where: { id, tenantId } });
    if (!cat) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      throw error;
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder, 10);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return await prisma.rdIdeaCategory.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCategory(tenantId, id) {
    const cat = await prisma.rdIdeaCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { ideas: true } } },
    });

    if (!cat) {
      const error = new Error('Category not found.');
      error.statusCode = 404;
      throw error;
    }

    // Protection against deleting categories that are referenced by ideas
    if (cat._count.ideas > 0) {
      // Deactivate instead of hard deleting
      return await prisma.rdIdeaCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return await prisma.rdIdeaCategory.delete({ where: { id } });
  }

  /**
   * Tags
   */
  async getTags(tenantId) {
    const ideas = await prisma.rdIdea.findMany({
      where: { tenantId },
      select: { tags: true },
    });

    const tagSet = new Set();
    ideas.forEach((i) => {
      if (i.tags) {
        i.tags.split(',').forEach((t) => {
          const clean = t.trim();
          if (clean) tagSet.add(clean);
        });
      }
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Reviewer Assignments
   */
  async assignReviewer(tenantId, ideaId, data, assignedById) {
    const idea = await prisma.rdIdea.findFirst({ where: { id: ideaId, tenantId } });
    if (!idea) {
      const error = new Error('Idea not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    const reviewerId = data.reviewerId || data.userId;
    if (!reviewerId) {
      const error = new Error('Reviewer ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const reviewerUser = await prisma.user.findFirst({ where: { id: reviewerId, tenantId } });
    if (!reviewerUser) {
      const error = new Error('Reviewer not found in tenant organization.');
      error.statusCode = 404;
      throw error;
    }

    const assignment = await prisma.rdIdeaReviewer.upsert({
      where: {
        ideaId_reviewerId: { ideaId, reviewerId },
      },
      create: {
        tenantId,
        ideaId,
        reviewerId,
        assignedById,
        status: 'PENDING',
      },
      update: {
        status: 'PENDING',
        assignedById,
      },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId: assignedById,
        type: 'STATUS_CHANGED',
        title: `Reviewer Assigned: ${idea.referenceNumber}`,
        description: `${reviewerUser.name} was assigned as reviewer for idea "${idea.title}".`,
        metadata: { ideaId, reviewerId },
      },
    });

    return {
      ...assignment,
      reviewerId: assignment.reviewerId,
      userId: assignment.reviewerId,
    };
  }

  async removeReviewer(tenantId, ideaId, reviewerId) {
    const assignment = await prisma.rdIdeaReviewer.findUnique({
      where: { ideaId_reviewerId: { ideaId, reviewerId } },
    });

    if (!assignment) {
      const error = new Error('Reviewer assignment not found.');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.rdIdeaReviewer.delete({
      where: { id: assignment.id },
    });
  }

  async getIdeaReviewers(tenantId, ideaId) {
    return await prisma.rdIdeaReviewer.findMany({
      where: { tenantId, ideaId },
      include: {
        reviewer: { select: { id: true, name: true, email: true, role: true } },
        assignedBy: { select: { id: true, name: true } },
      },
    });
  }
}

module.exports = new RdIdeaService();
