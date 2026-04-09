const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { requestIdMiddleware, errorHandler, notFoundHandler, logger } = require('./middleware/errorHandler');
require('dotenv').config({ path: './config.env' });

// ── Process-level error guards ─────────────────────────────────────────────
// Prevent stream/pipe errors from crashing the entire server process.
// These are defensive; the receipt PDF route already buffers to avoid them.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.code, err.message);
  // Only exit for truly fatal errors (e.g. EADDRINUSE), not stream errors
  if (err.code === 'ERR_STREAM_WRITE_AFTER_END' || err.code === 'EPIPE') {
    console.warn('[uncaughtException] Stream error – ignoring, not exiting');
  } else {
    console.error('[uncaughtException] Fatal – exiting:', err.stack);
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  // Do NOT exit — Express async handlers catch these at the route level
});

const app = express();

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// ── CORS configuration (MUST come before helmet and all other middleware) ───
const allowedOrigins = [
  'https://learnovoapp.vercel.app',
  ...(process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(url => url.trim())
    : []),
  // Local development origins
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    // Allow if origin is in the allowed list
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow all *.learnovoportal.com subdomains (tenant frontends)
    if (origin.endsWith('.learnovoportal.com') || origin === 'https://learnovoportal.com') {
      return callback(null, true);
    }
    // In development, allow any localhost (including subdomain.localhost)
    if (process.env.NODE_ENV !== 'production' &&
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}. Allowed:`, allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Tenant-Subdomain'],
  exposedHeaders: ['X-Request-ID', 'Content-Disposition'],
  maxAge: 86400, // Cache preflight for 24 hours
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Handle preflight OPTIONS for ALL routes before anything else
app.options('*', cors(corsOptions));
// Apply CORS to all requests
app.use(cors(corsOptions));

// Security middleware (AFTER CORS so headers aren't stripped)
// Skip helmet for test-payment page (needs relaxed CSP for Razorpay)
app.use((req, res, next) => {
  if (req.path === '/test-payment' || req.path.startsWith('/public/')) {
    return next();
  }
  helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })(req, res, next);
});
app.use(compression());

// Body parsing middleware
// The "verify" callback saves the raw body for Razorpay webhook signature verification.
// express.json() normally parses the body and throws away the raw string, but we need
// the exact raw bytes to compute the HMAC signature.
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    // Only save rawBody for webhook/callback routes (to save memory on other routes)
    if (req.originalUrl === '/api/fee-payments/webhook' ||
        req.originalUrl === '/api/student-fees/payment/icici-return' ||
        req.originalUrl === '/api/student-fees/payment/notify' ||
        req.originalUrl.startsWith('/api/fee-payments/webhook/icici-orange/')) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '50mb',
  verify: (req, res, buf) => {
    // ICICI Orange callback may arrive as application/x-www-form-urlencoded.
    // Capture the raw body so the webhook handler can log/inspect the
    // exact bytes (and verify signatures once ICICI's spec is shared).
    if (req.originalUrl.startsWith('/api/fee-payments/webhook/icici-orange/')) {
      req.rawBody = buf.toString();
    }
  }
}));

// Static files - uploads/ directory no longer used (S3 + Cloudinary)
// Images served from Cloudinary, documents from S3 pre-signed URLs

// Database connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('FATAL: MONGO_URI or MONGODB_URI is not set');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

mongoose.connect(mongoUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  autoIndex: !isProduction // indexes managed via utils/indexes.js in prod
})
  .then(async() => {
    console.log('MongoDB connected');
    // Create indexes in the background (non-blocking)
    const { ensureIndexes } = require('./utils/indexes');
    ensureIndexes().catch((e) => console.error('[indexes] bg error:', e.message));
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Root/health endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Learnovo API running',
    docs: '/api',
    tips: 'Try /api/settings/currencies for a public endpoint',
    requestId: req.requestId
  });
});

// Enhanced health check endpoint
app.get('/health', async(req, res) => {
  try {
    const healthCheck = {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      services: {
        database: 'unknown',
        email: 'unknown'
      }
    };

    // Check database connectivity
    try {
      await mongoose.connection.db.admin().ping();
      healthCheck.services.database = 'healthy';
    } catch (error) {
      healthCheck.services.database = 'unhealthy';
      healthCheck.success = false;
      healthCheck.status = 'degraded';
    }

    // Check email service
    try {
      const emailService = require('./services/emailService');
      const queueStatus = emailService.getQueueStatus();
      healthCheck.services.email = 'healthy';
      healthCheck.services.emailQueue = queueStatus;
    } catch (error) {
      healthCheck.services.email = 'unhealthy';
      healthCheck.success = false;
      healthCheck.status = 'degraded';
    }

    const statusCode = healthCheck.success ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Health check failed', error, { requestId: req.requestId });
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      requestId: req.requestId
    });
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve payment test page (development only)
if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  app.get('/test-payment', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-payment.html'));
  });
}

// ── Request timeout middleware ───────────────────────────────────────
app.use((req, res, next) => {
  // Long-running routes get a generous timeout (3 min)
  const longRunningPaths = [
    '/api/invoices/generate-bulk', '/api/invoices/bulk', '/api/report-cards/bulk-download',
    '/api/students/import', '/api/employees/import',
    '/api/transitions/year-rollover',
    '/api/fees/allocations/generate'
  ];
  // Medium-timeout routes (60s) — heavier queries that may exceed 30s
  const mediumPaths = [
    '/api/students/export', '/api/employees/export',
    '/api/fees/defaulters', '/api/fees/dashboard', '/api/fees/statistics',
    '/api/finance/dashboard', '/api/finance/report',
    '/api/reports', '/api/attendance',
    '/api/exams', '/api/payroll'
  ];
  const isLongRunning = longRunningPaths.some(p => req.path.startsWith(p) || req.originalUrl.startsWith(p));
  const isMedium = !isLongRunning && mediumPaths.some(p => req.path.startsWith(p) || req.originalUrl.startsWith(p));
  const timeout = isLongRunning ? 180000 : isMedium ? 60000 : 30000;

  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timed out. Please try again.' });
    }
  });
  next();
});

// Routes
app.use('/api/tenants', require('./routes/tenants'));
// app.use('/api/schools', require('./routes/schools')); // Commented out to be safe if file missing, but usually tenant-based. Diff showed it existed. I'll include it.
app.use('/api/schools', require('./routes/schools'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/academic-sessions', require('./routes/academicSessions'));
app.use('/api/academic-years', require('./routes/academicSessions')); // Alias for frontend compatibility
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/class-subjects', require('./routes/classSubjects'));
app.use('/api/teacher-assignments', require('./routes/teacherAssignments'));
app.use('/api/fees', require('./routes/feesReports')); // Must come before generic fees routes
app.use('/api/fees', require('./routes/fees'));
app.use('/api/student-fees', require('./routes/studentFees'));
app.use('/api/admin-disputes', require('./routes/adminDisputes'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/fee-structures', require('./routes/feeStructures'));
app.use('/api/fees/allocations', require('./routes/allocations'));
app.use('/api/fees/import', require('./routes/feeImport'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/admissions', require('./routes/admissions'));
app.use('/api/student-lists', require('./routes/studentLists'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sub-departments', require('./routes/subDepartments'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/transitions', require('./routes/transitions'));
app.use('/api/files', require('./routes/files')); // Cloudinary file operations
app.use('/api/test', require('./routes/test')); // Test endpoints (remove in production)

app.use('/api/payments', require('./routes/payments'));
// ICICI Orange callback — must be mounted BEFORE the generic /api/fee-payments
// router so the more-specific path is matched first. SPIS-only; gated by
// HTTP Basic Auth using env-var credentials provisioned to ICICI.
//
// Path-scoped text parser handles XML payloads (ICICI's older corporate
// stack often POSTs text/xml or application/xml). JSON and form-encoded
// bodies are already covered by the global parsers above, which also
// preserve req.rawBody for this path. The text parser captures rawBody
// the same way so signature verification can be added later.
app.use(
  '/api/fee-payments/webhook/icici-orange',
  express.text({
    type: ['text/xml', 'application/xml', 'text/plain'],
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use('/api/fee-payments/webhook/icici-orange', require('./routes/iciciOrangeWebhook'));
app.use('/api/fee-payments', require('./routes/feePayments'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/report-cards', require('./routes/reportCards'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/transport/routes', require('./routes/transportRoutes'));
app.use('/api/student-transport', require('./routes/studentTransport'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/advance-salary', require('./routes/advanceSalary'));
app.use('/api/homework', require('./routes/homework'));

// Expense Management
app.use('/api/expenses', require('./routes/expenses'));

// Income Management
app.use('/api/income', require('./routes/income'));

// Finance Dashboard (combined income + expense)
app.use('/api/finance', require('./routes/financeDashboard'));

// Timetable Management
app.use('/api/timetable', require('./routes/timetable'));

// Backup & Restore (admin-only)
app.use('/api/admin', require('./routes/backup'));

// Super Admin Routes
app.use('/api/super-admin/auth', require('./routes/superAdminAuth'));
app.use('/api/super-admin', require('./routes/superAdmin'));

// Serve test payment page (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/public', express.static(require('path').join(__dirname, 'public')));
  app.get('/test-payment', (req, res) => {
    // Relax CSP for test page so Razorpay checkout script can load
    res.setHeader('Content-Security-Policy', 'default-src \'self\'; script-src \'self\' https://checkout.razorpay.com; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' http://localhost:* https://*.razorpay.com; frame-src https://*.razorpay.com;');
    res.sendFile(require('path').join(__dirname, 'test-payment.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

// Start background jobs — only on PM2 cluster instance 0 to prevent duplicates
const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

if (isPrimaryInstance) {
  try {
    const reconciliationJob = require('./jobs/reconciliationJob');
    reconciliationJob.startJob();
  } catch (e) {
    console.error('Failed to start reconciliation job:', e);
  }

  try {
    const backupJob = require('./jobs/backupJob');
    backupJob.startJob();
  } catch (e) {
    console.error('Failed to start backup job:', e);
  }

  try {
    const homeworkStatusUpdater = require('./jobs/homeworkStatusUpdater');
    homeworkStatusUpdater.startJob();
  } catch (e) {
    console.error('Failed to start homework status updater:', e);
  }

  try {
    const examStatusUpdater = require('./jobs/examStatusUpdater');
    examStatusUpdater.startJob();
  } catch (e) {
    console.error('Failed to start exam status updater:', e);
  }

  try {
    const announcementExpiry = require('./jobs/announcementExpiry');
    announcementExpiry.startJob();
  } catch (e) {
    console.error('Failed to start announcement expiry job:', e);
  }

  try {
    const trialExpiryJob = require('./jobs/trialExpiryJob');
    trialExpiryJob.startJob();
  } catch (e) {
    console.error('Failed to start trial expiry job:', e);
  }
} else {
  console.log(`Skipping cron jobs on PM2 instance ${process.env.NODE_APP_INSTANCE}`);
}

// ── Memory monitoring ───────────────────────────────────────────────
setInterval(() => {
  const mem = process.memoryUsage();
  const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
  if (heapPercent > 85) {
    console.warn(`[memory] HIGH HEAP: ${heapPercent.toFixed(1)}% (${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB)`);
  }
}, 60000); // check every 60s

// ── Periodic GC (if --expose-gc flag is set) ────────────────────────
if (global.gc) {
  setInterval(() => {
    global.gc();
    console.log('[gc] Manual garbage collection triggered');
  }, 30 * 60 * 1000); // Every 30 minutes
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown — close Puppeteer browser on exit
const { closeBrowser } = require('./services/pdfService');
const shutdownHandler = async(signal) => {
  console.log(`\n${signal} received — closing Puppeteer browser...`);
  await closeBrowser();
  process.exit(0);
};
process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
process.on('SIGINT', () => shutdownHandler('SIGINT'));

module.exports = app;
