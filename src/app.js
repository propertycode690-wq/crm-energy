const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const contactRoutes = require('./routes/contactRoutes');
const dealRoutes = require('./routes/dealRoutes');
const taskRoutes = require('./routes/taskRoutes');
const noteRoutes = require('./routes/noteRoutes');
const activityRoutes = require('./routes/activityRoutes');
const userRoutes = require('./routes/userRoutes');
const erpRoutes = require('./routes/erpRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const territoryRoutes = require('./routes/territoryRoutes');
const hrRoutes = require('./routes/hrRoutes');
const supportRoutes = require('./routes/supportRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const manufacturingRoutes = require('./routes/manufacturingRoutes');
const eboxRoutes = require('./routes/eboxRoutes');
const swmtpRoutes = require('./routes/swmtpRoutes');
const aiRoutes = require('./routes/aiRoutes');
const rolePermissionRoutes = require('./routes/rolePermissionRoutes');
const rdRoutes = require('./routes/rdRoutes');
const gisRoutes = require('./routes/gisRoutes');
const bfovRoutes = require('./routes/bfovRoutes');
const rdEnterpriseRoutes = require('./routes/rdEnterpriseRoutes');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

const { corsOptions } = require('./config/corsConfig');

const app = express();

// Apply Centralized CORS Middleware across all routes
app.use(cors(corsOptions));

// Body parsing middleware with safety limits
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Normalize accidentally double-prefixed /api/api requests
app.use((req, res, next) => {
  if (req.url.startsWith('/api/api/')) {
    req.url = req.url.substring(4);
  }
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'CRM nErgy API is running' }));
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CRM nErgy API is running',
  });
});

// API Routes (Mounted under /api and root paths for seamless backward-compatibility)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/leads', leadRoutes);
app.use('/leads', leadRoutes);

app.use('/api/contacts', contactRoutes);
app.use('/contacts', contactRoutes);

app.use('/api/deals', dealRoutes);
app.use('/deals', dealRoutes);

app.use('/api/tasks', taskRoutes);
app.use('/tasks', taskRoutes);

app.use('/api/notes', noteRoutes);
app.use('/notes', noteRoutes);

app.use('/api/activities', activityRoutes);
app.use('/activities', activityRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/erp', erpRoutes);
app.use('/erp', erpRoutes);

app.use('/api/invoices', invoiceRoutes);
app.use('/invoices', invoiceRoutes);

app.use('/api/communications', communicationRoutes);
app.use('/communications', communicationRoutes);

app.use('/api/territories', territoryRoutes);
app.use('/territories', territoryRoutes);

app.use('/api/hr', hrRoutes);
app.use('/hr', hrRoutes);

app.use('/api/support', supportRoutes);
app.use('/support', supportRoutes);

app.use('/api/tenants', tenantRoutes);
app.use('/tenants', tenantRoutes);

app.use('/api/manufacturing', manufacturingRoutes);
app.use('/manufacturing', manufacturingRoutes);

app.use('/api/ebox', eboxRoutes);
app.use('/ebox', eboxRoutes);
app.use('/api/zbox', eboxRoutes);
app.use('/zbox', eboxRoutes);

app.use('/api/roles-permissions', rolePermissionRoutes);
app.use('/roles-permissions', rolePermissionRoutes);

app.use('/api/rd/enterprise', rdEnterpriseRoutes);
app.use('/rd/enterprise', rdEnterpriseRoutes);
app.use('/api/enterprise', rdEnterpriseRoutes);
app.use('/enterprise', rdEnterpriseRoutes);

app.use('/api/rd', rdRoutes);
app.use('/rd', rdRoutes);

app.use('/api/gis', gisRoutes);
app.use('/gis', gisRoutes);

app.use('/api/diagrams', bfovRoutes);
app.use('/diagrams', bfovRoutes);
app.use('/api/bfov', bfovRoutes);

app.use('/api/v1/internal-staff', swmtpRoutes);
app.use('/v1/internal-staff', swmtpRoutes);

app.use('/api/ai', aiRoutes);
app.use('/ai', aiRoutes);
app.use('/api/integration', aiRoutes);
app.use('/integration', aiRoutes);
app.use('/api', aiRoutes);

// 404 Handler for unknown routes
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
