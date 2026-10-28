<?php
/* ================================================================
   Aurel School SIGES — routeur pour le serveur PHP intégré
   Utilisation :  php -S 0.0.0.0:4000 router.php
   (les lanceurs DEMARRER-*.bat/.sh passent cette commande pour vous)
   ================================================================ */
/* En-têtes de sécurité (déploiement internet) */
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
/* v5.6 : contenu strictement limité à l'application (anti-XSS) */
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

/* API → index.php (le client appelle api/health, api/db, … relativement à la page) */
if (preg_match('#(^|/)api(/|$)#', $uri) || $uri === '/api'){
  require __DIR__ . '/api/index.php';
  return true;
}

/* Fichiers et dossiers sensibles — jamais servis */
/* Insensible à la casse (Windows ne distingue pas DATA de data), tout
   élément caché (.git, .env, .htaccess…) refusé, et seuls les fichiers de
   l'interface sont servis : aucune donnée, source, sauvegarde ni script. */
$segments = explode('/', trim(str_replace('\\', '/', $uri), '/'));
$cache = false;
foreach ($segments as $sg){ if ($sg !== '' && $sg[0] === '.') $cache = true; }
if ($cache
  || preg_match('#^/(data|seed|src|tests|docs|scripts|node_modules|dist|api)(/|$)#i', $uri)
  || (preg_match('#\.(php|json|sql|log|md|lock|zip|bat|sh|cmd|mjs|cjs|txt|ini|db|bak|old|tmp|docx|pdf)$#i', $uri)
      && !preg_match('#^/install\.php$#i', $uri))){
  http_response_code(403);
  exit('Accès interdit.');
}

/* Fichiers statiques de l'application (assets, images, favicon…) */
if ($uri !== '/' && $uri !== '' ){
  $f = __DIR__ . $uri;
  /* pas de remontée hors du projet */
  if (strpos(realpath(dirname($f)) ?: '', __DIR__) === 0 && is_file($f)){
    return false;   /* le serveur intégré sert le fichier tel quel */
  }
}

/* Page applicative (SPA React) */
require __DIR__ . '/index.html';
