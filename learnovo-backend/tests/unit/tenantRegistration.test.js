const request = require('supertest');
const app = require('../../server');
const { setupTestDB, validRegistrationData, invalidRegistrationData } = require('../testHelpers');

setupTestDB();

describe('Tenant Registration API', () => {
  describe('POST /api/tenants/register', () => {
    it('should register a new tenant successfully', async() => {
      const response = await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('School registered successfully');
      expect(response.body.data.tenant).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.requestId).toBeDefined();

      // Verify tenant data
      expect(response.body.data.tenant.schoolName).toBe(validRegistrationData.schoolName);
      expect(response.body.data.tenant.schoolCode).toBe(validRegistrationData.schoolCode);
      expect(response.body.data.tenant.subdomain).toBe(validRegistrationData.subdomain);

      // Verify user data
      expect(response.body.data.user.name).toBe(`${validRegistrationData.schoolName} Admin`);
      expect(response.body.data.user.email).toBe(validRegistrationData.email);
      expect(response.body.data.user.role).toBe('admin');
    });

    it('should return 400 for invalid registration data', async() => {
      const response = await request(app)
        .post('/api/tenants/register')
        .send(invalidRegistrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.requestId).toBeDefined();

      // Check that all validation errors are present
      const errorFields = response.body.errors.map(err => err.field);
      expect(errorFields).toContain('schoolName');
      expect(errorFields).toContain('email');
      expect(errorFields).toContain('password');
      expect(errorFields).toContain('schoolCode');
      expect(errorFields).toContain('subdomain');
    });

    it('should return 409 for duplicate school data', async() => {
      // First registration
      await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with same data
      const response = await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('School with that name or email already exists.');
      expect(response.body.requestId).toBeDefined();
    });

    it('should return 409 for duplicate email only', async() => {
      // First registration
      await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with different school but same email
      const duplicateEmailData = {
        ...validRegistrationData,
        schoolName: 'Different School',
        schoolCode: 'diff001',
        subdomain: 'different-school'
      };

      const response = await request(app)
        .post('/api/tenants/register')
        .send(duplicateEmailData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('School with that name or email already exists.');
    });

    it('should return 409 for duplicate school code only', async() => {
      // First registration
      await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with different email but same school code
      const duplicateCodeData = {
        ...validRegistrationData,
        email: 'different@school.com',
        schoolName: 'Different School',
        subdomain: 'different-school'
      };

      const response = await request(app)
        .post('/api/tenants/register')
        .send(duplicateCodeData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('School with that name or email already exists.');
    });

    it('should return 409 for duplicate subdomain only', async() => {
      // First registration
      await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with different email and school code but same subdomain
      const duplicateSubdomainData = {
        ...validRegistrationData,
        email: 'different@school.com',
        schoolName: 'Different School',
        schoolCode: 'diff001'
      };

      const response = await request(app)
        .post('/api/tenants/register')
        .send(duplicateSubdomainData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('School with that name or email already exists.');
    });

    it('should handle server errors gracefully', async() => {
      // Mock a database error by using invalid ObjectId
      const invalidData = {
        ...validRegistrationData,
        // This will cause a validation error
        schoolCode: 'a'.repeat(100) // Too long
      };

      const response = await request(app)
        .post('/api/tenants/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    it('should include request ID in all responses', async() => {
      const response = await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.requestId.length).toBeGreaterThan(0);
    });

    it('should create tenant with correct subscription defaults', async() => {
      const response = await request(app)
        .post('/api/tenants/register')
        .send(validRegistrationData)
        .expect(201);

      const subscription = response.body.data.tenant.subscription;
      expect(subscription.plan).toBe('free');
      expect(subscription.status).toBe('trial');
      expect(subscription.trialEndsAt).toBeDefined();

      // Check that trial ends in approximately 14 days
      const trialEndsAt = new Date(subscription.trialEndsAt);
      const now = new Date();
      const daysDiff = (trialEndsAt - now) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(14, 1);
    });
  });
});
