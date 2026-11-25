const prisma = require('../config/prisma');

class RdResearchService {
  // ==============================================================================
  // 1. RESEARCH OBJECTIVE MANAGEMENT (REQUIREMENT 26)
  // ==============================================================================

  async getObjectives(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.ownerId) where.ownerId = filters.ownerId;

    const objectives = await prisma.rdResearchObjective.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true, projectType: true, stage: true } },
        hypotheses: {
          select: {
            id: true,
            title: true,
            status: true,
            hypothesisType: true,
            evaluationDecision: true,
          },
        },
        experiments: {
          select: {
            id: true,
            title: true,
            status: true,
            experimentType: true,
          },
        },
      },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
    });

    return objectives.map((obj) => {
      const totalHypotheses = obj.hypotheses.length;
      const evaluatedHypotheses = obj.hypotheses.filter((h) =>
        ['SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE'].includes(h.status)
      ).length;
      const totalExperiments = obj.experiments.length;
      const completedExperiments = obj.experiments.filter((e) => e.status === 'COMPLETED').length;

      // Mathematically documented objective progress rollup
      let calculatedProgress = obj.progress;
      const totalItems = totalHypotheses + totalExperiments;
      if (totalItems > 0) {
        calculatedProgress = Math.round(((evaluatedHypotheses + completedExperiments) / totalItems) * 100);
      }

      return {
        ...obj,
        progress: calculatedProgress,
        metrics: {
          totalHypotheses,
          evaluatedHypotheses,
          totalExperiments,
          completedExperiments,
        },
      };
    });
  }

  async getObjectiveById(tenantId, id) {
    const objective = await prisma.rdResearchObjective.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, name: true, projectType: true, stage: true, client: true } },
        hypotheses: {
          include: {
            owner: { select: { id: true, name: true } },
            experiments: { select: { id: true, title: true, status: true } },
          },
        },
        experiments: {
          include: {
            owner: { select: { id: true, name: true } },
            runs: { select: { id: true, runNumber: true, status: true } },
          },
        },
        evidences: true,
        outcomes: true,
      },
    });

    if (!objective) {
      throw new Error('Research objective not found.');
    }

    return objective;
  }

  async createObjective(tenantId, data, userId) {
    const {
      projectId,
      title,
      description,
      researchQuestion,
      category = 'APPLIED_RESEARCH',
      priority = 'MEDIUM',
      status = 'ACTIVE',
      ownerId,
      startDate,
      targetDate,
      successCriteria,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Objective title is required.');

    // Verify project belongs to tenant
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('R&D project not found in tenant workspace.');

    const objective = await prisma.rdResearchObjective.create({
      data: {
        tenantId,
        projectId,
        title: title.trim(),
        description: description || null,
        researchQuestion: researchQuestion || null,
        category,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        status: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(status) ? status : 'ACTIVE',
        ownerId: ownerId || userId || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        targetDate: targetDate ? new Date(targetDate) : null,
        successCriteria: successCriteria || null,
        progress: 0,
        createdById: userId || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return objective;
  }

  async updateObjective(tenantId, id, data) {
    const existing = await prisma.rdResearchObjective.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research objective not found.');

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.researchQuestion !== undefined) updateData.researchQuestion = data.researchQuestion;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.targetDate !== undefined) updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    if (data.completionDate !== undefined)
      updateData.completionDate = data.completionDate ? new Date(data.completionDate) : null;
    if (data.successCriteria !== undefined) updateData.successCriteria = data.successCriteria;
    if (data.progress !== undefined) updateData.progress = parseInt(data.progress, 10);
    if (data.status !== undefined) {
      if (!['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(data.status)) {
        throw new Error(`Invalid status: ${data.status}`);
      }
      updateData.status = data.status;
      if (data.status === 'COMPLETED' && !updateData.completionDate) {
        updateData.completionDate = new Date();
      }
    }

    const updated = await prisma.rdResearchObjective.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;
  }

  async deleteObjective(tenantId, id) {
    const existing = await prisma.rdResearchObjective.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research objective not found.');

    await prisma.rdResearchObjective.delete({ where: { id } });
    return { success: true, message: 'Objective deleted successfully.' };
  }

  // ==============================================================================
  // 2. RESEARCH HYPOTHESIS MANAGEMENT (REQUIREMENT 27)
  // ==============================================================================

  async getHypotheses(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.objectiveId) where.objectiveId = filters.objectiveId;
    if (filters.status) where.status = filters.status;
    if (filters.hypothesisType) where.hypothesisType = filters.hypothesisType;
    if (filters.evaluationDecision) where.evaluationDecision = filters.evaluationDecision;

    return await prisma.rdHypothesis.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        objective: { select: { id: true, title: true, status: true } },
        project: { select: { id: true, name: true } },
        experiments: {
          select: {
            id: true,
            title: true,
            status: true,
            experimentType: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getHypothesisById(tenantId, id) {
    const hypothesis = await prisma.rdHypothesis.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        objective: { select: { id: true, title: true, researchQuestion: true, status: true } },
        project: { select: { id: true, name: true, stage: true, client: true } },
        experiments: {
          include: {
            runs: { select: { id: true, runNumber: true, status: true, completedAt: true } },
            results: true,
          },
        },
        evidences: true,
        outcomes: true,
      },
    });

    if (!hypothesis) {
      throw new Error('Hypothesis not found.');
    }

    return hypothesis;
  }

  async createHypothesis(tenantId, data, userId) {
    const {
      projectId,
      objectiveId,
      hypothesisCode,
      title,
      statement,
      description,
      scientificRationale,
      expectedOutcome,
      hypothesisType = 'ALTERNATIVE_HYPOTHESIS',
      priority = 'MEDIUM',
      status = 'PROPOSED',
      ownerId,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Hypothesis title is required.');
    if (!statement || !statement.trim()) throw new Error('Formal hypothesis statement is required.');

    // Validate project
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('Project not found in tenant.');

    // Validate objective if provided
    if (objectiveId) {
      const obj = await prisma.rdResearchObjective.findFirst({
        where: { id: objectiveId, tenantId },
      });
      if (!obj) throw new Error('Associated research objective not found.');
    }

    const code = hypothesisCode || `HYP-${Date.now().toString().slice(-4)}`;

    const validTypes = [
      'NULL_HYPOTHESIS',
      'ALTERNATIVE_HYPOTHESIS',
      'DIRECTIONAL_HYPOTHESIS',
      'NON_DIRECTIONAL_HYPOTHESIS',
    ];

    const hypothesis = await prisma.rdHypothesis.create({
      data: {
        tenantId,
        projectId,
        objectiveId: objectiveId || null,
        hypothesisCode: code,
        title: title.trim(),
        statement: statement.trim(),
        description: description || null,
        scientificRationale: scientificRationale || null,
        expectedOutcome: expectedOutcome || null,
        hypothesisType: validTypes.includes(hypothesisType) ? hypothesisType : 'ALTERNATIVE_HYPOTHESIS',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        status: ['DRAFT', 'PROPOSED', 'UNDER_TESTING', 'SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE', 'ARCHIVED'].includes(
          status
        )
          ? status
          : 'PROPOSED',
        ownerId: ownerId || userId || null,
        createdById: userId || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        objective: { select: { id: true, title: true } },
      },
    });

    return hypothesis;
  }

  async updateHypothesis(tenantId, id, data) {
    const existing = await prisma.rdHypothesis.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Hypothesis not found.');

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.statement !== undefined) updateData.statement = data.statement.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scientificRationale !== undefined) updateData.scientificRationale = data.scientificRationale;
    if (data.expectedOutcome !== undefined) updateData.expectedOutcome = data.expectedOutcome;
    if (data.hypothesisType !== undefined) updateData.hypothesisType = data.hypothesisType;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.objectiveId !== undefined) updateData.objectiveId = data.objectiveId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.status !== undefined) {
      if (
        !['DRAFT', 'PROPOSED', 'UNDER_TESTING', 'SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE', 'ARCHIVED'].includes(
          data.status
        )
      ) {
        throw new Error(`Invalid hypothesis status: ${data.status}`);
      }
      updateData.status = data.status;
    }

    return await prisma.rdHypothesis.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        objective: { select: { id: true, title: true } },
      },
    });
  }

  /**
   * Structured Evidence-Based Hypothesis Evaluation
   */
  async evaluateHypothesis(tenantId, id, evaluationData, userId) {
    const existing = await prisma.rdHypothesis.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Hypothesis not found.');

    const { decision, evaluationSummary, supportingEvidence, contradictoryEvidence, conclusion } = evaluationData;

    if (!['SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE'].includes(decision)) {
      throw new Error(`Invalid evaluation decision: ${decision}. Must be SUPPORTED, NOT_SUPPORTED, or INCONCLUSIVE.`);
    }

    const updated = await prisma.rdHypothesis.update({
      where: { id },
      data: {
        status: decision,
        evaluationDecision: decision,
        evaluationSummary: evaluationSummary || null,
        supportingEvidence: supportingEvidence || null,
        contradictoryEvidence: contradictoryEvidence || null,
        conclusion: conclusion || null,
        evaluatedById: userId,
        evaluationDate: new Date(),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;
  }

  async deleteHypothesis(tenantId, id) {
    const existing = await prisma.rdHypothesis.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Hypothesis not found.');

    await prisma.rdHypothesis.delete({ where: { id } });
    return { success: true, message: 'Hypothesis deleted successfully.' };
  }

  // ==============================================================================
  // 3. SCIENTIFIC VARIABLES MANAGEMENT (REQUIREMENT 28)
  // ==============================================================================

  async getVariables(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) {
      // Allow project-specific OR global tenant variables (projectId is null)
      where.OR = [{ projectId: filters.projectId }, { projectId: null }];
    }
    if (filters.variableType) where.variableType = filters.variableType;

    return await prisma.rdVariable.findMany({
      where,
      orderBy: [{ variableType: 'asc' }, { name: 'asc' }],
    });
  }

  async createVariable(tenantId, data) {
    const {
      projectId,
      name,
      description,
      variableType = 'INDEPENDENT',
      dataType = 'DECIMAL',
      unit,
      measurementMethod,
      expectedValue,
      minValue,
      maxValue,
      allowedValues,
      isRequired = true,
      notes,
    } = data;

    if (!name || !name.trim()) throw new Error('Variable name is required.');

    const validVarTypes = ['INDEPENDENT', 'DEPENDENT', 'CONTROLLED', 'CONTEXTUAL'];
    if (!validVarTypes.includes(variableType)) {
      throw new Error(`Invalid variableType: ${variableType}`);
    }

    const validDataTypes = ['INTEGER', 'DECIMAL', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'ENUM'];
    if (!validDataTypes.includes(dataType)) {
      throw new Error(`Invalid dataType: ${dataType}`);
    }

    if (minValue !== undefined && maxValue !== undefined && minValue !== null && maxValue !== null) {
      if (parseFloat(minValue) > parseFloat(maxValue)) {
        throw new Error('minValue cannot exceed maxValue.');
      }
    }

    const variable = await prisma.rdVariable.create({
      data: {
        tenantId,
        projectId: projectId || null,
        name: name.trim(),
        description: description || null,
        variableType,
        dataType,
        unit: unit || null,
        measurementMethod: measurementMethod || null,
        expectedValue: expectedValue ? String(expectedValue) : null,
        minValue: minValue !== undefined && minValue !== null ? parseFloat(minValue) : null,
        maxValue: maxValue !== undefined && maxValue !== null ? parseFloat(maxValue) : null,
        allowedValues: allowedValues || null,
        isRequired: !!isRequired,
        notes: notes || null,
      },
    });

    return variable;
  }

  validateMeasurementValue(variable, value) {
    if (value === undefined || value === null || value === '') {
      if (variable.isRequired) {
        return { isValid: false, error: `Value is required for variable '${variable.name}'.` };
      }
      return { isValid: true, numericValue: null };
    }

    const strVal = String(value).trim();

    if (variable.dataType === 'INTEGER') {
      const num = parseInt(strVal, 10);
      if (isNaN(num) || String(num) !== strVal) {
        return { isValid: false, error: `Value '${strVal}' is not a valid INTEGER for '${variable.name}'.` };
      }
      if (variable.minValue !== null && num < variable.minValue) {
        return { isValid: false, error: `Value ${num} is below minimum bound (${variable.minValue}).` };
      }
      if (variable.maxValue !== null && num > variable.maxValue) {
        return { isValid: false, error: `Value ${num} exceeds maximum bound (${variable.maxValue}).` };
      }
      return { isValid: true, numericValue: num };
    }

    if (variable.dataType === 'DECIMAL') {
      const num = parseFloat(strVal);
      if (isNaN(num)) {
        return { isValid: false, error: `Value '${strVal}' is not a valid DECIMAL for '${variable.name}'.` };
      }
      if (variable.minValue !== null && num < variable.minValue) {
        return { isValid: false, error: `Value ${num} is below minimum bound (${variable.minValue}).` };
      }
      if (variable.maxValue !== null && num > variable.maxValue) {
        return { isValid: false, error: `Value ${num} exceeds maximum bound (${variable.maxValue}).` };
      }
      return { isValid: true, numericValue: num };
    }

    if (variable.dataType === 'BOOLEAN') {
      const lower = strVal.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
        return { isValid: false, error: `Value '${strVal}' is not a valid BOOLEAN.` };
      }
      return { isValid: true, numericValue: ['true', '1', 'yes'].includes(lower) ? 1 : 0 };
    }

    if (variable.dataType === 'ENUM') {
      if (Array.isArray(variable.allowedValues) && variable.allowedValues.length > 0) {
        if (!variable.allowedValues.includes(strVal)) {
          return {
            isValid: false,
            error: `Value '${strVal}' is not allowed. Options: ${variable.allowedValues.join(', ')}`,
          };
        }
      }
      return { isValid: true, numericValue: null };
    }

    return { isValid: true, numericValue: null };
  }

  // ==============================================================================
  // 4. EXPERIMENT PROTOCOLS & PROTOCOL STEPS (REQUIREMENT 28, 63)
  // ==============================================================================

  async getProtocols(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) {
      where.OR = [{ projectId: filters.projectId }, { projectId: null }];
    }
    if (filters.status) where.status = filters.status;
    if (filters.isTemplate !== undefined) where.isTemplate = filters.isTemplate === 'true' || filters.isTemplate === true;

    return await prisma.rdExperimentProtocol.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        steps: { orderBy: { stepNumber: 'asc' } },
      },
      orderBy: [{ title: 'asc' }],
    });
  }

  async getProtocolById(tenantId, id) {
    const protocol = await prisma.rdExperimentProtocol.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        steps: { orderBy: { stepNumber: 'asc' } },
        experiments: { select: { id: true, title: true, status: true } },
      },
    });

    if (!protocol) throw new Error('Protocol not found.');
    return protocol;
  }

  async createProtocol(tenantId, data, userId) {
    const {
      projectId,
      protocolCode,
      title,
      description,
      purpose,
      methodology,
      requiredMaterials,
      equipmentDescription,
      safetyInstructions,
      expectedObservations,
      expectedResults,
      estimatedDurationMinutes,
      status = 'ACTIVE',
      isTemplate = false,
      steps = [],
    } = data;

    if (!title || !title.trim()) throw new Error('Protocol title is required.');

    const code = protocolCode || `PRT-${Date.now().toString().slice(-4)}`;

    const protocol = await prisma.rdExperimentProtocol.create({
      data: {
        tenantId,
        projectId: projectId || null,
        protocolCode: code,
        title: title.trim(),
        description: description || null,
        purpose: purpose || null,
        methodology: methodology || null,
        requiredMaterials: requiredMaterials || null,
        equipmentDescription: equipmentDescription || null,
        safetyInstructions: safetyInstructions || null,
        expectedObservations: expectedObservations || null,
        expectedResults: expectedResults || null,
        estimatedDurationMinutes: estimatedDurationMinutes ? parseInt(estimatedDurationMinutes, 10) : null,
        version: 1,
        status: ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status) ? status : 'ACTIVE',
        isTemplate: !!isTemplate,
        ownerId: userId || null,
        createdById: userId || null,
      },
    });

    // Create ordered protocol steps if provided
    if (Array.isArray(steps) && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await prisma.rdProtocolStep.create({
          data: {
            tenantId,
            protocolId: protocol.id,
            stepNumber: s.stepNumber || i + 1,
            title: s.title || `Step ${i + 1}`,
            instructions: s.instructions || s.title || 'Execute step instruction.',
            expectedAction: s.expectedAction || null,
            expectedObservation: s.expectedObservation || null,
            durationMinutes: s.durationMinutes ? parseInt(s.durationMinutes, 10) : null,
            isRequired: s.isRequired !== undefined ? !!s.isRequired : true,
            notes: s.notes || null,
          },
        });
      }
    }

    return await this.getProtocolById(tenantId, protocol.id);
  }

  async updateProtocol(tenantId, id, data) {
    const existing = await prisma.rdExperimentProtocol.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Protocol not found.');

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.methodology !== undefined) updateData.methodology = data.methodology;
    if (data.requiredMaterials !== undefined) updateData.requiredMaterials = data.requiredMaterials;
    if (data.equipmentDescription !== undefined) updateData.equipmentDescription = data.equipmentDescription;
    if (data.safetyInstructions !== undefined) updateData.safetyInstructions = data.safetyInstructions;
    if (data.expectedObservations !== undefined) updateData.expectedObservations = data.expectedObservations;
    if (data.expectedResults !== undefined) updateData.expectedResults = data.expectedResults;
    if (data.estimatedDurationMinutes !== undefined)
      updateData.estimatedDurationMinutes = parseInt(data.estimatedDurationMinutes, 10);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isTemplate !== undefined) updateData.isTemplate = !!data.isTemplate;

    await prisma.rdExperimentProtocol.update({
      where: { id },
      data: updateData,
    });

    return await this.getProtocolById(tenantId, id);
  }

  async createProtocolVersion(tenantId, id, data, userId) {
    const existing = await this.getProtocolById(tenantId, id);
    const newVersion = existing.version + 1;

    // Create a new protocol record with the incremented version preserving historical version
    const newProtocol = await prisma.rdExperimentProtocol.create({
      data: {
        tenantId,
        projectId: existing.projectId,
        protocolCode: `${existing.protocolCode}-v${newVersion}`,
        title: data.title || existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        purpose: data.purpose !== undefined ? data.purpose : existing.purpose,
        methodology: data.methodology !== undefined ? data.methodology : existing.methodology,
        requiredMaterials: data.requiredMaterials !== undefined ? data.requiredMaterials : existing.requiredMaterials,
        equipmentDescription:
          data.equipmentDescription !== undefined ? data.equipmentDescription : existing.equipmentDescription,
        safetyInstructions: data.safetyInstructions !== undefined ? data.safetyInstructions : existing.safetyInstructions,
        expectedObservations:
          data.expectedObservations !== undefined ? data.expectedObservations : existing.expectedObservations,
        expectedResults: data.expectedResults !== undefined ? data.expectedResults : existing.expectedResults,
        estimatedDurationMinutes: existing.estimatedDurationMinutes,
        version: newVersion,
        status: 'ACTIVE',
        isTemplate: existing.isTemplate,
        ownerId: userId || existing.ownerId,
        createdById: userId,
      },
    });

    // Copy steps
    const stepsToCopy = data.steps || existing.steps;
    for (const s of stepsToCopy) {
      await prisma.rdProtocolStep.create({
        data: {
          tenantId,
          protocolId: newProtocol.id,
          stepNumber: s.stepNumber,
          title: s.title,
          instructions: s.instructions,
          expectedAction: s.expectedAction,
          expectedObservation: s.expectedObservation,
          durationMinutes: s.durationMinutes,
          isRequired: s.isRequired,
          notes: s.notes,
        },
      });
    }

    return await this.getProtocolById(tenantId, newProtocol.id);
  }

  async duplicateProtocolTemplate(tenantId, templateId, overrides = {}, userId) {
    const template = await this.getProtocolById(tenantId, templateId);

    const duplicate = await prisma.rdExperimentProtocol.create({
      data: {
        tenantId,
        projectId: overrides.projectId || template.projectId,
        protocolCode: `PRT-${Date.now().toString().slice(-4)}`,
        title: overrides.title || `${template.title} (Copy)`,
        description: overrides.description || template.description,
        purpose: template.purpose,
        methodology: template.methodology,
        requiredMaterials: template.requiredMaterials,
        equipmentDescription: template.equipmentDescription,
        safetyInstructions: template.safetyInstructions,
        expectedObservations: template.expectedObservations,
        expectedResults: template.expectedResults,
        estimatedDurationMinutes: template.estimatedDurationMinutes,
        version: 1,
        status: 'ACTIVE',
        isTemplate: false,
        ownerId: userId,
        createdById: userId,
      },
    });

    for (const s of template.steps) {
      await prisma.rdProtocolStep.create({
        data: {
          tenantId,
          protocolId: duplicate.id,
          stepNumber: s.stepNumber,
          title: s.title,
          instructions: s.instructions,
          expectedAction: s.expectedAction,
          expectedObservation: s.expectedObservation,
          durationMinutes: s.durationMinutes,
          isRequired: s.isRequired,
        },
      });
    }

    return await this.getProtocolById(tenantId, duplicate.id);
  }

  async addProtocolStep(tenantId, protocolId, stepData) {
    const protocol = await prisma.rdExperimentProtocol.findFirst({
      where: { id: protocolId, tenantId },
    });
    if (!protocol) throw new Error('Protocol not found.');

    const maxStep = await prisma.rdProtocolStep.aggregate({
      where: { protocolId, tenantId },
      _max: { stepNumber: true },
    });
    const nextNum = (maxStep._max.stepNumber || 0) + 1;

    const step = await prisma.rdProtocolStep.create({
      data: {
        tenantId,
        protocolId,
        stepNumber: stepData.stepNumber || nextNum,
        title: stepData.title || `Step ${nextNum}`,
        instructions: stepData.instructions || stepData.title,
        expectedAction: stepData.expectedAction || null,
        expectedObservation: stepData.expectedObservation || null,
        durationMinutes: stepData.durationMinutes ? parseInt(stepData.durationMinutes, 10) : null,
        isRequired: stepData.isRequired !== undefined ? !!stepData.isRequired : true,
        notes: stepData.notes || null,
      },
    });

    return step;
  }

  // ==============================================================================
  // 5. EXPERIMENT PLANNING & STATUS (REQUIREMENT 28, 29)
  // ==============================================================================

  async getExperiments(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.objectiveId) where.objectiveId = filters.objectiveId;
    if (filters.hypothesisId) where.hypothesisId = filters.hypothesisId;
    if (filters.protocolId) where.protocolId = filters.protocolId;
    if (filters.status) where.status = filters.status;
    if (filters.experimentType) where.experimentType = filters.experimentType;

    const experiments = await prisma.rdExperiment.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        objective: { select: { id: true, title: true } },
        hypothesis: { select: { id: true, title: true, status: true, evaluationDecision: true } },
        protocol: { select: { id: true, title: true, protocolCode: true, version: true } },
        runs: {
          select: {
            id: true,
            runNumber: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        },
        results: {
          select: {
            id: true,
            isSuccessCriteriaMet: true,
            summary: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return experiments.map((exp) => {
      const totalRuns = exp.runs.length;
      const completedRuns = exp.runs.filter((r) => r.status === 'COMPLETED').length;
      const hasResults = exp.results.length > 0;

      return {
        ...exp,
        runMetrics: {
          totalRuns,
          completedRuns,
          hasResults,
          lastExecutionDate: exp.runs[0]?.completedAt || exp.runs[0]?.startedAt || null,
        },
      };
    });
  }

  async getExperimentById(tenantId, id) {
    const experiment = await prisma.rdExperiment.findFirst({
      where: { id, tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, stage: true, client: true } },
        objective: { select: { id: true, title: true, researchQuestion: true, status: true } },
        hypothesis: {
          select: {
            id: true,
            title: true,
            statement: true,
            hypothesisType: true,
            status: true,
            evaluationDecision: true,
          },
        },
        protocol: {
          include: {
            steps: { orderBy: { stepNumber: 'asc' } },
          },
        },
        task: { select: { id: true, title: true, status: true, rdStatus: true } },
        runs: {
          include: {
            runSteps: { orderBy: { stepNumber: 'asc' } },
            observations: true,
            measurements: true,
            results: true,
          },
          orderBy: { runNumber: 'desc' },
        },
        results: { orderBy: { createdAt: 'desc' } },
        evidences: true,
      },
    });

    if (!experiment) throw new Error('Experiment not found.');
    return experiment;
  }

  async createExperiment(tenantId, data, userId) {
    const {
      projectId,
      objectiveId,
      hypothesisId,
      protocolId,
      experimentCode,
      title,
      description,
      purpose,
      experimentType = 'LABORATORY',
      priority = 'MEDIUM',
      status = 'PLANNED',
      plannedStartDate,
      plannedEndDate,
      ownerId,
      assignedResearcherIds,
      experimentalConditions,
      expectedOutcomes,
      successCriteria,
      taskId,
      milestoneId,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Experiment title is required.');

    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('Project not found in tenant.');

    const code = experimentCode || `EXP-${Date.now().toString().slice(-4)}`;

    const validExpTypes = ['LABORATORY', 'FIELD', 'SIMULATION', 'ANALYTICAL', 'PROTOTYPE_TEST', 'OTHER'];

    const experiment = await prisma.rdExperiment.create({
      data: {
        tenantId,
        projectId,
        objectiveId: objectiveId || null,
        hypothesisId: hypothesisId || null,
        protocolId: protocolId || null,
        experimentCode: code,
        title: title.trim(),
        description: description || null,
        purpose: purpose || null,
        experimentType: validExpTypes.includes(experimentType) ? experimentType : 'LABORATORY',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        status: ['PLANNED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status)
          ? status
          : 'PLANNED',
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        ownerId: ownerId || userId || null,
        assignedResearcherIds: assignedResearcherIds || null,
        experimentalConditions: experimentalConditions || null,
        expectedOutcomes: expectedOutcomes || null,
        successCriteria: successCriteria || null,
        taskId: taskId || null,
        milestoneId: milestoneId || null,
        createdById: userId || null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return experiment;
  }

  async updateExperiment(tenantId, id, data) {
    const existing = await prisma.rdExperiment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Experiment not found.');

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.experimentType !== undefined) updateData.experimentType = data.experimentType;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.objectiveId !== undefined) updateData.objectiveId = data.objectiveId;
    if (data.hypothesisId !== undefined) updateData.hypothesisId = data.hypothesisId;
    if (data.protocolId !== undefined) updateData.protocolId = data.protocolId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.assignedResearcherIds !== undefined) updateData.assignedResearcherIds = data.assignedResearcherIds;
    if (data.experimentalConditions !== undefined) updateData.experimentalConditions = data.experimentalConditions;
    if (data.expectedOutcomes !== undefined) updateData.expectedOutcomes = data.expectedOutcomes;
    if (data.successCriteria !== undefined) updateData.successCriteria = data.successCriteria;
    if (data.plannedStartDate !== undefined)
      updateData.plannedStartDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null;
    if (data.plannedEndDate !== undefined)
      updateData.plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null;
    if (data.actualStartDate !== undefined)
      updateData.actualStartDate = data.actualStartDate ? new Date(data.actualStartDate) : null;
    if (data.actualEndDate !== undefined)
      updateData.actualEndDate = data.actualEndDate ? new Date(data.actualEndDate) : null;
    if (data.taskId !== undefined) updateData.taskId = data.taskId;
    if (data.milestoneId !== undefined) updateData.milestoneId = data.milestoneId;
    if (data.status !== undefined) {
      if (!['PLANNED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status)) {
        throw new Error(`Invalid experiment status: ${data.status}`);
      }
      updateData.status = data.status;
    }

    return await prisma.rdExperiment.update({
      where: { id },
      data: updateData,
    });
  }

  async getExperimentDashboardStats(tenantId, projectId = null) {
    const where = { tenantId };
    if (projectId) where.projectId = projectId;

    const [total, planned, ready, inProgress, paused, completed, failed, cancelled] = await Promise.all([
      prisma.rdExperiment.count({ where }),
      prisma.rdExperiment.count({ where: { ...where, status: 'PLANNED' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'READY' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'PAUSED' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'FAILED' } }),
      prisma.rdExperiment.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

    const totalRuns = await prisma.rdExperimentRun.count({ where: { tenantId } });
    const completedRuns = await prisma.rdExperimentRun.count({ where: { tenantId, status: 'COMPLETED' } });

    return {
      total,
      planned,
      ready,
      inProgress,
      paused,
      completed,
      failed,
      cancelled,
      runs: {
        total: totalRuns,
        completed: completedRuns,
      },
    };
  }

  // ==============================================================================
  // 6. EXPERIMENT RUN EXECUTION (REQUIREMENT 29, 63)
  // ==============================================================================

  async createExperimentRun(tenantId, experimentId, runData = {}, userId) {
    const experiment = await prisma.rdExperiment.findFirst({
      where: { id: experimentId, tenantId },
      include: {
        protocol: {
          include: {
            steps: { orderBy: { stepNumber: 'asc' } },
          },
        },
      },
    });

    if (!experiment) throw new Error('Experiment not found.');

    // Next run number
    const maxRun = await prisma.rdExperimentRun.aggregate({
      where: { experimentId, tenantId },
      _max: { runNumber: true },
    });
    const runNumber = (maxRun._max.runNumber || 0) + 1;
    const runCode = `${experiment.experimentCode}-R${runNumber}`;

    // Snapshot protocol configuration and steps to preserve historical fidelity
    const protocolSnapshot = experiment.protocol
      ? {
          protocolId: experiment.protocol.id,
          version: experiment.protocol.version,
          title: experiment.protocol.title,
          methodology: experiment.protocol.methodology,
          safetyInstructions: experiment.protocol.safetyInstructions,
          steps: experiment.protocol.steps.map((s) => ({
            stepNumber: s.stepNumber,
            title: s.title,
            instructions: s.instructions,
            expectedAction: s.expectedAction,
            expectedObservation: s.expectedObservation,
          })),
        }
      : null;

    const conditionsSnapshot = runData.conditionsSnapshot || experiment.experimentalConditions || {};

    const run = await prisma.rdExperimentRun.create({
      data: {
        tenantId,
        experimentId,
        runNumber,
        runCode,
        title: runData.title || `Run #${runNumber}`,
        status: runData.status || 'PLANNED',
        protocolVersion: experiment.protocol?.version || 1,
        protocolSnapshot,
        conditionsSnapshot,
        operatorId: runData.operatorId || userId || null,
        startedAt: runData.status === 'IN_PROGRESS' ? new Date() : null,
        notes: runData.notes || null,
        createdById: userId || null,
      },
    });

    // Populate run steps from protocol steps
    if (experiment.protocol && Array.isArray(experiment.protocol.steps)) {
      for (const step of experiment.protocol.steps) {
        await prisma.rdExperimentRunStep.create({
          data: {
            tenantId,
            runId: run.id,
            stepNumber: step.stepNumber,
            title: step.title,
            isCompleted: false,
          },
        });
      }
    }

    return await this.getExperimentRunById(tenantId, run.id);
  }

  async getExperimentRunById(tenantId, runId) {
    const run = await prisma.rdExperimentRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        experiment: {
          select: {
            id: true,
            title: true,
            experimentCode: true,
            experimentType: true,
            projectId: true,
            hypothesisId: true,
          },
        },
        runSteps: { orderBy: { stepNumber: 'asc' } },
        observations: { orderBy: { observedAt: 'desc' } },
        measurements: { orderBy: { measurementTime: 'desc' } },
        results: true,
        evidences: true,
      },
    });

    if (!run) throw new Error('Experiment run not found.');
    return run;
  }

  async updateRunStatus(tenantId, runId, status, userId) {
    const run = await prisma.rdExperimentRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error('Experiment run not found.');

    const validStatuses = ['PLANNED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid run status: ${status}`);
    }

    const updateData = { status };
    if (status === 'IN_PROGRESS' && !run.startedAt) {
      updateData.startedAt = new Date();
    }
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status) && !run.completedAt) {
      updateData.completedAt = new Date();
    }

    const updated = await prisma.rdExperimentRun.update({
      where: { id: runId },
      data: updateData,
    });

    // Auto-update parent experiment status if needed
    if (status === 'IN_PROGRESS') {
      await prisma.rdExperiment.update({
        where: { id: run.experimentId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return updated;
  }

  async completeRunStep(tenantId, runStepId, userId, notes = null) {
    const step = await prisma.rdExperimentRunStep.findFirst({
      where: { id: runStepId, tenantId },
    });
    if (!step) throw new Error('Run step not found.');

    const updated = await prisma.rdExperimentRunStep.update({
      where: { id: runStepId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        completedById: userId,
        notes: notes || step.notes,
      },
    });

    return updated;
  }

  // ==============================================================================
  // 7. OBSERVATIONS & MEASUREMENTS (REQUIREMENT 63, 25)
  // ==============================================================================

  async recordObservation(tenantId, runId, data, userId) {
    const run = await prisma.rdExperimentRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error('Experiment run not found.');

    const { title, description, observationType = 'GENERAL', stepNumber, variableId } = data;
    if (!title || !title.trim()) throw new Error('Observation title is required.');
    if (!description || !description.trim()) throw new Error('Observation description is required.');

    const observation = await prisma.rdExperimentObservation.create({
      data: {
        tenantId,
        runId,
        title: title.trim(),
        description: description.trim(),
        observationType,
        observedAt: new Date(),
        recordedById: userId || null,
        stepNumber: stepNumber !== undefined ? parseInt(stepNumber, 10) : null,
        variableId: variableId || null,
      },
    });

    return observation;
  }

  async getObservations(tenantId, runId) {
    return await prisma.rdExperimentObservation.findMany({
      where: { runId, tenantId },
      orderBy: { observedAt: 'desc' },
    });
  }

  async recordMeasurement(tenantId, runId, data, userId) {
    const run = await prisma.rdExperimentRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error('Experiment run not found.');

    const { variableId, recordedValue, stepNumber, measurementMethod, notes } = data;
    if (recordedValue === undefined || recordedValue === null || String(recordedValue).trim() === '') {
      throw new Error('recordedValue is required.');
    }

    let varNameSnapshot = 'Custom Measurement';
    let varTypeSnapshot = 'DEPENDENT';
    let dataType = 'DECIMAL';
    let unitSnapshot = data.unit || null;
    let numericValue = null;

    if (variableId) {
      const variable = await prisma.rdVariable.findFirst({
        where: { id: variableId, tenantId },
      });
      if (variable) {
        varNameSnapshot = variable.name;
        varTypeSnapshot = variable.variableType;
        dataType = variable.dataType;
        unitSnapshot = variable.unit;

        // Scientific data validation
        const validation = this.validateMeasurementValue(variable, recordedValue);
        if (!validation.isValid) {
          throw new Error(`Scientific Measurement Validation Error: ${validation.error}`);
        }
        numericValue = validation.numericValue;
      }
    } else {
      const parsed = parseFloat(recordedValue);
      if (!isNaN(parsed)) numericValue = parsed;
    }

    const measurement = await prisma.rdExperimentMeasurement.create({
      data: {
        tenantId,
        runId,
        variableId: variableId || null,
        variableNameSnapshot: varNameSnapshot,
        variableTypeSnapshot: varTypeSnapshot,
        recordedValue: String(recordedValue),
        numericValue,
        dataType,
        unitSnapshot,
        measurementTime: new Date(),
        measurementMethod: measurementMethod || null,
        recordedById: userId || null,
        stepNumber: stepNumber !== undefined ? parseInt(stepNumber, 10) : null,
        isAnomaly: !!data.isAnomaly,
        notes: notes || null,
      },
    });

    return measurement;
  }

  async getMeasurements(tenantId, runId) {
    return await prisma.rdExperimentMeasurement.findMany({
      where: { runId, tenantId },
      orderBy: { measurementTime: 'desc' },
    });
  }

  // ==============================================================================
  // 8. RESULTS & RUN COMPARISON (REQUIREMENT 25, 63)
  // ==============================================================================

  async recordExperimentResult(tenantId, experimentId, data, userId) {
    const experiment = await prisma.rdExperiment.findFirst({
      where: { id: experimentId, tenantId },
    });
    if (!experiment) throw new Error('Experiment not found.');

    const {
      runId,
      summary,
      keyFindings,
      expectedVsActual,
      criteriaEvaluation,
      deviations,
      researcherConclusion,
      isSuccessCriteriaMet = false,
    } = data;

    if (!summary || !summary.trim()) throw new Error('Result summary is required.');

    const result = await prisma.rdExperimentResult.create({
      data: {
        tenantId,
        experimentId,
        runId: runId || null,
        summary: summary.trim(),
        keyFindings: keyFindings || null,
        expectedVsActual: expectedVsActual || null,
        criteriaEvaluation: criteriaEvaluation || null,
        deviations: deviations || null,
        researcherConclusion: researcherConclusion || null,
        isSuccessCriteriaMet: !!isSuccessCriteriaMet,
        evaluatedById: userId || null,
        evaluatedAt: new Date(),
      },
    });

    return result;
  }

  async compareRuns(tenantId, experimentId, runIds = []) {
    const where = { experimentId, tenantId };
    if (Array.isArray(runIds) && runIds.length > 0) {
      where.id = { in: runIds };
    }

    const runs = await prisma.rdExperimentRun.findMany({
      where,
      include: {
        measurements: true,
        observations: true,
        results: true,
      },
      orderBy: { runNumber: 'asc' },
    });

    return {
      experimentId,
      runCount: runs.length,
      runs: runs.map((r) => ({
        id: r.id,
        runNumber: r.runNumber,
        runCode: r.runCode,
        title: r.title,
        status: r.status,
        protocolVersion: r.protocolVersion,
        conditionsSnapshot: r.conditionsSnapshot,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        observationsCount: r.observations.length,
        measurementsCount: r.measurements.length,
        measurements: r.measurements.map((m) => ({
          variable: m.variableNameSnapshot,
          value: m.recordedValue,
          numericValue: m.numericValue,
          unit: m.unitSnapshot,
        })),
        results: r.results.map((res) => ({
          summary: res.summary,
          isSuccessCriteriaMet: res.isSuccessCriteriaMet,
          conclusion: res.researcherConclusion,
        })),
      })),
    };
  }

  // ==============================================================================
  // 9. EVIDENCE & OUTCOMES TRACKING (REQUIREMENT 25)
  // ==============================================================================

  async createEvidence(tenantId, data, userId) {
    const {
      projectId,
      objectiveId,
      hypothesisId,
      experimentId,
      runId,
      title,
      description,
      evidenceType = 'EXPERIMENTAL_DATA',
      source,
      fileUrl,
      fileType,
      fileSize,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Evidence title is required.');

    const evidence = await prisma.rdResearchEvidence.create({
      data: {
        tenantId,
        projectId,
        objectiveId: objectiveId || null,
        hypothesisId: hypothesisId || null,
        experimentId: experimentId || null,
        runId: runId || null,
        title: title.trim(),
        description: description || null,
        evidenceType,
        source: source || null,
        fileUrl: fileUrl || null,
        fileType: fileType || null,
        fileSize: fileSize ? parseInt(fileSize, 10) : null,
        recordedById: userId || null,
        status: 'VERIFIED',
      },
    });

    return evidence;
  }

  async getEvidences(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.objectiveId) where.objectiveId = filters.objectiveId;
    if (filters.hypothesisId) where.hypothesisId = filters.hypothesisId;
    if (filters.experimentId) where.experimentId = filters.experimentId;
    if (filters.runId) where.runId = filters.runId;

    return await prisma.rdResearchEvidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOutcome(tenantId, data, userId) {
    const {
      projectId,
      objectiveId,
      hypothesisId,
      experimentId,
      title,
      summary,
      outcomeCategory = 'SCIENTIFIC_DISCOVERY',
      supportingEvidenceSummary,
      outcomeDate,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Outcome title is required.');
    if (!summary || !summary.trim()) throw new Error('Outcome summary is required.');

    const outcome = await prisma.rdResearchOutcome.create({
      data: {
        tenantId,
        projectId,
        objectiveId: objectiveId || null,
        hypothesisId: hypothesisId || null,
        experimentId: experimentId || null,
        title: title.trim(),
        summary: summary.trim(),
        outcomeCategory,
        supportingEvidenceSummary: supportingEvidenceSummary || null,
        outcomeDate: outcomeDate ? new Date(outcomeDate) : new Date(),
        recordedById: userId || null,
      },
    });

    return outcome;
  }

  async getOutcomes(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.objectiveId) where.objectiveId = filters.objectiveId;
    if (filters.hypothesisId) where.hypothesisId = filters.hypothesisId;

    return await prisma.rdResearchOutcome.findMany({
      where,
      orderBy: { outcomeDate: 'desc' },
    });
  }

  // ==============================================================================
  // 10. RESEARCH DOCUMENTATION & NOTES (REQUIREMENT 30, 63)
  // ==============================================================================

  async createResearchNote(tenantId, data, userId) {
    const { projectId, entityType, entityId, title, content } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!entityType) throw new Error('entityType is required (OBJECTIVE, HYPOTHESIS, EXPERIMENT, RUN).');
    if (!entityId) throw new Error('entityId is required.');
    if (!title || !title.trim()) throw new Error('Note title is required.');
    if (!content || !content.trim()) throw new Error('Note content is required.');

    const note = await prisma.rdResearchNote.create({
      data: {
        tenantId,
        projectId,
        entityType,
        entityId,
        title: title.trim(),
        content: content.trim(),
        authorId: userId || null,
      },
    });

    return note;
  }

  async getResearchNotes(tenantId, entityType, entityId) {
    return await prisma.rdResearchNote.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new RdResearchService();
