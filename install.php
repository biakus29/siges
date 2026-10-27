<?php
/* ================================================================
   Aurel School SIGES — Installateur (PHP + MySQL exclusifs)
   1. Vérifie les prérequis (PHP, MySQL, droits d'écriture)
   2. Crée la base : base vide de PRODUCTION + nom de l'établissement
      et compte administrateur (v6.7 : plus aucune donnée de démonstration)
   3. Génère config.php (secret des jetons) et protège le dossier data/
   Après l'installation : SUPPRIMEZ ce fichier (ou laissez la case
   « suppression automatique » cochée — il se supprime seul).
   ================================================================ */
session_start();
require __DIR__ . '/api/lib.php';

header('Content-Type: text/html; charset=utf-8');

$racine = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$nonce = isset($_SESSION['nonce']) ? $_SESSION['nonce'] : md5(uniqid(rand(), true));
$_SESSION['nonce'] = $nonce;

/* ---------- Petites aides ---------- */
function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function installed_ok(){ return aurel_installed(); }
/* v6.6 : valeur déjà saisie (le formulaire ne se vide plus en cas d'erreur) */
function pv($k, $def = ''){
  if (!isset($_POST[$k])) return $def;
  return is_string($_POST[$k]) ? h($_POST[$k]) : $def;
}
/* v6.6 : traduction des erreurs MySQL en conseils précis.
   v6.7 : conseils adaptés au serveur LOCAL (XAMPP) ou DISTANT (phpMyAdmin). */
function inst_erreur_mysql($msg, $mysql, $creer){
  $m = (string)$msg;
  $distant = !in_array($mysql['host'], array('localhost', '127.0.0.1', '::1'), true);
  if (stripos($m, 'Access denied for user') !== false){
    $r = "Connexion MySQL refusée : le nom d'utilisateur ou le mot de passe MySQL est incorrect pour « {$mysql['user']} »@« {$mysql['host']} ».\n";
    if ($distant)
      $r .= "• Base DISTANTE : vérifiez que cet utilisateur est autorisé à se connecter DEPUIS ce poste — dans phpMyAdmin → Comptes utilisateurs, son hôte doit être « % » ou l'adresse IP de CE serveur.\n"
         . "• Si l'application est hébergée sur le MÊME serveur que MySQL (hébergement mutualisé), l'hôte est souvent « localhost », pas l'adresse publique.\n";
    else
      $r .= "• Avec XAMPP/WAMP local : utilisateur « root », mot de passe VIDE.\n";
    $r .= "• Vérifiez aussi que l'utilisateur a bien les droits sur la base « {$mysql['base']} » — le mot de passe MySQL est celui de la base de données, pas celui du compte administrateur de l'application.";
    return $r;
  }
  if (stripos($m, '[1049]') !== false || stripos($m, 'Unknown database') !== false)
    return "La base « {$mysql['base']} » n'existe pas sur le serveur {$mysql['host']}.\n"
      . "• Cochez « Créer la base de données si elle n'existe pas » (l'utilisateur doit avoir le droit CREATE),\n"
      . "• ou créez-la manuellement depuis phpMyAdmin (rubrique « Bases de données » → Créer), puis relancez,\n"
      . "• ou indiquez le nom exact d'une base existante (phpMyAdmin liste vos bases).";
  if (stripos($m, '[2002]') !== false || stripos($m, 'Connection refused') !== false){
    $r = "MySQL ne répond pas sur {$mysql['host']}:{$mysql['port']}.\n"
       . "• Vérifiez que le serveur MySQL/MariaDB est DÉMARRÉ (XAMPP : bouton Start devant MySQL),\n"
       . "• vérifiez le port (3306 par défaut),\n";
    $r .= $distant
      ? "• Base DISTANTE : le serveur doit accepter les connexions externes (accès à distance activé chez l'hébergeur, pare-feu ouvert sur le port)."
      : "• et l'hôte (localhost ou 127.0.0.1 pour une installation sur ce poste).";
    return $r;
  }
  if (stripos($m, 'php_network_getaddresses') !== false || stripos($m, 'getaddrinfo failed') !== false)
    return "Hôte MySQL introuvable : « {$mysql['host']} » n'est pas une adresse valide.\n"
      . "• Indiquez uniquement le nom ou l'adresse IP — ex : localhost, 127.0.0.1 ou sql.hebergeur.com — sans http:// ni slash.";
  if (stripos($m, '[1044]') !== false || stripos($m, '[42000]') !== false || stripos($m, 'CREATE command denied') !== false)
    return "L'utilisateur « {$mysql['user']} » n'a pas le droit de créer la base « {$mysql['base']} ».\n"
      . "• Créez la base manuellement depuis phpMyAdmin, puis décochez « Créer la base de données si elle n'existe pas »,\n"
      . "• ou accordez le droit CREATE à cet utilisateur (GRANT ALL ON `{$mysql['base']}`.* ...).";
  return $m;
}

