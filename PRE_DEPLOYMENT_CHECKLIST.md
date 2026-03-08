# ✅ Pre-Deployment Checklist

Complete this checklist before deploying to production.

---

## 🔐 Security

### Backend
- [ ] JWT_SECRET is set and contains at least 32 random characters
- [ ] MongoDB connection string uses SRV format with authentication
- [ ] CORS is configured with specific frontend URL (no wildcards in production)
- [ ] Helmet.js security headers are enabled
- [ ] Rate limiting is active for production environment
- [ ] All passwords are hashed (bcrypt)
- [ ] Environment variables are not exposed in code
- [ ] API endpoints are protected with authentication middleware
- [ ] Input validation is enabled on all user inputs
- [ ] SQL injection protection (if using SQL) OR NoSQL injection prevention

### Frontend
- [ ] No API keys or secrets in client-side code
- [ ] Sensitive data is not logged in console
- [ ] Token storage is secure (localStorage or httpOnly cookies)
- [ ] Error messages don't expose sensitive information
- [ ] HTTPS is enforced
- [ ] Content Security Policy headers are set

---

## 🗄️ Database

- [ ] MongoDB Atlas cluster is created and running
- [ ] Database user is created with appropriate permissions
- [ ] IP whitelist is configured (0.0.0.0/0 for cloud)
- [ ] Connection string is tested and working
- [ ] Backup strategy is planned
- [ ] Database indexes are created for performance
- [ ] No sensitive data in database without encryption
- [ ] Seed data is removed or is safe for production

---

## 🌐 Environment Variables

### Backend (Render)
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` is set correctly
- [ ] `JWT_SECRET` is set and secure
- [ ] `FRONTEND_URL` is set to Vercel domain
- [ ] `PORT` is set (default: 5000)
- [ ] Email credentials configured (if using)
- [ ] Payment gateway keys configured (if using)

### Frontend (Vercel)
- [ ] `VITE_API_URL` points to Render backend
- [ ] No hardcoded URLs in code

---

## 🔧 Configuration

### Backend
- [ ] `package.json` has correct start script
- [ ] All dependencies are in `dependencies` (not devDependencies)
- [ ] Node version is specified in `package.json` or `.nvmrc`
- [ ] Build command is correct
- [ ] Start command is correct
- [ ] Error handling middleware is in place
- [ ] Logging is configured

### Frontend
- [ ] Build command works locally
- [ ] `vite.config.js` is configured
- [ ] All static assets are accessible
- [ ] No console errors in production build
- [ ] All API endpoints use environment variables
- [ ] Routing is configured correctly

---

## 📦 Dependencies

### Backend
- [ ] All required packages are installed
- [ ] No deprecated packages
- [ ] Security vulnerabilities are patched (`npm audit fix`)
- [ ] Package versions are locked in `package-lock.json`

### Frontend
- [ ] All required packages are installed
- [ ] No deprecated packages
- [ ] Security vulnerabilities are patched
- [ ] React production build is optimized
- [ ] Bundle size is reasonable (< 1MB ideally)

---

## 🧪 Testing

### Functional Tests
- [ ] Login works for all roles (admin, teacher, student, parent)
- [ ] Registration creates tenant and admin
- [ ] Dashboard loads with real data
- [ ] Students can be created and viewed
- [ ] Teachers can be created and viewed
- [ ] Fees can be created, viewed, and marked as paid
- [ ] Assignments can be created and viewed
- [ ] Multi-tenant isolation works correctly

### Edge Cases
- [ ] Handles network errors gracefully
- [ ] Shows proper error messages
- [ ] Empty states display correctly
- [ ] Large datasets don't crash the app
- [ ] Concurrent users don't cause issues

### Security Tests
- [ ] Unauthorized access is blocked
- [ ] Cross-tenant data access is prevented
- [ ] JWT tokens expire correctly
- [ ] Password reset works (if implemented)

---

## 🎨 UI/UX

### Responsive Design
- [ ] Mobile menu works correctly
- [ ] Dashboard cards stack properly on mobile
- [ ] Forms are usable on small screens
- [ ] Charts are readable on mobile
- [ ] Sidebar behaves correctly on all devices

### Loading States
- [ ] Loading spinners appear during API calls
- [ ] Skeleton loaders show for dashboard
- [ ] No layout shift when data loads

### Empty States
- [ ] No broken images or missing icons
- [ ] Empty lists show helpful messages
- [ ] Error states are user-friendly

---

## 📊 Performance

### Backend
- [ ] API response times < 500ms average
- [ ] Database queries are optimized
- [ ] Caching is implemented where appropriate
- [ ] No memory leaks in long-running processes

### Frontend
- [ ] First contentful paint < 2s
- [ ] Time to interactive < 5s
- [ ] Images are optimized and compressed
- [ ] Unused code is eliminated (tree-shaking)

---

## 🔍 Monitoring

- [ ] Error tracking is set up (Sentry or similar)
- [ ] Uptime monitoring is configured
- [ ] Log aggregation is working
- [ ] Analytics are implemented
- [ ] Health check endpoints are tested

---

## 📝 Documentation

- [ ] README.md is up to date
- [ ] API documentation exists
- [ ] Deployment guide is complete
- [ ] Environment variables are documented
- [ ] Changelog is maintained

---

## 🚀 Deployment

### Pre-Deploy
- [ ] Code is pushed to GitHub
- [ ] All branches are merged
- [ ] Latest code is on `main` branch
- [ ] No uncommitted changes

### Deploy
- [ ] Backend is deployed to Render
- [ ] Frontend is deployed to Vercel
- [ ] Custom domains are configured (if used)
- [ ] SSL certificates are active

### Post-Deploy
- [ ] Health check endpoints return 200
- [ ] All login flows work
- [ ] No console errors in browser
- [ ] Mobile experience is tested
- [ ] Email notifications work (if implemented)

---

## 🔄 Rollback Plan

- [ ] Know how to rollback deployment
- [ ] Previous stable version is tagged
- [ ] Rollback procedure is documented
- [ ] Backup is available

---

## 📞 Support

- [ ] Support email is configured
- [ ] Documentation is accessible to team
- [ ] Team knows how to access logs
- [ ] Emergency contact procedure exists

---

## ✅ Final Sign-Off

**Backend Lead:** ________________ Date: _______

**Frontend Lead:** ________________ Date: _______

**DevOps/Infrastructure:** ________________ Date: _______

**QA/Security:** ________________ Date: _______

---

**Notes:**
- Check all items before marking complete
- Document any exceptions or known issues
- Keep this checklist updated for future deployments

