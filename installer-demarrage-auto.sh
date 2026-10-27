#!/usr/bin/env bash
# Aurel School Compta — démarrage automatique (Linux, systemd utilisateur)
cd "$(dirname "$0")"
PORT="${1:-4000}"
APPDIR="$(pwd)"
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/aurel.service <<UNIT
[Unit]
Description=Aurel School Compta (PHP)
After=network.target

[Service]
WorkingDirectory=$APPDIR
ExecStart=/usr/bin/env php -d post_max_size=24M -d upload_max_filesize=24M -S 0.0.0.0:$PORT $APPDIR/router.php
Restart=always

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload 2>/dev/null
if systemctl --user enable --now aurel.service 2>/dev/null; then
  echo "[OK] Service installé : http://localhost:$PORT"
  echo "     Démarre avec votre session, redémarre en cas de crash."
  echo "     Retrait : bash retirer-demarrage-auto.sh"
else
  echo "[INFO] systemd utilisateur indisponible — ajout au démarrage via ~/.profile"
  grep -q "Aurel School Compta" ~/.profile 2>/dev/null || echo "cd '$APPDIR' && php -d post_max_size=24M -d upload_max_filesize=24M -S 0.0.0.0:$PORT router.php & # Aurel School Compta" >> ~/.profile
  echo "[OK] Ajouté à ~/.profile (prise en compte à la prochaine connexion)."
fi