function verifs(&$modeStockage){
  $dir = aurel_data_dir();
  $okDir = (is_dir($dir) || @mkdir($dir, 0775, true)) && is_writable($dir);
  $cfg = aurel_config_file();
  $okCfg = !is_file($cfg) ? is_writable(dirname($cfg)) : is_writable($cfg);
  $modeStockage = 'MySQL — stockage exclusif (extension pdo_mysql requise)';
  return array(
    array('PHP version 7.0 ou plus', version_compare(PHP_VERSION, '7.0.0', '>='), PHP_VERSION),
    array('Extension PDO MySQL', extension_loaded('pdo_mysql'),
      extension_loaded('pdo_mysql') ? 'disponible' : 'absente — activez pdo_mysql dans php.ini'),
    array('Dossier data/ accessible en écriture (journal des tentatives)', $okDir, $dir),
    array('Fichier config.php créable', $okCfg, $cfg),
  );
}

/* ---------- Réinstallation (demandée explicitement) ---------- */
$erreur = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])){
  if (!hash_equals($nonce, (string)(isset($_POST['nonce']) ? $_POST['nonce'] : ''))){
    $erreur = 'Session d\'installation expirée — rechargez la page et recommencez.';
  } elseif ($_POST['action'] === 'reinstall'){
    /* Sécurité : le code secret de config.php (accessible uniquement par
       FTP/gestion de fichiers sur le serveur) doit être confirmé. */
    $cfgNow = aurel_config(true);
    $code = (string)(isset($_POST['secret_confirm']) ? $_POST['secret_confirm'] : '');
    if ($cfgNow['secret'] === '' || !hash_equals($cfgNow['secret'], $code)){
      $erreur = 'Code de sécurité invalide — il figure dans le fichier config.php '
        . 'du serveur (valeur de « secret »). Opération refusée.';
    } else {
      @unlink(aurel_config_file());
      foreach (array('aurel.db', 'aurel.db-wal', 'aurel.db-shm', 'aurel-db.json', 'attempts.json') as $f){
        @unlink(aurel_data_dir() . '/' . $f);
      }
      header('Location: ' . $_SERVER['SCRIPT_NAME']);
      exit;
    }
  }
}

/* ---------- Installation proprement dite ---------- */
$installe = false;
$stockageLibelle = '';
$comptes = array();
$modeChoisi = null;
$etabInstalle = null;
$supprime = false;

