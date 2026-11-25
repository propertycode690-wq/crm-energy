/**
 * Dual Authentication Middleware: JWT Session & Enterprise Scoped API Keys
 * Master Prompt 16: Enterprise API Access, Rate Limiting & Scope Verification
 */

const { authenticateToken } = require('./auth');
const rdApiKeyService = require('../services/rdApiKeyService');

/**
 * Middleware: Accepts either JWT Bearer token OR X-API-Key / Bearer egokey_live_...
 */
const dualAuth = async (req, res, next) => {
  const xApiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let rawKey = (xApiKey && xApiKey.trim()) ? xApiKey.trim() : null;

  if (!rawKey && authHeader && authHeader.trim().startsWith('Bearer egokey_live_')) {
    rawKey = authHeader.trim().split(' ')[1];
  }

  // If API key is present, verify it
  if (rawKey) {
    try {
      const verification = await rdApiKeyService.verifyApiKey(rawKey);
      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          message: verification.error || 'Invalid or revoked API key',
          code: 'INVALID_API_KEY'
        });
      }

      req.user = {
        id: verification.keyId,
        userId: verification.keyId,
        tenantId: verification.tenantId,
        role: 'API_INTEGRATION_CLIENT',
        email: `api-${verification.name.replace(/\s+/g, '-').toLowerCase()}@egolytics.internal`,
        isApiKey: true,
        scopes: verification.scopes
      };
      req.apiKey = verification;
      return next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Internal error verifying API key',
        error: err.message
      });
    }
  }

  // Fallback to standard JWT session authentication
  return authenticateToken(req, res, next);
};

/**
 * Middleware to enforce required scopes on API requests
 */
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    // If not authenticated via API key (e.g. interactive UI session), allow full access
    if (!req.user || !req.user.isApiKey) {
      return next();
    }

    const scopes = req.user.scopes || [];
    if (scopes.includes('rd:admin') || scopes.includes(requiredScope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Missing required scope: ${requiredScope}`,
      code: 'INSUFFICIENT_SCOPE'
    });
  };
};

module.exports = {
  dualAuth,
  requireScope
};
