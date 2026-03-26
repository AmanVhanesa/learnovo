# Learnovo Backend

A comprehensive student management system backend built with Node.js, Express, and MongoDB.

## Features

- **Multi-tenant Architecture**: Support for multiple schools/organizations
- **Role-based Access Control**: Admin, Teacher, Student roles with proper permissions
- **Comprehensive Registration**: School registration with transaction support
- **CSV Import**: Bulk import of teachers and students
- **Email Notifications**: Automated onboarding and invitation emails
- **Structured Logging**: Request tracking and error monitoring
- **Database Migrations**: Version-controlled schema updates
- **Health Monitoring**: System health checks and monitoring
- **Security**: Rate limiting, input validation, and secure authentication

## Quick Start

### Prerequisites

- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd learnovo-backend
   npm ci
   ```

2. **Environment setup:**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your settings
   ```

3. **Database setup:**
   ```bash
   npm run migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`

## Configuration

### Environment Variables

Create a `config.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/learnovo
MONGODB_TEST_URI=mongodb://localhost:27017/learnovo_test

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@learnovo.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

## API Documentation

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Registration Endpoints

#### Register New School
```http
POST /api/tenants/register
Content-Type: application/json

{
  "schoolName": "Example School",
  "email": "admin@example.com",
  "password": "password123",
  "schoolCode": "EXAM001",
  "subdomain": "example-school",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "country": "Country",
    "zipCode": "12345"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "School registered successfully",
  "data": {
    "tenant": {
      "id": "...",
      "schoolName": "Example School",
      "schoolCode": "EXAM001",
      "subdomain": "example-school",
      "subscription": {
        "plan": "free",
        "status": "trial",
        "trialEndsAt": "2024-01-15T00:00:00.000Z"
      }
    },
    "user": {
      "id": "...",
      "name": "Example School Admin",
      "email": "admin@example.com",
      "role": "admin"
    },
    "token": "jwt-token-here"
  },
  "requestId": "uuid-here"
}
```

**Error Responses:**

- **400 Bad Request** (validation errors):
  ```json
  {
    "success": false,
    "errors": [
      {
        "field": "email",
        "message": "Valid email is required"
      }
    ],
    "requestId": "uuid-here"
  }
  ```

- **409 Conflict** (duplicate data):
  ```json
  {
    "success": false,
    "message": "School with that name or email already exists.",
    "requestId": "uuid-here"
  }
  ```

- **500 Internal Server Error**:
  ```json
  {
    "success": false,
    "message": "Internal server error",
    "requestId": "uuid-here"
  }
  ```

### CSV Import Endpoints

#### Import Teachers/Students
```http
POST /api/tenants/:tenantId/import/csv
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "type": "teachers", // or "students"
  "data": [
    {
      "name": "John Doe",
      "email": "john@school.com",
      "phone": "+1234567890",
      "qualifications": "M.Ed Mathematics",
      "subjects": "Mathematics, Physics"
    }
  ]
}
```

#### Get Import Template
```http
GET /api/tenants/:tenantId/import/template?type=teachers
Authorization: Bearer <admin-token>
```

### Health Check

#### System Health
```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "uuid-here",
  "services": {
    "database": "healthy",
    "email": "healthy",
    "emailQueue": {
      "queueLength": 0,
      "isProcessing": false,
      "pending": 0,
      "retrying": 0,
      "failed": 0
    }
  }
}
```

## Database Management

### Migrations

**Run all pending migrations:**
```bash
npm run migrate
```

**Check migration status:**
```bash
npm run migrate:status
```

**Rollback last migration:**
```bash
npm run migrate:rollback
```

### Database Schema

#### Tenants Collection
- `schoolName`: School name
- `email`: Admin email (unique)
- `schoolCode`: Unique school identifier
- `subdomain`: Unique subdomain
- `subscription`: Plan and billing info
- `settings`: School-specific settings

#### Users Collection
- `tenantId`: Reference to tenant
- `email`: User email (unique per tenant)
- `password`: Hashed password
- `role`: admin, teacher, or student
- `name`: User's full name
- Additional fields based on role

## Testing

### Running Tests

**All tests:**
```bash
npm test
```

**Unit tests only:**
```bash
npm run test:unit
```

**Integration tests only:**
```bash
npm run test:integration
```

**CI tests (unit + integration):**
```bash
npm run test:ci
```

### Test Coverage

Tests must maintain >80% coverage. View coverage report:
```bash
npm test -- --coverage
```

### Test Database

Tests use a separate database (`learnovo_test`). Ensure MongoDB is running and the test database is accessible.

## Development

### Code Quality

**Linting:**
```bash
npm run lint
npm run lint:fix
```

**Pre-commit hooks:**
Pre-commit hooks automatically run linting and formatting. Install with:
```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

### Project Structure

```
learnovo-backend/
├── middleware/          # Custom middleware
│   ├── auth.js         # Authentication middleware
│   ├── errorHandler.js # Error handling & logging
│   └── tenant.js       # Tenant-specific middleware
├── models/             # Mongoose models
├── routes/             # API routes
├── services/           # Business logic services
├── utils/              # Utility functions
├── tests/              # Test files
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── testHelpers.js # Test utilities
├── scripts/           # Database scripts
└── uploads/           # File uploads
```

## Monitoring & Logging

### Structured Logging

All logs are in JSON format with the following fields:
- `timestamp`: ISO timestamp
- `level`: info, warn, error
- `requestId`: Unique request identifier
- `route`: API route
- `tenantId`: Tenant identifier (if applicable)
- `userEmail`: User email (if authenticated)
- `message`: Log message
- `error`: Error details (for error logs)

### Health Monitoring

The `/health` endpoint provides:
- Database connectivity status
- Email service status
- Email queue status
- Overall system health

### Error Tracking

- All errors include request IDs for correlation
- 5xx errors return request IDs to clients
- Structured error logging for debugging

## Security

### Implemented Security Measures

- **Helmet**: Security headers
- **Rate Limiting**: API rate limiting in production
- **Input Validation**: Comprehensive request validation
- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **CORS**: Configured cross-origin requests
- **File Upload Validation**: Size and type restrictions

### Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **Input Sanitization**: All inputs are validated and sanitized
3. **SQL Injection Prevention**: Using Mongoose ODM
4. **XSS Prevention**: Input validation and sanitization
5. **Rate Limiting**: Prevents abuse and DoS attacks

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB URI
- [ ] Set secure JWT secret
- [ ] Configure SMTP settings
- [ ] Run database migrations
- [ ] Set up monitoring and logging
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure backup strategy

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

**Database Connection Issues:**
- Verify MongoDB is running
- Check MONGODB_URI in config.env
- Ensure network connectivity

**Email Issues:**
- Verify SMTP credentials
- Check email service logs
- Test with a simple email first

**Migration Issues:**
- Check migration status: `npm run migrate:status`
- Rollback if needed: `npm run migrate:rollback`
- Check database permissions

**Test Failures:**
- Ensure test database is accessible
- Check test environment variables
- Verify all dependencies are installed

### Debug Mode

Enable debug logging:
```bash
DEBUG=learnovo:* npm run dev
```

### Log Analysis

Search logs by request ID:
```bash
grep "requestId.*abc123" logs/app.log
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** with proper tests
4. **Run tests**: `npm run test:ci`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Write tests for new features
- Maintain >80% test coverage
- Follow ESLint rules
- Use conventional commit messages
- Update documentation for API changes

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review API documentation
- Check system health endpoint

## License

This project is licensed under the MIT License - see the LICENSE file for details.
