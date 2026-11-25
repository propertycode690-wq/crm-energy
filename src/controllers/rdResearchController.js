const rdResearchService = require('../services/rdResearchService');

class RdResearchController {
  // 1. Objectives
  async getObjectives(req, res, next) {
    try {
      const data = await rdResearchService.getObjectives(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getObjectiveById(req, res, next) {
    try {
      const data = await rdResearchService.getObjectiveById(req.user.tenantId, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createObjective(req, res, next) {
    try {
      const data = await rdResearchService.createObjective(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Research objective created.', data });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('not found')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateObjective(req, res, next) {
    try {
      const data = await rdResearchService.updateObjective(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({ success: true, message: 'Objective updated.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async deleteObjective(req, res, next) {
    try {
      const result = await rdResearchService.deleteObjective(req.user.tenantId, req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // 2. Hypotheses
  async getHypotheses(req, res, next) {
    try {
      const data = await rdResearchService.getHypotheses(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getHypothesisById(req, res, next) {
    try {
      const data = await rdResearchService.getHypothesisById(req.user.tenantId, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createHypothesis(req, res, next) {
    try {
      const data = await rdResearchService.createHypothesis(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Hypothesis created.', data });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('not found')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateHypothesis(req, res, next) {
    try {
      const data = await rdResearchService.updateHypothesis(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({ success: true, message: 'Hypothesis updated.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async evaluateHypothesis(req, res, next) {
    try {
      const data = await rdResearchService.evaluateHypothesis(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );
      return res.status(200).json({ success: true, message: 'Hypothesis evaluated successfully.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('Invalid evaluation decision')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async deleteHypothesis(req, res, next) {
    try {
      const result = await rdResearchService.deleteHypothesis(req.user.tenantId, req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // 3. Variables
  async getVariables(req, res, next) {
    try {
      const data = await rdResearchService.getVariables(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createVariable(req, res, next) {
    try {
      const data = await rdResearchService.createVariable(req.user.tenantId, req.body);
      return res.status(201).json({ success: true, message: 'Variable created.', data });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('cannot exceed')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // 4. Protocols
  async getProtocols(req, res, next) {
    try {
      const data = await rdResearchService.getProtocols(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getProtocolById(req, res, next) {
    try {
      const data = await rdResearchService.getProtocolById(req.user.tenantId, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createProtocol(req, res, next) {
    try {
      const data = await rdResearchService.createProtocol(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Protocol created.', data });
    } catch (error) {
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateProtocol(req, res, next) {
    try {
      const data = await rdResearchService.updateProtocol(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({ success: true, message: 'Protocol updated.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createProtocolVersion(req, res, next) {
    try {
      const data = await rdResearchService.createProtocolVersion(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'New protocol version created.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async duplicateProtocol(req, res, next) {
    try {
      const data = await rdResearchService.duplicateProtocolTemplate(
        req.user.tenantId,
        req.params.id,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'Protocol duplicated successfully.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async addProtocolStep(req, res, next) {
    try {
      const data = await rdResearchService.addProtocolStep(req.user.tenantId, req.params.id, req.body);
      return res.status(201).json({ success: true, message: 'Protocol step added.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // 5. Experiments
  async getExperiments(req, res, next) {
    try {
      const data = await rdResearchService.getExperiments(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getExperimentById(req, res, next) {
    try {
      const data = await rdResearchService.getExperimentById(req.user.tenantId, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async createExperiment(req, res, next) {
    try {
      const data = await rdResearchService.createExperiment(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Experiment created.', data });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('not found')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateExperiment(req, res, next) {
    try {
      const data = await rdResearchService.updateExperiment(req.user.tenantId, req.params.id, req.body);
      return res.status(200).json({ success: true, message: 'Experiment updated.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      const data = await rdResearchService.getExperimentDashboardStats(req.user.tenantId, req.query.projectId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // 6. Runs
  async createRun(req, res, next) {
    try {
      const data = await rdResearchService.createExperimentRun(
        req.user.tenantId,
        req.params.experimentId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'Experiment run created.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getRunById(req, res, next) {
    try {
      const data = await rdResearchService.getExperimentRunById(req.user.tenantId, req.params.id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async updateRunStatus(req, res, next) {
    try {
      const data = await rdResearchService.updateRunStatus(
        req.user.tenantId,
        req.params.id,
        req.body.status,
        req.user.userId
      );
      return res.status(200).json({ success: true, message: `Run status updated to ${req.body.status}.`, data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('Invalid')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async completeRunStep(req, res, next) {
    try {
      const data = await rdResearchService.completeRunStep(
        req.user.tenantId,
        req.params.id,
        req.user.userId,
        req.body.notes
      );
      return res.status(200).json({ success: true, message: 'Protocol step completed.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // 7. Observations & Measurements
  async recordObservation(req, res, next) {
    try {
      const data = await rdResearchService.recordObservation(
        req.user.tenantId,
        req.params.runId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'Observation recorded.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getObservations(req, res, next) {
    try {
      const data = await rdResearchService.getObservations(req.user.tenantId, req.params.runId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async recordMeasurement(req, res, next) {
    try {
      const data = await rdResearchService.recordMeasurement(
        req.user.tenantId,
        req.params.runId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'Measurement recorded.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('Validation') || error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getMeasurements(req, res, next) {
    try {
      const data = await rdResearchService.getMeasurements(req.user.tenantId, req.params.runId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // 8. Results & Compare
  async recordResult(req, res, next) {
    try {
      const data = await rdResearchService.recordExperimentResult(
        req.user.tenantId,
        req.params.experimentId,
        req.body,
        req.user.userId
      );
      return res.status(201).json({ success: true, message: 'Experiment result recorded.', data });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async compareRuns(req, res, next) {
    try {
      const runIds = req.query.runIds ? req.query.runIds.split(',') : [];
      const data = await rdResearchService.compareRuns(req.user.tenantId, req.params.experimentId, runIds);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // 9. Evidence & Outcomes
  async createEvidence(req, res, next) {
    try {
      const data = await rdResearchService.createEvidence(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Research evidence recorded.', data });
    } catch (error) {
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getEvidences(req, res, next) {
    try {
      const data = await rdResearchService.getEvidences(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createOutcome(req, res, next) {
    try {
      const data = await rdResearchService.createOutcome(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Research outcome recorded.', data });
    } catch (error) {
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getOutcomes(req, res, next) {
    try {
      const data = await rdResearchService.getOutcomes(req.user.tenantId, req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // 10. Notes
  async createNote(req, res, next) {
    try {
      const data = await rdResearchService.createResearchNote(req.user.tenantId, req.body, req.user.userId);
      return res.status(201).json({ success: true, message: 'Research note created.', data });
    } catch (error) {
      if (error.message.includes('required')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async getNotes(req, res, next) {
    try {
      const data = await rdResearchService.getResearchNotes(
        req.user.tenantId,
        req.query.entityType,
        req.query.entityId
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdResearchController();
