#!/bin/bash
# ============================================================
#  deploy.sh — Smart Rescuer Ring  |  Hostinger VPS Deployment
# ============================================================
# Usage:
#   chmod +x deploy.sh      (first time only)
#   ./deploy.sh
#
# What it does:
#   1. Pull latest code from git
#   2. Install / update Node dependencies
#   3. Compile the Express server to server_dist/
#   4. Gracefully reload PM2 (zero-downtime if cluster mode)
#   5. Save PM2 process list so it survives reboots
# ============================================================

set -e          # abort on any error
set -o pipefail # catch errors inside pipes

# ── Config ───────────────────────────────────────────────────
APP_DIR="/var/www/smart-rescuer-ring"   # <-- change to your actual project path on the VPS
APP_NAME="smart-rescuer-ring"           # must match the `name` field in ecosystem.config.js
LOGS_DIR="$APP_DIR/logs"
NODE_ENV="production"

echo ""
echo "=========================================="
echo "  🚑 Smart Rescuer Ring — Deploying..."
echo "=========================================="
echo ""

# ── 1. Navigate to project ───────────────────────────────────
cd "$APP_DIR"

# ── 2. Pull latest code ──────────────────────────────────────
echo "📥  Pulling latest code from git..."
git pull origin main

# ── 3. Install dependencies ──────────────────────────────────
echo ""
echo "📦  Installing dependencies..."
npm install --omit=dev --legacy-peer-deps

# ── 4. Build the server bundle ───────────────────────────────
echo ""
echo "🔨  Compiling Express server..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=server_dist

# ── 5. Ensure logs directory exists ──────────────────────────
mkdir -p "$LOGS_DIR"

# ── 6. Reload / Start PM2 ────────────────────────────────────
echo ""
echo "♻️   Reloading PM2 process..."

if pm2 list | grep -q "$APP_NAME"; then
  # Already running — do a graceful reload (no downtime)
  pm2 reload "$APP_NAME" --update-env
else
  # First time — start from ecosystem file
  pm2 start ecosystem.config.js
fi

# ── 7. Persist PM2 process list ──────────────────────────────
pm2 save

echo ""
echo "=========================================="
echo "  ✅  Deployment complete!"
echo "  Server : http://$(curl -s ifconfig.me):5000"
echo "  PM2    : pm2 logs $APP_NAME"
echo "=========================================="
