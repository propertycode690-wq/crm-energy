const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Secure storage directory outside public root
const STORAGE_BASE_DIR = path.join(__dirname, '../../storage/research_docs');

// Disallowed executable / malicious extensions
const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.js', '.mjs', '.com', '.msi', '.dll', '.bin', '.scr', '.jar', '.py', '.app'
]);

class RdElnService {
  constructor() {
    this._ensureStorageBaseDir();
  }

  _ensureStorageBaseDir() {
    try {
      if (!fs.existsSync(STORAGE_BASE_DIR)) {
        fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[RdElnService] Storage directory initialization warning:', err.message);
    }
  }

  _getTenantStorageDir(tenantId) {
    const tenantDir = path.join(STORAGE_BASE_DIR, tenantId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    return tenantDir;
  }

  _sanitizeFilename(filename) {
    if (!filename) return 'unnamed_file';
    // Remove directory traversal characters and unsafe path symbols
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  _validateFilePayload(fileName, fileSize, base64Content) {
    if (!fileName || !fileName.trim()) {
      throw new Error('Filename is required.');
    }
    const ext = path.extname(fileName).toLowerCase();
    if (DISALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`File upload rejected: Extension '${ext}' is disallowed for security.`);
    }

    // Maximum 25MB file size limit
    const MAX_SIZE = 25 * 1024 * 1024;
    if (fileSize && fileSize > MAX_SIZE) {
      throw new Error(`File size (${Math.round(fileSize / (1024 * 1024))}MB) exceeds maximum allowed limit of 25MB.`);
    }

    if (!base64Content) {
      throw new Error('File content payload is required.');
    }
  }

  _saveFileToDisk(tenantId, fileName, base64Content) {
    const tenantDir = this._getTenantStorageDir(tenantId);
    const sanitizedName = this._sanitizeFilename(fileName);
    const ext = path.extname(sanitizedName).toLowerCase();
    const uniqueId = crypto.randomUUID();
    const storedFileName = `${Date.now()}_${uniqueId}${ext}`;
    const targetFilePath = path.join(tenantDir, storedFileName);

    // Clean base64 string if data URL prefix is present
    const cleanBase64 = base64Content.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Prevent directory traversal
    if (!targetFilePath.startsWith(tenantDir)) {
      throw new Error('Directory traversal attempt detected.');
    }

    fs.writeFileSync(targetFilePath, buffer);

    // Cryptographic SHA-256 checksum
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      storagePath: targetFilePath,
      fileSize: buffer.length,
      fileChecksum: hash,
      fileExtension: ext || '.bin',
      originalFilename: sanitizedName,
    };
  }

  async _logAudit(tenantId, userId, title, description, metadata = {}) {
    try {
      await prisma.activity.create({
        data: {
          tenantId,
          userId: userId || null,
          type: 'NOTE_ADDED',
          title: `[ELN] ${title}`,
          description,
          metadata,
        },
      });
    } catch (err) {
      console.warn('[RdElnService] Audit logging warning:', err.message);
    }
  }

  // ==============================================================================
  // 1. ELECTRONIC LAB NOTEBOOK (ELN) WORKSPACE & NOTEBOOKS
  // ==============================================================================

  async listNotebooks(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { notebookCode: { contains: filters.search } },
        { description: { contains: filters.search } },
        { tags: { contains: filters.search } },
      ];
    }