if (!$erreur && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'installer'
    && hash_equals($nonce, (string)(isset($_POST['nonce']) ? $_POST['nonce'] : '')) && !installed_ok()){

  $mode = isset($_POST['mode']) ? $_POST['mode'] : 'vide';
  /* v6.6 : validation champ par champ — chaque erreur est explicite et le
     formulaire conserve les valeurs saisies (plus rien ne se vide). */
  $erreurs = array();
  /* v6.7 : plus de mode démonstration — installation 100 % production. */
  if ($mode === 'demo'){
    $erreurs[] = array('mode', "Le mode « démonstration » n'existe plus : depuis la v6.7, l'installation crée une base de production, sans aucune donnée de test. Choisissez « Base vide prête pour la production » ou « Se connecter à une base existante ».");
    $mode = 'vide';
  } elseif (!in_array($mode, array('vide', 'existante'), true)) $mode = 'vide';
  $adresse = trim((string)(isset($_POST['adresse']) ? $_POST['adresse'] : ''));
  if ($adresse !== '' && !preg_match('#^https?://[a-z0-9._:-]+#i', $adresse))
    $erreurs[] = array('adresse', "Adresse de l'application invalide : elle doit commencer par http:// ou https:// — ex : http://localhost/aurel-school-siges.");
  $mHost = trim((string)(isset($_POST['mysql_host']) ? $_POST['mysql_host'] : '127.0.0.1')) ?: '127.0.0.1';
  if (!preg_match('/^[a-zA-Z0-9._-]+$/', $mHost))
    $erreurs[] = array('mysql_host', "Hôte MySQL invalide : « {$mHost} ». Indiquez uniquement un nom ou une adresse IP (ex : localhost, 127.0.0.1) — sans http://, sans slash, sans espace.");
  $mPort = (string)(isset($_POST['mysql_port']) ? $_POST['mysql_port'] : '3306');
  if (!preg_match('/^[0-9]{1,5}$/', $mPort) || (int)$mPort < 1 || (int)$mPort > 65535)
    $erreurs[] = array('mysql_port', "Port MySQL invalide : « {$mPort} ». Indiquez un numéro entre 1 et 65535 — 3306 par défaut.");
  $mUser = trim((string)(isset($_POST['mysql_user']) ? $_POST['mysql_user'] : ''));
  if ($mUser === '')
    $erreurs[] = array('mysql_user', "Indiquez l'utilisateur MySQL (ex : root avec XAMPP, ou l'utilisateur créé pour l'application).");
  elseif (!preg_match('/^[a-zA-Z0-9._-]+$/', $mUser))
    $erreurs[] = array('mysql_user', "Nom d'utilisateur MySQL invalide : « {$mUser} ». Sans accent, sans espace — lettres, chiffres, point (.), tiret (-) et underscore (_) uniquement. Ex : root, aurel.");
  $mBase = trim((string)(isset($_POST['mysql_base']) ? $_POST['mysql_base'] : 'aurel_school')) ?: 'aurel_school';
  if (!preg_match('/^[a-zA-Z0-9_]+$/', $mBase))
    $erreurs[] = array('mysql_base', "Nom de base invalide : « {$mBase} ». MySQL n'accepte que les lettres, chiffres et underscore (_) — ex : aurel_school (ni espace, ni tiret, ni accent).");
  if ($mode === 'vide'){
    $nomEtab = trim((string)(isset($_POST['etab_nom']) ? $_POST['etab_nom'] : ''));
    if ($nomEtab === '')
      $erreurs[] = array('etab_nom', "Indiquez le nom de votre établissement (ex : Collège Sainte-Marie) — c'est le nom affiché dans l'application et sur les documents officiels.");
    $ident = trim((string)(isset($_POST['admin_user']) ? $_POST['admin_user'] : ''));
    if ($ident === '')
      $erreurs[] = array('admin_user', "Indiquez l'identifiant de connexion de l'administrateur (ex : admin, soeur.marie) — champ « Identifiant administrateur » de la section « Base vide ».");
    elseif (!preg_match('/^[a-zA-Z0-9._-]{3,20}$/', $ident))
      $erreurs[] = array('admin_user', "Identifiant administrateur invalide : « {$ident} ». 3 à 20 caractères — lettres, chiffres, point (.), tiret (-), underscore (_) ; sans accent et sans espace. Ex : admin, soeur.marie, j.ndongo.");
    $nomAdm = trim((string)(isset($_POST['admin_nom']) ? $_POST['admin_nom'] : ''));
    if ($nomAdm === '')
      $erreurs[] = array('admin_nom', "Indiquez le nom complet de l'administrateur (ex : Sœur Marie-Claire Ngo) — c'est le nom affiché dans l'application.");
    $pwd = (string)(isset($_POST['admin_pwd']) ? $_POST['admin_pwd'] : '');
    $pwd2 = (string)(isset($_POST['admin_pwd2']) ? $_POST['admin_pwd2'] : '');
    if (strlen($pwd) < 6)
      $erreurs[] = array('admin_pwd', "Mot de passe administrateur trop court : 6 caractères minimum (ex : admin2026).");
    if ($pwd !== $pwd2)
      $erreurs[] = array('admin_pwd2', "Les deux mots de passe ne correspondent pas : saisissez deux fois le même mot de passe.");
    /* v6.8 : réseau d'établissements — validation du compte superadministrateur */
    if (!empty($_POST['reseau'])){
      $su = trim((string)(isset($_POST['su_user']) ? $_POST['su_user'] : ''));
      if ($su === '')
        $erreurs[] = array('su_user', "Indiquez l'identifiant du superadministrateur (case « Réseau d'établissements » cochée) — ex : direction, dg.reseau.");
      elseif (!preg_match('/^[a-zA-Z0-9._-]{3,20}$/', $su))
        $erreurs[] = array('su_user', "Identifiant superadministrateur invalide : « {$su} ». 3 à 20 caractères — lettres, chiffres, point (.), tiret (-), underscore (_) ; sans accent ni espace.");
      elseif ($su === $ident)
        $erreurs[] = array('su_user', "L'identifiant du superadministrateur doit être différent de celui de l'administrateur (« {$ident} »).");
      $suNom = trim((string)(isset($_POST['su_nom']) ? $_POST['su_nom'] : ''));
      if ($suNom === '')
        $erreurs[] = array('su_nom', "Indiquez le nom complet du superadministrateur (ex : La Direction Générale) — c'est le nom affiché dans la console réseau.");
      $suPwd = (string)(isset($_POST['su_pwd']) ? $_POST['su_pwd'] : '');
      $suPwd2 = (string)(isset($_POST['su_pwd2']) ? $_POST['su_pwd2'] : '');
      if (strlen($suPwd) < 6)
        $erreurs[] = array('su_pwd', "Mot de passe superadministrateur trop court : 6 caractères minimum.");
      if ($suPwd !== $suPwd2)
        $erreurs[] = array('su_pwd2', "Les deux mots de passe superadministrateur ne correspondent pas : saisissez deux fois le même mot de passe.");
    }
  }
  if ($erreurs){
    $erreur = null;   /* rendu en liste détaillée plus bas */
  }
  if (!$erreurs) try {
    if ($mode === 'vide'){
      /* Base prête pour la production : structure fournie, aucune donnée,
         compte administrateur créé ici (équivalent de la purge v1.7). */
      $ident = trim((string)(isset($_POST['admin_user']) ? $_POST['admin_user'] : ''));
      $nom = trim((string)(isset($_POST['admin_nom']) ? $_POST['admin_nom'] : ''));
      $pwd = (string)(isset($_POST['admin_pwd']) ? $_POST['admin_pwd'] : '');
      $pwd2 = (string)(isset($_POST['admin_pwd2']) ? $_POST['admin_pwd2'] : '');
      $nomEtab = trim((string)(isset($_POST['etab_nom']) ? $_POST['etab_nom'] : ''));

      $db = aurel_seed_db();
      /* v2.1 : ne conserver que le premier établissement, vidé de ses données
         (la structure reste : année, niveaux, classes, frais, grille tarifaire) */
      $prem = isset($db['etablissements'][0]['id']) ? $db['etablissements'][0]['id'] : 'etab-001';
      $db['etablissements'] = array_values(array_filter(isset($db['etablissements']) && is_array($db['etablissements']) ? $db['etablissements'] : array(),
        function($e) use ($prem){ return is_array($e) && isset($e['id']) && $e['id'] === $prem; }));
      if (isset($db['bases']) && is_array($db['bases'])){
        $bases = array();
        foreach ($db['bases'] as $b){
          if (!is_array($b) || (isset($b['id']) && $b['id'] !== $prem)) continue;
          foreach (array('eleves', 'paiements', 'bourses', 'journal', 'anciens', 'notes', 'discipline') as $c){
            if (isset($b[$c]) && is_array($b[$c])) $b[$c] = array();
          }
          $bases[] = $b;
        }
        $db['bases'] = $bases;
      }
      foreach (array('eleves', 'paiements', 'bourses', 'journal', 'anciens', 'notes', 'discipline') as $c){ $db[$c] = array(); }
      /* v6.7 : établissement réellement vierge — nom saisi par l'installateur,
         coordonnées de démonstration effacées (à compléter dans Paramètres). */
      if (isset($db['etablissements'][0]) && is_array($db['etablissements'][0])){
        if ($nomEtab !== '') $db['etablissements'][0]['nom'] = $nomEtab;
        foreach (array('adresse', 'telephone', 'email') as $k) $db['etablissements'][0][$k] = '';
      }
      $etabInstalle = $nomEtab;
      $salt = bin2hex(random_bytes(7));
      $db['users'] = array(array(
        'id' => 'us-admin', 'username' => $ident, 'nom' => $nom, 'role' => 'admin',
        'actif' => true, 'salt' => $salt, 'hash' => hash('sha256', $salt . ':' . $pwd),
        'dernierAcces' => null, 'etablissementId' => $prem,
      ));
      if (isset($db['journalGlobal']) && is_array($db['journalGlobal'])) $db['journalGlobal'] = array();
      $comptes = array(array($ident, 'Administrateur — compte créé à l\'installation'));
      /* v6.8 : réseau d'établissements — premier superadministrateur (console réseau) */
      if (!empty($_POST['reseau'])){
        $suIdent = trim((string)(isset($_POST['su_user']) ? $_POST['su_user'] : ''));
        $suNom = trim((string)(isset($_POST['su_nom']) ? $_POST['su_nom'] : ''));
        $suPwd = (string)(isset($_POST['su_pwd']) ? $_POST['su_pwd'] : '');
        $saltSu = bin2hex(random_bytes(7));
        $db['users'][] = array(
          'id' => 'us-super', 'username' => $suIdent, 'nom' => $suNom, 'role' => 'superadmin',
          'actif' => true, 'salt' => $saltSu, 'hash' => hash('sha256', $saltSu . ':' . $suPwd),
          'dernierAcces' => null, 'etablissementId' => null,
        );
        $comptes[] = array($suIdent, 'Superadministrateur — console réseau (tous les établissements)');
      }
      $modeChoisi = 'Base vide prête pour la production — aucune donnée de test';
    }
    if ($mode === 'existante'){
      $modeChoisi = 'Base existante conservée — vos données, comptes et réglages sont intacts';
      $comptes = array(array('(inchangés)', 'Connectez-vous avec les comptes de l\'installation précédente'));
    }

    /* Adresse d'acces choisie par l'installateur (ou detectee) */
    $schema = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] !== ''
      ? $_SERVER['HTTP_HOST'] : 'localhost';
    $adresse = trim((string)(isset($_POST['adresse']) ? $_POST['adresse'] : ''));
    if ($adresse === '') $adresse = $schema . '://' . $host . $racine;

    /* Stockage MySQL exclusif */
    $storage = 'mysql';
    $mysql = array(
      'host' => trim((string)(isset($_POST['mysql_host']) ? $_POST['mysql_host'] : '127.0.0.1')) ?: '127.0.0.1',
      'port' => (int)(isset($_POST['mysql_port']) ? $_POST['mysql_port'] : 3306) ?: 3306,
      'user' => trim((string)(isset($_POST['mysql_user']) ? $_POST['mysql_user'] : '')),
      'pass' => (string)(isset($_POST['mysql_pass']) ? $_POST['mysql_pass'] : ''),
      'base' => trim((string)(isset($_POST['mysql_base']) ? $_POST['mysql_base'] : 'aurel_school')) ?: 'aurel_school',
    );
    {
      if (!extension_loaded('pdo_mysql')) throw new RuntimeException('L\'extension PDO MySQL n\'est pas active dans PHP.');
      if ($mysql['user'] === '') throw new RuntimeException('Indiquez l\'utilisateur MySQL.');
      /* création de la base si demandée (nécessite le droit CREATE) */
      if (!empty($_POST['creer_base'])){
        try {
          $srv = new PDO('mysql:host=' . $mysql['host'] . ';port=' . $mysql['port'] . ';charset=utf8mb4',
            $mysql['user'], $mysql['pass'], array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10));
          $nm = str_replace('`', '', $mysql['base']);
          $srv->exec('CREATE DATABASE IF NOT EXISTS `' . $nm . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (Throwable $e){
          throw new RuntimeException("Création de la base « {$mysql['base']} » impossible :\n" . inst_erreur_mysql($e->getMessage(), $mysql, true));
        }
      }
      /* test de connexion à la base */
      try {
        aurel_mysql_pdo($mysql);
      } catch (Throwable $e){
        throw new RuntimeException("Connexion MySQL impossible ({$mysql['user']}@{$mysql['host']}/{$mysql['base']}) :\n"
          . inst_erreur_mysql($e->getMessage(), $mysql, !empty($_POST['creer_base'])));
      }
      $stockageLibelle = 'MySQL — base ' . $mysql['base'] . ' sur ' . $mysql['host'] . ':' . $mysql['port'];
      /* v6.4 : reprise d'une base existante — l'installation précédente
         (ou la mise à jour) conserve l'intégralité de ses données. */
      if ($mode === 'existante'){
        try {
          $pdo = aurel_mysql_pdo($mysql);
          $t = $pdo->query("SHOW TABLES LIKE 'entities'")->fetchColumn();
          if ($t === false)
            throw new RuntimeException('cette base ne contient pas d\'installation Aurel School SIGES (table « entities » absente).');
          $n = (int)$pdo->query("SELECT COUNT(*) FROM entities WHERE coll='users'")->fetchColumn();
          if (!$n)
            throw new RuntimeException('la base indiquée ne contient aucun compte utilisateur Aurel School SIGES.');
        } catch (Throwable $e){
          throw new RuntimeException('Base existante invalide : ' . $e->getMessage());
        }
      }
    }

    /* Configuration d'abord (le magasin la relit), puis la base */
    $secret = bin2hex(random_bytes(32));
    $cfg = "<?php\n// Aurel School SIGES — configuration générée par install.php\n"
         . "// Secret des jetons de session (à régénérer si compromis).\n"
         . "// Adresse locale d'accès à l'application.\n"
         . "return array(\n"
         . "  'secret' => '" . $secret . "',\n"
         . "  'adresse' => '" . str_replace(array('\\', "'"), array('\\\\', "\\'"), $adresse) . "',\n"
         . "  'storage' => '" . $storage . "',\n"
         . "  'mysql' => array(\n"
         . "    'host' => " . var_export($mysql['host'], true) . ",\n"
         . "    'port' => " . (int)$mysql['port'] . ",\n"
         . "    'user' => " . var_export($mysql['user'], true) . ",\n"
         . "    'pass' => " . var_export($mysql['pass'], true) . ",\n"
         . "    'base' => " . var_export($mysql['base'], true) . ",\n"
         . "  ),\n"
         . ");\n";
    if (@file_put_contents(aurel_config_file(), $cfg) === false)
      throw new RuntimeException('Impossible d\'écrire config.php — vérifiez les droits.');
    /* forcer toutes les requêtes (OPcache) à voir le nouveau secret */
    if (function_exists('opcache_invalidate')) @opcache_invalidate(aurel_config_file(), true);
    try {
      if ($mode === 'existante'){
        /* v6.4 : connexion à l'ancienne base SANS AUCUNE perte — les
           comptes, élèves, paiements et réglages de l'installation
           précédente sont conservés tels quels. */
        aurel_store();
      } else {
        aurel_store($db);
        /* v5.7.1 : memorise si la base est une demonstration (autorise
           ou refuse la reinitialisation ulterieure via /api/reset).
           v6.7 : l'installateur ne crée plus de démonstration. */
        aurel_store()->setDemo(false);
      }
    } catch (Throwable $e){
      @unlink(aurel_config_file());   /* échec de la base : on permet de recommencer */
      throw $e;
    }

    /* Protection du dossier data/ (Apache) */
    @file_put_contents(aurel_data_dir() . '/.htaccess',
      "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    @file_put_contents(aurel_data_dir() . '/index.html', '');

    $installe = true;
    if (!empty($_POST['autodel'])){
      $supprime = @unlink(__FILE__);
    }
  } catch (Throwable $e){
    $erreur = $e->getMessage();
  }
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Installation — Aurel School SIGES</title>
<style>
  :root{ --navy:#0f2f57; --navy2:#16386b; --gold:#c9a227; --line:#d5dde8; --muted:#5a6b85; --ok:#1d8a4b; --bad:#c0392b; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:Tahoma, Arial, sans-serif; background:#eef2f8; color:#1c2b45; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .box{ width:100%; max-width:660px; background:#fff; border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 40px rgba(15,47,87,.12); overflow:hidden; }
  .head{ background:linear-gradient(135deg, var(--navy), var(--navy2)); color:#fff; padding:22px 28px; }
  .head h1{ font-size:17px; letter-spacing:.4px; }
  .head p{ font-size:12px; color:#bcd0ea; margin-top:4px; }
  .head .v{ float:right; font-size:10.5px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.25); padding:3px 10px; border-radius:20px; margin-top:-2px; }
  .body{ padding:24px 28px; }
  h2{ font-size:13.5px; color:var(--navy); margin-bottom:12px; text-transform:uppercase; letter-spacing:.06em; }
  table{ width:100%; border-collapse:collapse; margin-bottom:16px; }
  td{ padding:8px 10px; border-bottom:1px solid #eef1f6; font-size:12.3px; }
  td.st{ width:26px; font-weight:700; }
  .ok{ color:var(--ok); } .ko{ color:var(--bad); } .mut{ color:var(--muted); font-size:11px; }
  .choix{ border:1.5px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:10px; cursor:pointer; display:block; }
  .choix:hover{ border-color:var(--navy); background:#f7fafd; }
  .choix b{ font-size:12.8px; color:var(--navy); }
  .choix p{ font-size:11.6px; color:var(--muted); margin-top:3px; line-height:1.55; }
  input[type=text], input[type=password]{ width:100%; padding:8px 10px; border:1.5px solid var(--line); border-radius:8px; font-family:inherit; font-size:12.5px; margin-top:4px; }
  input[type=text]:focus, input[type=password]:focus{ outline:none; border-color:var(--navy); }
  label.lb{ display:block; font-size:11.6px; color:var(--muted); margin-top:10px; }
  .btn{ display:inline-block; background:linear-gradient(135deg, var(--gold), #b08d1e); color:#fff; border:none; border-radius:9px; padding:11px 26px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; text-decoration:none; }
  .btn:hover{ filter:brightness(1.06); }
  .btn2{ display:inline-block; background:#fff; color:var(--navy); border:1.5px solid var(--line); border-radius:9px; padding:10px 22px; font-size:12.5px; font-weight:700; cursor:pointer; text-decoration:none; }
  .err{ background:#fdecea; border:1px solid #f3c4bd; color:var(--bad); border-radius:9px; padding:10px 14px; font-size:12.3px; margin-bottom:14px; }
  .warn{ background:#fdf6e3; border:1px solid #eadbb5; color:#7a5c0e; border-radius:9px; padding:10px 14px; font-size:12px; margin-bottom:14px; line-height:1.6; }
  .foot{ padding:14px 28px; border-top:1px solid #eef1f6; font-size:10.6px; color:var(--muted); }
  .chkl{ display:flex; gap:8px; align-items:center; font-size:12px; color:var(--muted); margin:14px 0 4px; }
</style>
</head>
<body>
<div class="box">
  <div class="head">
    <span class="v">v<?= AUREL_VERSION ?></span>
    <h1>Aurel School SIGES — Installation</h1>
    <p>Système Intégré de Gestion des Établissements Scolaires</p>
  </div>
  <div class="body">

<?php if ($erreur): ?>
    <div class="err"><b>Installation interrompue :</b><br/><?= nl2br(h($erreur)) ?></div>
<?php elseif (!empty($erreurs)): ?>
    <div class="err"><b><?= count($erreurs) > 1 ? count($erreurs) . ' points à corriger :' : '1 point à corriger :' ?></b>
      <ul style="margin:8px 0 0 18px">
        <?php foreach ($erreurs as $er): ?>
        <li style="margin-bottom:6px"><?= h($er[1]) ?> <span class="mut">(champ « <?= h($er[0]) ?> »)</span></li>
        <?php endforeach; ?>
      </ul>
      <p style="margin-top:8px">Vos saisies sont conservées ci-dessous — corrigez simplement le ou les champs indiqués.</p>
    </div>
<?php endif; ?>

<?php if ($installe): ?>
    <h2>✅ Installation terminée</h2>
    <table>
      <tr><td class="st ok">✔</td><td>Adresse d'accès</td><td><b><?= h($adresse) ?></b></td></tr>
      <tr><td class="st ok">✔</td><td>Mode choisi</td><td><b><?= h($modeChoisi) ?></b></td></tr>
      <?php if ($etabInstalle !== null && $etabInstalle !== ''): ?>
      <tr><td class="st ok">✔</td><td>Établissement</td><td><b><?= h($etabInstalle) ?></b></td></tr>
      <?php endif; ?>
      <tr><td class="st ok">✔</td><td>Base de données</td><td><b><?= h($stockageLibelle !== '' ? $stockageLibelle : 'MySQL') ?></b></td></tr>
      <?php foreach ($comptes as $c): ?>
      <tr><td class="st ok">✔</td><td>Compte</td><td><b><?= h($c[0]) ?></b> — <?= h($c[1]) ?></td></tr>
      <?php endforeach; ?>
    </table>
    <?php if ($supprime): ?>
      <div class="warn">Le fichier <b>install.php a été supprimé automatiquement</b> — rien d'autre à faire.</div>
    <?php else: ?>
      <div class="warn"><b>Sécurité :</b> supprimez maintenant le fichier <b>install.php</b> du serveur,
      puis connectez-vous avec le compte administrateur créé ci-dessus. Changez son mot de passe régulièrement (Administration → Utilisateurs &amp; profils).</div>
    <?php endif; ?>
    <p style="margin:16px 0 6px">
      <a class="btn" href="<?= h($racine === '' ? './' : $racine . '/') ?>">Ouvrir l'application →</a>
    </p>

<?php elseif (installed_ok()): ?>
    <h2>Application déjà installée</h2>
    <p style="font-size:12.5px; line-height:1.7; margin-bottom:16px">
      La configuration (<b>config.php</b>) et la base existent déjà.
      L'application est prête — ouvrez-la simplement.<br><br>
      <b>Mise à jour vers une nouvelle version :</b> décompressez la nouvelle archive
      <b>à la place de l'ancienne</b> (ou copiez ses fichiers) en conservant
      <b>config.php</b> et la base MySQL : vos données sont reprises intégralement,
      sans perte. Pour repartir de zéro,
      utilisez la réinstallation ci-dessous : elle exige le code secret de
      <b>config.php</b> (présent uniquement sur le serveur) et efface
      <b>définitivement</b> toutes les données.
    </p>
    <p style="margin-bottom:16px">
      <a class="btn" href="<?= h($racine === '' ? './' : $racine . '/') ?>">Ouvrir l'application →</a>
    </p>
    <form method="post" onsubmit="return confirm('Effacer la base et réinstaller ? Toutes les données seront perdues.')">
      <input type="hidden" name="nonce" value="<?= h($nonce) ?>">
      <input type="hidden" name="action" value="reinstall">
      <label class="lb">Code de sécurité (valeur de « secret » dans config.php) *</label>
      <input type="password" name="secret_confirm" maxlength="80" autocomplete="off">
      <p class="mut" style="margin:6px 0 12px">Cette réinstallation efface définitivement toutes les données.
      Pour confirmer, copiez le code secret depuis le fichier <b>config.php</b> du serveur.</p>
      <button class="btn2" type="submit">Réinstaller depuis zéro…</button>
    </form>

<?php else: ?>
    <?php
      $modeStockage = '';
      $verifs = verifs($modeStockage);
      $bloquant = false;
      foreach ($verifs as $v){ if (!$v[1]) $bloquant = true; }
    ?>
    <h2>1 — Vérification de l'environnement</h2>
    <table>
      <?php foreach ($verifs as $i => $v): ?>
      <tr>
        <td class="st <?= $v[1] ? 'ok' : 'ko' ?>"><?= $v[1] ? '✔' : '✘' ?></td>
        <td><?= h($v[0]) ?></td>
        <td class="mut"><?= h($v[2]) ?></td>
      </tr>
      <?php endforeach; ?>
    </table>
    <p class="mut" style="margin-bottom:18px">Stockage des données : <b><?= h($modeStockage) ?></b></p>

    <?php if ($bloquant): ?>
      <div class="err"><b>Installation impossible :</b> corrigez les points marqués ✘ (droits d'écriture, version de PHP) puis rechargez cette page.</div>
    <?php else: ?>
    <form method="post" autocomplete="off">
      <input type="hidden" name="nonce" value="<?= h($nonce) ?>">
      <input type="hidden" name="action" value="installer">
      <h2>2 — Adresse du serveur (accès local)</h2>
      <label class="lb">Adresse à laquelle l'application sera accessible *</label>
      <input type="text" name="adresse" value="<?= pv('adresse', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . (isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] !== '' ? $_SERVER['HTTP_HOST'] : 'localhost') . $racine) ?>" maxlength="120">
      <p class="mut" style="margin:6px 0 18px">Laissez la valeur détectée, ou indiquez l'adresse de votre choix —
      ex : <b>http://localhost:80</b> (serveur intégré), <b>http://localhost/aurel-school-siges</b> (Apache/XAMPP)
      ou <b>http://127.0.0.0:80</b> (accès depuis les autres postes du réseau). Cette adresse est enregistrée
      dans la configuration et rappelée en fin d'installation.</p>
      <h2>3 — Base de données MySQL (locale ou distante)</h2>
      <p class="mut" style="margin:6px 0 12px">Les données sont stockées exclusivement dans votre serveur MySQL :
      <b>local</b> (XAMPP/WAMP sur ce poste) ou <b>distante</b> — serveur d'hébergement avec phpMyAdmin, serveur dédié.
      Indiquez « <b>localhost</b> » si MySQL se trouve sur la même machine que l'application ; sinon l'adresse du
      serveur de bases fournie par votre hébergeur. Sauvegarde : <b>mysqldump</b> ou l'export phpMyAdmin.</p>
      <div id="blk-mysql" style="border-top:1px dashed var(--line); margin-top:6px; padding-top:4px">
        <label class="lb">Hôte du serveur MySQL * <span class="mut" style="font-weight:400">— nom ou adresse IP du serveur de bases, sans http://</span></label>
        <input type="text" name="mysql_host" value="<?= pv('mysql_host', '127.0.0.1') ?>" maxlength="60" placeholder="localhost, 127.0.0.1 ou sql.hebergeur.com">
        <p class="mut" style="margin:4px 0 0">Base distante avec phpMyAdmin ? L'hôte figure dans votre panneau d'hébergement
        (souvent du type sql.votredomaine.com). Si l'application est hébergée sur le MÊME serveur que MySQL, l'hôte est « localhost ».</p>
        <label class="lb">Port * <span class="mut" style="font-weight:400">— 3306 par défaut</span></label>
        <input type="text" name="mysql_port" value="<?= pv('mysql_port', '3306') ?>" maxlength="5">
        <label class="lb">Utilisateur MySQL * <span class="mut" style="font-weight:400">— ex : root (XAMPP local), ou l'utilisateur créé par votre hébergeur — sans accent ni espace</span></label>
        <input type="text" name="mysql_user" value="<?= pv('mysql_user', 'root') ?>" maxlength="60">
        <label class="lb">Mot de passe MySQL <span class="mut" style="font-weight:400">— vide avec root/XAMPP par défaut</span></label>
        <input type="password" name="mysql_pass" maxlength="80">
        <label class="lb">Nom de la base * <span class="mut" style="font-weight:400">— lettres, chiffres et _ uniquement</span></label>
        <input type="text" name="mysql_base" value="<?= pv('mysql_base', 'aurel_school') ?>" maxlength="40">
        <label class="chkl" style="margin-top:10px">
          <input type="checkbox" name="creer_base" value="1" <?= !isset($_POST['action']) || !empty($_POST['creer_base']) ? 'checked' : '' ?>>
          <span>Créer la base si elle n'existe pas (droit CREATE requis — sinon créez-la d'abord depuis phpMyAdmin)</span>
        </label>
      </div>
      <h2>4 — Choix de la base de départ <span style="font-weight:400; font-size:11px; color:var(--muted)">(production uniquement — aucune donnée de test)</span></h2>
      <?php $modePost = isset($_POST['mode']) && in_array($_POST['mode'], array('vide', 'existante'), true) ? $_POST['mode'] : 'vide'; ?>
      <label class="choix">
        <input type="radio" name="mode" value="vide" <?= $modePost === 'vide' ? 'checked' : '' ?> onclick="document.getElementById('blk-admin').style.display='block'">
        <b>Base vide prête pour la production — recommandé</b>
        <p>Aucune donnée de test (élèves, paiements, bourses, comptes de démonstration) — la structure est fournie :
        années scolaires, niveaux, classes, types de frais et grilles. Vous indiquez le nom de votre établissement
        et créez ici l'unique compte administrateur ; les autres comptes seront ajoutés depuis l'application.</p>
      </label>
      <label class="choix">
        <input type="radio" name="mode" value="existante" <?= $modePost === 'existante' ? 'checked' : '' ?> onclick="document.getElementById('blk-admin').style.display='none'">
        <b>Se connecter à une base existante (mise à jour sans perte)</b>
        <p>Nouvelle installation ou montée de version : indiquez ci-dessus la base MySQL de votre installation
        précédente — elle est <b>reprise telle quelle</b> (élèves, paiements, comptes, réglages, modèles…).
        Aucune donnée n'est supprimée ni modifiée ; connectez-vous ensuite avec vos comptes habituels.</p>
      </label>
      <div id="blk-admin" style="display:<?= $modePost === 'vide' ? 'block' : 'none' ?>; border-top:1px dashed var(--line); margin-top:6px; padding-top:4px">
        <label class="lb">Nom de l'établissement * <span class="mut" style="font-weight:400">— ex : Collège Sainte-Marie de Yaoundé</span></label>
        <input type="text" name="etab_nom" value="<?= pv('etab_nom') ?>" placeholder="nom de votre école" maxlength="60">
        <p class="mut" style="margin:6px 0 12px">Le compte administrateur ci-dessous est le premier compte de l'application — il permet
        de créer tous les autres. <b>L'identifiant sert à se connecter</b> (pas le nom complet) : 3 à 20 caractères,
        lettres, chiffres, point (.), tiret (-) ou underscore (_), <b>sans accent ni espace</b>.</p>
        <label class="lb">Identifiant administrateur * <span class="mut" style="font-weight:400">— ex : admin, soeur.marie, j.ndongo</span></label>
        <input type="text" name="admin_user" value="<?= pv('admin_user', 'admin') ?>" maxlength="20">
        <label class="lb">Nom complet * <span class="mut" style="font-weight:400">— nom affiché dans l'application</span></label>
        <input type="text" name="admin_nom" value="<?= pv('admin_nom') ?>" placeholder="ex : Sœur Marie-Claire Ngo" maxlength="60">
        <label class="lb">Mot de passe * <span class="mut" style="font-weight:400">— 6 caractères minimum</span></label>
        <input type="password" name="admin_pwd" maxlength="40">
        <label class="lb">Confirmez le mot de passe *</label>
        <input type="password" name="admin_pwd2" maxlength="40">

        <label class="chkl" style="margin-top:12px">
          <input type="checkbox" name="reseau" value="1" <?= !empty($_POST['reseau']) ? 'checked' : '' ?> onclick="document.getElementById('blk-reseau').style.display=this.checked?'block':'none'">
          <span>Réseau d'établissements — créer AUSSI un compte <b>superadministrateur</b> (console réseau)</span>
        </label>
        <div id="blk-reseau" style="display:<?= !empty($_POST['reseau']) ? 'block' : 'none' ?>; border-top:1px dashed var(--line); margin-top:6px; padding-top:4px">
          <p class="mut" style="margin:6px 0 12px">Pour piloter plusieurs établissements (groupe scolaire, réseau d'écoles) : le
          superadministrateur accède à la console réseau — vue consolidée, création et suspension d'établissements,
          comptes et journal du réseau. <b>Laissez décoché pour une école unique.</b></p>
          <label class="lb">Identifiant superadministrateur * <span class="mut" style="font-weight:400">— différent de l'administrateur</span></label>
          <input type="text" name="su_user" value="<?= pv('su_user') ?>" maxlength="20">
          <label class="lb">Nom complet * <span class="mut" style="font-weight:400">— ex : La Direction Générale</span></label>
          <input type="text" name="su_nom" value="<?= pv('su_nom') ?>" maxlength="60">
          <label class="lb">Mot de passe * <span class="mut" style="font-weight:400">— 6 caractères minimum</span></label>
          <input type="password" name="su_pwd" maxlength="40">
          <label class="lb">Confirmez le mot de passe *</label>
          <input type="password" name="su_pwd2" maxlength="40">
        </div>
      </div>

      <label class="chkl">
        <input type="checkbox" name="autodel" value="1" checked>
        <span>Supprimer install.php automatiquement après l'installation (recommandé)</span>
      </label>

      <p style="margin-top:18px">
        <button class="btn" type="submit">Installer l'application →</button>
      </p>
    </form>
    <?php endif; ?>
<?php endif; ?>

  </div>
  <div class="foot">Aurel School SIGES v<?= AUREL_VERSION ?> • PHP <?= h(PHP_VERSION) ?> + MySQL •
    Après l'installation, sauvegardez régulièrement la base (mysqldump ou phpMyAdmin).</div>
</div>
</body>
</html>
