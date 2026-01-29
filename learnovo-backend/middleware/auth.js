const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      // Check query params (for file downloads)
      token = req.query.token;
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user no longer exists.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated.'
        });
      }

      // Grant access to protected route
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication.'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route.`
      });
    }
    next();
  };
};

// Check if user can access student data
exports.canAccessStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const user = req.user;

    // Admin can access all students
    if (user.role === 'admin') {
      return next();
    }

    // Teacher can access students in their assigned classes
    if (user.role === 'teacher') {
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found.'
        });
      }

      if (user.assignedClasses && user.assignedClasses.includes(student.class)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'You can only access students in your assigned classes.'
      });
    }

    // Student can only access their own data
    if (user.role === 'student') {
      if (user._id.toString() !== studentId) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your own data.'
        });
      }
      return next();
    }

    // Parent can access their children's data
    if (user.role === 'parent') {
      if (user.children && user.children.includes(studentId)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'You can only access your children\'s data.'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authorization.'
    });
  }
};

// Check if user can access fee data
exports.canAccessFee = async (req, res, next) => {
  try {
    const { feeId } = req.params;
    const user = req.user;

    // Admin can access all fees
    if (user.role === 'admin') {
      return next();
    }

    // Get fee and check if user can access it
    const Fee = require('../models/Fee');
    const fee = await Fee.findById(feeId).populate('student');

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found.'
      });
    }

    // Teacher can access fees for students in their classes
    if (user.role === 'teacher') {
      if (user.assignedClasses && user.assignedClasses.includes(fee.student.class)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'You can only access fees for students in your assigned classes.'
      });
    }

    // Student can only access their own fees
    if (user.role === 'student') {
      if (user._id.toString() === fee.student._id.toString()) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'You can only access your own fees.'
      });
    }

    // Parent can access their children's fees
    if (user.role === 'parent') {
      if (user.children && user.children.includes(fee.student._id.toString())) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'You can only access your children\'s fees.'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authorization.'
    });
  }
};

// Generate JWT token
exports.generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token response
exports.sendTokenResponse = (user, statusCode, res) => {
  const token = exports.generateToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
};
