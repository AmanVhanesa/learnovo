# Backend Scripts

This directory contains utility scripts for database operations and debugging.

## ⚠️ Security Notice

**ALL scripts must use environment variables for credentials.**

Never hardcode connection strings. Always use:
```javascript
const uri = process.env.MONGO_URI;
```

## Available Scripts

### `migrate-to-prod.js`
Migrates data from local database to production.

**Usage:**
```bash
PROD_MONGO_URI="your_prod_uri" node scripts/migrate-to-prod.js
```

### `inspect-prod.js`
Inspects production database contents (tenants and users).

**Usage:**
```bash
MONGO_URI="your_prod_uri" node scripts/inspect-prod.js
```

### `debug-login.js`
Debugs login issues by checking tenant and user data.

**Usage:**
```bash
MONGO_URI="your_prod_uri" node scripts/debug-login.js
```

## Best Practices

1. **Never commit** these scripts with hardcoded credentials
2. **Always** load credentials from environment variables
3. **Test locally** before running against production
4. **Back up** production data before running migration scripts
5. **Review** script output carefully for errors

## Environment Setup

Create a `.env` file in the backend root (already gitignored):
```bash
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/learnovo
```

Then run scripts with:
```bash
source ../.env && node scripts/script-name.js
```
