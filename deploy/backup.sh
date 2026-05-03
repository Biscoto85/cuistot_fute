#!/bin/bash
# Backup automatique PostgreSQL — Cuistot Futé
# Cron suggéré : 0 3 * * * /var/www/cuistot_fute/deploy/backup.sh
# (tous les jours à 3h du matin, cohérent avec PairsForm)

set -e

DB_NAME="cuistot"
DB_USER="cuistot"
BACKUP_DIR="/var/backups/cuistot"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump compressé
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup créé : $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Purge des backups plus vieux que RETENTION_DAYS jours
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Purge : fichiers > ${RETENTION_DAYS}j supprimés"

# Vérification : au moins 1 fichier récent (< 25h)
RECENT=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime -1 | wc -l)
if [ "$RECENT" -eq 0 ]; then
    echo "[$(date)] ERREUR : aucun backup récent trouvé" >&2
    exit 1
fi
