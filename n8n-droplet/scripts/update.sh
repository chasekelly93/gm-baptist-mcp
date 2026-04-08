#!/usr/bin/env bash
# =============================================================================
# Update n8n to the latest version
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

echo "[update] Backing up before update..."
./scripts/backup.sh || echo "[update] Backup skipped (run backup-setup.sh first)"

echo "[update] Pulling latest n8n image..."
docker compose pull

echo "[update] Restarting n8n..."
docker compose down
docker compose up -d

echo "[update] Waiting for n8n to become healthy..."
sleep 10
docker compose ps

echo "[update] Done. Check https://$(grep N8N_HOST .env | cut -d= -f2)"
