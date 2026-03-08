# 🚀 Quick Deployment Guide to Render + Vercel

## Prerequisites
- ✅ MongoDB Atlas account
- ✅ GitHub account
- ✅ Render account
- ✅ Vercel account

---

## Step 1: Prepare MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a **Free M0 Cluster**
3. Click **Connect** → **Connect your application**
4. Copy connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority
   ```
5. Click **Network Access** → **Add IP Address** → `0.0.0.0/0` (allow all)
6. Click **Database Access** → **Add New User**
   - Username: `learnovo_admin`
   - Password: (generate secure password)
   - Role: `Atlas Admin`

---

## Step 2: Prepare Your Code

### Generate Secure JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy this secret** - you'll need it!

### Push to GitHub

```bash
# Navigate to project root
cd "/Users/amanvhanesa/EvoTech Innovation /Websites/Learnovo"

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial deployment ready commit"

# Add your GitHub repository (replace with yours)
git remote add origin https://github.com/YOUR_USERNAME/learnovo.git

# Push
git push -u origin main
```

---

## Step 3: Deploy Backend to Render

### Create Render Account
Go to https://dashboard.render.com → Sign up (GitHub login works)

### Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub account
3. Select your `learnovo` repository
4. Click **Apply**

### Configure Backend Service

**Settings:**
- **Name**: `learnovo-backend`
- **Region**: Singapore (or closest to you)
- **Branch**: `main`
- **Root Directory**: Leave empty
- **Runtime**: Node
- **Build Command**: `cd learnovo-backend && npm install`
- **Start Command**: `cd learnovo-backend && node server.js`

**Environment Variables:**

Add these in Render dashboard:

```
NODE_ENV=production
PORT=5000

# MongoDB (from Step 1)
MONGODB_URI=mongodb+srv://learnovo_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority

# JWT Secret (from above)
JWT_SECRET=paste_your_generated_hex_string_here
JWT_EXPIRE=7d

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://learnovo.vercel.app

# Email (Optional - you can set these later)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

### Deploy

1. Click **Create Web Service**
2. Wait 5-10 minutes for deployment
3. Copy your **Service URL**: `https://learnovo-backend.onrender.com`

**⚠️ Free tier warning**: First request may take 30-50 seconds (cold start)

---

## Step 4: Deploy Frontend to Vercel

### Create Vercel Account
Go to https://vercel.com → Sign up (GitHub login works)

### Create Project

1. Click **Add New Project**
2. Import your GitHub repository
3. Select your `learnovo` repository

### Configure Frontend

**Framework Preset:** Vite

**Settings:**
- **Root Directory**: Leave empty
- **Build Command**: `cd learnovo-frontend && npm run build`
- **Output Directory**: `learnovo-frontend/dist`
- **Install Command**: `cd learnovo-frontend && npm install`

**Environment Variables:**

```
VITE_API_URL=https://learnovo-backend.onrender.com/api
```

### Deploy

1. Click **Deploy**
2. Wait 2-5 minutes
3. Copy your **Domain**: `https://learnovo.vercel.app` (or custom)

---

## Step 5: Update Backend with Frontend URL

1. Go back to **Render Dashboard**
2. Open your `learnovo-backend` service
3. Go to **Environment**
4. Update `FRONTEND_URL` with your Vercel URL:
   ```
   FRONTEND_URL=https://learnovo.vercel.app
   ```
5. Click **Save Changes** (will redeploy automatically)

---

## Step 6: Test Your Deployment

### Health Check
Visit: `https://learnovo-backend.onrender.com/health`

Expected response:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "...",
  "services": {
    "database": "healthy"
  }
}
```

### Test Frontend
Visit: `https://learnovo.vercel.app` or your custom domain

### Test Login
Use demo credentials:
- **Admin**: admin@learnovo.com / admin123
- **Teacher**: sarah.wilson@learnovo.com / teacher123
- **Student**: john.doe@learnovo.com / student123
- **Parent**: parent@learnovo.com / parent123

---

## Troubleshooting

### Backend Issues

**Problem: "Cannot connect to MongoDB"**
- ✅ Check MONGODB_URI in Render environment variables
- ✅ Verify IP whitelist in MongoDB Atlas (should include `0.0.0.0/0`)
- ✅ Check database user credentials

