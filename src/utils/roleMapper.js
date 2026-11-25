/**
 * CRM nErgy Role Mapper
 * Bidirectional normalization between Frontend role formats and Prisma Schema enum Role.
 */

const FRONTEND_TO_PRISMA_MAP = {
  // Business Owner / Executive
  business_owner: 'BUSINESS_OWNER',
  business_owners: 'BUSINESS_OWNER',
  'business owner': 'BUSINESS_OWNER',
  'business owners': 'BUSINESS_OWNER',
  'business owner / executive': 'BUSINESS_OWNER',
  owner: 'BUSINESS_OWNER',
  owners: 'BUSINESS_OWNER',
  ceo: 'BUSINESS_OWNER',

  // Customer / Client Portal
  customer: 'CUSTOMER',
  customers: 'CUSTOMER',
  client: 'CUSTOMER',
  clients: 'CUSTOMER',
  'client & customer portal': 'CUSTOMER',
  'client portal': 'CUSTOMER',

  // Content Creator
  content_creator: 'CONTENT_CREATOR',
  content_creators: 'CONTENT_CREATOR',
  'content creator': 'CONTENT_CREATOR',
  'content creators': 'CONTENT_CREATOR',
  'ai media & video creator': 'CONTENT_CREATOR',
  creator: 'CONTENT_CREATOR',
  creators: 'CONTENT_CREATOR',

  // Content Builder
  content_builder: 'CONTENT_BUILDER',
  content_builders: 'CONTENT_BUILDER',
  'content builder': 'CONTENT_BUILDER',
  'content builders': 'CONTENT_BUILDER',
  'campaign & content builder': 'CONTENT_BUILDER',
  builder: 'CONTENT_BUILDER',
  builders: 'CONTENT_BUILDER',

  // Influencer
  influencer: 'INFLUENCER',
  influencers: 'INFLUENCER',
  'influencer': 'INFLUENCER',
  'influencers': 'INFLUENCER',
  'brand ambassador & influencer': 'INFLUENCER',

  // Affiliate Partner
  affiliate_partner: 'AFFILIATE_PARTNER',
  affiliate_partners: 'AFFILIATE_PARTNER',
  'affiliate partner': 'AFFILIATE_PARTNER',
  'affiliate partners': 'AFFILIATE_PARTNER',
  'affiliate deal partner': 'AFFILIATE_PARTNER',
  affiliate: 'AFFILIATE_PARTNER',
  affiliates: 'AFFILIATE_PARTNER',

  // AI Marketing Pro
  ai_marketing_pro: 'AI_MARKETING_PRO',
  ai_marketing_pros: 'AI_MARKETING_PRO',
  'ai marketing pro': 'AI_MARKETING_PRO',
  'ai marketing pros': 'AI_MARKETING_PRO',
  'ai marketing specialist': 'AI_MARKETING_PRO',
  'growth & autonomous ads': 'AI_MARKETING_PRO',
  marketing: 'AI_MARKETING_PRO',

  // Human Resources
  hr: 'HR',
  'human resources': 'HR',
  'human resources director': 'HR',

  // Operations & Sales Admin (Admin 1)
  admin_1: 'OPERATIONS_SALES_ADMIN',
  admin1: 'OPERATIONS_SALES_ADMIN',
  'admin 1': 'OPERATIONS_SALES_ADMIN',
  'admin i': 'OPERATIONS_SALES_ADMIN',
  sales: 'OPERATIONS_SALES_ADMIN',
  operations_sales_admin: 'OPERATIONS_SALES_ADMIN',
  'operations & sales administrator': 'OPERATIONS_SALES_ADMIN',
  'operations & sales administrator (admin i)': 'OPERATIONS_SALES_ADMIN',
  'operations/sales admin': 'OPERATIONS_SALES_ADMIN',

  // Finance & Compliance Admin (Admin 2)
  admin_2: 'FINANCE_COMPLIANCE_ADMIN',
  admin2: 'FINANCE_COMPLIANCE_ADMIN',
  'admin 2': 'FINANCE_COMPLIANCE_ADMIN',
  'admin ii': 'FINANCE_COMPLIANCE_ADMIN',
  finance: 'FINANCE_COMPLIANCE_ADMIN',
  finance_compliance_admin: 'FINANCE_COMPLIANCE_ADMIN',
  'finance & compliance administrator': 'FINANCE_COMPLIANCE_ADMIN',
  'finance & compliance administrator (admin ii)': 'FINANCE_COMPLIANCE_ADMIN',
  'finance & compliance admin': 'FINANCE_COMPLIANCE_ADMIN',

  // CRM Pro
  crm_pro: 'CRM_PRO',
  'crm pro': 'CRM_PRO',
  'crm & pipeline specialist': 'CRM_PRO',
  'crm free': 'CRM_PRO',
  'csr free': 'CRM_PRO',
  employee: 'CRM_PRO',
  staff: 'CRM_PRO',

  // Super Admin
  super_admin: 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  'super admin': 'SUPER_ADMIN',
  'master super administrator': 'SUPER_ADMIN',
};

