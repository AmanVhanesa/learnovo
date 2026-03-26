# Security Guidelines for Learnovo

## 🔐 Credential Management

### Never Commit Secrets
**NEVER** hardcode credentials in your code. This includes:
- Database connection strings
- API keys
- Passwords
- JWT secrets
- OAuth tokens

### Use Environment Variables
Always use environment variables for sensitive data:

```javascript
// ❌ WRONG - Hardcoded
const uri = "mongodb+srv://user:password@cluster.mongodb.net/db";

// ✅ CORRECT - Environment variable
const uri = process.env.MONGO_URI;
```

### Environment Files
- Store secrets in `.env` files (already in `.gitignore`)
- Use different `.env` files for different environments
- **NEVER** commit `.env` files to git

### Production Secrets
For production deployments:
- **Hostinger VPS**: Set environment variables in `config.env` on the VPS (SSH)
- **Vercel**: Set environment variables in the Vercel project settings
- **MongoDB Atlas**: Use IP whitelisting and rotate passwords regularly

## 🛡️ Pre-Commit Hook
A pre-commit hook is installed that scans for common secret patterns.
It will **block commits** containing potential secrets.

To test it works:
```bash
# This should be blocked
echo 'const pwd = "mongodb+srv://user:pass@host"' > test.js
git add test.js
git commit -m "test"  # Will be blocked
```

## 📋 Security Checklist

Before committing code:
- [ ] No hardcoded passwords or API keys
- [ ] All secrets use `process.env.VARIABLE_NAME`
- [ ] `.env` files are in `.gitignore`
- [ ] Debug scripts don't contain real credentials
- [ ] Pre-commit hook is active (`ls -la .git/hooks/pre-commit`)

## 🚨 If Credentials Are Leaked

1. **Immediately rotate** the exposed credentials
2. Update environment variables in all deployment platforms
3. Review git history: `git log --all --full-history -- "**/config.env"`
4. Consider using `git filter-branch` or BFG Repo-Cleaner to remove from history
5. Monitor for unauthorized access

## 📚 Additional Resources

- [MongoDB Atlas Security](https://www.mongodb.com/docs/atlas/security/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
