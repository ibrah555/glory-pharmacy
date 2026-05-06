#!/bin/bash
# ==============================================
# Glory Pharmacy - EC2 Server Setup Script
# Run this script on a fresh Amazon Linux 2 / Ubuntu EC2 instance
# ==============================================

set -e

echo "=========================================="
echo "  Glory Pharmacy - EC2 Setup"
echo "=========================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
fi

echo "[1/6] Installing Node.js 20..."
if [ "$OS" = "amzn" ]; then
    # Amazon Linux 2
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs git
elif [ "$OS" = "ubuntu" ]; then
    # Ubuntu
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs git
fi

echo "[2/6] Installing PM2..."
sudo npm install -g pm2

echo "[3/6] Installing Nginx..."
if [ "$OS" = "amzn" ]; then
    sudo amazon-linux-extras install nginx1 -y || sudo yum install -y nginx
elif [ "$OS" = "ubuntu" ]; then
    sudo apt-get install -y nginx
fi

echo "[4/6] Setting up project directory..."
mkdir -p ~/glory-pharmacy/logs

echo "[5/6] Configuring Nginx..."
sudo cp ~/glory-pharmacy/deploy/nginx.conf /etc/nginx/conf.d/glory-pharmacy.conf
# Remove default nginx config if it conflicts
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "[6/6] Starting application with PM2..."
cd ~/glory-pharmacy/backend
npm install --production
cd ~/glory-pharmacy/frontend
npm install
npm run build
cd ~/glory-pharmacy
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "  Your app should be running at:"
echo "  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo ""
echo "  Useful commands:"
echo "    pm2 status          - Check app status"
echo "    pm2 logs            - View logs"
echo "    pm2 restart all     - Restart the app"
echo ""
