#!/bin/bash
set -e

# =============================================================================
# Learnovo Frontend — Rollback to Previous Release
# Location on VPS: /var/www/learnovo/rollback.sh
# =============================================================================

RELEASES_DIR="/var/www/learnovo/releases"
CURRENT_LINK="/var/www/learnovo/frontend/current"

CURRENT=$(readlink -f "$CURRENT_LINK" 2>/dev/null)
CURRENT_NAME=$(basename "$CURRENT" 2>/dev/null)

echo "========================================="
echo "  Learnovo Frontend Rollback"
echo "========================================="
echo ""

# List available releases
echo "Available releases:"
INDEX=0
declare -a RELEASES
while IFS= read -r dir; do
    INDEX=$((INDEX + 1))
    RELEASE_PATH="$RELEASES_DIR/$dir"
    RELEASES[$INDEX]="$RELEASE_PATH"
    if [ "$(readlink -f "$RELEASE_PATH")" = "$CURRENT" ]; then
        echo "  $INDEX. $dir (ACTIVE)"
    else
        echo "  $INDEX. $dir"
    fi
done < <(ls -dt "$RELEASES_DIR"/release-*/ 2>/dev/null | xargs -I{} basename {})

if [ $INDEX -lt 2 ]; then
    echo ""
    echo "ERROR: No previous release found to rollback to."
    exit 1
fi

# Get previous release (2nd newest)
PREVIOUS=$(ls -dt "$RELEASES_DIR"/release-*/ | sed -n '2p' | sed 's/\/$//')

if [ -z "$PREVIOUS" ]; then
    echo ""
    echo "ERROR: No previous release found."
    exit 1
fi

echo ""
echo "Rolling back..."
echo "  Current:    $CURRENT_NAME"
echo "  Rolling to: $(basename "$PREVIOUS")"
echo ""

# Switch symlink
ln -sfn "$PREVIOUS" "$CURRENT_LINK"

# Verify
if [ -f "$CURRENT_LINK/index.html" ]; then
    echo "Rollback complete!"
    echo "Active release: $(basename "$(readlink -f "$CURRENT_LINK")")"
else
    echo "ERROR: Rollback verification failed!"
    exit 1
fi