const PRISMA_TO_FRONTEND_MAP = {
  BUSINESS_OWNER: 'business_owner',
  CUSTOMER: 'customer',
  CONTENT_CREATOR: 'content_creator',
  CONTENT_BUILDER: 'content_builder',
  INFLUENCER: 'influencer',
  AFFILIATE_PARTNER: 'affiliate_partner',
  AI_MARKETING_PRO: 'ai_marketing_pro',
  HR: 'hr',
  OPERATIONS_SALES_ADMIN: 'admin_1',
  FINANCE_COMPLIANCE_ADMIN: 'admin_2',
  CRM_PRO: 'crm_pro',
  SUPER_ADMIN: 'super_admin',
};

const ROLE_DISPLAY_NAMES = {
  BUSINESS_OWNER: 'Business Owner / Executive',
  CUSTOMER: 'Client & Customer Portal',
  CONTENT_CREATOR: 'AI Media & Video Creator',
  CONTENT_BUILDER: 'Campaign & Content Builder',
  INFLUENCER: 'Brand Ambassador & Influencer',
  AFFILIATE_PARTNER: 'Affiliate Deal Partner',
  AI_MARKETING_PRO: 'AI Marketing Specialist',
  HR: 'Human Resources Director',
  OPERATIONS_SALES_ADMIN: 'Operations & Sales Administrator (Admin I)',
  FINANCE_COMPLIANCE_ADMIN: 'Finance & Compliance Administrator (Admin II)',
  CRM_PRO: 'CRM & Pipeline Specialist',
  SUPER_ADMIN: 'Master Super Administrator',
};

/**
 * Normalizes any frontend role input to valid Prisma Role enum.
 * @param {string} roleInput
 * @returns {string} Prisma Role enum
 */
const toPrismaRole = (roleInput) => {
  if (!roleInput) return 'BUSINESS_OWNER';
  const raw = String(roleInput).trim();
  const upper = raw.toUpperCase();
  if (PRISMA_TO_FRONTEND_MAP[upper]) return upper;

  const clean = raw.toLowerCase();
  if (FRONTEND_TO_PRISMA_MAP[clean]) return FRONTEND_TO_PRISMA_MAP[clean];

  const normalizedKey = clean.replace(/[\s-]+/g, '_');
  if (FRONTEND_TO_PRISMA_MAP[normalizedKey]) return FRONTEND_TO_PRISMA_MAP[normalizedKey];

  return 'BUSINESS_OWNER';
};

/**
 * Converts Prisma Role enum to frontend role ID format.
 * @param {string} prismaRole
 * @returns {string} Frontend role ID
 */
const toFrontendRole = (prismaRole) => {
  if (!prismaRole) return 'crm_pro';
  return PRISMA_TO_FRONTEND_MAP[prismaRole] || 'crm_pro';
};

/**
 * Gets human-readable display title for a role.
 * @param {string} role
 * @returns {string}
 */
const getRoleDisplayName = (role) => {
  const prismaRole = toPrismaRole(role);
  return ROLE_DISPLAY_NAMES[prismaRole] || 'CRM Specialist';
};

module.exports = {
  toPrismaRole,
  toFrontendRole,
  getRoleDisplayName,
  FRONTEND_TO_PRISMA_MAP,
  PRISMA_TO_FRONTEND_MAP,
};
