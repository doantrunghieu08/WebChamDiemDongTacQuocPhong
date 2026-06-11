#!/bin/bash
# ============================================
#  Deploy Frontend — HACTECH Grading System
#  Chạy script này trên máy local (Windows dùng Git Bash)
#  Yêu cầu: ssh key đã được cấu hình truy cập VPS
# ============================================

VPS_IP="103.75.182.246"
VPS_USER="root"           # đổi nếu dùng user khác
REMOTE_DIR="/var/www/hactech"
NGINX_CONF="/etc/nginx/sites-available/hactech"

echo "==> Tạo thư mục trên VPS..."
ssh ${VPS_USER}@${VPS_IP} "mkdir -p ${REMOTE_DIR}"

echo "==> Upload files frontend lên VPS..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.vscode' \
  --exclude='nginx.conf' \
  --exclude='deploy.sh' \
  ./ ${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/

echo "==> Cài Nginx nếu chưa có..."
ssh ${VPS_USER}@${VPS_IP} "apt-get install -y nginx 2>/dev/null || yum install -y nginx 2>/dev/null"

echo "==> Copy Nginx config..."
scp nginx.conf ${VPS_USER}@${VPS_IP}:${NGINX_CONF}

echo "==> Tạo cấu hình ẩn cho Token..."
if [ -f .env ]; then
  source .env
  echo "proxy_set_header Authorization \"Bearer ${RUNPOD_API_KEY}\";" > runpod_token.conf
else
  echo "proxy_set_header Authorization \"Bearer \";" > runpod_token.conf
fi
scp runpod_token.conf ${VPS_USER}@${VPS_IP}:/etc/nginx/runpod_token.conf
rm runpod_token.conf

echo "==> Kích hoạt site và reload Nginx..."
ssh ${VPS_USER}@${VPS_IP} "
  ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/hactech 2>/dev/null || true
  nginx -t && systemctl reload nginx
"

echo ""
echo "✅ Deploy hoàn thành! Truy cập: http://${VPS_IP}"
