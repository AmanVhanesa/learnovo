#!/bin/bash
set -e

# =============================================================================
# Learnovo Monitoring Setup — Phase 8
# Run as root on VPS
# =============================================================================

echo "========================================="
echo "  Learnovo Monitoring Setup"
echo "========================================="

# --- 1. PM2 log rotation ---
echo ""
echo "[1/3] Configuring PM2 log rotation..."
su - deploy -c "pm2 install pm2-logrotate" || true
su - deploy -c "pm2 set pm2-logrotate:max_size 10M" || true
su - deploy -c "pm2 set pm2-logrotate:retain 7" || true
su - deploy -c "pm2 set pm2-logrotate:compress true" || true
echo "  PM2 logrotate configured (10MB max, 7 days retention)."

# --- 2. Uptime Kuma (Node.js version, no Docker needed) ---
echo ""
echo "[2/3] Installing Uptime Kuma..."

KUMA_DIR="/opt/uptime-kuma"

if [ -d "$KUMA_DIR" ]; then
    echo "  Uptime Kuma already installed at $KUMA_DIR"
else
    git clone https://github.com/louislam/uptime-kuma.git "$KUMA_DIR"
    cd "$KUMA_DIR"
    npm run setup

    # Create systemd service
    cat > /etc/systemd/system/uptime-kuma.service << 'SERVICE'
[Unit]
Description=Uptime Kuma Monitoring
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/uptime-kuma
ExecStart=/usr/bin/node server/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

    chown -R deploy:deploy "$KUMA_DIR"
    systemctl daemon-reload
    systemctl enable uptime-kuma
    systemctl start uptime-kuma
    echo "  Uptime Kuma installed and running on port 3001."
fi

echo ""
echo "  Access Uptime Kuma: http://157.173.219.189:3001"
echo "  (Only accessible from localhost via UFW — use SSH tunnel:)"
echo "  ssh -L 3001:localhost:3001 deploy@157.173.219.189"
echo ""
echo "  Recommended monitors to add:"
echo "    - https://learnovoportal.com (main site)"
echo "    - https://spis.learnovoportal.com (test tenant)"
echo "    - https://learnovoportal.com/api/health (backend API)"

# --- 3. Simple log analysis script ---
echo ""
echo "[3/3] Creating log analysis script..."

cat > /var/www/learnovo/log-stats.sh << 'LOGSCRIPT'
#!/bin/bash
# Quick Nginx log analysis for Learnovo

LOG="/var/log/nginx/learnovo-access.log"

echo "=== Learnovo Log Stats ==="
echo "Date: $(date)"
echo ""

if [ ! -f "$LOG" ]; then
    echo "No log file found at $LOG"
    exit 0
fi

echo "--- Top 10 IPs (last 24h) ---"
awk -v d="$(date -d '24 hours ago' '+%d/%b/%Y')" '$4 ~ d {print $1}' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- HTTP Status Codes (last 24h) ---"
awk '{print $9}' "$LOG" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Top 10 URLs ---"
awk '{print $7}' "$LOG" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Error log (last 20 lines) ---"
tail -20 /var/log/nginx/learnovo-error.log 2>/dev/null || echo "No errors."
LOGSCRIPT

chmod +x /var/www/learnovo/log-stats.sh
chown deploy:deploy /var/www/learnovo/log-stats.sh
echo "  Log analysis script created: /var/www/learnovo/log-stats.sh"

echo ""
echo "========================================="
echo "  Monitoring Setup Complete!"
echo "========================================="
