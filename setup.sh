#!/usr/bin/env bash
set -e

echo "=== Taschengeld Setup ==="
echo ""

# Eltern-Passwort abfragen
while true; do
  read -r -s -p "Eltern-Passwort festlegen: " ADMIN_PASSWORD
  echo ""
  if [ -z "$ADMIN_PASSWORD" ]; then
    echo "Fehler: Passwort darf nicht leer sein."
    continue
  fi
  read -r -s -p "Passwort bestätigen: " ADMIN_PASSWORD_CONFIRM
  echo ""
  if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
    break
  fi
  echo "Fehler: Passwörter stimmen nicht überein. Bitte erneut versuchen."
  echo ""
done

# Session-Secret generieren
SESSION_SECRET=$(openssl rand -base64 32)

# .env schreiben
cat > .env << EOF
ADMIN_PASSWORD=$ADMIN_PASSWORD
SESSION_SECRET=$SESSION_SECRET
EOF
echo "✓ .env erstellt"

# docker-compose.yml aus Vorlage kopieren (falls noch nicht vorhanden)
if [ ! -f docker-compose.yml ]; then
  cp docker-compose.example.yml docker-compose.yml
  echo "✓ docker-compose.yml erstellt"
else
  echo "  docker-compose.yml bereits vorhanden, wird nicht überschrieben"
fi

# Datenbank-Verzeichnis anlegen
mkdir -p data
echo "✓ data/ Verzeichnis erstellt"

echo ""
echo "Setup abgeschlossen. Starten mit:"
echo ""
echo "  docker compose up -d"
echo ""
