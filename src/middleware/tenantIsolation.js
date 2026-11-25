/**
 * Multi-Tenant Data Isolation Guard
 * EgoLytics R&D Management Platform / CRM nErgy Enterprise
 * 
 * Enforces strict server-side tenant isolation:
 * 1. Blocks cross-tenant data requests
 * 2. Prevents tenant ID spoofing from request body or query params
 * 3. Guarantees queries are partitioned by authenticated req.user.tenantId
 */

/**
 * Middleware: Validates that any client-supplied tenant identifier matches the trusted JWT session.
 * Prevents cross-tenant parameter tampering and injection attacks.
 */
const validateTenantScope = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Valid tenant context not found in session.',
      code: 'MISSING_TENANT_CONTEXT',
    });
  }

  const sessionTenantId = req.user.tenantId;

  // Check route params, query string, and body
  const paramTenantId = req.params?.tenantId;
  const queryTenantId = req.query?.tenantId;
  const bodyTenantId = req.body?.tenantId;

  if (paramTenantId && paramTenantId !== sessionTenantId) {
    return res.status(403).json({
      success: false,
      message: 'Cross-tenant access violation: Requested route tenant does not match authorized session.',
      code: 'CROSS_TENANT_VIOLATION',
    });
  }

  if (queryTenantId && queryTenantId !== sessionTenantId) {
    return res.status(403).json({
      success: false,
      message: 'Cross-tenant query violation: Requested query tenant does not match authorized session.',
      code: 'CROSS_TENANT_VIOLATION',
    });
  }

  if (bodyTenantId && bodyTenantId !== sessionTenantId) {
    return res.status(403).json({
      success: false,
      message: 'Cross-tenant mutation violation: Payload tenant does not match authorized session.',
      code: 'CROSS_TENANT_VIOLATION',
    });
  }

  next();
};

/**
 * Utility helper: Injects strict tenantId constraint into Prisma query where clause.
 * @param {Object} req - Express request object with verified req.user
 * @param {Object} whereClause - Existing Prisma query where conditions
 * @returns {Object} Safe where clause guaranteed to be scoped by tenantId
 */
const scopeToTenant = (req, whereClause = {}) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('Cannot scope query: req.user.tenantId is missing.');
  }
  return {
    ...whereClause,
    tenantId,
  };
};

module.exports = {
  validateTenantScope,
  scopeToTenant,
};
