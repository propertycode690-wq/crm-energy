const rdElnService = require('../services/rdElnService');

class RdElnController {
  // Helper to extract verified tenantId & userId
  _getContext(req) {
    const tenantId = req.user?.tenantId || req.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];
    if (!tenantId) {
      const err = new Error('Authentication required: Tenant context missing.');
      err.statusCode = 401;
      throw err;
    }
    return { tenantId, userId };
  }

  // ==============================================================================
  // 1. NOTEBOOK CONTROLLERS
  // ==============================================================================

  async listNotebooks(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const notebooks = await rdElnService.listNotebooks(tenantId, req.query);
      res.json({ success: true, data: notebooks });
    } catch (err) {
      next(err);
    }
  }

  async createNotebook(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const notebook = await rdElnService.createNotebook(tenantId, req.body, userId);
      res.status(201).json({ success: true, data: notebook, message: 'Notebook created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getNotebook(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const notebook = await rdElnService.getNotebook(tenantId, req.params.id);
      res.json({ success: true, data: notebook });
    } catch (err) {
      next(err);
    }
  }

  async updateNotebook(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const notebook = await rdElnService.updateNotebook(tenantId, req.params.id, req.body, userId);
      res.json({ success: true, data: notebook, message: 'Notebook updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async archiveNotebook(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const notebook = await rdElnService.archiveNotebook(tenantId, req.params.id, userId);
      res.json({ success: true, data: notebook, message: 'Notebook archived successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async addContributor(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const contributor = await rdElnService.addContributor(tenantId, req.params.id, req.body, userId);
      res.json({ success: true, data: contributor, message: 'Contributor updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 2. RESEARCH ENTRY CONTROLLERS
  // ==============================================================================

  async listEntries(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const entries = await rdElnService.listEntries(tenantId, req.query);
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  }

  async createEntry(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const entry = await rdElnService.createEntry(tenantId, req.body, userId);
      res.status(201).json({ success: true, data: entry, message: 'Research entry created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getEntry(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const entry = await rdElnService.getEntry(tenantId, req.params.id);
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  async updateEntry(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const entry = await rdElnService.updateEntry(tenantId, req.params.id, req.body, userId);
      res.json({ success: true, data: entry, message: 'Research entry updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async archiveEntry(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const entry = await rdElnService.archiveEntry(tenantId, req.params.id, userId);
      res.json({ success: true, data: entry, message: 'Research entry archived.' });
    } catch (err) {
      next(err);
    }
  }

  async getEntryVersions(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const versions = await rdElnService.getEntryVersions(tenantId, req.params.id);
      res.json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 3. RESEARCH DOCUMENT CONTROLLERS
  // ==============================================================================

  async listDocuments(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const documents = await rdElnService.listDocuments(tenantId, req.query);
      res.json({ success: true, data: documents });
    } catch (err) {
      next(err);
    }
  }

  async uploadDocument(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const { filePayload, ...data } = req.body;
      const doc = await rdElnService.uploadDocument(tenantId, data, filePayload, userId);
      res.status(201).json({ success: true, data: doc, message: 'Document uploaded successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getDocument(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const doc = await rdElnService.getDocument(tenantId, req.params.id);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  async updateDocumentMetadata(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const doc = await rdElnService.updateDocumentMetadata(tenantId, req.params.id, req.body, userId);
      res.json({ success: true, data: doc, message: 'Document metadata updated.' });
    } catch (err) {
      next(err);
    }
  }

  async archiveDocument(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const doc = await rdElnService.archiveDocument(tenantId, req.params.id, userId);
      res.json({ success: true, data: doc, message: 'Document archived.' });
    } catch (err) {
      next(err);
    }
  }

  async restoreDocument(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const doc = await rdElnService.restoreDocument(tenantId, req.params.id, userId);
      res.json({ success: true, data: doc, message: 'Document restored to active status.' });
    } catch (err) {
      next(err);
    }
  }

  async downloadDocument(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const versionNumber = req.query.version || null;
      const fileInfo = await rdElnService.getDocumentFile(tenantId, req.params.id, versionNumber);

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`);
      res.setHeader('Content-Length', fileInfo.fileSize);
      res.send(fileInfo.buffer);
    } catch (err) {
      next(err);
    }
  }

  async previewDocument(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const versionNumber = req.query.version || null;
      const fileInfo = await rdElnService.getDocumentFile(tenantId, req.params.id, versionNumber);

      // Allow browser inline rendering for previewable formats
      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.fileName)}"`);
      res.send(fileInfo.buffer);
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 4. DOCUMENT VERSION CONTROLLERS (REQUIREMENT 94)
  // ==============================================================================

  async uploadNewVersion(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const { filePayload, revisionSummary } = req.body;
      const result = await rdElnService.uploadNewVersion(tenantId, req.params.id, filePayload, revisionSummary, userId);
      res.status(201).json({ success: true, data: result, message: 'New version uploaded successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getDocumentVersions(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const versions = await rdElnService.getDocumentVersions(tenantId, req.params.id);
      res.json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  async restoreHistoricalVersion(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const result = await rdElnService.restoreHistoricalVersion(tenantId, req.params.id, req.params.versionNumber, userId);
      res.json({ success: true, data: result, message: 'Historical version restored as latest version.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 5. DATASET CONTROLLERS
  // ==============================================================================

  async listDatasets(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const datasets = await rdElnService.listDatasets(tenantId, req.query);
      res.json({ success: true, data: datasets });
    } catch (err) {
      next(err);
    }
  }

  async createDataset(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const dataset = await rdElnService.createDataset(tenantId, req.body, userId);
      res.status(201).json({ success: true, data: dataset, message: 'Dataset registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getDataset(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const dataset = await rdElnService.getDataset(tenantId, req.params.id);
      res.json({ success: true, data: dataset });
    } catch (err) {
      next(err);
    }
  }

  async uploadDatasetFile(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const { filePayload, rowCount, columnCount, schemaDescription } = req.body;
      const file = await rdElnService.uploadDatasetFile(tenantId, req.params.id, filePayload, { rowCount, columnCount, schemaDescription }, userId);
      res.status(201).json({ success: true, data: file, message: 'File added to dataset successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async downloadDatasetFile(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const fileInfo = await rdElnService.getDatasetFile(tenantId, req.params.fileId);

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`);
      res.setHeader('Content-Length', fileInfo.fileSize);
      res.send(fileInfo.buffer);
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 6. KNOWLEDGE REPOSITORY CONTROLLERS
  // ==============================================================================

  async listKnowledgeRecords(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const records = await rdElnService.listKnowledgeRecords(tenantId, req.query);
      res.json({ success: true, data: records });
    } catch (err) {
      next(err);
    }
  }

  async createKnowledgeRecord(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const record = await rdElnService.createKnowledgeRecord(tenantId, req.body, userId);
      res.status(201).json({ success: true, data: record, message: 'Knowledge record created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getKnowledgeRecord(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const record = await rdElnService.getKnowledgeRecord(tenantId, req.params.id);
      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }

  async updateKnowledgeRecord(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const record = await rdElnService.updateKnowledgeRecord(tenantId, req.params.id, req.body, userId);
      res.json({ success: true, data: record, message: 'Knowledge record updated.' });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 7. ENTITY DOCUMENT LINKING CONTROLLERS
  // ==============================================================================

  async linkDocumentToEntity(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const { entityType, entityId, linkType } = req.body;
      const link = await rdElnService.linkDocumentToEntity(tenantId, req.params.id, entityType, entityId, linkType, userId);
      res.json({ success: true, data: link, message: 'Document linked successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async unlinkDocumentFromEntity(req, res, next) {
    try {
      const { tenantId, userId } = this._getContext(req);
      const result = await rdElnService.unlinkDocumentFromEntity(tenantId, req.params.linkId, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getEntityDocuments(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const { entityType, entityId } = req.params;
      const docs = await rdElnService.getEntityDocuments(tenantId, entityType, entityId);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  }

  // ==============================================================================
  // 8. GLOBAL ELN SEARCH
  // ==============================================================================

  async globalSearch(req, res, next) {
    try {
      const { tenantId } = this._getContext(req);
      const result = await rdElnService.globalSearch(tenantId, req.query.q || req.query.search || '', req.query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

const controller = new RdElnController();
// Bind all methods to ensure 'this' context is preserved
for (const key of Object.getOwnPropertyNames(RdElnController.prototype)) {
  if (typeof controller[key] === 'function' && key !== 'constructor') {
    controller[key] = controller[key].bind(controller);
  }
}

module.exports = controller;
