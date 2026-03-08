# ⚡ 5-Minute Deployment to Render + Vercel

## What You Need
- MongoDB Atlas account (free)
- GitHub account
- Render account (free)
- Vercel account (free)

---

## 🎯 5 Simple Steps

### 1️⃣ Setup MongoDB Atlas (2 minutes)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create FREE cluster
3. Create user: username `learnovo_admin`, password (save it!)
4. **Network Access** → Add IP: `0.0.0.0/0`
5. **Database** → Click **Connect** → **Connect your application**
6. Copy connection string:
   ```
   mongodb+srv://learnovo_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority
   ```

---

### 2️⃣ Generate JWT Secret (30 seconds)

Run this in terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy the output** - you'll need it!

---

### 3️⃣ Push to GitHub (1 minute)

```bash
cd "/Users/amanvhanesa/EvoTech Innovation /Websites/Learnovo"
git init
git add .
git commit -m "Deployment ready"
git remote add origin https://github.com/YOUR_USERNAME/learnovo.git
git push -u origin main
```

---

### 4️⃣ Deploy Backend on Render (2 minutes)

**A. Create Account**
1. Go to https://dashboard.render.com
2. Sign up with GitHub

**B. Create Web Service**
1. Click **New +** → **Web Service**
2. Connect to your GitHub repo
3. Select `learnovo`

**C. Configure**
```
Name: learnovo-backend
Region: Singapore
Branch: main
Build Command: cd learnovo-backend && npm install
Start Command: cd learnovo-backend && node server.js
```

**D. Add Environment Variables**
Click **Environment** tab, add:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=<paste from step 1>
JWT_SECRET=<paste from step 2>
JWT_EXPIRE=7d
FRONTEND_URL=https://learnovo.vercel.app
```

**E. Deploy**
1. Click **Create Web Service**
2. Wait 5-10 minutes ⏳
3. Copy URL: `https://learnovo-backend-xxxx.onrender.com`

---

### 5️⃣ Deploy Frontend on Vercel (1 minute)

**A. Create Account**
1. Go to https://vercel.com
2. Sign up with GitHub

**B. Create Project**
1. Click **Add New Project**
2. Import your `learnovo` repo

**C. Configure**
```
Framework: Vite
Build Command: cd learnovo-frontend && npm run build
Output Directory: learnovo-frontend/dist
```

**D. Add Environment Variable**
```
VITE_API_URL=https://learnovo-backend-xxxx.onrender.com/api
```

**E. Deploy**
1. Click **Deploy**
2. Wait 2-5 minutes ⏳
3. Copy URL: `https://learnovo-xxxx.vercel.app`

---

### 6️⃣ Final Step - Update Backend

Go back to Render → Your Service → Environment → Update:
```
FRONTEND_URL=<paste your Vercel URL>
```

Save changes (auto-redeploys)

---

## ✅ Test Your Live Site

1. Visit your Vercel URL
2. Test login:
   - Admin: `admin@learnovo.com` / `admin123`
   - Teacher: `sarah.wilson@learnovo.com` / `teacher123`

---

## 🐛 Quick Fixes

**Backend not starting?**
- Check MongoDB connection string
- Verify JWT_SECRET is set
- Check Render logs

**Frontend showing errors?**
- Verify VITE_API_URL matches Render URL + `/api`
- Check browser console
- Clear cache

**Can't login?**
- Database might need seeding
- Check Render logs for errors

---

## 💰 Total Cost

**FREE FOREVER** (on free tiers)

- Render: 750 hours/month free
- Vercel: Unlimited projects, 100GB bandwidth
- MongoDB: 512MB free storage

---

## 🎉 You're Live!

Your student management system is now running in production!

**Need help?** Check `DEPLOYMENT_GUIDE.md` for detailed info.

**Want production-grade?** See upgrade options in deployment guide.

