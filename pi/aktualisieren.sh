#!/usr/bin/env bash
# Neuen Code von GitHub holen und Dienst neu starten: bash pi/aktualisieren.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
# Code der Auswertung kann sich geändert haben.
if [ -f cache/last_updated.txt ]; then node scripts/auswerten.mjs --immer; fi
sudo systemctl restart eu-piraten
echo "Aktualisiert und neu gestartet."
