#!/bin/bash
set -e

# =============================================================================
# Learnovo VPS Server Setup — Phase 1 + Phase 10
# Run as root on your Hostinger VPS: ssh root@157.173.219.189
# =============================================================================

echo "========================================="
echo "  Learnovo VPS Server Setup"
echo "========================================="

# --- 1. System Update ---
echo ""
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# --- 2. Create deploy user (non-root) ---
echo ""
echo "[2/8] Creating deploy user..."
if id "deploy" &>/dev/null; then
    echo "  User 'deploy' already exists, skipping."
else
    adduser --disabled-password --gecos "Learnovo Deploy" deploy
    usermod -aG sudo deploy
    echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
    chmod 440 /etc/sudoers.d/deploy

    # Copy root SSH keys to deploy user
    mkdir -p /home/deploy/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
    fi
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
    echo "  Created user 'deploy' with sudo + SSH access."
fi

# --- 3. Install Node.js v18 LTS via nvm (if not present) ---
echo ""
echo "[3/8] Checking Node.js..."
if command -v node &>/dev/null; then
    NODE_VER=$(node -v)
    echo "  Node.js $NODE_VER already installed."
else
    echo "  Installing Node.js v18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo "  Node.js $(node -v) installed."
fi

# Install PM2 globally if not present
if command -v pm2 &>/dev/null; then
    echo "  PM2 already installed."
else
    echo "  Installing PM2..."
    npm install -g pm2
    pm2 startup systemd -u deploy --hp /home/deploy
    echo "  PM2 installed and configured for startup."
fi

# --- 4. Install Certbot + Cloudflare DNS plugin ---
echo ""
echo "[4/8] Installing Certbot..."
apt install -y certbot python3-certbot-nginx
# Cloudflare plugin for wildcard SSL (install now, configure later)
apt install -y python3-certbot-dns-cloudflare 2>/dev/null || pip3 install certbot-dns-cloudflare 2>/dev/null || true
echo "  Certbot installed."

# --- 5. Configure UFW Firewall ---
echo ""
echo "[5/8] Configuring UFW firewall..."
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
# Allow port 3001 only from localhost (for Uptime Kuma)
ufw allow from 127.0.0.1 to any port 3001 comment 'Uptime Kuma local'
echo "y" | ufw enable
ufw status verbose
echo "  UFW configured and enabled."

# --- 6. Install & Configure fail2ban ---
echo ""
echo "[6/8] Installing fail2ban..."
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
maxretry = 10
JAIL

systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban configured (SSH: 3 attempts, 2hr ban)."

# --- 7. Enable unattended-upgrades ---
echo ""
echo "[7/8] Enabling unattended security upgrades..."
apt install -y unattended-upgrades apt-listchanges
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUPGRADE'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUPGRADE
systemctl enable unattended-upgrades
echo "  Unattended upgrades enabled."

# --- 8. Configure logrotate for Nginx ---
echo ""
echo "[8/8] Configuring Nginx log rotation..."
cat > /etc/logrotate.d/nginx-learnovo << 'LOGROTATE'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
LOGROTATE
echo "  Logrotate configured (daily, 14 days retention)."

# --- Harden SSH ---
echo ""
echo "[SECURITY] Hardening SSH..."
# Backup original config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Disable root login and password auth (only after deploy user is confirmed working)
echo ""
echo "  WARNING: SSH hardening will disable root login and password auth."
echo "  Make sure you can SSH as 'deploy' user before enabling this."
echo ""
echo "  To enable SSH hardening later, run:"
echo "    sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config"
echo "    sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
echo "    systemctl restart sshd"

# --- Create directory structure ---
echo ""
echo "[SETUP] Creating deployment directories..."
mkdir -p /var/www/learnovo/frontend
mkdir -p /var/www/learnovo/frontend-repo
mkdir -p /var/www/learnovo/releases
chown -R deploy:deploy /var/www/learnovo

echo ""
echo "========================================="
echo "  Server Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Test SSH as deploy user: ssh deploy@157.173.219.189"
echo "  2. Run 02-nginx-setup.sh"
echo "  3. Run 03-ssl-setup.sh"
echo ""
