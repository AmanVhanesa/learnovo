const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// Test database setup
const setupTestDB = () => {
  beforeAll(async() => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/learnovo_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  beforeEach(async() => {
    // Clear all collections before each test
    await Promise.all([
      User.deleteMany({}),
      Tenant.deleteMany({})
    ]);
  });

  afterAll(async() => {
    // Close database connection
    await mongoose.connection.close();
  });
};

// Helper functions for tests
const createTestTenant = async(overrides = {}) => {
  const defaultTenant = {
    schoolName: 'Test School',
    email: 'test@school.com',
    schoolCode: 'test001',
    subdomain: 'test-school',
    subscription: {
      plan: 'free',
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    },
    ...overrides
  };

  return await Tenant.create(defaultTenant);
};

const createTestUser = async(tenantId, overrides = {}) => {
  const defaultUser = {
    tenantId,
    name: 'Test User',
    email: 'test@user.com',
    password: 'password123',
    role: 'admin',
    ...overrides
  };

  return await User.create(defaultUser);
};

const getAuthToken = async(user) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      id: user._id,
      tenantId: user.tenantId,
      role: user.role
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '7d' }
  );
};

const makeAuthenticatedRequest = (app, method, url, token, data = null) => {
  const req = request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/json');

  if (data) {
    return req.send(data);
  }
  return req;
};

// Test data factories
const validRegistrationData = {
  schoolName: 'New Test School',
  email: 'newtest@school.com',
  password: 'password123',
  schoolCode: 'newtest001',
  subdomain: 'new-test-school',
  phone: '+1234567890',
  address: {
    street: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    zipCode: '12345'
  }
};

const invalidRegistrationData = {
  schoolName: '', // Invalid: empty
  email: 'invalid-email', // Invalid: not an email
  password: '123', // Invalid: too short
  schoolCode: 'ab', // Invalid: too short
  subdomain: 'ab' // Invalid: too short
};

const validTeacherData = [
  {
    name: 'John Doe',
    email: 'john.doe@school.com',
    phone: '+1234567890',
    qualifications: 'M.Ed Mathematics',
    subjects: 'Mathematics, Physics'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@school.com',
    phone: '+1234567891',
    qualifications: 'B.Ed English',
    subjects: 'English, Literature'
  }
];

const validStudentData = [
  {
    name: 'Alice Johnson',
    email: 'alice.johnson@school.com',
    class: 'Grade 10A',
    rollno: 'STU001',
    phone: '+1234567892',
    guardianName: 'Robert Johnson',
    guardianPhone: '+1234567893',
    address: '123 Main St, City, State'
  },
  {
    name: 'Bob Wilson',
    email: 'bob.wilson@school.com',
    class: 'Grade 10B',
    rollno: 'STU002',
    phone: '+1234567894',
    guardianName: 'Mary Wilson',
    guardianPhone: '+1234567895',
    address: '456 Oak Ave, City, State'
  }
];

module.exports = {
  setupTestDB,
  createTestTenant,
  createTestUser,
  getAuthToken,
  makeAuthenticatedRequest,
  validRegistrationData,
  invalidRegistrationData,
  validTeacherData,
  validStudentData
};
