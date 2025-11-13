const request = require('supertest');
const app = require('../../server');
const { setupTestDB, createTestTenant, createTestUser, getAuthToken, makeAuthenticatedRequest, validTeacherData, validStudentData } = require('../testHelpers');

setupTestDB();

describe('CSV Import API', () => {
  let tenant;
  let adminUser;
  let authToken;

  beforeEach(async() => {
    // Create test tenant and admin user
    tenant = await createTestTenant();
    adminUser = await createTestUser(tenant._id, { role: 'admin' });
    authToken = await getAuthToken(adminUser);
  });

  describe('POST /api/tenants/:id/import/csv', () => {
    it('should import teachers successfully', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'teachers',
          data: validTeacherData
        }
      ).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('CSV import completed');
      expect(response.body.data.summary.created).toBe(2);
      expect(response.body.data.summary.skipped).toBe(0);
      expect(response.body.data.summary.errors).toBe(0);
      expect(response.body.data.type).toBe('teachers');
      expect(response.body.requestId).toBeDefined();
    });

    it('should import students successfully', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'students',
          data: validStudentData
        }
      ).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('CSV import completed');
      expect(response.body.data.summary.created).toBe(2);
      expect(response.body.data.summary.skipped).toBe(0);
      expect(response.body.data.summary.errors).toBe(0);
      expect(response.body.data.type).toBe('students');
      expect(response.body.requestId).toBeDefined();
    });

    it('should skip duplicate teachers', async() => {
      // First import
      await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'teachers',
          data: [validTeacherData[0]]
        }
      ).expect(200);

      // Second import with duplicate
      const duplicateData = [
        validTeacherData[0], // Duplicate
        validTeacherData[1]  // New
      ];

      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'teachers',
          data: duplicateData
        }
      ).expect(200);

      expect(response.body.data.summary.created).toBe(1);
      expect(response.body.data.summary.skipped).toBe(1);
      expect(response.body.data.summary.errors).toBe(1);
      expect(response.body.data.errors[0].error).toContain('already exists');
    });

    it('should skip duplicate students', async() => {
      // First import
      await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'students',
          data: [validStudentData[0]]
        }
      ).expect(200);

      // Second import with duplicate
      const duplicateData = [
        validStudentData[0], // Duplicate
        validStudentData[1]  // New
      ];

      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'students',
          data: duplicateData
        }
      ).expect(200);

      expect(response.body.data.summary.created).toBe(1);
      expect(response.body.data.summary.skipped).toBe(1);
      expect(response.body.data.summary.errors).toBe(1);
      expect(response.body.data.errors[0].error).toContain('already exists');
    });

    it('should return 400 for invalid type', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'invalid',
          data: validTeacherData
        }
      ).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid type');
      expect(response.body.requestId).toBeDefined();
    });

    it('should return 400 for missing data', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'teachers'
          // Missing data field
        }
      ).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid request');
      expect(response.body.requestId).toBeDefined();
    });

    it('should return 403 for non-admin users', async() => {
      // Create a teacher user
      const teacherUser = await createTestUser(tenant._id, { role: 'teacher' });
      const teacherToken = await getAuthToken(teacherUser);

      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        teacherToken,
        {
          type: 'teachers',
          data: validTeacherData
        }
      ).expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only admins can import data');
      expect(response.body.requestId).toBeDefined();
    });

    it('should handle validation errors gracefully', async() => {
      const invalidTeacherData = [
        {
          name: '', // Invalid: empty name
          email: 'invalid-email', // Invalid: not an email
          phone: 'invalid-phone' // Invalid: not a valid phone
        }
      ];

      const response = await makeAuthenticatedRequest(
        app,
        'post',
        `/api/tenants/${tenant._id}/import/csv`,
        authToken,
        {
          type: 'teachers',
          data: invalidTeacherData
        }
      ).expect(200);

      expect(response.body.data.summary.created).toBe(0);
      expect(response.body.data.summary.skipped).toBe(1);
      expect(response.body.data.summary.errors).toBe(1);
      expect(response.body.data.errors[0].error).toContain('Missing required fields');
    });
  });

  describe('GET /api/tenants/:id/import/template', () => {
    it('should return teacher template', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'get',
        `/api/tenants/${tenant._id}/import/template?type=teachers`,
        authToken
      ).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('teachers');
      expect(response.body.data.headers).toContain('name');
      expect(response.body.data.headers).toContain('email');
      expect(response.body.data.headers).toContain('phone');
      expect(response.body.data.required).toContain('name');
      expect(response.body.data.required).toContain('email');
      expect(response.body.data.sample).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    it('should return student template', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'get',
        `/api/tenants/${tenant._id}/import/template?type=students`,
        authToken
      ).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('students');
      expect(response.body.data.headers).toContain('name');
      expect(response.body.data.headers).toContain('email');
      expect(response.body.data.headers).toContain('class');
      expect(response.body.data.headers).toContain('rollno');
      expect(response.body.data.required).toContain('name');
      expect(response.body.data.required).toContain('email');
      expect(response.body.data.required).toContain('class');
      expect(response.body.data.required).toContain('rollno');
      expect(response.body.data.sample).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    it('should return 400 for invalid type', async() => {
      const response = await makeAuthenticatedRequest(
        app,
        'get',
        `/api/tenants/${tenant._id}/import/template?type=invalid`,
        authToken
      ).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid type');
      expect(response.body.requestId).toBeDefined();
    });

    it('should return 403 for non-admin users', async() => {
      const teacherUser = await createTestUser(tenant._id, { role: 'teacher' });
      const teacherToken = await getAuthToken(teacherUser);

      const response = await makeAuthenticatedRequest(
        app,
        'get',
        `/api/tenants/${tenant._id}/import/template?type=teachers`,
        teacherToken
      ).expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only admins can access templates');
      expect(response.body.requestId).toBeDefined();
    });
  });
});
