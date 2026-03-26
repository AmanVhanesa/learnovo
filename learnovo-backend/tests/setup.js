// Test setup file
require('dotenv').config({ path: './config.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/learnovo_test';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Add any global test utilities here
};
