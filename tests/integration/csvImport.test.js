const request = require('supertest');
const app = require('../../server');
const { setupTestDB, createTestTenant, createTestUser, getAuthToken, makeAuthenticatedRequest, validTeacherData, validStudentData } = require('../testHelpers');

setupTestDB();

// ─── Helpers for modern import pipeline tests ────────────────────────────────

/** Build a minimal valid student row for the preview/execute pipeline */
const makeStudentRow = (i) => ({
  admissionNumber: `ADM${String(i).padStart(3, '0')}`,
  firstName: `First${i}`,
  lastName: `Last${i}`,
  dateOfBirth: '2010-06-15',
  gender: 'male',
  currentClass: 'Class 1',
  currentSection: 'A'
});

/** Convert an array of row objects to a CSV Buffer */
const rowsToCSV = (rows) => {
  if (!rows.length) return Buffer.from('', 'utf8');
  const header = Object.keys(rows[0]).join(',');
  const lines = rows.map(r => Object.values(r).join(','));
  return Buffer.from([header, ...lines].join('\n'), 'utf8');
};

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Modern import pipeline: preview → execute ────────────────────────────

  describe('POST /api/students/import/preview', () => {
    it('should accept a 50-row CSV and return totalRows === 50', async() => {
      const rows = Array.from({ length: 50 }, (_, i) => makeStudentRow(i + 1));
      const csvBuffer = rowsToCSV(rows);

      const response = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.totalRows).toBe(50);
    });

    it('should return validData, summary, errors, and preview fields', async() => {
      const rows = [makeStudentRow(1), makeStudentRow(2)];
      const csvBuffer = rowsToCSV(rows);

      const response = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.validData)).toBe(true);
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(Array.isArray(response.body.duplicates)).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalRows).toBe(2);
    });

    it('should mark a row with a missing required field as invalid', async() => {
      const rows = [
        { admissionNumber: 'ADM001', firstName: '', lastName: 'Last', dateOfBirth: '2010-01-01', gender: 'male', currentClass: 'Class 1', currentSection: 'A' }
      ];
      const csvBuffer = rowsToCSV(rows);

      const response = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.invalidRows).toBeGreaterThan(0);
    });

    it('should return 400 when no file is attached', async() => {
      const response = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async() => {
      const teacherUser = await createTestUser(tenant._id, { role: 'teacher', email: 'teacher.preview@test.com' });
      const teacherToken = await getAuthToken(teacherUser);
      const rows = [makeStudentRow(1)];
      const csvBuffer = rowsToCSV(rows);

      const response = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/students/import/execute', () => {
    it('should import all valid rows and return success count', async() => {
      // Step 1: preview to get validData
      const rows = Array.from({ length: 5 }, (_, i) => makeStudentRow(i + 1));
      const csvBuffer = rowsToCSV(rows);

      const previewRes = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' });

      expect(previewRes.body.success).toBe(true);
      const validData = previewRes.body.validData;
      expect(validData.length).toBeGreaterThan(0);

      // Step 2: execute
      const response = await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ validData, options: { skipDuplicates: true } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(validData.length);
      expect(response.body.data.failed).toBe(0);
    });

    it('should skip duplicate rows when skipDuplicates is true', async() => {
      // First import
      const rows = [makeStudentRow(1)];
      const csvBuffer = rowsToCSV(rows);

      const firstPreview = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' });

      await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ validData: firstPreview.body.validData, options: { skipDuplicates: true } })
        .expect(200);

      // Second import of the same row — should be skipped
      const secondPreview = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' });

      // The duplicate should appear in the duplicates array, not validData
      const duplicateRow = (secondPreview.body.duplicates || []).map(d => d.data);

      const response = await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          validData: [...(secondPreview.body.validData || []), ...duplicateRow],
          options: { skipDuplicates: true }
        })
        .expect(200);

      expect(response.body.data.skipped).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 when validData is missing', async() => {
      const response = await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ options: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when validData is empty array', async() => {
      const response = await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ validData: [], options: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should still import valid rows when some rows fail', async() => {
      // Mix valid row + row with bad data that will fail at DB level
      const rows = [makeStudentRow(10)];
      const csvBuffer = rowsToCSV(rows);

      const previewRes = await request(app)
        .post('/api/students/import/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', csvBuffer, { filename: 'students.csv', contentType: 'text/csv' });

      const validData = previewRes.body.validData;

      // Inject a corrupted row alongside the valid one
      const mixedData = [
        ...validData,
        { admissionNumber: null, role: 'student', tenantId: tenant._id }
      ];

      const response = await request(app)
        .post('/api/students/import/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ validData: mixedData, options: { skipDuplicates: true } })
        .expect(200);

      // The valid row should succeed even though the corrupted one failed
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBeGreaterThanOrEqual(1);
    });
  });
});
