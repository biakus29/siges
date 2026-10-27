<?php
/* ================================================================
   Aurel School SIGES — API PHP (MySQL exclusif)
   Points d'entrée : /api/health, /api/etablissements (public),
   /api/auth/login|logout|me, /api/db (GET/POST), /api/reset —
   authentification Bearer HMAC, verrou de révision.
   ================================================================ */
require __DIR__ . '/lib.php';
require __DIR__ . '/licence.php';

/* ---------- En-têtes de sécurité (déploiement internet) ----------
   Aucun CORS ouvert : l'application est servie de la MÊME origine que
   l'API ; un autre site ne doit pouvoir ni lire ni modifier les données. */
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
/* v5.6 : l'API ne renvoie que du JSON — aucun contenu actif permis */
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'){
  http_response_code(204);
  exit;
}

/* ---------- Route (insensible au sous-dossier d'installation) ---------- */
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$pos = strpos($uriPath, '/api/');
$route = ($pos === false) ? '/' : substr($uriPath, $pos + 4);  /* ex. '/health' */
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'HEAD') $method = 'GET';   /* sondes de supervision */

/* ---------- Garde d'authentification ---------- */
function need_auth(){
  $u = aurel_auth_user();
  if (!$u) jout(401, array('ok' => false, 'msg' => 'Session expirée ou invalide — reconnectez-vous.'));
  return $u;
}
function need_admin(){
  $u = need_auth();
  if ($u['role'] !== 'admin' && $u['role'] !== 'superadmin') jout(403, array('ok' => false, 'msg' => 'Action réservée à l\'administrateur.'));
  return $u;
}

