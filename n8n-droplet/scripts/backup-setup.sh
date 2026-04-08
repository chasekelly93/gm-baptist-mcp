#!/usr/bin/env bash
# =============================================================================
# Sets up a daily cron job for n8n workflow backups
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

chmod +x "${SCRIPT_DIR}/backup.sh"

# Create backup directories inside the n8n container
docker exec n8n mkdir -p /home/node/.n8n/backups/workflows /home/node/.n8n/backups/credentials 2>/dev/null || true

# Install git if not present
apt-get install -y git > /dev/null 2>&1

# Add cron job — runs daily at 2 AM ET
CRON_LINE="0 2 * * * ${SCRIPT_DIR}/backup.sh >> /var/log/n8n-backup.log 2>&1"

# Avoid duplicating the cron entry
(crontab -l 2>/dev/null | grep -v "n8n-backups\|backup.sh" ; echo "${CRON_LINE}") | crontab -

echo "Backup cron job installed:"
echo "  Schedule: Daily at 2:00 AM (server time)"
echo "  Log:      /var/log/n8n-backup.log"
echo ""
echo "To test immediately:  ${SCRIPT_DIR}/backup.sh"
echo "To view cron jobs:    crontab -l"