    const notebooks = await prisma.rdNotebook.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        owner: { select: { id: true, name: true, email: true } },
        contributors: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: {
          select: {
            entries: true,
            documents: true,
            datasets: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return notebooks;
  }

  async createNotebook(tenantId, data, userId) {
    const { projectId, title, description, category = 'LABORATORY', tags, status = 'ACTIVE' } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Notebook title is required.');

    // Verify project belongs to tenant
    const project = await prisma.erpProject.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new Error('R&D Project not found or access denied.');

    // Generate unique notebookCode
    const count = await prisma.rdNotebook.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const notebookCode = data.notebookCode || `NB-${year}-${String(count + 1).padStart(3, '0')}`;

    const notebook = await prisma.rdNotebook.create({
      data: {
        tenantId,
        projectId,
        notebookCode,
        title: title.trim(),
        description: description || null,
        category,
        tags: tags || null,
        status,
        ownerId: userId || null,
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Automatically add owner as contributor with OWNER role
    if (userId) {
      await prisma.rdNotebookContributor.create({
        data: {
          tenantId,
          notebookId: notebook.id,
          userId,
          role: 'OWNER',
        },
      });
    }

    await this._logAudit(tenantId, userId, 'Notebook Created', `Created notebook ${notebook.notebookCode}: "${notebook.title}"`, { notebookId: notebook.id });

    return notebook;
  }

  async getNotebook(tenantId, id) {
    const notebook = await prisma.rdNotebook.findFirst({
      where: { id, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true } },
        owner: { select: { id: true, name: true, email: true } },
        contributors: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        entries: {
          orderBy: { createdAt: 'desc' },
          include: {
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          include: {
            versions: { orderBy: { versionNumber: 'desc' } },
          },
        },
        datasets: {
          orderBy: { createdAt: 'desc' },
          include: {
            files: true,
          },
        },
        _count: {
          select: {
            entries: true,
            documents: true,
            datasets: true,
          },
        },
      },
    });

    if (!notebook) throw new Error('Research notebook not found or access denied.');
    return notebook;
  }

  async updateNotebook(tenantId, id, data, userId) {
    const existing = await prisma.rdNotebook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research notebook not found.');

    const { title, description, category, tags, status } = data;

    const updated = await prisma.rdNotebook.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        description: description !== undefined ? description : existing.description,
        category: category || existing.category,
        tags: tags !== undefined ? tags : existing.tags,
        status: status || existing.status,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await this._logAudit(tenantId, userId, 'Notebook Updated', `Updated notebook ${updated.notebookCode}`, { notebookId: id });
    return updated;
  }

  async archiveNotebook(tenantId, id, userId) {
    const existing = await prisma.rdNotebook.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research notebook not found.');

    const updated = await prisma.rdNotebook.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this._logAudit(tenantId, userId, 'Notebook Archived', `Archived notebook ${updated.notebookCode}`, { notebookId: id });
    return updated;
  }

  async addContributor(tenantId, notebookId, data, actorUserId) {
    const { userId, role = 'CONTRIBUTOR' } = data;
    if (!userId) throw new Error('userId is required.');

    const notebook = await prisma.rdNotebook.findFirst({
      where: { id: notebookId, tenantId },
    });
    if (!notebook) throw new Error('Research notebook not found.');

    const contributor = await prisma.rdNotebookContributor.upsert({
      where: {
        notebookId_userId: { notebookId, userId },
      },
      update: { role },
      create: {
        tenantId,
        notebookId,
        userId,
        role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this._logAudit(tenantId, actorUserId, 'Contributor Added', `Added contributor ${userId} (${role}) to ${notebook.notebookCode}`);
    return contributor;
  }

  // ==============================================================================
  // 2. RESEARCH ENTRIES & ENHANCED RESEARCH NOTES (REUSE rd_research_notes)
  // ==============================================================================

  async listEntries(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.notebookId) where.notebookId = filters.notebookId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.experimentId) where.experimentId = filters.experimentId;
    if (filters.hypothesisId) where.hypothesisId = filters.hypothesisId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } },
        { tags: { contains: filters.search } },
        { entryNumber: { contains: filters.search } },
      ];
    }

    return await prisma.rdResearchNote.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEntry(tenantId, data, userId) {
    const {
      projectId,
      notebookId,
      title,
      content,
      category = 'RESEARCH_OBSERVATION',
      status = 'DRAFT',
      tags,
      researchDate,
      entityType = 'NOTEBOOK',
      entityId,
      objectiveId,
      hypothesisId,
      experimentId,
      runId,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Entry title is required.');
    if (!content || !content.trim()) throw new Error('Entry content is required.');

    // Count existing entries in notebook/project to assign entryNumber
    const count = await prisma.rdResearchNote.count({
      where: { tenantId, ...(notebookId ? { notebookId } : { projectId }) },
    });
    const entryNumber = `ENT-${String(count + 1).padStart(3, '0')}`;

    const isFinalized = status === 'FINALIZED';

    const note = await prisma.rdResearchNote.create({
      data: {
        tenantId,
        projectId,
        notebookId: notebookId || null,
        entityType: entityType || 'NOTEBOOK',
        entityId: entityId || notebookId || projectId,
        entryNumber,
        title: title.trim(),
        content: content.trim(),
        category,
        status,
        researchDate: researchDate ? new Date(researchDate) : new Date(),
        tags: tags || null,
        objectiveId: objectiveId || null,
        hypothesisId: hypothesisId || null,
        experimentId: experimentId || null,
        runId: runId || null,
        authorId: userId || null,
        finalizedAt: isFinalized ? new Date() : null,
        finalizedById: isFinalized ? userId : null,
        version: 1,
      },
    });

    // Create initial revision snapshot in rd_research_note_versions
    await prisma.rdResearchNoteVersion.create({
      data: {
        tenantId,
        noteId: note.id,
        versionNumber: 1,
        title: note.title,
        content: note.content,
        changeSummary: 'Initial creation',
        savedById: userId || null,
      },
    });

    await this._logAudit(tenantId, userId, 'Research Entry Created', `Created entry ${note.entryNumber}: "${note.title}"`, { noteId: note.id });
    return note;
  }

  async getEntry(tenantId, id) {
    const note = await prisma.rdResearchNote.findFirst({
      where: { id, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        documents: {
          include: {
            versions: { orderBy: { versionNumber: 'desc' } },
          },
        },
      },
    });
    if (!note) throw new Error('Research entry not found or access denied.');
    return note;
  }

  async updateEntry(tenantId, id, data, userId) {
    const existing = await prisma.rdResearchNote.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research entry not found.');

    const {
      title,
      content,
      category,
      status,
      tags,
      researchDate,
      changeSummary,
      objectiveId,
      hypothesisId,
      experimentId,
      runId,
    } = data;

    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newContent = content !== undefined ? content.trim() : existing.content;
    const newStatus = status || existing.status;

    // Check if content or title changed
    const contentChanged = newTitle !== existing.title || newContent !== existing.content;

    // Calculate new version number
    const nextVersion = contentChanged ? existing.version + 1 : existing.version;

    const nowFinalized = newStatus === 'FINALIZED' && existing.status !== 'FINALIZED';

    const updated = await prisma.rdResearchNote.update({
      where: { id },
      data: {
        title: newTitle,
        content: newContent,
        category: category || existing.category,
        status: newStatus,
        tags: tags !== undefined ? tags : existing.tags,
        researchDate: researchDate ? new Date(researchDate) : existing.researchDate,
        objectiveId: objectiveId !== undefined ? objectiveId : existing.objectiveId,
        hypothesisId: hypothesisId !== undefined ? hypothesisId : existing.hypothesisId,
        experimentId: experimentId !== undefined ? experimentId : existing.experimentId,
        runId: runId !== undefined ? runId : existing.runId,
        version: nextVersion,
        finalizedAt: nowFinalized ? new Date() : existing.finalizedAt,
        finalizedById: nowFinalized ? userId : existing.finalizedById,
      },
    });

    // If content or title changed, persist new historical revision snapshot
    if (contentChanged) {
      await prisma.rdResearchNoteVersion.create({
        data: {
          tenantId,
          noteId: id,
          versionNumber: nextVersion,
          title: newTitle,
          content: newContent,
          changeSummary: changeSummary || `Revision ${nextVersion} saved`,
          savedById: userId || null,
        },
      });
    }

    await this._logAudit(tenantId, userId, 'Research Entry Updated', `Updated entry ${updated.entryNumber} (v${nextVersion})`, { noteId: id, version: nextVersion });
    return updated;
  }

  async archiveEntry(tenantId, id, userId) {
    const existing = await prisma.rdResearchNote.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research entry not found.');

    const updated = await prisma.rdResearchNote.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this._logAudit(tenantId, userId, 'Research Entry Archived', `Archived entry ${updated.entryNumber}`, { noteId: id });
    return updated;
  }

  async getEntryVersions(tenantId, noteId) {
    const note = await prisma.rdResearchNote.findFirst({
      where: { id: noteId, tenantId },
    });
    if (!note) throw new Error('Research entry not found.');

    return await prisma.rdResearchNoteVersion.findMany({
      where: { noteId, tenantId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  // ==============================================================================
  // 3. RESEARCH DOCUMENTS & REVISION MANAGEMENT (REQUIREMENT 42, 94)
  // ==============================================================================

  async listDocuments(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.notebookId) where.notebookId = filters.notebookId;
    if (filters.noteId) where.noteId = filters.noteId;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.experimentId) where.experimentId = filters.experimentId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { documentCode: { contains: filters.search } },
        { originalFilename: { contains: filters.search } },
        { description: { contains: filters.search } },
        { tags: { contains: filters.search } },
      ];
    }

    return await prisma.rdResearchDocument.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        uploader: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        links: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(tenantId, data, filePayload, userId) {
    const {
      projectId,
      notebookId,
      noteId,
      experimentId,
      runId,
      hypothesisId,
      objectiveId,
      title,
      description,
      category = 'RESEARCH_REPORT',
      tags,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Document title is required.');

    // Validate file payload
    const { fileName, fileSize, base64Content, mimeType = 'application/octet-stream' } = filePayload || {};
    this._validateFilePayload(fileName, fileSize, base64Content);

    // Save file to disk & compute SHA-256 checksum
    const diskInfo = this._saveFileToDisk(tenantId, fileName, base64Content);

    // Generate documentCode
    const count = await prisma.rdResearchDocument.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const documentCode = data.documentCode || `DOC-${year}-${String(count + 1).padStart(3, '0')}`;

    const doc = await prisma.rdResearchDocument.create({
      data: {
        tenantId,
        projectId,
        notebookId: notebookId || null,
        noteId: noteId || null,
        experimentId: experimentId || null,
        runId: runId || null,
        hypothesisId: hypothesisId || null,
        objectiveId: objectiveId || null,
        documentCode,
        title: title.trim(),
        description: description || null,
        category,
        tags: tags || null,
        originalFilename: diskInfo.originalFilename,
        fileExtension: diskInfo.fileExtension,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: diskInfo.fileSize,
        storagePath: diskInfo.storagePath,
        fileChecksum: diskInfo.fileChecksum,
        currentVersion: 1,
        status: 'ACTIVE',
        uploadedById: userId || null,
      },
    });

    // Create Initial Version 1
    await prisma.rdDocumentVersion.create({
      data: {
        tenantId,
        documentId: doc.id,
        versionNumber: 1,
        versionLabel: 'v1.0',
        originalFilename: diskInfo.originalFilename,
        fileExtension: diskInfo.fileExtension,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: diskInfo.fileSize,
        storagePath: diskInfo.storagePath,
        fileChecksum: diskInfo.fileChecksum,
        revisionSummary: 'Initial document upload',
        isCurrent: true,
        uploadedById: userId || null,
      },
    });

    // Auto-create document link if linked to specific entity
    if (experimentId) {
      await prisma.rdDocumentLink.create({
        data: {
          tenantId,
          documentId: doc.id,
          entityType: 'EXPERIMENT',
          entityId: experimentId,
          linkType: 'SUPPORTING_DOCUMENT',
          linkedById: userId || null,
        },
      });
    }

    await this._logAudit(tenantId, userId, 'Document Uploaded', `Uploaded document ${doc.documentCode}: "${doc.title}" (${diskInfo.originalFilename})`, { documentId: doc.id });
    return doc;
  }

  async getDocument(tenantId, id) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        uploader: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        links: true,
      },
    });
    if (!doc) throw new Error('Research document not found or access denied.');
    return doc;
  }

