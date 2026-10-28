<?php
/* Génère config.php depuis les variables d'environnement au démarrage du
   conteneur. Tant que la base ne contient aucun compte, config.php n'est pas
   écrit : install.php reste disponible pour la première installation.
   Si MySQL ne répond pas, config.php est écrit quand même, pour ne jamais
   rouvrir l'installateur sur une base déjà en service. */
require '/var/www/html/api/lib.php';

$secret = (string)getenv('SIGES_SECRET');
$host = (string)getenv('MYSQL_HOST');
if ($secret === '' || $host === ''){
  fwrite(STDERR, "siges : SIGES_SECRET ou MYSQL_HOST absent — installation manuelle via install.php.\n");
  exit(0);
}

$mysql = array(
  'host' => $host,
  'port' => (int)(getenv('MYSQL_PORT') ?: 3306),
  'user' => (string)getenv('MYSQL_USER'),
  'pass' => (string)getenv('MYSQL_PASSWORD'),
  'base' => (string)(getenv('MYSQL_DATABASE') ?: 'aurel_school'),
);

try {
  $pdo = aurel_mysql_pdo($mysql);
  $t = $pdo->query("SHOW TABLES LIKE 'entities'")->fetchColumn();
  $n = $t === false ? 0 : (int)$pdo->query("SELECT COUNT(*) FROM entities WHERE coll='users'")->fetchColumn();
  if ($n === 0){
    fwrite(STDERR, "siges : base vide — ouvrez /install.php pour la première installation.\n");
    exit(0);
  }
} catch (Throwable $e){
  if (strpos($e->getMessage(), '[1049]') !== false){   /* base pas encore créée */
    fwrite(STDERR, "siges : base absente — ouvrez /install.php pour la première installation.\n");
    exit(0);
  }
  fwrite(STDERR, 'siges : MySQL injoignable au démarrage (' . $e->getMessage() . ") — config.php écrit malgré tout.\n");
}

$cfg = array(
  'secret' => $secret,
  'adresse' => (string)getenv('RENDER_EXTERNAL_URL'),
  'storage' => 'mysql',
  'mysql' => $mysql,
);
$f = aurel_config_file();
file_put_contents($f, "<?php\n// Aurel School SIGES — généré au démarrage du conteneur (variables d'environnement).\nreturn " . var_export($cfg, true) . ";\n");
@chown($f, 'www-data');
fwrite(STDERR, "siges : config.php généré.\n");
