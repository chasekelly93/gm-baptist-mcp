#!/usr/bin/env bash
# =============================================================================
# n8n Workflow Backup to GitHub
# Exports all workflows and credentials (encrypted) and pushes to a Git repo
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

BACKUP_DIR="/root/n8n-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo "[backup] Starting n8n backup — ${TIMESTAMP}"

# --- 1. Export workflows via n8n CLI inside the container ---
mkdir -p "${BACKUP_DIR}/workflows" "${BACKUP_DIR}/credentials"

# Export all workflows to a single JSON file
docker exec n8n n8n export:workflow --all --output="/home/node/.n8n/backups/workflows.json" 2>/dev/null || true

# Export all credentials (encrypted with N8N_ENCRYPTION_KEY)
docker exec n8n n8n export:credentials --all --output="/home/node/.n8n/backups/credentials.json" 2>/dev/null || true

# Copy from Docker volume to host
VOLUME_PATH=$(docker volume inspect n8n-droplet_n8n_data --format '{{ .Mountpoint }}')
if [ -f "${VOLUME_PATH}/backups/workflows.json" ]; then
  cp "${VOLUME_PATH}/backups/workflows.json" "${BACKUP_DIR}/workflows/" 2>/dev/null || true
fi
if [ -f "${VOLUME_PATH}/backups/credentials.json" ]; then
  cp "${VOLUME_PATH}/backups/credentials.json" "${BACKUP_DIR}/credentials/" 2>/dev/null || true
fi

# Also back up the entire n8n database as a fallback
if [ -f "${VOLUME_PATH}/database.sqlite" ]; then
  cp "${VOLUME_PATH}/database.sqlite" "${BACKUP_DIR}/database.sqlite" 2>/dev/null || true
fi

# --- 2. Push to GitHub ---
if [ -z "${GITHUB_BACKUP_TOKEN:-}" ] || [ -z "${GITHUB_BACKUP_REPO:-}" ]; then
  echo "[backup] GITHUB_BACKUP_TOKEN or GITHUB_BACKUP_REPO not set — skipping git push."
  echo "[backup] Local backup saved to ${BACKUP_DIR}"
  exit 0
fi

cd "${BACKUP_DIR}"

if [ ! -d .git ]; then
  git init
  git remote add origin "https://${GITHUB_BACKUP_TOKEN}@github.com/${GITHUB_BACKUP_REPO}.git"
  # Pull existing content from remote first
  git fetch origin main 2>/dev/null && git checkout main 2>/dev/null || git checkout -b main
fi

git add -A
git commit -m "backup: ${TIMESTAMP}" || { echo "[backup] No changes to commit."; exit 0; }
git push -u origin main || echo "[backup] Push failed — check token/repo permissions."

echo "[backup] Complete — ${TIMESTAMP}"