  async updateDocumentMetadata(tenantId, id, data, userId) {
    const existing = await prisma.rdResearchDocument.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research document not found.');

    const { title, description, category, tags } = data;

    const updated = await prisma.rdResearchDocument.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        description: description !== undefined ? description : existing.description,
        category: category || existing.category,
        tags: tags !== undefined ? tags : existing.tags,
      },
    });

    await this._logAudit(tenantId, userId, 'Document Metadata Updated', `Updated metadata for ${updated.documentCode}`, { documentId: id });
    return updated;
  }

  async archiveDocument(tenantId, id, userId) {
    const existing = await prisma.rdResearchDocument.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research document not found.');

    const updated = await prisma.rdResearchDocument.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this._logAudit(tenantId, userId, 'Document Archived', `Archived document ${updated.documentCode}`, { documentId: id });
    return updated;
  }

  async restoreDocument(tenantId, id, userId) {
    const existing = await prisma.rdResearchDocument.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Research document not found.');

    const updated = await prisma.rdResearchDocument.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this._logAudit(tenantId, userId, 'Document Restored', `Restored document ${updated.documentCode}`, { documentId: id });
    return updated;
  }

  // ==============================================================================
  // 4. DOCUMENT VERSION HISTORY & SAFE RESTORATION (REQUIREMENT 94)
  // ==============================================================================

  async uploadNewVersion(tenantId, documentId, filePayload, revisionSummary, userId) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new Error('Research document not found or access denied.');

    const { fileName, fileSize, base64Content, mimeType } = filePayload || {};
    this._validateFilePayload(fileName, fileSize, base64Content);

    // Save new file to disk
    const diskInfo = this._saveFileToDisk(tenantId, fileName, base64Content);

    const nextVerNum = doc.currentVersion + 1;
    const versionLabel = `v${nextVerNum}.0`;

    // Mark previous current version as not current
    await prisma.rdDocumentVersion.updateMany({
      where: { documentId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create new version record
    const versionRecord = await prisma.rdDocumentVersion.create({
      data: {
        tenantId,
        documentId,
        versionNumber: nextVerNum,
        versionLabel,
        originalFilename: diskInfo.originalFilename,
        fileExtension: diskInfo.fileExtension,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: diskInfo.fileSize,
        storagePath: diskInfo.storagePath,
        fileChecksum: diskInfo.fileChecksum,
        revisionSummary: revisionSummary || `Revision ${versionLabel} uploaded`,
        isCurrent: true,
        uploadedById: userId || null,
      },
    });

    // Update parent document with latest current version metadata
    const updatedDoc = await prisma.rdResearchDocument.update({
      where: { id: documentId },
      data: {
        currentVersion: nextVerNum,
        storagePath: diskInfo.storagePath,
        fileSize: diskInfo.fileSize,
        fileChecksum: diskInfo.fileChecksum,
        originalFilename: diskInfo.originalFilename,
        fileExtension: diskInfo.fileExtension,
        mimeType: mimeType || doc.mimeType,
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    await this._logAudit(tenantId, userId, 'New Document Version Uploaded', `Uploaded ${versionLabel} for ${doc.documentCode} (${revisionSummary || 'No summary'})`, { documentId, version: nextVerNum });
    return { document: updatedDoc, version: versionRecord };
  }

  async getDocumentVersions(tenantId, documentId) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new Error('Research document not found.');

    return await prisma.rdDocumentVersion.findMany({
      where: { documentId, tenantId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async restoreHistoricalVersion(tenantId, documentId, targetVersionNumber, userId) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new Error('Research document not found.');

    const targetVersion = await prisma.rdDocumentVersion.findFirst({
      where: { documentId, versionNumber: parseInt(targetVersionNumber, 10), tenantId },
    });
    if (!targetVersion) throw new Error(`Historical version v${targetVersionNumber} not found.`);

    // Verify storage file exists
    if (!fs.existsSync(targetVersion.storagePath)) {
      throw new Error('Historical file content is not available on disk.');
    }

    // Per Requirement 94 & Section 8.4:
    // Restoration must create a NEW revision event and NEVER erase newer versions.
    const newVersionNumber = doc.currentVersion + 1;
    const versionLabel = `v${newVersionNumber}.0`;

    // Mark previous current versions false
    await prisma.rdDocumentVersion.updateMany({
      where: { documentId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create new version referencing historical file
    const newVersion = await prisma.rdDocumentVersion.create({
      data: {
        tenantId,
        documentId,
        versionNumber: newVersionNumber,
        versionLabel,
        originalFilename: targetVersion.originalFilename,
        fileExtension: targetVersion.fileExtension,
        mimeType: targetVersion.mimeType,
        fileSize: targetVersion.fileSize,
        storagePath: targetVersion.storagePath,
        fileChecksum: targetVersion.fileChecksum,
        revisionSummary: `Restored from version ${targetVersion.versionLabel} (#${targetVersion.versionNumber})`,
        isCurrent: true,
        uploadedById: userId || null,
      },
    });

    // Update document current version
    const updatedDoc = await prisma.rdResearchDocument.update({
      where: { id: documentId },
      data: {
        currentVersion: newVersionNumber,
        storagePath: targetVersion.storagePath,
        fileSize: targetVersion.fileSize,
        fileChecksum: targetVersion.fileChecksum,
        originalFilename: targetVersion.originalFilename,
        fileExtension: targetVersion.fileExtension,
        mimeType: targetVersion.mimeType,
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    await this._logAudit(tenantId, userId, 'Document Version Restored', `Restored ${doc.documentCode} from ${targetVersion.versionLabel} as new version ${versionLabel}`, { documentId, restoredFrom: targetVersionNumber, newVersion: newVersionNumber });
    return { document: updatedDoc, restoredVersion: newVersion };
  }

  async getDocumentFile(tenantId, documentId, versionNumber = null) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new Error('Research document not found or access denied.');

    let filePath = doc.storagePath;
    let fileName = doc.originalFilename;
    let mimeType = doc.mimeType;

    if (versionNumber) {
      const ver = await prisma.rdDocumentVersion.findFirst({
        where: { documentId, versionNumber: parseInt(versionNumber, 10), tenantId },
      });
      if (ver) {
        filePath = ver.storagePath;
        fileName = ver.originalFilename;
        mimeType = ver.mimeType;
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found in storage.');
    }

    const buffer = fs.readFileSync(filePath);
    return {
      buffer,
      fileName,
      mimeType,
      fileSize: buffer.length,
    };
  }

  // ==============================================================================
  // 5. RESEARCH DATASET REGISTRY & FILES (REQUIREMENT 42)
  // ==============================================================================

  async listDatasets(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.notebookId) where.notebookId = filters.notebookId;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.experimentId) where.experimentId = filters.experimentId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { datasetCode: { contains: filters.search } },
        { description: { contains: filters.search } },
        { tags: { contains: filters.search } },
      ];
    }

    return await prisma.rdDataset.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        owner: { select: { id: true, name: true, email: true } },
        files: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDataset(tenantId, data, userId) {
    const {
      projectId,
      notebookId,
      noteId,
      experimentId,
      runId,
      title,
      description,
      category = 'EXPERIMENTAL_DATASET',
      dataFormat = 'CSV',
      dataSource,
      collectionDate,
      tags,
    } = data;

    if (!projectId) throw new Error('projectId is required.');
    if (!title || !title.trim()) throw new Error('Dataset title is required.');

    const count = await prisma.rdDataset.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const datasetCode = data.datasetCode || `DS-${year}-${String(count + 1).padStart(3, '0')}`;

    const dataset = await prisma.rdDataset.create({
      data: {
        tenantId,
        projectId,
        notebookId: notebookId || null,
        noteId: noteId || null,
        experimentId: experimentId || null,
        runId: runId || null,
        datasetCode,
        title: title.trim(),
        description: description || null,
        category,
        dataFormat,
        dataSource: dataSource || null,
        collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
        tags: tags || null,
        status: 'ACTIVE',
        ownerId: userId || null,
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        files: true,
      },
    });

    await this._logAudit(tenantId, userId, 'Dataset Registered', `Registered dataset ${dataset.datasetCode}: "${dataset.title}"`, { datasetId: dataset.id });
    return dataset;
  }

  async getDataset(tenantId, id) {
    const dataset = await prisma.rdDataset.findFirst({
      where: { id, tenantId },
      include: {
        project: { select: { id: true, name: true, status: true } },
        notebook: { select: { id: true, title: true, notebookCode: true } },
        owner: { select: { id: true, name: true, email: true } },
        files: true,
      },
    });
    if (!dataset) throw new Error('Dataset not found or access denied.');
    return dataset;
  }

  async uploadDatasetFile(tenantId, datasetId, filePayload, metadata = {}, userId) {
    const dataset = await prisma.rdDataset.findFirst({
      where: { id: datasetId, tenantId },
    });
    if (!dataset) throw new Error('Dataset not found or access denied.');

    const { fileName, fileSize, base64Content, mimeType = 'text/csv' } = filePayload || {};
    this._validateFilePayload(fileName, fileSize, base64Content);

    const diskInfo = this._saveFileToDisk(tenantId, fileName, base64Content);

    const file = await prisma.rdDatasetFile.create({
      data: {
        tenantId,
        datasetId,
        fileName: diskInfo.originalFilename,
        originalFilename: diskInfo.originalFilename,
        fileExtension: diskInfo.fileExtension,
        mimeType: mimeType || 'text/csv',
        fileSize: diskInfo.fileSize,
        storagePath: diskInfo.storagePath,
        fileChecksum: diskInfo.fileChecksum,
        rowCount: metadata.rowCount !== undefined ? parseInt(metadata.rowCount, 10) : null,
        columnCount: metadata.columnCount !== undefined ? parseInt(metadata.columnCount, 10) : null,
        schemaDescription: metadata.schemaDescription || null,
        uploadedById: userId || null,
      },
    });

    await this._logAudit(tenantId, userId, 'Dataset File Uploaded', `Uploaded file ${file.fileName} to dataset ${dataset.datasetCode}`, { datasetId, fileId: file.id });
    return file;
  }

  async getDatasetFile(tenantId, fileId) {
    const file = await prisma.rdDatasetFile.findFirst({
      where: { id: fileId, tenantId },
    });
    if (!file) throw new Error('Dataset file not found or access denied.');

    if (!fs.existsSync(file.storagePath)) {
      throw new Error('Dataset file not found in storage.');
    }

    const buffer = fs.readFileSync(file.storagePath);
    return {
      buffer,
      fileName: file.originalFilename,
      mimeType: file.mimeType,
      fileSize: buffer.length,
    };
  }

  // ==============================================================================
  // 6. RESEARCH KNOWLEDGE REPOSITORY (REQUIREMENT 30, 42)
  // ==============================================================================

  async listKnowledgeRecords(tenantId, filters = {}) {
    const where = { tenantId };
    if (filters.category) where.category = filters.category;
    if (filters.sourceProjectId) where.sourceProjectId = filters.sourceProjectId;
    if (filters.accessLevel) where.accessLevel = filters.accessLevel;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { knowledgeCode: { contains: filters.search } },
        { description: { contains: filters.search } },
        { content: { contains: filters.search } },
        { tags: { contains: filters.search } },
      ];
    }

    return await prisma.rdKnowledgeRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createKnowledgeRecord(tenantId, data, userId) {
    const {
      title,
      content,
      description,
      category = 'RESEARCH_FINDING',
      tags,
      sourceProjectId,
      sourceNotebookId,
      sourceExperimentId,
      sourceNoteId,
      sourceEvidenceId,
      sourceOutcomeId,
      accessLevel = 'TENANT_WIDE',
      status = 'PUBLISHED',
    } = data;

    if (!title || !title.trim()) throw new Error('Knowledge title is required.');
    if (!content || !content.trim()) throw new Error('Knowledge content is required.');

    const count = await prisma.rdKnowledgeRecord.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const knowledgeCode = data.knowledgeCode || `KB-${year}-${String(count + 1).padStart(3, '0')}`;

    const record = await prisma.rdKnowledgeRecord.create({
      data: {
        tenantId,
        knowledgeCode,
        title: title.trim(),
        content: content.trim(),
        description: description || null,
        category,
        tags: tags || null,
        sourceProjectId: sourceProjectId || null,
        sourceNotebookId: sourceNotebookId || null,
        sourceExperimentId: sourceExperimentId || null,
        sourceNoteId: sourceNoteId || null,
        sourceEvidenceId: sourceEvidenceId || null,
        sourceOutcomeId: sourceOutcomeId || null,
        accessLevel,
        status,
        authorId: userId || null,
      },
    });

    await this._logAudit(tenantId, userId, 'Knowledge Record Created', `Created knowledge record ${record.knowledgeCode}: "${record.title}"`, { recordId: record.id });
    return record;
  }

  async getKnowledgeRecord(tenantId, id) {
    const record = await prisma.rdKnowledgeRecord.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new Error('Knowledge record not found or access denied.');
    return record;
  }

  async updateKnowledgeRecord(tenantId, id, data, userId) {
    const existing = await prisma.rdKnowledgeRecord.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new Error('Knowledge record not found.');

    const { title, content, description, category, tags, status, accessLevel } = data;

    const updated = await prisma.rdKnowledgeRecord.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        content: content !== undefined ? content.trim() : existing.content,
        description: description !== undefined ? description : existing.description,
        category: category || existing.category,
        tags: tags !== undefined ? tags : existing.tags,
        status: status || existing.status,
        accessLevel: accessLevel || existing.accessLevel,
      },
    });

    await this._logAudit(tenantId, userId, 'Knowledge Record Updated', `Updated knowledge record ${updated.knowledgeCode}`, { recordId: id });
    return updated;
  }

  // ==============================================================================
  // 7. ENTITY DOCUMENT LINKING & DISCOVERY
  // ==============================================================================

  async linkDocumentToEntity(tenantId, documentId, entityType, entityId, linkType = 'SUPPORTING_DOCUMENT', userId) {
    const doc = await prisma.rdResearchDocument.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!doc) throw new Error('Research document not found.');

    const link = await prisma.rdDocumentLink.upsert({
      where: {
        documentId_entityType_entityId: {
          documentId,
          entityType,
          entityId,
        },
      },
      update: { linkType },
      create: {
        tenantId,
        documentId,
        entityType,
        entityId,
        linkType,
        linkedById: userId || null,
      },
      include: { document: true },
    });

    await this._logAudit(tenantId, userId, 'Document Linked', `Linked ${doc.documentCode} to ${entityType}:${entityId}`);
    return link;
  }

  async unlinkDocumentFromEntity(tenantId, linkId, userId) {
    const link = await prisma.rdDocumentLink.findFirst({
      where: { id: linkId, tenantId },
    });
    if (!link) throw new Error('Document link not found.');

    await prisma.rdDocumentLink.delete({ where: { id: linkId } });
    await this._logAudit(tenantId, userId, 'Document Unlinked', `Removed document link ${linkId}`);
    return { success: true, message: 'Document unlinked successfully.' };
  }

  async getEntityDocuments(tenantId, entityType, entityId) {
    const links = await prisma.rdDocumentLink.findMany({
      where: { tenantId, entityType, entityId },
      include: {
        document: {
          include: {
            versions: { orderBy: { versionNumber: 'desc' } },
            uploader: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return links.map(l => ({
      linkId: l.id,
      linkType: l.linkType,
      linkedAt: l.createdAt,
      document: l.document,
    }));
  }

  // ==============================================================================
  // 8. UNIFIED ELN DISCOVERY SEARCH (AC-20)
  // ==============================================================================

  async globalSearch(tenantId, query, filters = {}) {
    if (!query || !query.trim()) {
      return { notebooks: [], entries: [], documents: [], datasets: [], knowledge: [] };
    }
    const q = query.trim();

    const [notebooks, entries, documents, datasets, knowledge] = await Promise.all([
      prisma.rdNotebook.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q } },
            { notebookCode: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.rdResearchNote.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
            { entryNumber: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.rdResearchDocument.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q } },
            { documentCode: { contains: q } },
            { originalFilename: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.rdDataset.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q } },
            { datasetCode: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.rdKnowledgeRecord.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q } },
            { knowledgeCode: { contains: q } },
            { content: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        take: 10,
      }),
    ]);

    return {
      query: q,
      counts: {
        notebooks: notebooks.length,
        entries: entries.length,
        documents: documents.length,
        datasets: datasets.length,
        knowledge: knowledge.length,
        total: notebooks.length + entries.length + documents.length + datasets.length + knowledge.length,
      },
      notebooks,
      entries,
      documents,
      datasets,
      knowledge,
    };
  }
}

module.exports = new RdElnService();
