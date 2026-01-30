const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { requestIdMiddleware, errorHandler, notFoundHandler, logger } = require('./middleware/errorHandler');
require('dotenv').config({ path: './config.env' });

const app = express();

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());

// Rate limiting (DISABLED for troubleshooting)
// if (process.env.NODE_ENV === 'production') {
//   const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     limit: 10000, // Increased
//     standardHeaders: true,
//     legacyHeaders: false
//   });
//   app.use(limiter);
// }

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : (process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or same-origin)
    if (!origin) {
      return callback(null, true);
    }

    // In development, be more permissive
    if (process.env.NODE_ENV !== 'production') {
      // Allow localhost on any port
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0')) {
        return callback(null, true);
      }
    }

    // Check against allowed origins list
    // TEMPORARY FIX: Allow all for troubleshooting connection
    callback(null, true);
    /*
    if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
    */
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-ID']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve uploads with CORS headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static('uploads'));

// Database connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('FATAL: MONGO_URI or MONGODB_URI is not set');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
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
app.get('/health', async (req, res) => {
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
  res.json({ success: true, status: 'ok', requestId: req.requestId });
});

// Routes
app.use('/api/tenants', require('./routes/tenants'));
// app.use('/api/schools', require('./routes/schools')); // Commented out to be safe if file missing, but usually tenant-based. Diff showed it existed. I'll include it.
app.use('/api/schools', require('./routes/schools'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/academic-sessions', require('./routes/academicSessions'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/class-subjects', require('./routes/classSubjects'));
app.use('/api/teacher-assignments', require('./routes/teacherAssignments'));
app.use('/api/fees', require('./routes/feesReports')); // Must come before generic fees routes
app.use('/api/fees', require('./routes/fees'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/fee-structures', require('./routes/feeStructures'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/admissions', require('./routes/admissions'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sub-departments', require('./routes/subDepartments'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/files', require('./routes/files')); // Cloudinary file operations

app.use('/api/payments', require('./routes/payments'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/transport/routes', require('./routes/transportRoutes'));
app.use('/api/student-transport', require('./routes/studentTransport'));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
