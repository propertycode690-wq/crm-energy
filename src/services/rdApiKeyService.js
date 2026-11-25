/**
 * Scoped Enterprise API Key Service
 * Master Prompt 16: External Integration, SHA-256 Hashed Keys & Scoped Authorization
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const rdAuditService = require('./rdAuditService');

const VALID_SCOPES = [
  'rd:read',
  'rd:write',
  'rd:export',
  'rd:admin',
  'gis:read',
  'gis:write',
  'bfov:read',
  'bfov:write'
];

class RdApiKeyService {
  /**
   * Generate an enterprise API key (raw key is returned ONLY once)
   */
  async generateKey(tenantId, createdById, data = {}, actorInfo = {}) {
    const {
      name,
      scopes = ['rd:read', 'rd:export'],
      rateLimitPerMin = 60,
      expiresAtDays = 90
    } = data;

    if (!name || !name.trim()) {
      const error = new Error('API Key Name/Description is required');
      error.statusCode = 400;
      throw error;
    }

    // Filter valid scopes
    const normalizedScopes = Array.isArray(scopes)
      ? scopes.filter(s => VALID_SCOPES.includes(s.toLowerCase()))
      : ['rd:read', 'rd:export'];

    if (normalizedScopes.length === 0) {
      normalizedScopes.push('rd:read');
    }

    // Generate raw key
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const rawKey = `egokey_live_${rawSecret}`;
    const keyPrefix = `${rawKey.substring(0, 16)}...`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let expiresAt = null;
    if (expiresAtDays && parseInt(expiresAtDays) > 0) {
      expiresAt = new Date(Date.now() + parseInt(expiresAtDays) * 24 * 60 * 60 * 1000);
    }

    const apiKeyRecord = await prisma.rdApiKey.create({
      data: {
        tenantId,
        createdById: createdById || null,
        name: name.trim(),
        keyPrefix,
        keyHash,
        scopes: normalizedScopes,
        rateLimitPerMin: Math.max(10, Math.min(1000, parseInt(rateLimitPerMin) || 60)),
        status: 'ACTIVE',
        expiresAt
      }
    });

    // Audit log (Notice: NO rawKey is ever saved in audit log)
    await rdAuditService.logAuditEvent({
      tenantId,
      userId: createdById,
      actorName: actorInfo.name || 'System Admin',
      action: 'GENERATE_API_KEY',
      entityType: 'API_KEY',
      entityId: apiKeyRecord.id,
      details: { keyName: apiKeyRecord.name, keyPrefix, scopes: normalizedScopes },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      rawKey, // Exposed ONLY during creation
      keyPrefix,
      scopes: normalizedScopes,
      rateLimitPerMin: apiKeyRecord.rateLimitPerMin,
      status: apiKeyRecord.status,
      expiresAt,
      createdAt: apiKeyRecord.createdAt
    };
  }

  /**
   * List API keys for tenant (securely excludes keyHash)
   */
  async listKeys(tenantId) {
    const keys = await prisma.rdApiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMin: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        creator: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return keys;
  }

  /**
   * Revoke an API Key
   */
  async revokeKey(tenantId, id, userId, actorInfo = {}) {
    const key = await prisma.rdApiKey.findFirst({
      where: { id, tenantId }
    });

    if (!key) {
      const error = new Error('API key not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.rdApiKey.update({
      where: { id },
      data: { status: 'REVOKED' }
    });

    await rdAuditService.logAuditEvent({
      tenantId,
      userId,
      actorName: actorInfo.name || 'System Admin',
      action: 'REVOKE_API_KEY',
      entityType: 'API_KEY',
      entityId: id,
      details: { keyName: key.name, keyPrefix: key.keyPrefix },
      ipAddress: actorInfo.ip,
      userAgent: actorInfo.userAgent
    });

    return { success: true, id, status: 'REVOKED' };
  }

  /**
   * Verify raw API Key against stored hashes
   */
  async verifyApiKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('egokey_live_')) {
      return { valid: false, error: 'Malformed or missing API key format' };
    }

    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const key = await prisma.rdApiKey.findFirst({
      where: { keyHash: hash }
    });

    if (!key) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (key.status !== 'ACTIVE') {
      return { valid: false, error: `API key is ${key.status.toLowerCase()}` };
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update usage asynchronously
    prisma.rdApiKey.update({
      where: { id: key.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      }
    }).catch(err => console.error('[ApiKeyService] Failed to record usage:', err.message));

    return {
      valid: true,
      tenantId: key.tenantId,
      keyId: key.id,
      name: key.name,
      scopes: Array.isArray(key.scopes) ? key.scopes : [],
      rateLimitPerMin: key.rateLimitPerMin
    };
  }
}

module.exports = new RdApiKeyService();

