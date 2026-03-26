# Deployment Guide — Hostinger VPS + Vercel

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| **Backend** | Hostinger VPS (Node.js + PM2) | `https://api.learnovoportal.com` |
| **Frontend** | Vercel | `https://learnovoportal.com` |
| **Database** | MongoDB Atlas | cluster0.soajlb4.mongodb.net |

Multi-tenant subdomains: `{school}.learnovoportal.com` (e.g. `spis.learnovoportal.com`)

---

## Prerequisites

- Hostinger VPS with SSH access
- MongoDB Atlas account
- Vercel account
- Domain: `learnovoportal.com` (DNS managed via Hostinger/Cloudflare)

---

## Backend Deployment (Hostinger VPS)

### 1. SSH into VPS

```bash
ssh root@<VPS_IP>
```

### 2. Install Node.js & PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g pm2
```

### 3. Clone & Setup

```bash
cd /var/www
git clone <REPO_URL> learnovo
cd learnovo/learnovo-backend
npm install --production
```

### 4. Environment Variables

Create `config.env` on the VPS (never commit this file):

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority
JWT_SECRET=<strong-random-hex-string>
JWT_EXPIRE=7d
FRONTEND_URL=https://learnovoportal.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=<email>
EMAIL_PASS=<app-password>
BCRYPT_ROUNDS=12
LOG_LEVEL=info
```

### 5. Start with PM2

```bash
pm2 start server.js --name learnovo-backend --node-args="--max-old-space-size=512"
pm2 save
pm2 startup  # auto-start on reboot
```

### 6. Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.learnovoportal.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

Then enable SSL:
```bash
certbot --nginx -d api.learnovoportal.com
```

### 7. Deploy Updates

```bash
ssh root@<VPS_IP>
cd /var/www/learnovo/learnovo-backend
git pull origin main
npm install --production
pm2 restart learnovo-backend
```

---

## Frontend Deployment (Vercel)

### Environment Variable

```
VITE_API_URL=https://api.learnovoportal.com/api
```

### Auto-Deploy

Push to `main` branch — Vercel auto-deploys.

---

## Health Check

```bash
curl https://api.learnovoportal.com/health
```

---

## Useful PM2 Commands

```bash
pm2 status              # Check running processes
pm2 logs learnovo-backend  # View logs
pm2 restart learnovo-backend
pm2 monit               # Real-time monitoring
```

---

## Monitoring

- **PM2 logs**: `pm2 logs --lines 100`
- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Uptime**: https://uptimerobot.com (monitor `/health`)

---

**Last Updated**: March 2026
