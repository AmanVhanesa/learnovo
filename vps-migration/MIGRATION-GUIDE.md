# Learnovo Frontend — VPS Migration Guide

**VPS:** 157.173.219.189 (Hostinger, Ubuntu, 8GB RAM)
**Domain:** learnovoportal.com
**Backend:** Port 5000 via PM2 (already running)
**Frontend:** React + Vite (migrating from Vercel)

---

## Pre-Migration Checklist

- [ ] SSH access works: `ssh root@157.173.219.189`
- [ ] Backend is running on port 5000 on the VPS
- [ ] You have the GitHub repo URL: `https://github.com/AmanVhanesa/learnovo`
- [ ] You know your Cloudflare API token (or DNS provider credentials)

---

## Phase 1 — Server Preparation

### Step 1: Upload all scripts to VPS

From your local machine (in the project root):

```bash
# Upload all migration scripts
scp -r vps-migration/* root@157.173.219.189:/tmp/learnovo-migration/
```

Or if you prefer to do it file by file:

```bash
scp vps-migration/01-server-setup.sh root@157.173.219.189:/tmp/
scp vps-migration/02-nginx-learnovo.conf root@157.173.219.189:/tmp/learnovo-nginx.conf
scp vps-migration/03-ssl-setup.sh root@157.173.219.189:/tmp/
scp vps-migration/04-deploy.sh root@157.173.219.189:/tmp/
scp vps-migration/05-rollback.sh root@157.173.219.189:/tmp/
scp vps-migration/06-monitoring-setup.sh root@157.173.219.189:/tmp/
scp vps-migration/07-nginx-setup.sh root@157.173.219.189:/tmp/
```

### Step 2: SSH into VPS and run server setup

```bash
ssh root@157.173.219.189

# Make scripts executable
chmod +x /tmp/01-server-setup.sh /tmp/03-ssl-setup.sh /tmp/07-nginx-setup.sh /tmp/06-monitoring-setup.sh

# Run server setup (installs tools, creates deploy user, firewall, fail2ban)
bash /tmp/01-server-setup.sh
```

This script will:
- Create a `deploy` user with sudo + SSH access
- Install/verify Node.js, PM2, Certbot
- Configure UFW firewall (ports 22, 80, 443 only)
- Install fail2ban (SSH: 3 attempts = 2hr ban)
- Enable unattended security upgrades
- Configure Nginx log rotation (daily, 14 days)
- Create `/var/www/learnovo/` directory structure

### Step 3: Verify deploy user works

```bash
# From your local machine (new terminal)
ssh deploy@157.173.219.189

# Should work without password (uses same SSH keys as root)
```

---

## Phase 2 — Clone & Build Frontend

### Step 4: Clone the frontend repo

```bash
# SSH as deploy user
ssh deploy@157.173.219.189

cd /var/www/learnovo/frontend-repo

# Clone just the frontend from the monorepo
git clone --depth 1 --branch main https://github.com/AmanVhanesa/learnovo.git .
```

> **Note:** Since your repo is a monorepo, the deploy script will build from the `learnovo-frontend/` subdirectory. We need to adjust the deploy script for this.

### Step 5: Update deploy script for monorepo structure

```bash
# Copy deploy and rollback scripts
sudo cp /tmp/04-deploy.sh /var/www/learnovo/deploy.sh
sudo cp /tmp/05-rollback.sh /var/www/learnovo/rollback.sh
sudo chmod +x /var/www/learnovo/deploy.sh /var/www/learnovo/rollback.sh
sudo chown deploy:deploy /var/www/learnovo/deploy.sh /var/www/learnovo/rollback.sh
```

**IMPORTANT:** Since your repo is a monorepo, edit the deploy script:

```bash
nano /var/www/learnovo/deploy.sh
```

Change the build section to:

```bash
# Navigate to frontend directory within monorepo
cd "$REPO_DIR/learnovo-frontend"

# Install dependencies
log "Installing dependencies..."
npm ci --production=false

# Build
log "Building production bundle..."
npm run build

# Copy build output
log "Creating release: $RELEASE_NAME"
mkdir -p "$RELEASE_DIR"
cp -r dist/* "$RELEASE_DIR/"
```

### Step 6: Create .env.production on server

```bash
cat > /var/www/learnovo/frontend-repo/learnovo-frontend/.env.production << 'EOF'
VITE_API_URL=/api
VITE_APP_DOMAIN=learnovoportal.com
VITE_PAYMENT_GATEWAY_ENABLED=true
EOF
```

