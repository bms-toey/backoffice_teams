#!/bin/bash
# ──────────────────────────────────────────────────────
# 01-setup-pocketbase.sh
# ติดตั้ง PocketBase บน Linux + ตั้ง systemd service
# รัน: bash 01-setup-pocketbase.sh
# ──────────────────────────────────────────────────────
set -e

PB_VERSION="0.22.14"
PB_DIR="/opt/pocketbase"
PB_DATA_DIR="/opt/pocketbase/pb_data"
PB_USER="pocketbase"
ARCH="amd64"

echo "======================================================"
echo " ติดตั้ง PocketBase v${PB_VERSION} บน Linux"
echo "======================================================"

# สร้าง user สำหรับรัน service
if ! id "$PB_USER" &>/dev/null; then
  sudo useradd --system --no-create-home --shell /bin/false $PB_USER
  echo "[OK] สร้าง system user: $PB_USER"
fi

# สร้างโฟลเดอร์
sudo mkdir -p $PB_DIR $PB_DATA_DIR
echo "[OK] สร้างโฟลเดอร์: $PB_DIR"

# ดาวน์โหลด PocketBase
DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
echo "กำลังดาวน์โหลด PocketBase จาก GitHub..."
cd /tmp
wget -q --show-progress "$DOWNLOAD_URL" -O pocketbase.zip

# แตกไฟล์
unzip -o pocketbase.zip pocketbase -d $PB_DIR
rm pocketbase.zip
sudo chmod +x $PB_DIR/pocketbase
sudo chown -R $PB_USER:$PB_USER $PB_DIR
echo "[OK] ติดตั้ง PocketBase สำเร็จ"

# สร้าง systemd service
sudo tee /etc/systemd/system/pocketbase.service > /dev/null << EOF
[Unit]
Description=PocketBase - Self-hosted Backend
After=network.target
Documentation=https://pocketbase.io/docs

[Service]
Type=simple
User=$PB_USER
Group=$PB_USER
WorkingDirectory=$PB_DIR
ExecStart=$PB_DIR/pocketbase serve --http=0.0.0.0:8090 --dir=$PB_DATA_DIR
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pocketbase

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$PB_DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "[OK] สร้าง systemd service"

# เปิด service
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase

sleep 2

# ตรวจสอบ
if systemctl is-active --quiet pocketbase; then
  echo ""
  echo "======================================================"
  echo " PocketBase รันสำเร็จแล้ว!"
  echo "======================================================"
  echo ""
  echo " URL       : http://$(hostname -I | awk '{print $1}'):8090"
  echo " Admin UI  : http://$(hostname -I | awk '{print $1}'):8090/_/"
  echo " Data dir  : $PB_DATA_DIR"
  echo ""
  echo " ขั้นตอนถัดไป:"
  echo "  1. เปิดบราวเซอร์ไปที่ Admin UI"
  echo "  2. สร้าง admin account ครั้งแรก"
  echo "  3. จดจำ email + password ไว้สำหรับ migration script"
  echo "  4. รัน: node 02-migrate-firestore-to-pb.js"
  echo ""
else
  echo "[ERROR] PocketBase ไม่สามารถรันได้"
  sudo journalctl -u pocketbase -n 20
  exit 1
fi
