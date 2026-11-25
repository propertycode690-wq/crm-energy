const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Optional auth helper: allows unauthenticated visitors (e.g. login/portal screen) to safely query articles or empty tickets without 401 errors
const authenticateOrGuest = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticateToken(req, res, next);
};

// Support Ticket Interaction Roles (Staff & Customers)
const TICKET_ACCESS_ROLES = [
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'OPERATIONS_SALES_ADMIN',
  'CRM_PRO',
  'CUSTOMER',
];

// Support Ticket Deletion Roles (Administrative authorities only)
const TICKET_DELETE_ROLES = [
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'OPERATIONS_SALES_ADMIN',
];

// Knowledge Base Article Publishing Roles
const ARTICLE_PUBLISH_ROLES = [
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'CRM_PRO',
  'CONTENT_BUILDER',
  'OPERATIONS_SALES_ADMIN',
];

// Knowledge Base Article Read Roles (All authenticated workspace members)
const ARTICLE_READ_ROLES = [
  'SUPER_ADMIN',
  'BUSINESS_OWNER',
  'CUSTOMER',
  'CONTENT_CREATOR',
  'CONTENT_BUILDER',
  'CRM_PRO',
  'OPERATIONS_SALES_ADMIN',
  'FINANCE_COMPLIANCE_ADMIN',
  'HR',
  'AI_MARKETING_PRO',
  'AFFILIATE_PARTNER',
  'INFLUENCER',
];

// Tickets - Safe for login screen or authenticated users
router.get('/tickets', authenticateOrGuest, (req, res, next) => {
  if (!req.user) {
    return res.status(200).json({ success: true, count: 0, data: [] });
  }
  return supportController.getTickets(req, res, next);
});

router.get('/tickets/:id', authenticateToken, authorizeRoles(...TICKET_ACCESS_ROLES), supportController.getTicketById);
router.post('/tickets', authenticateToken, authorizeRoles(...TICKET_ACCESS_ROLES), supportController.createTicket);
router.put('/tickets/:id', authenticateToken, authorizeRoles(...TICKET_ACCESS_ROLES), supportController.updateTicket);
router.delete('/tickets/:id', authenticateToken, authorizeRoles(...TICKET_DELETE_ROLES), supportController.deleteTicket);

// Knowledge Base Articles - Accessible publicly or with authenticated session
router.get('/articles', authenticateOrGuest, (req, res, next) => {
  if (!req.user) {
    req.user = { tenantId: 'TENANT-08492', role: 'BUSINESS_OWNER' };
  }
  return supportController.getArticles(req, res, next);
});

router.post('/articles', authenticateToken, authorizeRoles(...ARTICLE_PUBLISH_ROLES), supportController.createArticle);

module.exports = router;

