# 🔐 Deployment Secrets - SAVE THESE!

**IMPORTANT**: Keep this file secure. You'll need these values for deployment.

---

## JWT Secret (Generated)

Use this for `JWT_SECRET` in Render environment variables:

```
c9086b36da8868ffa891e29a7dc13a71146a18458b187497b8b39c4b6bb0dbba
```

---

## Next Steps

1. **Create GitHub Repository**
   - Go to https://github.com/new
   - Create a new repository (e.g., "learnovo")
   - Don't initialize with README
   - Copy the repository URL

2. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/learnovo.git
   git push -u origin main
   ```

3. **Follow DEPLOY_NOW.md** for complete deployment instructions

---

## Environment Variables You'll Need

### MongoDB Atlas
- Connection string from MongoDB Atlas dashboard

### Render (Backend)
- JWT_SECRET: (use the value above)
- MONGODB_URI: (from MongoDB Atlas)
- FRONTEND_URL: (from Vercel, update after deployment)

### Vercel (Frontend)
- VITE_API_URL: (your Render backend URL + /api)

---

**⚠️ Delete this file after deployment or add to .gitignore!**