### Step 7: Run first deployment

```bash
/var/www/learnovo/deploy.sh
```

Verify:
```bash
ls -la /var/www/learnovo/frontend/current/
# Should show index.html and assets/
cat /var/www/learnovo/frontend/current/index.html | head -5
```

---

## Phase 3 — SSL Certificate (Before Nginx HTTPS)

### Step 8: Set up DNS first

Go to your DNS provider and add these records:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | @ | 157.173.219.189 | Off (for now) |
| A | * | 157.173.219.189 | Off (for now) |

Wait 5-10 minutes for DNS propagation. Verify:

```bash
# From your local machine
dig learnovoportal.com +short
# Should return: 157.173.219.189

dig test.learnovoportal.com +short
# Should return: 157.173.219.189
```

### Step 9: Get wildcard SSL certificate

**Option A — Cloudflare (Recommended):**

1. Sign up at [Cloudflare](https://dash.cloudflare.com) and add `learnovoportal.com`
2. Change your domain's nameservers to Cloudflare's (they'll tell you which ones)
3. Create an API token:
   - Go to Profile → API Tokens → Create Token
   - Template: "Edit zone DNS"
   - Zone: `learnovoportal.com`
   - Copy the token

4. On the VPS:
```bash
ssh root@157.173.219.189

# Create Cloudflare credentials
mkdir -p /etc/letsencrypt
cat > /etc/letsencrypt/cloudflare.ini << 'EOF'
dns_cloudflare_api_token = YOUR_TOKEN_HERE
EOF
chmod 600 /etc/letsencrypt/cloudflare.ini

# Request wildcard cert
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d "learnovoportal.com" -d "*.learnovoportal.com" \
  --preferred-challenges dns-01 \
  --non-interactive \
  --agree-tos \
  --email aman@learnovoportal.com
```

**Option B — Manual DNS challenge (if not using Cloudflare):**

```bash
certbot certonly --manual \
  -d "learnovoportal.com" -d "*.learnovoportal.com" \
  --preferred-challenges dns-01 \
  --agree-tos --email aman@learnovoportal.com
```

Certbot will ask you to add a TXT record at `_acme-challenge.learnovoportal.com`. Add it in your DNS, wait 2 min, press Enter.

> **Warning:** Manual certs don't auto-renew. You'll need to repeat this every 90 days.

### Step 10: Verify SSL

```bash
# Check cert files exist
ls -la /etc/letsencrypt/live/learnovoportal.com/

# Test auto-renewal
certbot renew --dry-run
```

---

## Phase 4 — Nginx Configuration

### Step 11: Check existing Nginx config

Before applying the new config, check what's already running:

```bash
# See existing configs
ls -la /etc/nginx/sites-enabled/
cat /etc/nginx/sites-enabled/* 2>/dev/null

# Check if backend has its own server block
grep -r "server_name" /etc/nginx/sites-available/
```

**If you have an existing config for `api.learnovoportal.com`:**
- Keep it running — the new config only handles `learnovoportal.com` and `*.learnovoportal.com`
- The `/api/` proxy in the new config routes requests on the main domain to the backend
- You can remove the api subdomain config later once everything works

### Step 12: Install the Nginx config

```bash
# Copy the config file (should already be at /tmp/learnovo-nginx.conf from Step 1)
sudo cp /tmp/learnovo-nginx.conf /etc/nginx/sites-available/learnovo

# Disable default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable learnovo config
sudo ln -sf /etc/nginx/sites-available/learnovo /etc/nginx/sites-enabled/learnovo

# Test config
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx
```

### Step 13: Verify Nginx is serving the frontend

```bash
# Test HTTPS
curl -I https://learnovoportal.com

# Should return:
# HTTP/2 200
# x-frame-options: SAMEORIGIN
# x-content-type-options: nosniff
# strict-transport-security: max-age=31536000...

# Test HTTP → HTTPS redirect
curl -I http://learnovoportal.com
# Should return 301 → https://learnovoportal.com

# Test www → non-www redirect
curl -I https://www.learnovoportal.com
# Should return 301 → https://learnovoportal.com

# Test API proxy
curl -s https://learnovoportal.com/api/health | head -20

# Test subdomain (replace 'spis' with a real tenant slug)
curl -I https://spis.learnovoportal.com
```

---

## Phase 5 — GitHub Actions CI/CD

### Step 14: Generate SSH key for deployments

On the VPS:

```bash
# Generate a deploy key (as deploy user)
su - deploy
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""

# Add public key to authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Display private key (you'll need this for GitHub)
cat ~/.ssh/github_deploy
```

### Step 15: Add GitHub Secrets

Go to: **https://github.com/AmanVhanesa/learnovo/settings/secrets/actions**

Add these secrets:

| Secret Name | Value |
|------------|-------|
| `VPS_HOST` | `157.173.219.189` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/github_deploy` (the private key) |

### Step 16: The workflow is already created

The file `.github/workflows/deploy-frontend.yml` has been created in your repo. It triggers on pushes to `main` that change files in `learnovo-frontend/`.

Push it to GitHub:
```bash
# From your local machine
cd "/Users/amanvhanesa/EvoTech Innovation /Websites/Learnovo"
git add .github/workflows/deploy-frontend.yml
git commit -m "ci: add frontend auto-deploy to VPS on push to main"
git push origin main
```

---

## Phase 6 — Monitoring

### Step 17: Set up monitoring

```bash
ssh root@157.173.219.189
bash /tmp/06-monitoring-setup.sh
```

### Step 18: Access Uptime Kuma

Uptime Kuma runs on port 3001 but is blocked by UFW (only localhost). Use SSH tunnel:

```bash
# From your local machine
ssh -L 3001:localhost:3001 deploy@157.173.219.189
```

Then open: **http://localhost:3001**

Add these monitors:
1. **Main Site:** `https://learnovoportal.com` (check every 60s)
2. **Test Tenant:** `https://spis.learnovoportal.com` (check every 60s)
3. **Backend API:** `https://learnovoportal.com/api/health` (check every 30s)

---

## Phase 7 — Performance (Cloudflare CDN)

If you set up Cloudflare for DNS (Step 9, Option A), you automatically get:

### Step 19: Configure Cloudflare settings

In Cloudflare Dashboard → your domain:

1. **SSL/TLS → Overview:** Set to "Full (Strict)"
2. **SSL/TLS → Edge Certificates:** Enable "Always Use HTTPS"
3. **Speed → Optimization:**
   - Enable Auto Minify (JS, CSS, HTML)
   - Enable Brotli compression
4. **Caching → Configuration:**
   - Browser Cache TTL: "Respect Existing Headers"
5. **Rules → Page Rules** (free plan gets 3 rules):
   - Rule 1: `*learnovoportal.com/assets/*` → Cache Level: Cache Everything, Edge TTL: 1 month
   - Rule 2: `*learnovoportal.com/api/*` → Cache Level: Bypass
6. **DNS:** Turn on the orange cloud (proxy) for both `@` and `*` records

This gives you **free CDN + DDoS protection + analytics**.

---

## Phase 8 — Final Verification

Run through this checklist on the VPS:

```bash
ssh deploy@157.173.219.189

echo "=== Verification Checklist ==="

# 1. Nginx config
echo "--- Nginx ---"
sudo nginx -t 2>&1

# 2. Frontend is served
echo "--- Frontend ---"
curl -s -o /dev/null -w "%{http_code}" https://learnovoportal.com
echo " (should be 200)"

# 3. API proxy works
echo "--- API Proxy ---"
curl -s -o /dev/null -w "%{http_code}" https://learnovoportal.com/api/health
echo " (should be 200)"

# 4. Wildcard subdomains
echo "--- Wildcard Subdomain ---"
curl -s -o /dev/null -w "%{http_code}" https://spis.learnovoportal.com
echo " (should be 200)"

# 5. SSL
echo "--- SSL ---"
curl -sI https://learnovoportal.com | grep -i "strict-transport"

# 6. HTTP → HTTPS redirect
echo "--- HTTP Redirect ---"
curl -s -o /dev/null -w "%{http_code}" http://learnovoportal.com
echo " (should be 301)"

# 7. www redirect
echo "--- www Redirect ---"
curl -s -o /dev/null -w "%{http_code}" -L https://www.learnovoportal.com
echo " (should be 301 then 200)"

# 8. Gzip
echo "--- Compression ---"
curl -sI -H "Accept-Encoding: gzip" https://learnovoportal.com | grep -i "content-encoding"

# 9. Cache headers on assets
echo "--- Static Asset Cache ---"
ASSET=$(curl -s https://learnovoportal.com | grep -oP 'src="/assets/[^"]+' | head -1 | sed 's/src="//')
if [ -n "$ASSET" ]; then
    curl -sI "https://learnovoportal.com$ASSET" | grep -i "cache-control"
fi

# 10. Security headers
echo "--- Security Headers ---"
curl -sI https://learnovoportal.com | grep -iE "x-frame|x-content-type|x-xss|referrer-policy"

# 11. Deploy script
echo "--- Deploy Script ---"
ls -la /var/www/learnovo/deploy.sh && echo "EXISTS"

# 12. Rollback script
echo "--- Rollback Script ---"
ls -la /var/www/learnovo/rollback.sh && echo "EXISTS"

# 13. PM2
echo "--- PM2 ---"
pm2 list

# 14. UFW
echo "--- Firewall ---"
sudo ufw status

# 15. fail2ban
echo "--- fail2ban ---"
sudo systemctl is-active fail2ban

# 16. Unattended upgrades
echo "--- Unattended Upgrades ---"
sudo systemctl is-active unattended-upgrades

# 17. SSL auto-renewal
echo "--- SSL Renewal ---"
sudo certbot renew --dry-run 2>&1 | tail -3

echo ""
echo "=== Verification Complete ==="
```

---

## Daily Operations Quick Reference

### Deploy (manual)
```bash
ssh deploy@157.173.219.189
/var/www/learnovo/deploy.sh
```

### Rollback
```bash
ssh deploy@157.173.219.189
/var/www/learnovo/rollback.sh
```

### View logs
```bash
# Nginx access log
tail -f /var/log/nginx/learnovo-access.log

# Nginx error log
tail -f /var/log/nginx/learnovo-error.log

# Backend PM2 logs
pm2 logs

# Deploy log
cat /var/www/learnovo/deploy.log

# Log stats
/var/www/learnovo/log-stats.sh
```

### Check status
```bash
# Backend
pm2 status

# Nginx
sudo systemctl status nginx

# Firewall
sudo ufw status

# fail2ban
sudo fail2ban-client status sshd

# SSL cert expiry
sudo certbot certificates

# Disk usage
df -h
du -sh /var/www/learnovo/releases/*/
```

### Restart services
```bash
# Restart backend
pm2 restart all

# Restart Nginx
sudo systemctl restart nginx

# Restart Uptime Kuma
sudo systemctl restart uptime-kuma
```

---

## File Locations on VPS

| File | Location |
|------|----------|
| Frontend source | `/var/www/learnovo/frontend-repo/` |
| Active build | `/var/www/learnovo/frontend/current/` (symlink) |
| All releases | `/var/www/learnovo/releases/` |
| Deploy script | `/var/www/learnovo/deploy.sh` |
| Rollback script | `/var/www/learnovo/rollback.sh` |
| Log stats | `/var/www/learnovo/log-stats.sh` |
| Deploy log | `/var/www/learnovo/deploy.log` |
| Nginx config | `/etc/nginx/sites-available/learnovo` |
| Nginx logs | `/var/log/nginx/learnovo-*.log` |
| SSL certs | `/etc/letsencrypt/live/learnovoportal.com/` |
| Cloudflare creds | `/etc/letsencrypt/cloudflare.ini` |
| fail2ban config | `/etc/fail2ban/jail.local` |
| Uptime Kuma | `/opt/uptime-kuma/` |

---

## Troubleshooting

### Frontend shows blank page
```bash
# Check if build exists
ls /var/www/learnovo/frontend/current/index.html

# Check Nginx is pointing to right place
readlink /var/www/learnovo/frontend/current

# Check Nginx error log
tail -20 /var/log/nginx/learnovo-error.log
```

### API proxy returns 502
```bash
# Check if backend is running
pm2 status
curl http://localhost:5000/api/health

# Restart backend
pm2 restart all
```

### Subdomain not resolving
```bash
# Check DNS
dig schoolname.learnovoportal.com +short
# Should return 157.173.219.189

# Check Nginx wildcard
grep "server_name" /etc/nginx/sites-available/learnovo
# Should show: *.learnovoportal.com
```

### SSL certificate renewal fails
```bash
# Check cert status
sudo certbot certificates

# Manual renewal
sudo certbot renew --force-renewal

# Check Cloudflare credentials
sudo cat /etc/letsencrypt/cloudflare.ini
```

### Deploy script fails
```bash
# Check the log
cat /var/www/learnovo/deploy.log

# Common issues:
# - npm ci fails: check Node version (need v18+)
# - git pull fails: check SSH keys / repo access
# - Build fails: check .env.production exists
```
