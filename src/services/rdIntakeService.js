const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Project Intake Service
 * Manages research proposal submissions, screening, reviews, approvals, and conversion to projects.
 */
class RdIntakeService {
  /**
   * Helper to generate human-readable sequential proposal reference: PROP-YYYY-XXXX
   */
  async generateReferenceNumber(tenantId) {
    const year = new Date().getFullYear();
    const count = await prisma.projectProposal.count({
      where: { tenantId },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `PROP-${year}-${seq}`;
  }

  /**
   * List intake proposals with filters and metrics
   */
  async getProposals(tenantId, query = {}) {
    const {
      status,
      category,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where = { tenantId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { referenceNumber: { contains: search } },
        { title: { contains: search } },
        { summary: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [proposals, total] = await Promise.all([
      prisma.projectProposal.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc' },
        include: {
          submittingUser: { select: { id: true, name: true, email: true } },
          reviewer: { select: { id: true, name: true, email: true } },
          strategicGoal: { select: { id: true, code: true, title: true } },
          convertedProject: { select: { id: true, name: true, status: true, progress: true } },
        },
      }),
      prisma.projectProposal.count({ where }),
    ]);

    // Summary metrics across all proposals for tenant
    const allProposals = await prisma.projectProposal.findMany({
      where: { tenantId },
      select: { status: true, estimatedBudget: true },
    });

    const statusCounts = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      MORE_INFO_REQUIRED: 0,
      APPROVED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };
    let totalPipelineBudget = 0;

    allProposals.forEach((p) => {
      if (statusCounts[p.status] !== undefined) {
        statusCounts[p.status] += 1;
      }
      if (['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(p.status)) {
        totalPipelineBudget += parseFloat(p.estimatedBudget || 0);
      }
    });

    return {
      proposals,
      metrics: {
        total: allProposals.length,
        pipelineBudget: totalPipelineBudget,
        statusBreakdown: statusCounts,
        pendingReviewCount: statusCounts.SUBMITTED + statusCounts.UNDER_REVIEW + statusCounts.MORE_INFO_REQUIRED,
        approvalRate:
          allProposals.length > 0
            ? (((statusCounts.APPROVED) / (statusCounts.APPROVED + statusCounts.REJECTED || 1)) * 100).toFixed(1)
            : '0.0',
      },
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Get proposal by ID
   */
  async getProposalById(tenantId, proposalId) {
    const proposal = await prisma.projectProposal.findFirst({
      where: { id: proposalId, tenantId },
      include: {
        submittingUser: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        strategicGoal: true,
        convertedProject: {
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
            budget: true,
            spent: true,
            manager: true,
            deadline: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error('Proposal not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return proposal;
  }

  /**
   * Create new proposal (Draft or Submitted)
   */
  async createProposal(tenantId, data, userId) {
    const referenceNumber = await this.generateReferenceNumber(tenantId);
    const initialStatus = data.isSubmitted ? 'SUBMITTED' : 'DRAFT';

    const proposal = await prisma.projectProposal.create({
      data: {
        tenantId,
        referenceNumber,
        title: data.title ? data.title.trim() : 'Untitled R&D Proposal',
        summary: data.summary || '',
        description: data.description || '',
        category: data.category || 'Product Innovation',
        problemStatement: data.problemStatement || '',
        expectedOutcomes: data.expectedOutcomes || '',
        estimatedBudget: parseFloat(data.estimatedBudget) || 0,
        estimatedDurationMonths: parseInt(data.estimatedDurationMonths, 10) || 6,
        proposedStartDate: data.proposedStartDate ? new Date(data.proposedStartDate) : null,
        expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
        submittingUserId: userId || null,
        status: initialStatus,
        strategicGoalId: data.strategicGoalId || null,
        expectedRoi: parseFloat(data.expectedRoi) || 50.0,
        riskAssessment: data.riskAssessment || 'MEDIUM',
        feasibilityScore: parseFloat(data.feasibilityScore) || 70.0,
      },
      include: {
        submittingUser: { select: { id: true, name: true, email: true } },
        strategicGoal: true,
      },
    });

    if (initialStatus === 'SUBMITTED') {
      await prisma.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Proposal Submitted: ${proposal.referenceNumber}`,
          description: `Proposal "${proposal.title}" submitted for screening.`,
          metadata: { proposalId: proposal.id, referenceNumber: proposal.referenceNumber },
        },
      });
    }

    return proposal;
  }

  /**
   * Update proposal details (Draft, More Info, or Review stage)
   */
  async updateProposal(tenantId, proposalId, data, userId) {
    const existing = await this.getProposalById(tenantId, proposalId);

    if (['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(existing.status)) {
      const error = new Error(`Cannot modify a proposal in ${existing.status} status.`);
      error.statusCode = 400;
      throw error;
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.problemStatement !== undefined) updateData.problemStatement = data.problemStatement;
    if (data.expectedOutcomes !== undefined) updateData.expectedOutcomes = data.expectedOutcomes;
    if (data.estimatedBudget !== undefined) updateData.estimatedBudget = parseFloat(data.estimatedBudget);
    if (data.estimatedDurationMonths !== undefined) updateData.estimatedDurationMonths = parseInt(data.estimatedDurationMonths, 10);
    if (data.proposedStartDate !== undefined) updateData.proposedStartDate = data.proposedStartDate ? new Date(data.proposedStartDate) : null;
    if (data.expectedCompletionDate !== undefined) updateData.expectedCompletionDate = data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null;
    if (data.strategicGoalId !== undefined) updateData.strategicGoalId = data.strategicGoalId || null;
    if (data.expectedRoi !== undefined) updateData.expectedRoi = parseFloat(data.expectedRoi);
    if (data.riskAssessment !== undefined) updateData.riskAssessment = data.riskAssessment;
    if (data.feasibilityScore !== undefined) updateData.feasibilityScore = parseFloat(data.feasibilityScore);

    return await prisma.projectProposal.update({
      where: { id: proposalId },
      data: updateData,
      include: {
        submittingUser: { select: { id: true, name: true, email: true } },
        strategicGoal: true,
      },
    });
  }

  /**
   * Submit draft proposal
   */
  async submitProposal(tenantId, proposalId, userId) {
    const proposal = await this.getProposalById(tenantId, proposalId);

    if (proposal.status !== 'DRAFT' && proposal.status !== 'MORE_INFO_REQUIRED') {
      const error = new Error(`Only proposals in DRAFT or MORE_INFO_REQUIRED status can be submitted.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.projectProposal.update({
      where: { id: proposalId },
      data: {
        status: 'SUBMITTED',
        moreInfoNotes: proposal.status === 'MORE_INFO_REQUIRED' ? proposal.moreInfoNotes : null,
      },
      include: {
        submittingUser: { select: { id: true, name: true, email: true } },
        strategicGoal: true,
      },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId,
        type: 'STATUS_CHANGED',
        title: `Proposal Submitted: ${proposal.referenceNumber}`,
        description: `Proposal "${proposal.title}" moved to SUBMITTED.`,
        metadata: { proposalId: proposal.id },
      },
    });

    return updated;
  }

  /**
   * Reviewer starts review / requests more info
   */
  async reviewProposal(tenantId, proposalId, { action, notes }, reviewerId) {
    const proposal = await this.getProposalById(tenantId, proposalId);

    if (action === 'START_REVIEW') {
      const updated = await prisma.projectProposal.update({
        where: { id: proposalId },
        data: {
          status: 'UNDER_REVIEW',
          reviewerId,
        },
      });
      return updated;
    }

    if (action === 'REQUEST_INFO') {
      if (!notes || notes.trim() === '') {
        const error = new Error('Clarification notes are required when requesting more information.');
        error.statusCode = 400;
        throw error;
      }
      const updated = await prisma.projectProposal.update({
        where: { id: proposalId },
        data: {
          status: 'MORE_INFO_REQUIRED',
          reviewerId,
          moreInfoNotes: notes.trim(),
        },
      });
      return updated;
    }

    const error = new Error('Invalid review action specified.');
    error.statusCode = 400;
    throw error;
  }

  /**
   * Approve Proposal & Convert to Project (Atomic Transaction)
   */
  async approveProposal(tenantId, proposalId, { reviewComments }, reviewerId, reviewerName = 'R&D Reviewer') {
    const proposal = await this.getProposalById(tenantId, proposalId);

    if (['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(proposal.status)) {
      const error = new Error(`Proposal is already ${proposal.status} and cannot be approved.`);
      error.statusCode = 400;
      throw error;
    }

    // Atomic transaction for approval, project creation, and goal alignment
    return await prisma.$transaction(async (tx) => {
      // 1. Calculate scores for converted project
      const riskScore = proposal.riskAssessment === 'HIGH' ? 70.0 : proposal.riskAssessment === 'LOW' ? 25.0 : 45.0;
      const roiScore = proposal.expectedRoi || 60.0;
      const feasibility = proposal.feasibilityScore || 70.0;
      // Formula: Score = (ROI * 0.35) + (Alignment * 0.25) + (Feasibility * 0.20) + ((100 - Risk) * 0.20)
      const alignmentComponent = proposal.strategicGoalId ? 80.0 : 40.0;
      const compositePriorityScore = Math.min(
        100,
        Math.max(10, roiScore * 0.35 + alignmentComponent * 0.25 + feasibility * 0.2 + (100 - riskScore) * 0.2)
      );

      // Determine initial priority tier
      let priority = 'MEDIUM';
      if (compositePriorityScore >= 75) priority = 'CRITICAL';
      else if (compositePriorityScore >= 60) priority = 'HIGH';
      else if (compositePriorityScore <= 35) priority = 'LOW';

      // 2. Create the real ERP / R&D Project
      const project = await tx.erpProject.create({
        data: {
          tenantId,
          name: proposal.title,
          client: `Internal R&D / ${proposal.category}`,
          budget: proposal.estimatedBudget || 0,
          spent: 0,
          progress: 5,
          status: 'Planning',
          manager: reviewerName,
          assignedUserId: proposal.submittingUserId || reviewerId || null,
          deadline: proposal.expectedCompletionDate || null,
          startDate: proposal.proposedStartDate || new Date(),
          projectType: 'R_AND_D',
          priority,
          priorityScore: parseFloat(compositePriorityScore.toFixed(1)),
          riskScore,
          roiScore,
          feasibilityScore: feasibility,
          strategicCategory: proposal.category,
          stage: 'APPROVED_INTAKE',
        },
      });

      // 3. Update proposal to APPROVED and link converted project
      const updatedProposal = await tx.projectProposal.update({
        where: { id: proposalId },
        data: {
          status: 'APPROVED',
          reviewerId,
          reviewComments: reviewComments || 'Approved and successfully converted to active R&D Project.',
          convertedProjectId: project.id,
        },
        include: {
          convertedProject: true,
          strategicGoal: true,
        },
      });

      // 4. Automatically link to Strategic Goal if defined on proposal
      if (proposal.strategicGoalId) {
        await tx.projectStrategicAlignment.create({
          data: {
            tenantId,
            projectId: project.id,
            goalId: proposal.strategicGoalId,
            alignmentRationale: `Auto-aligned upon intake proposal approval (${proposal.referenceNumber}): ${proposal.summary || proposal.title}`,
            impactWeight: 1.0,
          },
        });
      }

      // 5. Activity log
      await tx.activity.create({
        data: {
          tenantId,
          userId: reviewerId,
          type: 'STATUS_CHANGED',
          title: `Proposal Approved: ${proposal.referenceNumber}`,
          description: `Proposal "${proposal.title}" approved and converted into R&D Project "${project.name}".`,
          metadata: { proposalId: proposal.id, projectId: project.id },
        },
      });

      return {
        proposal: updatedProposal,
        project,
        message: `Proposal ${proposal.referenceNumber} approved and converted to R&D Project "${project.name}".`,
      };
    });
  }

  /**
   * Reject Proposal with reason
   */
  async rejectProposal(tenantId, proposalId, { rejectionReason }, reviewerId) {
    if (!rejectionReason || rejectionReason.trim() === '') {
      const error = new Error('Rejection reason is required.');
      error.statusCode = 400;
      throw error;
    }

    const proposal = await this.getProposalById(tenantId, proposalId);

    if (['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(proposal.status)) {
      const error = new Error(`Proposal is already ${proposal.status} and cannot be rejected.`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.projectProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        reviewerId,
        rejectionReason: rejectionReason.trim(),
      },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId: reviewerId,
        type: 'STATUS_CHANGED',
        title: `Proposal Rejected: ${proposal.referenceNumber}`,
        description: `Proposal "${proposal.title}" rejected. Reason: ${rejectionReason.trim()}`,
        metadata: { proposalId: proposal.id, rejectionReason: rejectionReason.trim() },
      },
    });

    return updated;
  }

  /**
   * Submitter withdraws proposal
   */
  async withdrawProposal(tenantId, proposalId, userId) {
    const proposal = await this.getProposalById(tenantId, proposalId);

    if (proposal.status === 'APPROVED') {
      const error = new Error('Approved proposals cannot be withdrawn.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.projectProposal.update({
      where: { id: proposalId },
      data: { status: 'WITHDRAWN' },
    });

    await prisma.activity.create({
      data: {
        tenantId,
        userId,
        type: 'STATUS_CHANGED',
        title: `Proposal Withdrawn: ${proposal.referenceNumber}`,
        description: `Proposal "${proposal.title}" was withdrawn.`,
        metadata: { proposalId: proposal.id },
      },
    });

    return updated;
  }
}

module.exports = new RdIntakeService();
