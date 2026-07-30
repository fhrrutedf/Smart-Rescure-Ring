#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  deploy-hostinger.sh — PulseRing VPS Setup & Deploy Script
#  Hostinger Ubuntu VPS  |  Internal Port: 8741
#  Run this ONCE on the server to set everything up.
# ═══════════════════════════════════════════════════════════════
# Usage:
#   chmod +x deploy-hostinger.sh
#   ./deploy-hostinger.sh
# ═══════════════════════════════════════════════════════════════

set -e  # Stop on any error

APP_DIR="/var/www/pulsering"
APP_PORT=8741
REPO_URL="https://github.com/fhrrutedf/Smart-Rescure-Ring.git"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🚑 PulseRing — Hostinger VPS Deployer      ║"
echo "║   Internal Port: $APP_PORT                      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Install Node.js 20 ────────────────────────────────
echo "📦 [1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
echo "✅ Node.js installed"

# ─── Step 2: Install PM2 globally ──────────────────────────────
echo ""
echo "📦 [2/7] Installing PM2..."
sudo npm install -g pm2
echo "✅ PM2 installed"

# ─── Step 3: Install Nginx ─────────────────────────────────────
echo ""
echo "📦 [3/7] Installing Nginx..."
sudo apt-get install -y nginx
echo "✅ Nginx installed"

# ─── Step 4: Clone or update the repo ─────────────────────────
echo ""
echo "📁 [4/7] Setting up application directory..."
if [ -d "$APP_DIR" ]; then
  echo "→ Directory exists, pulling latest changes..."
  cd "$APP_DIR"
  git pull origin main
else
  echo "→ Cloning repository..."
  sudo mkdir -p "$APP_DIR"
  sudo chown $USER:$USER "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
echo "✅ Code is up to date"

# ─── Step 5: Install dependencies & build ─────────────────────
echo ""
echo "🔨 [5/7] Installing dependencies and building..."
cd "$APP_DIR"
npm install --production=false

# Build the server
npm run server:build
echo "✅ Server built → server_dist/index.js"

# ─── Step 6: Create .env if missing ───────────────────────────
echo ""
echo "⚙️  [6/7] Checking .env file..."
if [ ! -f "$APP_DIR/.env" ]; then
  echo "⚠️  .env not found — creating from .env.example..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  ❗ IMPORTANT: Edit .env before continuing!"
  echo "     nano $APP_DIR/.env"
  echo ""
  echo "  Required values to fill in:"
  echo "    GEMINI_API_KEY=..."
  echo "    ELEVENLABS_API_KEY=..."
  echo "    ELEVENLABS_VOICE_ID=..."
  echo "    EXPO_PUBLIC_API_URL=https://yourdomain.com"
  echo "    PORT=8741"
  echo "════════════════════════════════════════════════════"
  echo ""
  read -p "Press ENTER after you've filled in .env to continue..."
else
  echo "✅ .env file exists"
fi

# ─── Step 7: Configure Nginx ──────────────────────────────────
echo ""
echo "🌐 [7/7] Configuring Nginx..."
sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/pulsering
sudo ln -sf /etc/nginx/sites-available/pulsering /etc/nginx/sites-enabled/pulsering
sudo rm -f /etc/nginx/sites-enabled/default

if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "✅ Nginx configured and reloaded"
else
  echo "❌ Nginx config error — please check nginx.conf"
  exit 1
fi

# ─── Start / Restart with PM2 ─────────────────────────────────
echo ""
echo "🚀 Starting PulseRing with PM2..."
cd "$APP_DIR"

# Stop existing instance if running
pm2 stop pulsering 2>/dev/null || true
pm2 delete pulsering 2>/dev/null || true

# Start fresh
PORT=$APP_PORT pm2 start server_dist/index.js \
  --name pulsering \
  --env production \
  --max-memory-restart 400M

pm2 save
pm2 startup | tail -1 | sudo bash  2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ PulseRing is LIVE!                       ║"
echo "╠══════════════════════════════════════════════╣"
echo "║   Internal:  http://localhost:$APP_PORT          ║"
echo "║   Public:    http://YOUR_VPS_IP               ║"
echo "║   Health:    http://YOUR_VPS_IP/api/health    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "📋 Useful commands:"
echo "   pm2 logs pulsering       — view live logs"
echo "   pm2 status               — check app status"
echo "   pm2 restart pulsering    — restart app"
echo "   sudo nginx -t            — test nginx config"
