# Aurel School SIGES — image PHP + Apache (hébergement Render ou tout hôte Docker).
# La base MySQL est externe : voir render.yaml et la section « Render » du README.
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite headers \
 && printf '<Directory /var/www/html>\n  AllowOverride All\n</Directory>\n' > /etc/apache2/conf-enabled/siges.conf

COPY . /var/www/html/
RUN mv /var/www/html/docker/entrypoint.sh /usr/local/bin/siges-entrypoint \
 && mv /var/www/html/docker/siges-config.php /usr/local/bin/siges-config.php \
 && rm -rf /var/www/html/docker \
 && chmod +x /usr/local/bin/siges-entrypoint \
 && mkdir -p /var/www/html/data \
 && chown -R www-data:www-data /var/www/html

CMD ["siges-entrypoint"]
