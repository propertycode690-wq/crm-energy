const dotenv = require('dotenv');
dotenv.config();

/**
 * ==============================================================================
 * CENTRALIZED CORS ORIGINS CONFIGURATION
 * Add any frontend port or domain here (e.g. 5173, 5174, 5175, etc.)
 * ==============================================================================
 */
const parseOrigins = (raw) => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

// Explicit list of allowed origins - Easy to add/remove any port or domain
const ALLOWED_ORIGINS = [
  // Localhost Vite Dev Servers (Standard & Fallback Ports)
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',

  // 127.0.0.1 IP equivalents
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:8080',

  // Production & Staging Domains
  'https://crm-energy.netlify.app',
  'https://crm-energy-production.up.railway.app',
  'https://crm-energy-backend-production.up.railway.app',
  'https://crm-energy-backend-production-59b6.up.railway.app',

  // Extra origins from .env (CORS_ORIGIN)
  ...parseOrigins(process.env.CORS_ORIGIN),
];

/**
 * Helper to dynamically check if an origin is permitted:
 * - Automatically allows ANY localhost or 127.0.0.1 port (e.g. 5173, 5174, 5175, 5176, etc.)
 * - Matches explicit list in ALLOWED_ORIGINS
 * - Allows Netlify and Railway subdomains
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Server-to-server, curl, mobile apps
  const normalized = origin.replace(/\/+$/, '');

  // 1. Check explicit list
  if (ALLOWED_ORIGINS.includes(normalized)) return true;

  // 2. Wildcard check: ANY localhost or 127.0.0.1 port (prevents port collisions)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // 3. Subdomains for Netlify and Railway
  if (normalized.endsWith('.netlify.app') || normalized.endsWith('.railway.app')) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed by policy: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Platform-Api-Key',
    'X-Api-Key',
    'X-SWMTP-Signature',
    'x-user-role-id',
    'x-user-role',
    'x-user-id',
    'x-user-name',
    'x-tenant-id',
    'X-User-Role-Id',
    'X-User-Role',
    'X-User-Id',
    'X-User-Name',
    'X-Tenant-Id',
  ],
  optionsSuccessStatus: 200,
};

module.exports = {
  ALLOWED_ORIGINS,
  isOriginAllowed,
  corsOptions,
};
