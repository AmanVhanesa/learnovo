# 🚀 Learnovo Deployment Guide

Complete guide for deploying Learnovo to **Render (Backend)** and **Vercel (Frontend)**.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Render)](#backend-deployment-render)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Environment Variables](#environment-variables)
5. [Domain Configuration](#domain-configuration)
6. [Post-Deployment Checklist](#post-deployment-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- MongoDB Atlas account (free tier available)
- GitHub account
- Render account (free tier available)
- Vercel account (free tier available)
- Domain name (optional)

---

## Backend Deployment (Render)

### Step 1: Prepare MongoDB Atlas

1. Create a MongoDB Atlas account: https://www.mongodb.com/cloud/atlas
2. Create a new cluster (Free M0 tier is sufficient)
3. Whitelist IP addresses: `0.0.0.0/0` (allows all IPs)
4. Create a database user with read/write permissions
5. Get your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority
   ```

### Step 2: Connect Repository to Render

1. Push your code to GitHub (if not already done):
   ```bash
   cd learnovo-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/learnovo-backend.git
   git push -u origin main
   ```

2. Go to Render Dashboard: https://dashboard.render.com
3. Click **New +** → **Web Service**
4. Connect your GitHub repository
5. Select `learnovo-backend` repository

### Step 3: Configure Render Web Service

**Basic Settings:**
- **Name**: `learnovo-backend` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: (leave empty)
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

**Environment Variables:**
Add the following variables in Render dashboard:

```env
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_min_32_chars

# Frontend URL (will be your Vercel domain later)
FRONTEND_URL=https://your-app.vercel.app

# Email Configuration (Optional - for emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Razorpay (Optional - for payments)
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

1. Click **Create Web Service**
2. Wait for deployment to complete (5-10 minutes)
3. Copy your service URL: `https://learnovo-backend.onrender.com`

---

## Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

1. Ensure your frontend code is pushed to GitHub:
   ```bash
   cd learnovo-frontend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/learnovo-frontend.git
   git push -u origin main
   ```

2. Create `.env.production` file (for local testing):
   ```env
   VITE_API_URL=https://learnovo-backend.onrender.com/api
   ```

### Step 2: Connect to Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Click **Add New Project**
3. Import your GitHub repository
4. Select `learnovo-frontend` repository

### Step 3: Configure Build Settings

**Framework Preset:** Vite

**Build Settings:**
- **Root Directory**: (leave empty)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

**Environment Variables:**
Add in Vercel dashboard:

```env
VITE_API_URL=https://learnovo-backend.onrender.com/api
```

### Step 4: Deploy

1. Click **Deploy**
2. Wait for deployment (2-5 minutes)
3. Your app is live at: `https://your-app.vercel.app`

---

## Environment Variables

### Backend (Render) - Complete List

```env
# Application
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/learnovo?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=generate_a_random_32_char_hex_string

# CORS
FRONTEND_URL=https://your-app.vercel.app

# Email Service (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@learnovo.com

# Payment Gateway (Optional)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key

# Admin Configuration
ADMIN_EMAIL=admin@learnovo.com
ADMIN_PASSWORD=SecurePassword123!
```

### Frontend (Vercel) - Complete List

```env
# API Configuration
VITE_API_URL=https://learnovo-backend.onrender.com/api
```

---

## Domain Configuration

### Option 1: Custom Domain on Vercel

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain: `app.yourdomain.com`
3. Follow DNS configuration instructions
4. Update `FRONTEND_URL` in Render backend environment variables

### Option 2: Custom Domain on Render

1. In Render dashboard, go to **Settings** → **Custom Domains**
2. Add your custom domain
3. Configure DNS as instructed

**DNS Configuration Example:**
```
Type: A Record
Name: @
Value: [Render IP Address]
TTL: 3600
```

---

## Post-Deployment Checklist

### ✅ Essential Checks

- [ ] Backend is accessible at Render URL
- [ ] Frontend loads at Vercel URL
- [ ] Health check endpoint works: `GET https://your-backend.onrender.com/health`
- [ ] Demo login works for all roles (admin, teacher, student, parent)
- [ ] Database connection is successful
- [ ] CORS is configured correctly
- [ ] Environment variables are set

### ✅ Functional Tests

**Admin User:**
- [ ] Can create school/tenant
- [ ] Can add students and teachers
- [ ] Can view dashboard statistics
- [ ] Can manage fees
- [ ] Can view reports

**Teacher User:**
- [ ] Can log in successfully
- [ ] Can view dashboard
- [ ] Can create assignments
- [ ] Can view students

**Student User:**
- [ ] Can log in successfully
- [ ] Can view assignments
- [ ] Can view fees
- [ ] Can see dashboard

**Parent User:**
- [ ] Can log in successfully
- [ ] Can view children's information
- [ ] Can view fees

### ✅ Security Checks

- [ ] HTTPS is enabled (automatic on Render/Vercel)
- [ ] JWT tokens are being generated correctly
- [ ] CORS is properly configured
- [ ] Environment variables are not exposed
- [ ] Rate limiting is active

---

## Troubleshooting

### Backend Issues

**Problem: Build fails on Render**

**Solution:**
1. Check Node version compatibility
2. Ensure `package.json` has all dependencies
3. Check build logs in Render dashboard
4. Verify `start` command is correct

**Problem: "Cannot connect to MongoDB"**

**Solution:**
1. Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
2. Check connection string format
3. Verify database user credentials
4. Check MongoDB cluster is running

**Problem: CORS errors in browser**

**Solution:**
1. Verify `FRONTEND_URL` matches your Vercel domain exactly
2. Check backend `server.js` CORS configuration
3. Clear browser cache and cookies

### Frontend Issues

**Problem: "Cannot connect to server"**

**Solution:**
1. Verify `VITE_API_URL` is correct in Vercel
2. Check backend is running on Render
3. Verify no trailing slashes in URLs

**Problem: Blank page after deployment**

**Solution:**
1. Check browser console for errors
2. Verify build completed successfully
3. Check if React Router is configured correctly

**Problem: Assets not loading**

**Solution:**
1. Check `vite.config.js` base path
2. Verify all assets are in `public` folder
3. Clear browser cache

---

## Performance Optimization

### Backend (Render)

- Enable **Auto-Deploy** for continuous integration
- Use **Health Check** endpoint for reliability
- Monitor logs regularly
- Set up email alerts for downtime

### Frontend (Vercel)

- Enable **Edge Caching** in Vercel settings
- Use **Preview Deployments** for testing
- Enable **Analytics** to monitor performance
- Configure **Automatic HTTPS**

---

## Monitoring & Maintenance

### Recommended Tools

1. **Uptime Monitoring:** UptimeRobot (free tier)
2. **Error Tracking:** Sentry (free tier)
3. **Analytics:** Google Analytics or Vercel Analytics
4. **Logs:** Render Logs + Vercel Logs

### Regular Maintenance

- Update dependencies monthly
- Monitor database size (MongoDB Atlas free tier: 512MB)
- Check Render bandwidth usage
- Review error logs weekly
- Backup database regularly

---

## Security Best Practices

### ✅ Implemented

- JWT token authentication
- Password hashing (bcrypt)
- CORS protection
- Rate limiting (production only)
- Helmet.js security headers
- Environment variable isolation
- MongoDB connection encryption (Atlas)

### 🔄 Recommended for Production

- Set up SSL/TLS certificates (automatic on Render/Vercel)
- Implement refresh token rotation
- Add CSRF protection
- Set up API request logging
- Configure firewall rules
- Enable MongoDB backup

---

## Rollback Procedure

### Backend Rollback (Render)

1. Go to Render dashboard
2. Navigate to your service
3. Click **Events** tab
4. Find previous successful deployment
5. Click **Manual Deploy** → **Deploy this version**

### Frontend Rollback (Vercel)

1. Go to Vercel dashboard
2. Navigate to your project
3. Click **Deployments** tab
4. Find previous deployment
5. Click **•••** → **Promote to Production**

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **MongoDB Atlas Docs:** https://docs.atlas.mongodb.com
- **React Router Docs:** https://reactrouter.com

---

## Quick Start Commands

### Local Development

```bash
# Backend
cd learnovo-backend
npm install
npm run dev

# Frontend
cd learnovo-frontend
npm install
npm run dev
```

### Production Build

```bash
# Backend
cd learnovo-backend
npm install
npm start

# Frontend
cd learnovo-frontend
npm install
npm run build
```

---

## License

This project is proprietary software for educational purposes.

---

**Last Updated:** November 2024
**Version:** 1.0.0

