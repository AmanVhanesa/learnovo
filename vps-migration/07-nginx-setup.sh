#!/bin/bash
set -e

# =============================================================================
# Learnovo Nginx Setup — Phase 4
# Run as root on VPS
# =============================================================================

NGINX_CONF="/etc/nginx/sites-available/learnovo"
NGINX_ENABLED="/etc/nginx/sites-enabled/learnovo"

echo "========================================="
echo "  Learnovo Nginx Setup"
echo "========================================="

# Check if existing config exists
if [ -f "$NGINX_CONF" ]; then
    echo ""
    echo "WARNING: Existing Nginx config found at $NGINX_CONF"
    echo "Backing up to ${NGINX_CONF}.backup.$(date +%Y%m%d)"
    cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d)"
fi

# Check for existing backend config
echo ""
echo "--- Existing Nginx configs ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
echo ""

# Check if there's a separate api.learnovoportal.com config
if grep -r "api.learnovoportal.com" /etc/nginx/sites-available/ 2>/dev/null; then
    echo "WARNING: Found existing config for api.learnovoportal.com"
    echo "The new config proxies /api/ to localhost:5000 on the main domain."
    echo "You may want to keep the api subdomain config for backward compatibility,"
    echo "or remove it once the proxy is confirmed working."
    echo ""
fi

# Copy the config
echo "Installing Nginx config..."
# The config file should already be copied to VPS from 02-nginx-learnovo.conf
if [ -f "/tmp/learnovo-nginx.conf" ]; then
    cp /tmp/learnovo-nginx.conf "$NGINX_CONF"
else
    echo "ERROR: Copy 02-nginx-learnovo.conf to /tmp/learnovo-nginx.conf first:"
    echo "  scp vps-migration/02-nginx-learnovo.conf root@157.173.219.189:/tmp/learnovo-nginx.conf"
    exit 1
fi

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Enable the config
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Test config
echo ""
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "Nginx config is valid! Reloading..."
    systemctl reload nginx
    echo "Nginx reloaded successfully."
else
    echo ""
    echo "ERROR: Nginx config test failed! Check the errors above."
    echo "Reverting to backup..."
    if [ -f "${NGINX_CONF}.backup."* ]; then
        cp "${NGINX_CONF}.backup."* "$NGINX_CONF"
        nginx -t && systemctl reload nginx
    fi
    exit 1
fi

echo ""
echo "========================================="
echo "  Nginx Setup Complete!"
echo "========================================="
echo ""
echo "NOTE: SSL certificate is required before HTTPS will work."
echo "Run 03-ssl-setup.sh next."
echo ""
