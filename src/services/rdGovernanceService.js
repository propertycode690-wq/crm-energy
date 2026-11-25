const prisma = require('../config/prisma');

/**
 * EgoLytics Stage-Gate Governance & Approval Workflow Service
 * Requirements 7 & 8: Innovation Stage Management, Decision Checkpoints,
 * Multi-person sign-offs, Evidence-based reviews, and Auditable Outcomes.
 */
class RdGovernanceService {
  /**
   * Seed default 5-stage innovation template for a tenant if none exist
   */
  async ensureDefaultTemplate(tenantId, userId = null) {
    const existing = await prisma.rdStageTemplate.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
          include: {
            criteria: true,
            gate: true,
          },
        },
      },
    });

    if (existing && existing.stages.length > 0) {
      return existing;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Create template
      const template = await tx.rdStageTemplate.create({
        data: {
          tenantId,
          name: 'Standard 5-Stage Innovation Process',
          code: 'STD_5_STAGE_INNOVATION',
          description: 'Comprehensive enterprise R&D stage-gate lifecycle from concept ideation to commercial rollout.',
          version: 1,
          isDefault: true,
          isActive: true,
          createdById: userId || null,
        },
      });

      // 2. Define standard 5 stages with criteria and gates
      const stageDefinitions = [
        {
          stageNumber: 1,
          name: 'Discovery & Ideation',
          code: 'STAGE_1_DISCOVERY',
          responsibleRole: 'RESEARCH_LEAD',
          color: '#3b82f6',
          description: 'Initial opportunity scoping, hypothesis generation, and fundamental science exploration.',
          expectedDeliverables: 'Concept Brief, Problem Statement, and Preliminary Literature/Patent Search.',
          gateName: 'Gate 1: Concept & Scoping Review',
          gateCode: 'GATE_1_CONCEPT',
          criteria: [
            { name: 'Core problem statement clearly documented', type: 'ENTRY', isMandatory: true, evidenceRequired: false },
            { name: 'Initial market/technology opportunity estimated', type: 'EXIT', isMandatory: true, evidenceRequired: false },
            { name: 'Preliminary literature & prior-art review attached', type: 'EXIT', isMandatory: true, evidenceRequired: true },
          ],
        },
        {
          stageNumber: 2,
          name: 'Feasibility Assessment',
          code: 'STAGE_2_FEASIBILITY',
          responsibleRole: 'TECH_LEAD',
          color: '#8b5cf6',
          description: 'Lab-scale proof of concept, technical risk assessment, and resource feasibility verification.',
          expectedDeliverables: 'Technical Feasibility Report, Risk Matrix, and Initial Budget Projection.',
          gateName: 'Gate 2: Technical Feasibility Gate',
          gateCode: 'GATE_2_FEASIBILITY',
          criteria: [
            { name: 'Gate 1 formal approval recorded', type: 'ENTRY', isMandatory: true, evidenceRequired: false },
            { name: 'Technical & execution risk assessment documented', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            { name: 'Laboratory proof of concept results verified', type: 'EXIT', isMandatory: true, evidenceRequired: true },
          ],
        },
        {
          stageNumber: 3,
          name: 'Research & Development',
          code: 'STAGE_3_RD',
          responsibleRole: 'PRINCIPAL_SCIENTIST',
          color: '#06b6d4',
          description: 'Detailed experimental development, prototype fabrication, and engineering optimization.',
          expectedDeliverables: 'Working Alpha Prototype, Test Datasets, and Design Architecture Document.',
          gateName: 'Gate 3: Prototype & Development Gate',
          gateCode: 'GATE_3_DEVELOPMENT',
          criteria: [
            { name: 'Resource and equipment allocation confirmed', type: 'ENTRY', isMandatory: true, evidenceRequired: false },
            { name: 'Functional prototype demonstrates design specs', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            { name: 'Intellectual Property disclosure submitted', type: 'EXIT', isMandatory: true, evidenceRequired: true },
          ],
        },
        {
          stageNumber: 4,
          name: 'Validation & Pilot Testing',
          code: 'STAGE_4_VALIDATION',
          responsibleRole: 'QA_DIRECTOR',
          color: '#f59e0b',
          description: 'System reliability testing, pilot scale-up trials, compliance checks, and stress testing.',
          expectedDeliverables: 'Pilot Trial Report, Safety Compliance Sign-Off, and Failure Mode Analysis.',
          gateName: 'Gate 4: Pre-Commercialization Gate',
          gateCode: 'GATE_4_VALIDATION',
          criteria: [
            { name: 'Safety, regulatory & compliance clearance', type: 'ENTRY', isMandatory: true, evidenceRequired: true },
            { name: 'Pilot run achieves 95%+ specification tolerance', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            { name: 'Manufacturing transfer plan completed', type: 'EXIT', isMandatory: true, evidenceRequired: false },
          ],
        },
        {
          stageNumber: 5,
          name: 'Commercialization & Transfer',
          code: 'STAGE_5_TRANSFER',
          responsibleRole: 'COMMERCIAL_LEAD',
          color: '#10b981',
          description: 'Production line transfer, customer launch, market introduction, and post-launch audit.',
          expectedDeliverables: 'Production Sign-off, Commercial Launch Plan, and Customer Feedback Baseline.',
          gateName: 'Gate 5: Final Commercial Launch Gate',
          gateCode: 'GATE_5_LAUNCH',
          criteria: [
            { name: 'Supply chain & manufacturing capacity verified', type: 'ENTRY', isMandatory: true, evidenceRequired: false },
            { name: 'Commercial readiness & customer sign-off confirmed', type: 'EXIT', isMandatory: true, evidenceRequired: true },
            { name: 'Final IP patent claims submitted', type: 'EXIT', isMandatory: true, evidenceRequired: true },
          ],
        },
      ];

      for (const def of stageDefinitions) {
        const stage = await tx.rdInnovationStage.create({
          data: {
            tenantId,
            templateId: template.id,
            name: def.name,
            code: def.code,
            stageNumber: def.stageNumber,
            responsibleRole: def.responsibleRole,
            color: def.color,
            description: def.description,
            expectedDeliverables: def.expectedDeliverables,
          },
        });

        // Create gate
        await tx.rdDecisionGate.create({
          data: {
            tenantId,
            stageId: stage.id,
            name: def.gateName,
            code: def.gateCode,
            gateOrder: def.stageNumber,
            approvalPolicy: 'ALL_MUST_APPROVE',
            requiredSignOffCount: 1,
            reviewInstructions: `Review all evidence and mandatory exit criteria for ${def.name}.`,
          },
        });

        // Create criteria
        for (let idx = 0; idx < def.criteria.length; idx++) {
          const crit = def.criteria[idx];
          await tx.rdStageCriterion.create({
            data: {
              tenantId,
              stageId: stage.id,
              name: crit.name,
              type: crit.type,
              isMandatory: crit.isMandatory,
              evidenceRequired: crit.evidenceRequired,
              sortOrder: idx + 1,
            },
          });
        }
      }

      return await tx.rdStageTemplate.findUnique({
        where: { id: template.id },
        include: {
          stages: {
            orderBy: { stageNumber: 'asc' },
            include: { criteria: true, gate: true },
          },
        },
      });
    });
  }

  /**
   * List all stage templates for a tenant
   */
  async getTemplates(tenantId, userId = null) {
    await this.ensureDefaultTemplate(tenantId, userId);
    return await prisma.rdStageTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
          include: {
            gate: true,
            _count: { select: { criteria: true } },
          },
        },
        _count: { select: { governances: true } },
      },
    });
  }

  /**
   * Get single template details
   */
  async getTemplateById(tenantId, id) {
    const template = await prisma.rdStageTemplate.findFirst({
      where: { id, tenantId },
      include: {
        stages: {
          orderBy: { stageNumber: 'asc' },
          include: {
            criteria: { orderBy: { sortOrder: 'asc' } },
            gate: true,
          },
        },
        _count: { select: { governances: true } },
      },
    });

    if (!template) {
      const error = new Error('Stage-gate template not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return template;
  }

  /**
   * Create custom Stage-Gate template
   */
  async createTemplate(tenantId, data, userId) {
    const { name, code, description, stages } = data;

    if (!name || name.trim() === '') {
      const error = new Error('Template name is required.');
      error.statusCode = 400;
      throw error;
    }

    const tCode = (code || name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()).trim();

    // Check duplicate code
    const existing = await prisma.rdStageTemplate.findFirst({
      where: { tenantId, code: tCode },
    });
    if (existing) {
      const error = new Error(`Stage template with code "${tCode}" already exists.`);
      error.statusCode = 400;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      const template = await tx.rdStageTemplate.create({
        data: {
          tenantId,
          name: name.trim(),
          code: tCode,
          description: description || '',
          version: 1,
          isDefault: Boolean(data.isDefault),
          createdById: userId,
        },
      });

      if (Array.isArray(stages) && stages.length > 0) {
        for (let i = 0; i < stages.length; i++) {
          const s = stages[i];
          const stageNumber = i + 1;
          const stage = await tx.rdInnovationStage.create({
            data: {
              tenantId,
              templateId: template.id,
              name: s.name.trim(),
              code: s.code || `STAGE_${stageNumber}_${s.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
              stageNumber,
              description: s.description || '',
              expectedDeliverables: s.expectedDeliverables || '',
              color: s.color || '#3b82f6',
              responsibleRole: s.responsibleRole || 'RD_LEAD',
            },
          });

          // Gate
          await tx.rdDecisionGate.create({
            data: {
              tenantId,
              stageId: stage.id,
              name: s.gateName || `Gate ${stageNumber}: ${s.name} Review`,
              code: s.gateCode || `GATE_${stageNumber}`,
              gateOrder: stageNumber,
              approvalPolicy: s.approvalPolicy || 'ALL_MUST_APPROVE',
              requiredSignOffCount: s.requiredSignOffCount || 1,
              reviewInstructions: s.reviewInstructions || '',
            },
          });

          // Criteria
          if (Array.isArray(s.criteria)) {
            for (let cIdx = 0; cIdx < s.criteria.length; cIdx++) {
              const crit = s.criteria[cIdx];
              await tx.rdStageCriterion.create({
                data: {
                  tenantId,
                  stageId: stage.id,
                  name: crit.name.trim(),
                  type: crit.type || 'EXIT',
                  isMandatory: crit.isMandatory !== undefined ? Boolean(crit.isMandatory) : true,
                  evidenceRequired: Boolean(crit.evidenceRequired),
                  sortOrder: cIdx + 1,
                  validationRule: crit.validationRule || null,
                },
              });
            }
          }
        }
      }

      return await tx.rdStageTemplate.findUnique({
        where: { id: template.id },
        include: {
          stages: {
            orderBy: { stageNumber: 'asc' },
            include: { criteria: true, gate: true },
          },
        },
      });
    });
  }

  /**
   * Initialize Stage-Gate Governance on an R&D Project
   */
  async initializeProjectGovernance(tenantId, projectId, data = {}, userId = null) {
    // 1. Verify project
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
      include: { intakeProposal: true },
    });

    if (!project) {
      const error = new Error('R&D Project not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    // 2. Check if governance instance already exists
    const existing = await prisma.rdProjectGovernance.findUnique({
      where: { projectId },
      include: {
        template: true,
        currentStage: { include: { criteria: true, gate: true } },
        reviews: { orderBy: { cycleNumber: 'desc' }, take: 1 },
      },
    });

    if (existing) {
      return existing;
    }

    // 3. Resolve template
    let templateId = data.templateId;
    let template = null;

    if (templateId) {
      template = await prisma.rdStageTemplate.findFirst({
        where: { id: templateId, tenantId, isActive: true },
        include: {
          stages: {
            orderBy: { stageNumber: 'asc' },
            include: { criteria: true, gate: true },
          },
        },
      });
    }

    if (!template) {
      template = await this.ensureDefaultTemplate(tenantId, userId);
    }

    if (!template || !template.stages || template.stages.length === 0) {
      const error = new Error('No valid innovation stages found in selected template.');
      error.statusCode = 400;
      throw error;
    }

    const stage1 = template.stages[0];
    const gate1 = stage1.gate;

    return await prisma.$transaction(async (tx) => {
      // 4. Create governance record
      const governance = await tx.rdProjectGovernance.create({
        data: {
          tenantId,
          projectId,
          templateId: template.id,
          templateVersion: template.version,
          currentStageId: stage1.id,
          currentGateId: gate1 ? gate1.id : null,
          governanceStatus: 'ACTIVE',
          originProposalId: project.intakeProposal?.id || null,
        },
        include: {
          template: true,
          currentStage: { include: { criteria: true, gate: true } },
        },
      });

      // 5. Create initial review cycle for Gate 1
      let initialReview = null;
      if (gate1) {
        initialReview = await tx.rdGateReview.create({
          data: {
            tenantId,
            governanceId: governance.id,
            projectId,
            gateId: gate1.id,
            stageId: stage1.id,
            cycleNumber: 1,
            status: 'READY_FOR_REVIEW',
            summary: `Initial review cycle for ${stage1.name}`,
            criteriaTotalCount: stage1.criteria.length,
          },
        });
      }

      // 6. Record stage progression history
      await tx.rdProjectStageHistory.create({
        data: {
          tenantId,
          governanceId: governance.id,
          projectId,
          toStageId: stage1.id,
          toStageName: stage1.name,
          triggerGateId: gate1 ? gate1.id : null,
          eventType: 'INITIALIZED',
          actorId: userId,
          reason: 'Stage-Gate governance initialized for project.',
        },
      });

      // 7. Update project stage field
      await tx.erpProject.update({
        where: { id: projectId },
        data: { stage: stage1.name },
      });

      // 8. Audit log
      await tx.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Governance Initialized: ${project.name}`,
          description: `Project initialized on stage "${stage1.name}" using template "${template.name}".`,
          metadata: { projectId, governanceId: governance.id, stageId: stage1.id },
        },
      });

      return {
        ...governance,
        activeReview: initialReview,
      };
    });
  }

  /**
   * Get project governance details
   */
  async getProjectGovernance(tenantId, projectId, userId = null) {
    let governance = await prisma.rdProjectGovernance.findFirst({
      where: { projectId, tenantId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            budget: true,
            spent: true,
            progress: true,
            status: true,
            stage: true,
            priority: true,
            priorityScore: true,
            manager: true,
          },
        },
        template: {
          include: {
            stages: {
              orderBy: { stageNumber: 'asc' },
              include: { criteria: true, gate: true },
            },
          },
        },
        currentStage: {
          include: {
            criteria: { orderBy: { sortOrder: 'asc' } },
            gate: true,
          },
        },
        currentGate: true,
        reviews: {
          orderBy: { cycleNumber: 'desc' },
          take: 5,
          include: {
            gate: true,
            stage: true,
            reviewers: {
              include: { reviewer: { select: { id: true, name: true, email: true, role: true } } },
            },
            signOffs: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
            evidence: true,
            decisions: {
              include: { maker: { select: { id: true, name: true, email: true } } },
            },
            comments: {
              include: { author: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!governance) {
      // Auto-initialize if project exists
      governance = await this.initializeProjectGovernance(tenantId, projectId, {}, userId);
      return await this.getProjectGovernance(tenantId, projectId, userId);
    }

    return governance;
  }

  /**
   * Submit Gate for Review
   */
  async submitGateReview(tenantId, reviewId, data = {}, userId) {
    const review = await prisma.rdGateReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        governance: true,
        stage: { include: { criteria: true } },
        evidence: true,
      },
    });

    if (!review) {
      const error = new Error('Gate review not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    if (review.governance.governanceStatus === 'ON_HOLD') {
      const error = new Error('Cannot submit gate review while project governance is ON HOLD.');
      error.statusCode = 400;
      throw error;
    }

    if (review.governance.governanceStatus === 'TERMINATED') {
      const error = new Error('Cannot submit gate review for a TERMINATED project.');
      error.statusCode = 400;
      throw error;
    }

    // Verify mandatory criteria
    const mandatoryCriteria = review.stage.criteria.filter((c) => c.isMandatory && c.type === 'EXIT');
    const criteriaRequiringEvidence = mandatoryCriteria.filter((c) => c.evidenceRequired);

    if (criteriaRequiringEvidence.length > 0) {
      const attachedCriterionIds = new Set(review.evidence.map((e) => e.criterionId).filter(Boolean));
      const hasGeneralEvidence = review.evidence.length > 0;

      if (!hasGeneralEvidence && criteriaRequiringEvidence.some((c) => !attachedCriterionIds.has(c.id))) {
        const error = new Error('Mandatory exit criteria require attached research evidence before submission.');
        error.statusCode = 400;
        throw error;
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.rdGateReview.update({
        where: { id: reviewId },
        data: {
          status: 'SUBMITTED',
          submittedById: userId,
          submittedAt: new Date(),
          summary: data.summary || review.summary,
          notes: data.notes || review.notes,
          criteriaCompletedCount: mandatoryCriteria.length,
          allCriteriaMet: true,
        },
      });

      await tx.rdProjectStageHistory.create({
        data: {
          tenantId,
          governanceId: review.governanceId,
          projectId: review.projectId,
          fromStageId: review.stageId,
          toStageId: review.stageId,
          fromStageName: review.stage.name,
          toStageName: review.stage.name,
          triggerGateId: review.gateId,
          eventType: 'SUBMITTED_FOR_REVIEW',
          actorId: userId,
          reason: data.summary || 'Gate submitted for formal review.',
        },
      });

      await tx.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Gate Submitted for Review`,
          description: `Stage "${review.stage.name}" submitted for gate decision.`,
          metadata: { reviewId, projectId: review.projectId, gateId: review.gateId },
        },
      });

      return updatedReview;
    });
  }

  /**
   * Assign Gatekeepers / Reviewers
   */
  async assignReviewers(tenantId, reviewId, data, assignedById) {
    const review = await prisma.rdGateReview.findFirst({
      where: { id: reviewId, tenantId },
      include: { governance: true },
    });

    if (!review) {
      const error = new Error('Gate review not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    const reviewerIds = Array.isArray(data.reviewers)
      ? data.reviewers
      : [data.reviewerId || data.userId];

    const role = data.role || 'GATEKEEPER';
    const assignments = [];

    for (const rid of reviewerIds) {
      if (!rid) continue;
      const user = await prisma.user.findFirst({ where: { id: rid, tenantId } });
      if (!user) continue;

      const assignment = await prisma.rdGateReviewer.upsert({
        where: {
          reviewId_userId: { reviewId, userId: rid },
        },
        create: {
          tenantId,
          reviewId,
          userId: rid,
          role,
          status: 'PENDING',
          assignedById,
        },
        update: {
          role,
          status: 'PENDING',
          assignedById,
        },
        include: {
          reviewer: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      assignments.push(assignment);
    }

    // Update review status to UNDER_REVIEW if currently SUBMITTED
    if (review.status === 'SUBMITTED' || review.status === 'READY_FOR_REVIEW') {
      await prisma.rdGateReview.update({
        where: { id: reviewId },
        data: { status: 'UNDER_REVIEW' },
      });
    }

    return assignments;
  }

  /**
   * Submit Reviewer Formal Sign-Off
   */
  async submitSignOff(tenantId, reviewId, data, userId) {
    const { recommendation, comments } = data;

    if (!recommendation) {
      const error = new Error('Recommendation (APPROVE, REJECT, REWORK, HOLD, MORE_INFO) is required.');
      error.statusCode = 400;
      throw error;
    }

    const review = await prisma.rdGateReview.findFirst({
      where: { id: reviewId, tenantId },
      include: { governance: true, gate: true },
    });

    if (!review) {
      const error = new Error('Gate review not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Upsert sign-off
      const signOff = await tx.rdGateSignOff.upsert({
        where: {
          reviewId_userId: { reviewId, userId },
        },
        create: {
          tenantId,
          reviewId,
          userId,
          recommendation,
          comments: comments || '',
        },
        update: {
          recommendation,
          comments: comments || '',
          signedOffAt: new Date(),
        },
      });

      // 2. Update reviewer status
      await tx.rdGateReviewer.updateMany({
        where: { reviewId, userId },
        data: { status: 'SIGN_OFF_SUBMITTED' },
      });

      // 3. Activity log
      await tx.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Gate Sign-Off Recorded`,
          description: `Evaluator recorded sign-off (${recommendation}) on gate review.`,
          metadata: { reviewId, recommendation, signOffId: signOff.id },
        },
      });

      return signOff;
    });
  }

  /**
   * Upload / Link Evidence Document to Gate Review
   */
  async uploadEvidence(tenantId, reviewId, data, userId) {
    const { title, description, evidenceType = 'DOCUMENT', fileUrl, fileSize, criterionId } = data;

    if (!title || title.trim() === '') {
      const error = new Error('Evidence title is required.');
      error.statusCode = 400;
      throw error;
    }

    const review = await prisma.rdGateReview.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review) {
      const error = new Error('Gate review not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    const evidence = await prisma.rdGateEvidence.create({
      data: {
        tenantId,
        reviewId,
        projectId: review.projectId,
        criterionId: criterionId || null,
        title: title.trim(),
        description: description || '',
        evidenceType,
        fileUrl: fileUrl || `uploads/evidence/${Date.now()}_${title.replace(/\s+/g, '_')}.pdf`,
        fileSize: fileSize || 1024 * 250,
        uploadedById: userId,
        status: 'PENDING_REVIEW',
      },
    });

    return evidence;
  }

  /**
   * Record Authoritative Final Gate Decision
   * Outcomes: GO_CONTINUE, HOLD, REWORK_RECYCLE, TERMINATE_KILL, REQUEST_MORE_INFO
   */
  async recordGateDecision(tenantId, reviewId, data, userId) {
    const { decision, decisionReason, decisionComments } = data;

    const validDecisions = [
      'GO_CONTINUE',
      'HOLD',
      'REWORK_RECYCLE',
      'TERMINATE_KILL',
      'REQUEST_MORE_INFO',
    ];

    if (!validDecisions.includes(decision)) {
      const error = new Error(`Invalid decision outcome: ${decision}`);
      error.statusCode = 400;
      throw error;
    }

    if (!decisionReason || decisionReason.trim() === '') {
      const error = new Error('Documented decision justification / reason is mandatory.');
      error.statusCode = 400;
      throw error;
    }

    const review = await prisma.rdGateReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        governance: {
          include: {
            template: {
              include: {
                stages: {
                  orderBy: { stageNumber: 'asc' },
                  include: { gate: true },
                },
              },
            },
          },
        },
        stage: true,
        gate: true,
        signOffs: true,
      },
    });

    if (!review) {
      const error = new Error('Gate review not found or access denied.');
      error.statusCode = 404;
      throw error;
    }

    // Verify approval policy if GO_CONTINUE
    if (decision === 'GO_CONTINUE') {
      const policy = review.gate.approvalPolicy;
      const minSignOffs = review.gate.requiredSignOffCount || 1;
      const approveSignOffs = review.signOffs.filter((s) => s.recommendation === 'APPROVE');

      if (policy === 'ALL_MUST_APPROVE' && review.signOffs.length > 0 && approveSignOffs.length < review.signOffs.length) {
        const error = new Error('Cannot execute GO decision: Policy requires unanimous approval and outstanding negative sign-offs exist.');
        error.statusCode = 400;
        throw error;
      }

      if (policy === 'MINIMUM_COUNT' && approveSignOffs.length < minSignOffs) {
        const error = new Error(`Cannot execute GO decision: Minimum of ${minSignOffs} approvals required (current: ${approveSignOffs.length}).`);
        error.statusCode = 400;
        throw error;
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Create decision record
      const gateDecision = await tx.rdGateDecision.create({
        data: {
          tenantId,
          reviewId,
          governanceId: review.governanceId,
          projectId: review.projectId,
          gateId: review.gateId,
          decision,
          decisionReason: decisionReason.trim(),
          decisionComments: decisionComments || '',
          decisionMakerId: userId,
        },
      });

      const templateStages = review.governance.template.stages;
      const currentStageIndex = templateStages.findIndex((s) => s.id === review.stageId);
      const nextStage = currentStageIndex !== -1 && currentStageIndex + 1 < templateStages.length
        ? templateStages[currentStageIndex + 1]
        : null;

      let newGovernanceStatus = review.governance.governanceStatus;
      let newCurrentStageId = review.governance.currentStageId;
      let newCurrentGateId = review.governance.currentGateId;
      let eventType = 'DECISION_RECORDED';
      let nextReview = null;

      // 2. Handle outcome logic
      if (decision === 'GO_CONTINUE') {
        await tx.rdGateReview.update({
          where: { id: reviewId },
          data: { status: 'APPROVED' },
        });

        if (nextStage) {
          // Advance project to next stage
          newCurrentStageId = nextStage.id;
          newCurrentGateId = nextStage.gate ? nextStage.gate.id : null;
          newGovernanceStatus = 'ACTIVE';
          eventType = 'ADVANCED';

          // Create next review cycle
          if (nextStage.gate) {
            nextReview = await tx.rdGateReview.create({
              data: {
                tenantId,
                governanceId: review.governanceId,
                projectId: review.projectId,
                gateId: nextStage.gate.id,
                stageId: nextStage.id,
                cycleNumber: 1,
                status: 'READY_FOR_REVIEW',
                summary: `Review cycle for ${nextStage.name}`,
              },
            });
          }

          // Update ERP project stage string
          await tx.erpProject.update({
            where: { id: review.projectId },
            data: { stage: nextStage.name },
          });

          await tx.rdProjectStageHistory.create({
            data: {
              tenantId,
              governanceId: review.governanceId,
              projectId: review.projectId,
              fromStageId: review.stageId,
              toStageId: nextStage.id,
              fromStageName: review.stage.name,
              toStageName: nextStage.name,
              triggerGateId: review.gateId,
              triggerDecisionId: gateDecision.id,
              eventType: 'ADVANCED',
              actorId: userId,
              reason: decisionReason,
            },
          });
        } else {
          // Final stage completed
          newGovernanceStatus = 'COMPLETED';
          eventType = 'COMPLETED';

          await tx.rdProjectStageHistory.create({
            data: {
              tenantId,
              governanceId: review.governanceId,
              projectId: review.projectId,
              fromStageId: review.stageId,
              toStageId: null,
              fromStageName: review.stage.name,
              toStageName: 'COMPLETED',
              triggerGateId: review.gateId,
              triggerDecisionId: gateDecision.id,
              eventType: 'COMPLETED',
              actorId: userId,
              reason: 'Final stage-gate completed successfully. Project transferred to production.',
            },
          });
        }
      } else if (decision === 'HOLD') {
        newGovernanceStatus = 'ON_HOLD';
        eventType = 'HELD';

        await tx.rdGateReview.update({
          where: { id: reviewId },
          data: { status: 'ON_HOLD' },
        });

        await tx.rdProjectStageHistory.create({
          data: {
            tenantId,
            governanceId: review.governanceId,
            projectId: review.projectId,
            fromStageId: review.stageId,
            toStageId: review.stageId,
            fromStageName: review.stage.name,
            toStageName: review.stage.name,
            triggerGateId: review.gateId,
            triggerDecisionId: gateDecision.id,
            eventType: 'HELD',
            actorId: userId,
            reason: decisionReason,
          },
        });
      } else if (decision === 'REWORK_RECYCLE') {
        newGovernanceStatus = 'REWORK_REQUIRED';
        eventType = 'REWORK_REQUESTED';

        await tx.rdGateReview.update({
          where: { id: reviewId },
          data: { status: 'REWORK_REQUIRED' },
        });

        // Create new review cycle for resubmission
        nextReview = await tx.rdGateReview.create({
          data: {
            tenantId,
            governanceId: review.governanceId,
            projectId: review.projectId,
            gateId: review.gateId,
            stageId: review.stageId,
            cycleNumber: review.cycleNumber + 1,
            status: 'READY_FOR_REVIEW',
            summary: `Rework cycle ${review.cycleNumber + 1} for ${review.stage.name}`,
            notes: `Rework instructions: ${decisionReason}`,
          },
        });

        await tx.rdProjectStageHistory.create({
          data: {
            tenantId,
            governanceId: review.governanceId,
            projectId: review.projectId,
            fromStageId: review.stageId,
            toStageId: review.stageId,
            fromStageName: review.stage.name,
            toStageName: review.stage.name,
            triggerGateId: review.gateId,
            triggerDecisionId: gateDecision.id,
            eventType: 'REWORK_REQUESTED',
            actorId: userId,
            reason: decisionReason,
          },
        });
      } else if (decision === 'TERMINATE_KILL') {
        newGovernanceStatus = 'TERMINATED';
        eventType = 'TERMINATED';

        await tx.rdGateReview.update({
          where: { id: reviewId },
          data: { status: 'REJECTED' },
        });

        await tx.rdProjectStageHistory.create({
          data: {
            tenantId,
            governanceId: review.governanceId,
            projectId: review.projectId,
            fromStageId: review.stageId,
            toStageId: null,
            fromStageName: review.stage.name,
            toStageName: 'TERMINATED',
            triggerGateId: review.gateId,
            triggerDecisionId: gateDecision.id,
            eventType: 'TERMINATED',
            actorId: userId,
            reason: decisionReason,
          },
        });
      } else if (decision === 'REQUEST_MORE_INFO') {
        await tx.rdGateReview.update({
          where: { id: reviewId },
          data: {
            status: 'MORE_INFO_REQUIRED',
            moreInfoRequestedNotes: decisionReason,
          },
        });

        await tx.rdProjectStageHistory.create({
          data: {
            tenantId,
            governanceId: review.governanceId,
            projectId: review.projectId,
            fromStageId: review.stageId,
            toStageId: review.stageId,
            fromStageName: review.stage.name,
            toStageName: review.stage.name,
            triggerGateId: review.gateId,
            triggerDecisionId: gateDecision.id,
            eventType: 'MORE_INFO_REQUESTED',
            actorId: userId,
            reason: decisionReason,
          },
        });
      }

      // Update governance status
      const updatedGovernance = await tx.rdProjectGovernance.update({
        where: { id: review.governanceId },
        data: {
          governanceStatus: newGovernanceStatus,
          currentStageId: newCurrentStageId,
          currentGateId: newCurrentGateId,
          lastTransitionAt: new Date(),
          holdReason: decision === 'HOLD' ? decisionReason : null,
          terminationReason: decision === 'TERMINATE_KILL' ? decisionReason : null,
          completedAt: newGovernanceStatus === 'COMPLETED' ? new Date() : null,
        },
      });

      // Audit log
      await tx.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Gate Decision: ${decision}`,
          description: `Authoritative decision recorded for gate ${review.gate.name}: ${decision}.`,
          metadata: { decision, decisionReason, reviewId, projectId: review.projectId },
        },
      });

      return {
        decision: gateDecision,
        governance: updatedGovernance,
        nextReview,
      };
    });
  }

  /**
   * Resume governance from ON_HOLD status
   */
  async resumeHeldGovernance(tenantId, projectId, data = {}, userId) {
    const governance = await prisma.rdProjectGovernance.findFirst({
      where: { projectId, tenantId },
      include: {
        currentStage: true,
        currentGate: true,
        reviews: { orderBy: { cycleNumber: 'desc' }, take: 1 },
      },
    });

    if (!governance) {
      const error = new Error('Project governance not found.');
      error.statusCode = 404;
      throw error;
    }

    if (governance.governanceStatus !== 'ON_HOLD') {
      const error = new Error('Only projects with ON_HOLD status can be resumed.');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.rdProjectGovernance.update({
        where: { id: governance.id },
        data: {
          governanceStatus: 'ACTIVE',
          holdReason: null,
          lastTransitionAt: new Date(),
        },
      });

      // Resume latest review if it was ON_HOLD
      const latestReview = governance.reviews[0];
      if (latestReview && latestReview.status === 'ON_HOLD') {
        await tx.rdGateReview.update({
          where: { id: latestReview.id },
          data: { status: 'UNDER_REVIEW' },
        });
      }

      await tx.rdProjectStageHistory.create({
        data: {
          tenantId,
          governanceId: governance.id,
          projectId: governance.projectId,
          fromStageId: governance.currentStageId,
          toStageId: governance.currentStageId,
          fromStageName: governance.currentStage?.name,
          toStageName: governance.currentStage?.name,
          eventType: 'RESUMED',
          actorId: userId,
          reason: data.reason || 'Project governance resumed from hold.',
        },
      });

      await tx.activity.create({
        data: {
          tenantId,
          userId,
          type: 'STATUS_CHANGED',
          title: `Governance Resumed`,
          description: `Project governance resumed from hold.`,
          metadata: { projectId, governanceId: governance.id },
        },
      });

      return updated;
    });
  }

  /**
   * Governance Dashboard Metrics
   */
  async getDashboardMetrics(tenantId) {
    const [governanceRecords, totalReviews, pendingSignOffs] = await Promise.all([
      prisma.rdProjectGovernance.findMany({
        where: { tenantId },
        include: {
          project: { select: { name: true, budget: true, progress: true } },
          currentStage: { select: { id: true, name: true, stageNumber: true, color: true } },
        },
      }),
      prisma.rdGateReview.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'] } },
      }),
      prisma.rdGateReviewer.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    const statusCounts = {
      ACTIVE: 0,
      ON_HOLD: 0,
      REWORK_REQUIRED: 0,
      TERMINATED: 0,
      COMPLETED: 0,
    };

    const stageDistribution = {};

    governanceRecords.forEach((g) => {
      if (statusCounts[g.governanceStatus] !== undefined) {
        statusCounts[g.governanceStatus] += 1;
      }
      if (g.currentStage) {
        const sName = g.currentStage.name;
        stageDistribution[sName] = (stageDistribution[sName] || 0) + 1;
      }
    });

    return {
      totalGovernedProjects: governanceRecords.length,
      activeProjects: statusCounts.ACTIVE,
      heldProjects: statusCounts.ON_HOLD,
      reworkProjects: statusCounts.REWORK_REQUIRED,
      terminatedProjects: statusCounts.TERMINATED,
      completedProjects: statusCounts.COMPLETED,
      activeReviews: totalReviews,
      pendingSignOffs,
      statusCounts,
      stageDistribution,
    };
  }

  /**
   * Reviewer Inbox
   */
  async getReviewerInbox(tenantId, userId) {
    return await prisma.rdGateReviewer.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: { assignedAt: 'desc' },
      include: {
        review: {
          include: {
            stage: true,
            gate: true,
            governance: {
              include: {
                project: { select: { id: true, name: true, manager: true, budget: true, progress: true } },
              },
            },
            evidence: true,
            signOffs: { where: { userId } },
          },
        },
      },
    });
  }

  /**
   * List projects under governance with multi-filter query
   */
  async getGovernedProjects(tenantId, query = {}) {
    const { status, stageId, search, page = 1, limit = 20 } = query;

    const where = { tenantId };

    if (status && status !== 'ALL') {
      where.governanceStatus = status;
    }

    if (stageId && stageId !== 'ALL') {
      where.currentStageId = stageId;
    }

    if (search) {
      where.project = {
        name: { contains: search },
      };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [governances, total] = await Promise.all([
      prisma.rdProjectGovernance.findMany({
        where,
        skip,
        take,
        orderBy: { lastTransitionAt: 'desc' },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              budget: true,
              spent: true,
              progress: true,
              manager: true,
              priority: true,
              priorityScore: true,
            },
          },
          currentStage: true,
          currentGate: true,
          reviews: {
            orderBy: { cycleNumber: 'desc' },
            take: 1,
            include: {
              signOffs: true,
              reviewers: true,
            },
          },
        },
      }),
      prisma.rdProjectGovernance.count({ where }),
    ]);

    return {
      projects: governances,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }
}

module.exports = new RdGovernanceService();
