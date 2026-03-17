# CLAUDE.md — Learnovo Backend

## Stack
Node.js 16+ · Express · MongoDB 4.4+ (Mongoose) · JWT · Nodemailer · Jest · ESLint

## Project Structure
```
middleware/        # auth.js, errorHandler.js, tenant.js
models/            # Mongoose schemas
routes/            # Express route definitions
services/          # Business logic (keep it here, not in routes)
utils/             # Shared helpers
tests/unit/        # Mocked unit tests
tests/integration/ # Full tests against learnovo_test DB
scripts/           # Migration scripts
```

## Common Commands
```bash
npm run dev                  # Dev server on port 5000
npm run test:ci              # Run before every PR
npm test -- --coverage       # Coverage must stay >80%
npm run migrate              # Run pending migrations
npm run migrate:status       # Check migration state
npm run lint:fix             # Auto-fix lint issues
DEBUG=learnovo:* npm run dev # Verbose debug logging
```

## Core Conventions

**Multi-tenancy** — Every DB query must be scoped by `tenantId`. Tenant middleware attaches `req.tenant` — use it. Never cross tenant boundaries.

**Services layer** — Business logic lives in `services/`. Route handlers only: validate → call service → respond. No logic in controllers.

**Error handling** — Always `next(err)`, never swallow errors. All errors flow through `middleware/errorHandler.js` and include a `requestId`.

**Logging** — Use the structured logger, not `console.log`. Every log needs: `timestamp`, `level`, `requestId`, `route`, `tenantId`, `message`.

**Transactions** — Use MongoDB transactions when writing to multiple collections (e.g., tenant + user creation on registration).

**Migrations** — All schema changes need a migration in `scripts/`. Never modify models without one.

## API Response Shape
```json
// Success
{ "success": true, "message": "...", "data": {}, "requestId": "uuid" }

// Error
{ "success": false, "message": "...", "errors": [{ "field": "", "message": "" }], "requestId": "uuid" }
```

| Status | When |
|--------|------|
| 201 | Created |
| 400 | Validation failure |
| 401 | Bad/missing token |
| 403 | Insufficient role |
| 409 | Duplicate/conflict |
| 500 | Unexpected server error |

## Auth
- Bearer token required on all protected routes: `Authorization: Bearer <jwt>`
- Role guards come from `middleware/auth.js` — no inline role checks in handlers
- Three roles: `admin` · `teacher` · `student`

## Security Rules
- Never commit secrets or `config.env`
- Validate all inputs before they reach the service layer
- Never log or store plaintext passwords (bcrypt only)
- Don't disable rate limiting in production

## Pitfalls to Avoid
- Missing `tenantId` filter on DB queries
- Business logic creeping into route handlers
- Swallowing errors instead of calling `next(err)`
- Schema changes without a migration
- Using `console.log` instead of the structured logger
- Hardcoding config values instead of using `config.env`

## Key Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tenants/register` | None | Register school |
| POST | `/api/tenants/:tenantId/import/csv` | Admin | Bulk import users |
| GET | `/api/tenants/:tenantId/import/template` | Admin | CSV template |
| GET | `/health` | None | System health |