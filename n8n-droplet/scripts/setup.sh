#!/usr/bin/env bash
# =============================================================================
# n8n Droplet Setup Script
# Run on a fresh Ubuntu 24.04 LTS DigitalOcean Droplet
#
# Usage:
#   1. scp this entire n8n-droplet/ folder to your Droplet
#   2. ssh into the Droplet
#   3. cd /root/n8n-droplet
#   4. cp .env.example .env && nano .env   # fill in your values
#   5. chmod +x scripts/setup.sh && sudo ./scripts/setup.sh
# =============================================================================
set -euo pipefail

# --- Load .env ---
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in your values."
  exit 1
fi
source .env

echo "============================================"
echo "  n8n Droplet Setup — $(date)"
echo "============================================"

# --- 1. System updates + swap ---
echo ""
echo "[1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# Add 2GB swap for stability on smaller Droplets
if [ ! -f /swapfile ]; then
  echo "  Creating 2GB swap file..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  Swap enabled."
else
  echo "  Swap already exists."
fi

# --- 2. Install Docker ---
echo ""
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  echo "  Docker installed: $(docker --version)"
else
  echo "  Docker already installed: $(docker --version)"
fi

# --- 3. Install Nginx ---
echo ""
echo "[3/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# --- 4. Configure Nginx ---
echo ""
echo "[4/8] Configuring Nginx reverse proxy..."
cp nginx/n8n.conf /etc/nginx/sites-available/n8n.conf
ln -sf /etc/nginx/sites-available/n8n.conf /etc/nginx/sites-enabled/n8n.conf
rm -f /etc/nginx/sites-enabled/default

# Temporarily use HTTP-only config for Certbot challenge
cat > /etc/nginx/sites-available/n8n.conf <<TEMPNGINX
server {
    listen 80;
    server_name ${N8N_HOST};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
TEMPNGINX

mkdir -p /var/www/certbot
nginx -t && systemctl restart nginx

# --- 5. SSL with Certbot ---
echo ""
echo "[5/8] Setting up Let's Encrypt SSL..."
apt-get install -y certbot python3-certbot-nginx

echo "  Requesting certificate for ${N8N_HOST}..."
certbot --nginx -d "${N8N_HOST}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect

# --- 6. Install full Nginx proxy config ---
echo ""
echo "[6/8] Writing final Nginx proxy config..."
# Replace the placeholder domain in our template with the actual N8N_HOST
sed "s/n8n.gmbaptistoutreach.com/${N8N_HOST}/g" nginx/n8n.conf > /etc/nginx/sites-available/n8n.conf
nginx -t && systemctl reload nginx

# Set up auto-renewal
systemctl enable certbot.timer
echo "  SSL certificate installed and auto-renewal enabled."

# --- 7. Configure firewall ---
echo ""
echo "[7/8] Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
# Block direct access to n8n port — force traffic through Nginx
ufw deny 5678
echo "y" | ufw enable
ufw status

# --- 8. Start n8n ---
echo ""
echo "[8/8] Starting n8n with Docker Compose..."
docker compose up -d

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  n8n URL:    https://${N8N_HOST}"
echo "  Username:   ${N8N_BASIC_AUTH_USER}"
echo ""
echo "  Check status:  docker compose ps"
echo "  View logs:     docker compose logs -f n8n"
echo ""
echo "  NEXT STEPS:"
echo "  1. Verify https://${N8N_HOST} loads in your browser"
echo "  2. Change the basic auth password if you haven't already"
echo "  3. Set up the backup cron job: sudo ./scripts/backup-setup.sh"
echo "============================================"
