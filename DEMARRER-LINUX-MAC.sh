#!/usr/bin/env bash
# Aurel School Compta — Collège Bonneau (PHP) — serveur local intégré
# Usage : bash DEMARRER-LINUX-MAC.sh [port]   (défaut : 4000)
cd "$(dirname "$0")"
PORT="${1:-4000}"
echo "=================================================="
echo "   AUREL SCHOOL COMPTA — COLLÈGE BONNEAU (PHP)"
echo "   Gestion des frais de scolarité — v1.8"
echo "=================================================="
if ! command -v php >/dev/null 2>&1; then
  echo "[ERREUR] PHP n'est pas installé."
  echo "   Installez PHP 7.0+ (paquet php-cli) puis relancez."
  exit 1
fi
echo "PHP détecté : $(php -r 'echo PHP_VERSION;')"
[ -f config.php ] || echo "Première utilisation : ouvrez http://localhost:$PORT/install.php"
( sleep 2
  if command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:$PORT >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then open http://localhost:$PORT
  fi ) &
echo "Serveur : http://localhost:$PORT (Ctrl+C pour arrêter)"
echo "Réseau : http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT depuis les autres postes"
exec php -d post_max_size=24M -d upload_max_filesize=24M -S 0.0.0.0:$PORT router.php
