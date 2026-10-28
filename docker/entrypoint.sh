#!/bin/sh
# Démarrage du conteneur : port imposé par Render, config.php recréé depuis
# les variables d'environnement (le disque est effacé à chaque déploiement).
set -e

PORT="${PORT:-10000}"
sed -ri "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

php /usr/local/bin/siges-config.php

exec apache2-foreground
