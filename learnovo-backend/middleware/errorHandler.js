const { v4: uuidv4 } = require('uuid');

// Generate request ID for tracking
const generateRequestId = () => uuidv4();

// Structured logging utility
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      requestId: meta.requestId,
      route: meta.route,
      tenantId: meta.tenantId,
      userEmail: meta.userEmail,
      message,
      ...meta
    }));
  },

  error: (message, error, meta = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: meta.requestId,
      route: meta.route,
      tenantId: meta.tenantId,
      userEmail: meta.userEmail,
      message,
      error: error?.message,
      stack: error?.stack,
      ...meta
    }));
  },

  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      requestId: meta.requestId,
      route: meta.route,
      tenantId: meta.tenantId,
      userEmail: meta.userEmail,
      message,
      ...meta
    }));
  }
};

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Error response formatter
const formatErrorResponse = (error, req) => {
  const requestId = req.requestId || generateRequestId();

  // Validation errors (400)
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));

    logger.warn('Validation error', error, {
      requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    return {
      success: false,
      errors,
      requestId
    };
  }

  // Duplicate key error (409)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    const message = `${field === 'email' ? 'Email' : field === 'schoolCode' ? 'School code' : field === 'subdomain' ? 'Subdomain' : 'Field'} already exists`;

    logger.warn('Duplicate key error', error, {
      requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    return {
      success: false,
      message: message,
      requestId
    };
  }

  // Cast error (400)
  if (error.name === 'CastError') {
    logger.warn('Cast error', error, {
      requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    return {
      success: false,
      message: 'Invalid ID format',
      requestId
    };
  }

  // JWT errors (401)
  if (error.name === 'JsonWebTokenError') {
    logger.warn('JWT error', error, {
      requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    return {
      success: false,
      message: 'Invalid token',
      requestId
    };
  }

  if (error.name === 'TokenExpiredError') {
    logger.warn('Token expired', error, {
      requestId,
      route: req.route?.path,
      tenantId: req.tenant?._id,
      userEmail: req.user?.email
    });

    return {
      success: false,
      message: 'Token expired',
      requestId
    };
  }

  // Default server error (500)
  logger.error('Unhandled error', error, {
    requestId,
    route: req.route?.path,
    tenantId: req.tenant?._id,
    userEmail: req.user?.email
  });

  // Build comprehensive error response
  const errorResponse = {
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    requestId
  };

  // In development, include detailed error information
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error = error.message;
    errorResponse.errorName = error.name;
    errorResponse.errorCode = error.code;
    
    // Include validation errors if present
    if (error.errors && typeof error.errors === 'object' && Object.keys(error.errors).length > 0) {
      errorResponse.validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message,
        kind: error.errors[key].kind,
        value: error.errors[key].value
      }));
    }
    
    // Include duplicate key info if present
    if (error.keyPattern || error.keyValue) {
      errorResponse.duplicateKey = {
        pattern: error.keyPattern,
        value: error.keyValue
      };
    }
    
    // Include stack trace in development
    if (error.stack) {
      errorResponse.stack = error.stack.split('\n').slice(0, 15).join('\n');
    }
  }

  return errorResponse;
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  const errorResponse = formatErrorResponse(err, req);

  // Determine status code based on error type
  let statusCode = 500;

  if (err.name === 'ValidationError' || err.name === 'CastError') {
    statusCode = 400;
  } else if (err.code === 11000) {
    statusCode = 409;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
  } else if (err.statusCode) {
    statusCode = err.statusCode;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res) => {
  const requestId = req.requestId || generateRequestId();

  logger.warn('Route not found', {
    requestId,
    route: req.originalUrl,
    method: req.method
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId
  });
};

module.exports = {
  logger,
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  generateRequestId
};
