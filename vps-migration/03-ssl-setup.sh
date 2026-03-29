#!/bin/bash
set -e

# =============================================================================
# Learnovo SSL Setup — Wildcard Certificate
# Run as root on VPS after Nginx is configured
# =============================================================================

DOMAIN="learnovoportal.com"

echo "========================================="
echo "  Learnovo SSL Setup"
echo "========================================="
echo ""
echo "You need a wildcard SSL cert for: $DOMAIN + *.$DOMAIN"
echo ""

# Check if Cloudflare credentials exist
if [ -f /etc/letsencrypt/cloudflare.ini ]; then
    echo "Cloudflare credentials found. Requesting wildcard cert..."
    certbot certonly --dns-cloudflare \
        --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
        -d "$DOMAIN" -d "*.$DOMAIN" \
        --preferred-challenges dns-01 \
        --non-interactive \
        --agree-tos \
        --email admin@$DOMAIN
else
    echo "=== OPTION A: Cloudflare DNS (Recommended) ==="
    echo ""
    echo "1. Create a Cloudflare API token at: https://dash.cloudflare.com/profile/api-tokens"
    echo "   - Permissions: Zone > DNS > Edit"
    echo "   - Zone Resources: Include > Specific zone > $DOMAIN"
    echo ""
    echo "2. Create the credentials file:"
    echo "   sudo mkdir -p /etc/letsencrypt"
    echo "   sudo nano /etc/letsencrypt/cloudflare.ini"
    echo ""
    echo "   Add this line:"
    echo "   dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN"
    echo ""
    echo "   Then secure it:"
    echo "   sudo chmod 600 /etc/letsencrypt/cloudflare.ini"
    echo ""
    echo "3. Re-run this script."
    echo ""
    echo "=== OPTION B: Manual DNS Challenge ==="
    echo ""
    echo "If you don't use Cloudflare, run this manually:"
    echo ""
    echo "  sudo certbot certonly --manual \\"
    echo "    -d \"$DOMAIN\" -d \"*.$DOMAIN\" \\"
    echo "    --preferred-challenges dns-01 \\"
    echo "    --agree-tos --email admin@$DOMAIN"
    echo ""
    echo "  Certbot will ask you to create a TXT record at:"
    echo "    _acme-challenge.$DOMAIN"
    echo "  Add it in your DNS provider, wait 2 min, then press Enter."
    echo ""
    echo "  NOTE: Manual certs don't auto-renew. You'll need to repeat"
    echo "  this every 90 days or switch to Cloudflare DNS plugin."
    echo ""
fi

# Test auto-renewal
echo ""
echo "Testing auto-renewal (dry run)..."
certbot renew --dry-run 2>/dev/null && echo "Auto-renewal is working!" || echo "Auto-renewal not yet configured (run after getting cert)."

echo ""
echo "After SSL is set up, reload Nginx:"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
