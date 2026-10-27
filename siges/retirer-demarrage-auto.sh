#!/usr/bin/env bash
systemctl --user disable --now aurel.service 2>/dev/null
rm -f ~/.config/systemd/user/aurel.service
systemctl --user daemon-reload 2>/dev/null
sed -i '/Aurel School Compta/d' ~/.profile 2>/dev/null
echo "[OK] Démarrage automatique retiré."
