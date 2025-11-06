# 🚀 DEPLOY NOW - Step-by-Step Instructions

Follow these exact steps to deploy Learnovo to production.

---

## ⚡ Quick Deploy (Follow in Order)

### 0️⃣ Prerequisites (5 min)

**A. MongoDB Atlas**
- Sign up: https://www.mongodb.com/cloud/atlas
- Create free cluster
- Create database user
- Whitelist IP: `0.0.0.0/0`
- Copy connection string

**B. Generate Secrets**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy this output!

---

### 1️⃣ Push to GitHub (2 min)

```bash
cd "/Users/amanvhanesa/EvoTech Innovation /Websites/Learnovo"

# First time only
git init
git add .
git commit -m "Production ready v1.0"

# Add your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/learnovo.git
git branch -M main
git push -u origin main
```

**Replace** `YOUR_USERNAME` with your GitHub username!

---

### 2️⃣ Deploy Backend - Render (5 min)

**A. Create Account**
- Go to: https://dashboard.render.com
- Click "Sign up with GitHub"

**B. Create Service**
- Click **New +** → **Web Service**
- Select your GitHub repo
- Click **Connect**

**C. Configure Settings**

Copy these EXACT settings:

```
Name: learnovo-backend
Region: Singapore (or closest to you)
Branch: main
Root Directory: (leave empty)
Runtime: Node
Build Command: cd learnovo-backend && npm install
Start Command: cd learnovo-backend && node server.js
```

**D. Add Environment Variables**

Click **Environment** tab, then click **Add Environment Variable** for each:

```
NODE_ENV = production
```

```
PORT = 5000
```

```
MONGODB_URI = mongodb+srv://learnovo_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/learnovo?retryWrites=true&w=majority
```
*(Replace with your actual MongoDB connection string)*

```
JWT_SECRET = PASTE_YOUR_GENERATED_SECRET_HERE
```
*(Use the output from step 0B)*

```
JWT_EXPIRE = 7d
```

```
FRONTEND_URL = https://learnovo.vercel.app
```
*(We'll update this after Vercel)*

**E. Deploy**
- Click **Create Web Service**
- Wait 5-10 minutes
- ⚠️ **First deployment takes longer!**
- Copy your URL: `https://learnovo-backend-xxxx.onrender.com`

---

### 3️⃣ Deploy Frontend - Vercel (5 min)

**A. Create Account**
- Go to: https://vercel.com
- Click "Sign up with GitHub"

**B. Create Project**
- Click **Add New Project**
- Import your GitHub repo
- Click **Import**

**C. Configure Settings**

```
Framework Preset: Vite

Root Directory: (leave empty - we'll fix this)

Build Command: cd learnovo-frontend && npm run build

Output Directory: learnovo-frontend/dist

Install Command: cd learnovo-frontend && npm install
```

**D. Add Environment Variable**

Click **Environment Variables**, add:

```
VITE_API_URL = https://learnovo-backend-xxxx.onrender.com/api
```
*(Use your actual Render URL from step 2E + /api)*

**E. Deploy**
- Click **Deploy**
- Wait 2-5 minutes
- Get your URL: `https://learnovo-xxxx.vercel.app`

---

### 4️⃣ Update Backend (1 min)

Go back to Render:
- Open your service
- Click **Environment**
- Find `FRONTEND_URL`
- Update to your Vercel URL: `https://learnovo-xxxx.vercel.app`
- Click **Save Changes**
- Auto-redeploys in 2-3 minutes

---

### 5️⃣ Test Everything (5 min)

**Health Check:**
```
https://learnovo-backend-xxxx.onrender.com/health
```
Should return: `{"success": true, "status": "ok"}`

**Frontend:**
```
https://learnovo-xxxx.vercel.app
```
Should load homepage

**Login Test:**
- Click Login
- Email: `admin@learnovo.com`
- Password: `admin123`
- Should work!

---

## ✅ You're Live! 🎉

Your application is now on the internet!

---

## 🐛 Troubleshooting

**Backend won't start?**
- Check Render logs
- Verify MONGODB_URI is correct
- Make sure JWT_SECRET is set

**Frontend blank?**
- Check Vercel logs
- Verify VITE_API_URL ends with `/api`
- Check browser console

**Can't login?**
- Database might need data
- Try creating a new tenant
- Check backend logs for errors

---

## 📱 Your Live URLs

**Backend:** https://learnovo-backend-xxxx.onrender.com
**Frontend:** https://learnovo-xxxx.vercel.app

---

## 🎯 What's Next?

1. **Test all features**
2. **Invite users**
3. **Set up monitoring** (see DEPLOYMENT_GUIDE.md)
4. **Add custom domain** (optional)

---

**Need help?** Check `DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

**Congrats on deploying!** 🎊

