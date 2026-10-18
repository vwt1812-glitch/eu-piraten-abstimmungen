#!/usr/bin/env bash
# Einrichtung auf dem Raspberry Pi (Raspberry Pi OS Lite 64-bit). Aufruf im Projektordner: bash pi/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
VERZEICHNIS="$PWD"
BENUTZER="$(id -un)"

echo "== Pakete (git, Chromium, Schriften)"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates fonts-dejavu-core
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
CHROMIUM="$(command -v chromium || command -v chromium-browser)"

echo "== Node.js 22"
if ! node --version 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "== Abhängigkeiten"
# Playwright nutzt das Chromium aus apt, ein eigener Browser-Download ist nicht nötig.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

echo "== Zugangsdaten"
if [ ! -f /etc/eu-piraten.env ]; then
  sed "s#^CHROMIUM_PATH=.*#CHROMIUM_PATH=$CHROMIUM#" pi/umgebung.beispiel | sudo install -m 600 /dev/stdin /etc/eu-piraten.env
  echo "Angelegt: /etc/eu-piraten.env – bitte ausfüllen: sudo nano /etc/eu-piraten.env"
else
  echo "/etc/eu-piraten.env existiert schon – bleibt unverändert."
fi

echo "== Dienst"
sed "s#@VERZEICHNIS@#$VERZEICHNIS#g; s#@BENUTZER@#$BENUTZER#g; s#@NODE@#$(command -v node)#g" pi/eu-piraten.service \
  | sudo tee /etc/systemd/system/eu-piraten.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable eu-piraten

cat <<TEXT

Fertig. Nächste Schritte:
  1. sudo nano /etc/eu-piraten.env          (Postiz und Telegram eintragen)
  2. sudo systemctl start eu-piraten
  3. journalctl -u eu-piraten -f            (Protokoll ansehen)
TEXT
