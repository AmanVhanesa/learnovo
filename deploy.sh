#!/bin/bash

echo "🚀 Learnovo Deployment Helper"
echo "=============================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized. Run: git init"
    exit 1
fi

# Check if we have a remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null)

if [ -z "$REMOTE_URL" ]; then
    echo "📦 Step 1: Push to GitHub"
    echo "-------------------------"
    echo "1. Go to https://github.com/new"
    echo "2. Create a new repository (e.g., 'learnovo')"
    echo "3. DON'T initialize with README"
    echo "4. Copy the repository URL"
    echo ""
    read -p "Enter your GitHub repository URL (or press Enter to skip): " GITHUB_URL
    
    if [ ! -z "$GITHUB_URL" ]; then
        git remote add origin "$GITHUB_URL"
        git branch -M main
        echo "✅ Remote added: $GITHUB_URL"
        echo ""
        echo "Now push your code:"
        echo "  git push -u origin main"
        echo ""
    else
        echo "⚠️  Skipping GitHub setup. You can add it later with:"
        echo "   git remote add origin YOUR_GITHUB_URL"
        echo ""
    fi
else
    echo "✅ GitHub remote already set: $REMOTE_URL"
    echo ""
fi

# Display secrets
echo "🔐 Step 2: Deployment Secrets"
echo "------------------------------"
echo "Your JWT Secret (save this for Render):"
echo "c9086b36da8868ffa891e29a7dc13a71146a18458b187497b8b39c4b6bb0dbba"
echo ""
echo "(Also saved in DEPLOYMENT_SECRETS.md)"
echo ""

# Check MongoDB Atlas
echo "📊 Step 3: MongoDB Atlas Setup"
echo "-------------------------------"
echo "1. Go to https://www.mongodb.com/cloud/atlas"
echo "2. Sign up / Log in"
echo "3. Create FREE cluster (M0)"
echo "4. Create database user"
echo "5. Network Access → Add IP: 0.0.0.0/0"
echo "6. Database → Connect → Connect your application"
echo "7. Copy connection string"
echo ""
read -p "Have you set up MongoDB Atlas? (y/n): " MONGO_READY
echo ""

# Render setup
echo "🖥️  Step 4: Deploy Backend to Render"
echo "-------------------------------------"
echo "1. Go to https://dashboard.render.com"
echo "2. Sign up with GitHub"
echo "3. Click 'New +' → 'Web Service'"
echo "4. Connect your GitHub repo"
echo "5. Configure:"
echo "   - Name: learnovo-backend"
echo "   - Build Command: cd learnovo-backend && npm install"
echo "   - Start Command: cd learnovo-backend && node server.js"
echo "6. Add Environment Variables (see DEPLOYMENT_SECRETS.md)"
echo "7. Deploy!"
echo ""
read -p "Have you deployed to Render? (y/n): " RENDER_READY
echo ""

# Vercel setup
echo "🎨 Step 5: Deploy Frontend to Vercel"
echo "-------------------------------------"
echo "1. Go to https://vercel.com"
echo "2. Sign up with GitHub"
echo "3. Click 'Add New Project'"
echo "4. Import your GitHub repo"
echo "5. Configure:"
echo "   - Framework: Vite"
echo "   - Build Command: cd learnovo-frontend && npm run build"
echo "   - Output Directory: learnovo-frontend/dist"
echo "6. Add Environment Variable:"
echo "   - VITE_API_URL: https://YOUR-RENDER-URL.onrender.com/api"
echo "7. Deploy!"
echo ""
read -p "Have you deployed to Vercel? (y/n): " VERCEL_READY
echo ""

echo "✅ Deployment Steps Complete!"
echo ""
echo "📚 Need more help? Check:"
echo "   - DEPLOY_NOW.md (fastest path)"
echo "   - DEPLOYMENT_GUIDE.md (detailed guide)"
echo "   - START_HERE.md (navigation guide)"
echo ""
echo "🎉 Your app should now be live!"

