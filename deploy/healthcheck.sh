#!/bin/bash
# Monitoring basique — vérification que l'API répond
# Cron suggéré : */5 * * * * /var/www/cuistot_fute/deploy/healthcheck.sh
# (toutes les 5 minutes)

API_URL="http://127.0.0.1:3003/api/health"
LOG_FILE="/var/log/pm2/cuistot-healthcheck.log"
MAX_LOG_LINES=500

response=$(curl -sf --max-time 10 "$API_URL" 2>/dev/null)
status=$?

if [ $status -ne 0 ] || ! echo "$response" | grep -q '"status":"ok"'; then
    echo "[$(date)] ✗ API DOWN — redémarrage PM2" >> "$LOG_FILE"
    pm2 restart cuistot-api
else
    echo "[$(date)] ✓ OK" >> "$LOG_FILE"
fi

# Rotation du log (garde les dernières MAX_LOG_LINES lignes)
tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
