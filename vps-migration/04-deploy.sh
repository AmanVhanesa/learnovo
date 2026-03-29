#!/bin/bash
set -e

# =============================================================================
# Learnovo Frontend — Zero-Downtime Deployment
# Location on VPS: /var/www/learnovo/deploy.sh
# =============================================================================

REPO_DIR="/var/www/learnovo/frontend-repo"
FRONTEND_DIR="$REPO_DIR/learnovo-frontend"
RELEASES_DIR="/var/www/learnovo/releases"
CURRENT_LINK="/var/www/learnovo/frontend/current"
RELEASE_NAME="release-$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
MAX_RELEASES=5
LOG_FILE="/var/www/learnovo/deploy.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Deploying Learnovo Frontend..."
log "========================================="

# Pull latest code
log "Pulling latest code..."
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

# Navigate to frontend within monorepo
cd "$FRONTEND_DIR"

# Install dependencies
log "Installing dependencies..."
npm ci --production=false

# Build
log "Building production bundle..."
npm run build

# Verify build output
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    log "ERROR: Build failed — dist/index.html not found!"
    exit 1
fi

# Create release
log "Creating release: $RELEASE_NAME"
mkdir -p "$RELEASE_DIR"
cp -r dist/* "$RELEASE_DIR/"

# Switch symlink (atomic operation)
log "Switching symlink to new release..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# Verify symlink
if [ ! -f "$CURRENT_LINK/index.html" ]; then
    log "ERROR: Symlink verification failed!"
    exit 1
fi

# Clean old releases (keep last N)
log "Cleaning old releases (keeping last $MAX_RELEASES)..."
cd "$RELEASES_DIR"
ls -dt release-*/ 2>/dev/null | tail -n +$((MAX_RELEASES + 1)) | xargs rm -rf 2>/dev/null || true

# Show current releases
log "Current releases:"
ls -dt release-*/ 2>/dev/null | head -5 | while read dir; do
    if [ "$(readlink -f "$CURRENT_LINK")" = "$(readlink -f "$RELEASES_DIR/$dir")" ]; then
        log "  -> $dir (ACTIVE)"
    else
        log "     $dir"
    fi
done

log "========================================="
log "Deployed successfully: $RELEASE_NAME"
log "========================================="