**Problem: "CORS errors"**
- ✅ Ensure FRONTEND_URL in Render matches your Vercel URL exactly
- ✅ Check for trailing slashes
- ✅ Clear browser cache

**Problem: "Cold start takes too long"**
- ✅ This is normal for Render free tier
- ✅ Upgrade to paid plan to avoid cold starts

### Frontend Issues

**Problem: "Cannot connect to server"**
- ✅ Check VITE_API_URL in Vercel environment variables
- ✅ Verify backend is running
- ✅ Check browser console for errors

**Problem: "Blank page"**
- ✅ Check build logs in Vercel
- ✅ Look for errors in browser console
- ✅ Verify all environment variables are set

---

## Security Checklist

Before going live:

- [x] JWT_SECRET is a strong random string (32+ characters)
- [x] MongoDB password is strong
- [x] CORS is configured with specific frontend URL
- [x] HTTPS is enabled (automatic on Render/Vercel)
- [x] Environment variables are not exposed
- [x] Rate limiting is active
- [x] Helmet security headers are enabled

---

## Cost Estimate (Free Tier)

| Service | Plan | Cost | Limits |
|---------|------|------|--------|
| Render Backend | Free | $0 | 750 hrs/month, 512MB RAM |
| Vercel Frontend | Free | $0 | 100GB bandwidth |
| MongoDB Atlas | Free M0 | $0 | 512MB storage |

**Total: FREE** 🎉

**Note:** Free tiers have limitations:
- Render spins down after 15 min inactivity
- First request can be slow (cold start)
- Limited bandwidth on Vercel free tier

**Upgrade costs if needed:**
- Render Starter: $7/month (no cold starts, better performance)
- Vercel Pro: $20/month (better limits)
- MongoDB M10: $57/month (production ready)

---

## Custom Domain (Optional)

### On Vercel

1. Go to your project → **Settings** → **Domains**
2. Add your domain: `app.yourdomain.com`
3. Configure DNS:
   - Type: **CNAME**
   - Name: `app`
   - Value: `cname.vercel-dns.com`

### On Render

1. Go to your service → **Settings** → **Custom Domains**
2. Add your domain
3. Configure DNS as instructed

### Update Environment Variables

After adding custom domain:
- Update `FRONTEND_URL` in Render to use your custom domain
- Redeploy backend

---

## Post-Deployment Monitoring

### Recommended Tools (All Free)

1. **Uptime Monitoring**: https://uptimerobot.com
   - Add your backend health URL
   - Get alerts when site is down

2. **Error Tracking**: Sentry.io (free tier)
   - Catch production errors automatically

3. **Analytics**: Google Analytics or Vercel Analytics
   - Track user behavior

---

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Check Render logs for errors
- [ ] Monitor MongoDB Atlas storage usage
- [ ] Review Vercel bandwidth usage

**Monthly:**
- [ ] Update dependencies: `npm audit fix`
- [ ] Backup database from MongoDB Atlas
- [ ] Check for security updates

**Quarterly:**
- [ ] Review and optimize database queries
- [ ] Check performance metrics
- [ ] Update documentation

---

## Quick Commands Reference

```bash
# Check backend logs (Render)
# Go to Render Dashboard → Your Service → Logs

# Check frontend logs (Vercel)
# Go to Vercel Dashboard → Your Project → Deployments → Logs

# Update backend
git push origin main  # Auto-deploys on Render

# Update frontend
git push origin main  # Auto-deploys on Vercel

# Rollback backend
# Render Dashboard → Your Service → Manual Deploy → Previous Version

# Rollback frontend
# Vercel Dashboard → Deployments → ... → Promote to Production
```

---

## Support

Need help?

1. **Render Docs**: https://render.com/docs
2. **Vercel Docs**: https://vercel.com/docs
3. **MongoDB Atlas**: https://docs.atlas.mongodb.com

---

## Success! 🎉

Your Learnovo application should now be live!

**Backend**: https://learnovo-backend.onrender.com  
**Frontend**: https://learnovo.vercel.app (or your custom domain)

**Next Steps:**
- Test all features
- Set up monitoring
- Configure custom domain
- Invite users to try it!

---

**Last Updated**: November 2024