try {

  /* v6.4 : sauvegarde automatique — déclenchement paresseux à chaque
     requête API si la fréquence configurée est atteinte. */
  if (aurel_installed()) aurel_backup_hook();

  /* ---------- Licence d'exploitation (verrou de maintenance) ----------
     Coupe toute route sensible si la période est échue. Les routes
     /health, /etablissements et /licence/* restent toujours accessibles. */
  aurel_lic_guard($route);

  /* État du verrou (public, discret) + déblocage par code de maintenance */
  if ($route === '/licence/etat' && $method === 'GET'){
    $e = aurel_lic_etat();
    jout(200, array('ok' => true, 'bloque' => $e['bloque'], 'ref' => $e['ref']));
  }
  if ($route === '/licence/activer' && $method === 'POST'){
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?';
    if (aurel_rate_limited('LIC|' . $ip)) jout(429, array('ok' => false, 'msg' => 'Trop de tentatives — patientez un instant.'));
    $b = jbody();
    $r = aurel_lic_activer(isset($b['code']) ? $b['code'] : '');
    if ($r['ok']){
      aurel_clear_fails('LIC|' . $ip);
      jout(200, array('ok' => true));
    }
    aurel_record_fail('LIC|' . $ip);
    usleep(400000);
    jout(401, array('ok' => false, 'msg' => 'Code de maintenance incorrect.'));
  }

  /* ---------- Santé (sonde du client React) ---------- */
  if ($route === '/health' && $method === 'GET'){
    jout(200, array(
      'ok' => true,
      'app' => AUREL_APP,
      'version' => AUREL_VERSION,
      'mode' => aurel_store()->mode,
      'rev' => aurel_store()->getRev(),
    ));
  }

  /* ---------- Connexion ---------- */
  /* Liste publique des etablissements actifs (page de connexion) */
  if ($route === '/etablissements' && $method === 'GET'){
    $db = aurel_store()->getDb();
    $out = array();
    if (isset($db['etablissements']) && is_array($db['etablissements'])){
      foreach ($db['etablissements'] as $e){
        if (is_array($e) && (!isset($e['actif']) || $e['actif'] !== false)){
          $out[] = array(
            'id' => isset($e['id']) ? $e['id'] : '',
            'nom' => isset($e['nom']) ? $e['nom'] : '',
            'ville' => isset($e['ville']) ? $e['ville'] : ''
          );
        }
      }
    } elseif (isset($db['settings']) && is_array($db['settings']) && !empty($db['settings']['nomEtablissement'])){
      $out[] = array('id' => 'etab-001', 'nom' => $db['settings']['nomEtablissement'], 'ville' => '');
    }
    jout(200, $out);
  }

  if ($route === '/auth/login' && $method === 'POST'){
    $b = jbody();
    $username = isset($b['username']) ? $b['username'] : '';
    $pwd = isset($b['pwd']) ? $b['pwd'] : '';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?';
    $key = $ip . '|' . strtolower(trim((string)$username));
    $keyIp = 'IP|' . $ip;   /* v5.6 : compteur global par IP (anti-variation d'identifiants) */

    if (aurel_rate_limited($key) || aurel_rate_limited($keyIp)){
      jout(429, array('ok' => false, 'msg' => 'Trop de tentatives — patientez un instant.'));
    }

    $db = aurel_store()->getDb();
    $user = null;
    foreach ($db['users'] as $u){
      if (is_array($u) && strtolower(trim((string)$u['username'])) === strtolower(trim((string)$username))){
        $user = $u;
        break;
      }
    }
    /* comparaison en temps constant ; empreintes scellées par bcrypt */
    $okPwd = $user && !empty($user['actif']) && aurel_pwd_ok($user, $pwd);

    if (!$okPwd){
      aurel_record_fail($key);
      aurel_record_fail($keyIp);
      usleep(250000);   /* ralentit les tentatives automatisées */
      jout(401, array('ok' => false, 'msg' => 'Identifiants incorrects.'));
    }

    /* v5.1 : un compte d'un établissement suspendu ne se connecte plus
       (contrôle réseau du superadministrateur, appliqué aussi côté serveur) */
    if ($user['role'] !== 'superadmin' && !empty($user['etablissementId'])
      && isset($db['etablissements']) && is_array($db['etablissements'])){
      foreach ($db['etablissements'] as $e){
        if (is_array($e) && isset($e['id'], $e['actif'])
          && $e['id'] === $user['etablissementId'] && $e['actif'] === false){
          jout(403, array('ok' => false, 'msg' => 'Connexion impossible : cet établissement est momentanément suspendu par l\'administration générale.'));
        }
      }
    }

    aurel_clear_fails($key);
    aurel_clear_fails($keyIp);
    /* migration : une ancienne empreinte SHA-256 est scellée (bcrypt) dès la connexion */
    if (!aurel_pwd_scelle($user['hash'])){
      $user['hash'] = aurel_pwd_sceller($user['hash']);
      aurel_store()->updateUser($user);
    }
    /* v5.7.1 : « demo » informe l'interface si la base est une démonstration */
    jout(200, array('ok' => true, 'token' => aurel_token($user['id']), 'user' => aurel_safe_user($user),
      'demo' => aurel_store()->isDemo()));
  }

  /* ---------- Déconnexion ---------- */
  if ($route === '/auth/logout' && $method === 'POST'){
    need_auth();
    aurel_revoquer_token(aurel_bearer());   /* le jeton ne peut plus être réutilisé */
    jout(200, array('ok' => true));
  }

  /* ---------- Changement de son propre mot de passe (tous les profils) ---------- */
  if ($route === '/auth/password' && $method === 'POST'){
    $u = need_auth();
    $b = jbody();
    $ancien = isset($b['ancien']) ? (string)$b['ancien'] : '';
    $nouveau = isset($b['nouveau']) ? (string)$b['nouveau'] : '';
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?';
    $key = $ip . '|' . strtolower(trim((string)$u['username']));
    if (aurel_rate_limited($key)) jout(429, array('ok' => false, 'msg' => 'Trop de tentatives — patientez un instant.'));
    if (!aurel_pwd_ok($u, $ancien)){
      aurel_record_fail($key);
      usleep(250000);
      jout(403, array('ok' => false, 'msg' => 'Mot de passe actuel incorrect.'));
    }
    if (strlen($nouveau) < 8) jout(400, array('ok' => false, 'msg' => 'Le nouveau mot de passe doit comporter au moins 8 caractères.'));
    if ($nouveau === $ancien) jout(400, array('ok' => false, 'msg' => 'Le nouveau mot de passe doit être différent de l\'actuel.'));
    aurel_clear_fails($key);
    $store = aurel_store();
    $db = $store->getDb();
    foreach ($db['users'] as $i => $x){
      if (isset($x['id']) && $x['id'] === $u['id']){
        $sel = bin2hex(random_bytes(6));
        $db['users'][$i]['salt'] = $sel;
        $db['users'][$i]['hash'] = aurel_pwd_sceller(aurel_pwd_empreinte($sel, $nouveau));
        unset($db['users'][$i]['mustChangePwd']);
      }
    }
    jout(200, array('ok' => true, 'rev' => $store->replaceDb($db)));
  }

  /* ---------- Session courante ---------- */
  if ($route === '/auth/me' && $method === 'GET'){
    $u = need_auth();
    jout(200, array('ok' => true, 'user' => aurel_safe_user($u)));
  }

  /* ---------- Base complète (synchronisation par révision) ---------- */
  if ($route === '/db' && $method === 'GET'){
    $u = need_auth();
    $store = aurel_store();
    /* chaque compte ne reçoit que son périmètre, sans sels ni empreintes */
    jout(200, array('ok' => true, 'rev' => $store->getRev(), 'db' => aurel_vue($u, $store->getDb()),
      'demo' => $store->isDemo()));
  }

  if ($route === '/db' && $method === 'POST'){
    $u = need_auth();
    /* v5.6 : plafond de taille (24 Mo de données + marge JSON) —
       en-tête Content-Length (rejet rapide) PUIS longueur réelle du
       corps (requêtes transférées par morceaux). */
    if ((isset($_SERVER['CONTENT_LENGTH']) && (int)$_SERVER['CONTENT_LENGTH'] > 26214400)){
      jout(413, array('ok' => false, 'msg' => 'Charge trop volumineuse.'));
    }
    $raw = file_get_contents('php://input');
    /* v7.2 : transport AUREL1 — corps « AUREL1:<base64> » (Content-Type
       text/plain). Contournement des pare-feu applicatifs (WAF/ModSecurity)
       des hébergements mutualisés qui refusent les gros POST JSON (HTTP 406)
       : le contenu encodé n'est pas inspectable. L'ancien format JSON reste
       accepté (compatibilité pendant la mise à jour des postes). */
    if (substr($raw, 0, 7) === 'AUREL1:'){
      $decode = base64_decode(substr($raw, 7), false);
      if (is_string($decode)) $raw = $decode;
    }
    if (strlen($raw) > 26214400){
      jout(413, array('ok' => false, 'msg' => 'Charge trop volumineuse.'));
    }
    $b = json_decode($raw, true);
    if (!is_array($b)) $b = array();
    $rev = isset($b['rev']) ? (int)$b['rev'] : null;
    $db = isset($b['db']) ? $b['db'] : null;
    if (!is_array($db) || empty($db['users'])) jout(400, array('ok' => false, 'msg' => 'Charge utile invalide.'));
    $store = aurel_store();
    if ($rev !== (int)$store->getRev()){
      jout(409, array('ok' => false, 'rev' => $store->getRev(),
        'msg' => 'Base modifiée depuis un autre poste — rechargez puis réessayez.'));
    }
    /* v5.6 : les modifications doivent rester dans les droits du rôle
       (comptes et établissements réservés aux administrateurs,
       lecteur en consultation seule). */
    $old = $store->getDb();
    /* la base reçue ne peut contenir que le périmètre du compte, qui est
       ensuite réintégré dans la base complète (autres établissements,
       sels et empreintes conservés côté serveur) */
    $raison = aurel_perimetre_ok($u, $old, $db);
    if ($raison === true){
      $db = aurel_reintegrer($u, $old, $db);
      $raison = aurel_db_changes_allowed($u, $old, $db);
    }
    if ($raison !== true){
      jout(403, array('ok' => false, 'msg' => 'Modification refusée : ' . $raison));
    }
    try {
      $newRev = $store->replaceDb(aurel_sceller_comptes($db), $rev);
      if ($newRev === false){
        jout(409, array('ok' => false, 'rev' => $store->getRev(),
          'msg' => 'Base modifiée depuis un autre poste — rechargez puis réessayez.'));
      }
      jout(200, array('ok' => true, 'rev' => $newRev));
    } catch (Throwable $e){
      aurel_log_error($e);
      jout(400, array('ok' => false, 'msg' => 'Enregistrement impossible — vérifiez les données.'));
    }
  }

  /* ---------- Réinitialisation de la démonstration (admin) ----------
     v5.7.1 : REFUSÉE sur une base de production (données réelles) —
     seule une base installée en mode démonstration peut être réinitialisée. */
  if ($route === '/reset' && $method === 'POST'){
    need_admin();
    $store = aurel_store();
    if (!$store->isDemo()){
      jout(403, array('ok' => false,
        'msg' => 'Réinitialisation refusée : cette base contient des données réelles (elle n\'est pas une démonstration).'));
    }
    jout(200, array('ok' => true, 'rev' => $store->reset()));
  }

  /* ---------- v6.4 : sauvegarde automatique (administrateur) ---------- */
  if ($route === '/backup' && $method === 'GET'){
    need_admin();
    $cfg = aurel_backup_config();
    jout(200, array('ok' => true,
      'cfg' => array('actif' => (bool)$cfg['actif'], 'dir' => (string)$cfg['dir'], 'freq' => (string)$cfg['freq'],
        'garder' => (int)$cfg['garder'], 'derniere' => (int)$cfg['derniere']),
      'fichiers' => aurel_backup_liste($cfg)));
  }
  if ($route === '/backup/settings' && $method === 'POST'){
    need_admin();
    $b = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($b)) $b = array();
    $cur = aurel_backup_config();
    $actif = !empty($b['actif']);
    $dir = isset($b['dir']) ? trim((string)$b['dir']) : $cur['dir'];
    $freq = isset($b['freq']) ? (string)$b['freq'] : $cur['freq'];
    $garder = isset($b['garder']) ? (int)$b['garder'] : (int)$cur['garder'];
    if (!array_key_exists($freq, aurel_backup_freqs())) $freq = '24h';
    if ($garder < 1) $garder = 1;
    if ($garder > 100) $garder = 100;
    if ($actif){
      $msg = '';
      if (!aurel_backup_dir_ok($dir, $msg)) jout(400, array('ok' => false, 'msg' => $msg));
    }
    $cfg = array('actif' => $actif, 'dir' => $dir, 'freq' => $freq, 'garder' => $garder,
      'derniere' => (int)$cur['derniere']);
    aurel_backup_config_save($cfg);
    $premiere = null;
    /* première activation : sauvegarde immédiate */
    if ($actif && !$cfg['derniere']){
      try { $premiere = aurel_backup_run(true); $cfg = aurel_backup_config(); }
      catch (Throwable $e){ aurel_log_error($e); $premiere = array('ok' => false, 'msg' => $e->getMessage()); }
    }
    jout(200, array('ok' => true, 'cfg' => $cfg, 'premiere' => $premiere, 'fichiers' => aurel_backup_liste($cfg)));
  }
  if ($route === '/backup/test' && $method === 'POST'){
    need_admin();
    $b = json_decode((string)file_get_contents('php://input'), true);
    $dir = is_array($b) && isset($b['dir']) ? trim((string)$b['dir']) : '';
    $msg = '';
    if (!aurel_backup_dir_ok($dir, $msg)) jout(400, array('ok' => false, 'msg' => $msg));
    $sonde = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'aurel-sonde-' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($sonde, 'test') === false || !@unlink($sonde))
      jout(400, array('ok' => false, 'msg' => 'Le serveur ne peut pas écrire dans ce répertoire.'));
    jout(200, array('ok' => true, 'msg' => 'Répertoire accessible en lecture et écriture.'));
  }
  if ($route === '/backup/now' && $method === 'POST'){
    need_admin();
    try {
      $r = aurel_backup_run(true);
      $cfg = aurel_backup_config();
      jout(200, array('ok' => true, 'fichier' => $r['fichier'], 'taille' => $r['taille'], 'purges' => $r['purges'],
        'cfg' => array('actif' => (bool)$cfg['actif'], 'dir' => (string)$cfg['dir'], 'freq' => (string)$cfg['freq'],
          'garder' => (int)$cfg['garder'], 'derniere' => (int)$cfg['derniere']),
        'fichiers' => aurel_backup_liste($cfg)));
    } catch (Throwable $e){
      aurel_log_error($e);
      jout(400, array('ok' => false, 'msg' => $e->getMessage()));
    }
  }

  jout(404, array('ok' => false, 'msg' => 'Route inconnue.'));

} catch (Throwable $e){
  aurel_log_error($e);
  jout(500, array('ok' => false, 'msg' => 'Erreur serveur — consultez data/error.log.'));
}
