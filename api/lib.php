<?php
/* ================================================================
   Aurel School SIGES — multi-établissements
   Bibliothèque serveur PHP : stockage MySQL EXCLUSIF (PDO),
   jetons HMAC, limitation des tentatives.
   Compatible PHP 7.0+ — requiert l'extension pdo_mysql.
   ================================================================ */

define('AUREL_APP', 'aurel-school-siges');
define('AUREL_VERSION', '7.2');
define('AUREL_TTL_MS', 8 * 3600 * 1000);      /* jetons valables 8 h */

function aurel_colls(){
  /* v2.1 : racine multi-etablissements + collections historiques (compatibilite) */
  return array('users', 'etablissements', 'bases', 'journalGlobal',
               'annees', 'niveaux', 'classes', 'frais', 'tarifs',
               'eleves', 'paiements', 'bourses', 'journal', 'anciens',
               'matieres', 'notes', 'discipline', 'groupes', 'enseignants', 'plan', 'sequences', 'appreciations');
}

function aurel_root(){ return dirname(__DIR__); }
function aurel_data_dir(){ return aurel_root() . '/data'; }
function aurel_seed_file(){ return aurel_root() . '/seed/seed.json'; }
function aurel_config_file(){ return aurel_root() . '/config.php'; }

/* ---------- Configuration (secret des jetons, généré à l'installation) ---------- */
function aurel_config($recharger = false){
  /* Relue à CHAQUE appel : sur le serveur intégré php -S (et avec des
     workers), un cache statique peut survivre d'une requête à l'autre et
     servir un secret périmé après une (ré)installation — ce qui invaliderait
     des jetons pourtant émis avec le secret courant. Le coût de lecture
     d'un si petit fichier est négligeable. */
  $cfg = array('secret' => '', 'adresse' => '', 'storage' => 'mysql',
    'mysql' => array('host' => '127.0.0.1', 'port' => 3306, 'user' => '', 'pass' => '', 'base' => 'aurel_school'));
  $f = aurel_config_file();
  if (is_file($f)){
    /* OPcache peut servir une version périmée du fichier juste après une
       (ré)installation (revalidate_freq) : on invalide explicitement. */
    if (function_exists('opcache_invalidate')) @opcache_invalidate($f, true);
    $loaded = @include $f;   /* config.php : <?php return ['secret' => '...']; */
    if (is_array($loaded)) $cfg = array_merge($cfg, $loaded);
  }
  if (empty($cfg['secret'])) $cfg['secret'] = 'aurel-secret-provisoire-installez';
  return $cfg;
}

function aurel_installed(){
  return is_file(aurel_config_file());
}

/* ---------- Réponses JSON ---------- */
function jout($status, $data){
  if (!headers_sent()){
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
  }
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function jbody(){
  $raw = file_get_contents('php://input');
  if (!is_string($raw) || $raw === '') return array();
  $j = json_decode($raw, true);
  return is_array($j) ? $j : array();
}

/* ---------- Graine de démonstration ----------
   seed/seed.json est généré depuis le module JavaScript officiel
   (buildSeed, seedV 5) : données identiques à la version Node.
   À l'import, les paiements du jour postérieurs à l'heure courante
   sont ramenés à l'instant présent (aucune heure dans le futur). */
function aurel_seed_db(){
  $f = aurel_seed_file();
  if (!is_file($f)) throw new RuntimeException('seed/seed.json introuvable.');
  $db = json_decode(file_get_contents($f), true);
  if (!is_array($db) || empty($db['users'])) throw new RuntimeException('seed/seed.json invalide.');
  $now = date('Y-m-d\TH:i');
  $today = date('Y-m-d');
  if (isset($db['paiements']) && is_array($db['paiements'])){
    foreach ($db['paiements'] as $i => $p){
      if (isset($p['date']) && strpos($p['date'], $today) === 0 && substr($p['date'], 0, 16) > $now){
        $db['paiements'][$i]['date'] = $now;
      }
    }
  }
  return $db;
}

/* ---------- Magasin MySQL (base aurel_school, PDO) ---------- */
class AurelMysqlStore {
  private $pdo;
  public $mode = 'mysql';
  public function __construct($pdo){
    $this->pdo = $pdo;
    $this->pdo->exec('CREATE TABLE IF NOT EXISTS entities (
      coll VARCHAR(32) NOT NULL,
      id   VARCHAR(64) NOT NULL,
      ord  INT NOT NULL DEFAULT 0,
      doc  LONGTEXT NOT NULL,
      PRIMARY KEY (coll, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $this->pdo->exec('CREATE TABLE IF NOT EXISTS meta (
      `key`   VARCHAR(32) PRIMARY KEY,
      `value` LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  }
  private function meta($key){
    $q = $this->pdo->prepare('SELECT `value` FROM meta WHERE `key`=?');
    $q->execute(array($key));
    $v = $q->fetchColumn();
    return $v === false ? null : $v;
  }
  private function setMeta($key, $value){
    $this->pdo->prepare('INSERT INTO meta (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)')
      ->execute(array($key, $value));
  }
  public function getRev(){ return (int)$this->meta('rev'); }
  /* données techniques (jetons révoqués…) — hors de la base applicative */
  public function getMeta($key){ return $this->meta($key); }
  public function putMeta($key, $value){ $this->setMeta($key, $value); }
  /* Met à jour un seul compte (mot de passe re-haché) sans changer la révision :
     les sels et empreintes ne sont jamais transmis aux postes. */
  public function updateUser($doc){
    $this->pdo->prepare("UPDATE entities SET doc=? WHERE coll='users' AND id=?")
      ->execute(array(json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (string)$doc['id']));
  }
  public function getDb(){
    $db = array('version' => 1);
    $q = $this->pdo->prepare('SELECT doc FROM entities WHERE coll=? ORDER BY ord, id');
    foreach (aurel_colls() as $c){
      $q->execute(array($c));
      $db[$c] = array();
      while ($row = $q->fetchColumn()){
        $doc = json_decode($row, true);
        if (is_array($doc)) $db[$c][] = $doc;
      }
    }
    $st = $this->meta('settings');
    if ($st !== null){
      $x = json_decode($st, true);
      if (is_array($x)) $db['settings'] = $x;
    }
    return $db;
  }
  /* $revAttendue : verrou de révision ATOMIQUE — la révision est relue sous
     verrou (FOR UPDATE) dans la transaction ; deux enregistrements simultanés
     ne peuvent plus s'écraser. Renvoie false si la révision a changé. */
  public function replaceDb($db, $revAttendue = null){
    if (!is_array($db) || empty($db['users'])) throw new RuntimeException('base invalide');
    $this->pdo->beginTransaction();
    try {
      if ($revAttendue !== null){
        $q = $this->pdo->query("SELECT `value` FROM meta WHERE `key`='rev' FOR UPDATE");
        $cur = $q ? (int)$q->fetchColumn() : 0;
        if ($cur !== (int)$revAttendue){ $this->pdo->rollBack(); return false; }
      }
      $this->pdo->exec('DELETE FROM entities');
      $ins = $this->pdo->prepare('INSERT INTO entities (coll,id,ord,doc) VALUES (?,?,?,?)');
      foreach (aurel_colls() as $c){
        $i = 0;
        $docs = isset($db[$c]) && is_array($db[$c]) ? $db[$c] : array();
        foreach ($docs as $doc){
          $id = isset($doc['id']) ? (string)$doc['id'] : (string)$i;
          $ins->execute(array($c, $id, $i, json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
          $i++;
        }
      }
      $this->setMeta('settings', json_encode(isset($db['settings']) ? $db['settings'] : new stdClass(),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
      $this->setMeta('rev', (string)($this->getRev() + 1));
      $this->pdo->commit();
    } catch (Throwable $e){
      $this->pdo->rollBack();
      throw $e;
    }
    return $this->getRev();
  }
  public function reset(){ return $this->replaceDb(aurel_seed_db()); }
  /* v5.7.1 : drapeau « base de démonstration » — posé par install.php
     (mode démo). /api/reset et le bouton « Réinitialiser » sont refusés
     sur une base de production pour éviter toute perte de données réelles. */
  public function isDemo(){ return $this->meta('demo') === '1'; }
  public function setDemo($estDemo){ $this->setMeta('demo', $estDemo ? '1' : '0'); }
}

/* Options PDO communes. v6.7 : serveur MySQL distant — échec rapide plutôt
   que blocage. MySQL hébergé exigeant TLS (Aiven…) : la variable
   d'environnement MYSQL_SSL_CA indique le certificat CA du fournisseur. */
function aurel_mysql_options(){
  $o = array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10);
  $ca = getenv('MYSQL_SSL_CA');
  if ($ca && is_file($ca)) $o[PDO::MYSQL_ATTR_SSL_CA] = $ca;
  return $o;
}

/* Connexion MySQL selon la configuration (throw si inaccessible) */
function aurel_mysql_pdo($m = null){
  $cfg = aurel_config();
  if (!is_array($m)) $m = $cfg['mysql'];
  $dsn = 'mysql:host=' . $m['host'] . ';port=' . (int)$m['port'] . ';dbname=' . $m['base'] . ';charset=utf8mb4';
  return new PDO($dsn, $m['user'], $m['pass'], aurel_mysql_options());
}

/* ---------- Magasin partagé (singleton) ----------
   $installDb : si fourni (installateur), remplace la base immédiatement.
   Sinon, une base absente/vide est initialisée avec la démonstration. */
function aurel_store($installDb = null){
  static $store = null;
  /* En installation : on ignore le cache et on RECHARGE la configuration
     (config.php vient d'etre ecrit — le cache de la requete est perime). */
  if ($store !== null && $installDb === null) return $store;

  $dir = aurel_data_dir();
  if (!is_dir($dir)) @mkdir($dir, 0775, true);

  /* Stockage MySQL exclusif — aucune autre configuration possible */
  $cfg = aurel_config($installDb !== null);
  if (!aurel_installed() || empty($cfg['mysql']['user'])){
    throw new RuntimeException('Application non installée — ouvrez install.php et indiquez la connexion MySQL.');
  }
  $store = new AurelMysqlStore(aurel_mysql_pdo());
  try {
    $db = $store->getDb();
    /* une base vide n'est PLUS remplie avec la démonstration (comptes aux mots
       de passe publics) : seul l'installateur initialise la base. */
    if ($installDb !== null){
      $store->replaceDb($installDb);
    }
  } catch (Throwable $e){ /* seed absent : erreur claire remontee par l API */ }
  return $store;
}

/* ---------- Jetons HMAC (compatibles le schéma de la version Node) ---------- */
function b64url_encode($raw){ return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }
function b64url_decode($s){
  $s = strtr((string)$s, '-_', '+/');
  return base64_decode($s . str_repeat('=', (4 - strlen($s) % 4) % 4));
}
function aurel_sign($payload){
  return b64url_encode(hash_hmac('sha256', $payload, aurel_config()['secret'], true));
}
function aurel_token($userId){
  $p = b64url_encode(json_encode(array('uid' => $userId, 'exp' => round(microtime(true) * 1000) + AUREL_TTL_MS,
    'jti' => bin2hex(random_bytes(8)))));
  return $p . '.' . aurel_sign($p);
}
function aurel_verify_token($t){
  $parts = explode('.', (string)$t);
  if (count($parts) !== 2) return null;
  list($p, $s) = $parts;
  if (!hash_equals(aurel_sign($p), $s)) return null;
  $d = json_decode(b64url_decode($p), true);
  if (!is_array($d) || empty($d['exp']) || $d['exp'] <= round(microtime(true) * 1000)) return null;
  if (!empty($d['jti']) && aurel_token_revoque($d['jti'])) return null;
  return $d;
}

/* ---------- Jetons révoqués (déconnexion) ---------- */
function aurel_revoques(){
  $j = json_decode((string)aurel_store()->getMeta('revoques'), true);
  return is_array($j) ? $j : array();
}
function aurel_token_revoque($jti){
  $r = aurel_revoques();
  return isset($r[$jti]);
}
function aurel_revoquer_token($t){
  $d = aurel_verify_token($t);
  if (!$d || empty($d['jti'])) return;
  $r = aurel_revoques();
  $now = round(microtime(true) * 1000);
  foreach ($r as $k => $exp){ if ($exp <= $now) unset($r[$k]); }   /* purge des jetons expirés */
  $r[$d['jti']] = $d['exp'];
  aurel_store()->putMeta('revoques', json_encode($r));
}

/* ---------- Mots de passe ----------
   Empreinte d'origine (compatible avec l'interface) : sha256(sel:mot de passe).
   Elle est désormais SCELLÉE côté serveur avec password_hash (bcrypt) : une
   fuite de la base ne permet plus de retrouver les mots de passe par force brute. */
function aurel_pwd_empreinte($salt, $pwd){ return hash('sha256', $salt . ':' . $pwd); }
function aurel_pwd_scelle($hash){ return is_string($hash) && strpos($hash, '$2y$') === 0; }
function aurel_pwd_sceller($empreinte){ return password_hash($empreinte, PASSWORD_DEFAULT); }
function aurel_pwd_ok($user, $pwd){
  if (!$user || !isset($user['salt'], $user['hash'])) return false;
  $e = aurel_pwd_empreinte($user['salt'], $pwd);
  if (aurel_pwd_scelle($user['hash'])) return password_verify($e, $user['hash']);
  return hash_equals((string)$user['hash'], $e);
}

/* ---------- Périmètre de chaque compte ----------
   Le superadministrateur voit tout le réseau ; tout autre compte ne voit que
   SON établissement. Les sels et empreintes ne quittent jamais le serveur. */
function aurel_etab_de($u, $db){
  if (!empty($u['etablissementId'])) return (string)$u['etablissementId'];
  $e = isset($db['etablissements']) && is_array($db['etablissements']) ? $db['etablissements'] : array();
  return count($e) === 1 && isset($e[0]['id']) ? (string)$e[0]['id'] : null;
}
function aurel_user_visible($doc, $etab){
  return is_array($doc) && (!isset($doc['role']) || $doc['role'] !== 'superadmin')
    && isset($doc['etablissementId']) && (string)$doc['etablissementId'] === (string)$etab;
}
function aurel_sans_secrets($users){
  $out = array();
  foreach ((array)$users as $x){ if (is_array($x)) unset($x['salt'], $x['hash']); $out[] = $x; }
  return $out;
}
function aurel_vue($u, $db){
  if (isset($db['users'])) $db['users'] = aurel_sans_secrets($db['users']);
  if ($u['role'] === 'superadmin') return $db;
  $old_users = $db['users'];
  $etab = aurel_etab_de($u, $db);
  $uids = array();
  $users = array();
  foreach ((array)$db['users'] as $x){
    if (aurel_user_visible($x, $etab)){ $users[] = $x; $uids[(string)$x['id']] = 1; }
  }
  $db['users'] = $users;
  foreach (array('etablissements', 'bases') as $c){
    $l = array();
    foreach ((array)(isset($db[$c]) ? $db[$c] : array()) as $x){
      if (is_array($x) && isset($x['id']) && (string)$x['id'] === (string)$etab) $l[] = $x;
    }
    $db[$c] = $l;
  }
  $j = array();
  foreach ((array)(isset($db['journalGlobal']) ? $db['journalGlobal'] : array()) as $x){
    if (is_array($x) && isset($x['uid']) && isset($uids[(string)$x['uid']])) $j[] = $x;
  }
  $db['journalGlobal'] = $j;
  /* informe l'interface sans révéler les comptes du réseau */
  $db['superadminExiste'] = false;
  foreach ((array)$old_users as $x){ if (is_array($x) && isset($x['role']) && $x['role'] === 'superadmin') $db['superadminExiste'] = true; }
  return $db;
}

/* Contrôle du périmètre d'un envoi (comptes non superadmin) : la base reçue
   ne doit contenir QUE ce que le compte a le droit de voir. */
function aurel_perimetre_ok($u, $old, $new){
  if ($u['role'] === 'superadmin') return true;
  $etab = aurel_etab_de($u, $old);
  if ($etab === null) return 'compte sans établissement.';
  $oldU = aurel_by_id(isset($old['users']) ? $old['users'] : array());
  $premierSuper = true;
  foreach ($oldU as $x){ if (isset($x['role']) && $x['role'] === 'superadmin'){ $premierSuper = false; break; } }
  foreach ((array)(isset($new['users']) ? $new['users'] : array()) as $x){
    if (!is_array($x) || !isset($x['id'])) return 'compte invalide.';
    $id = (string)$x['id'];
    if (isset($oldU[$id]) && !aurel_user_visible($oldU[$id], $etab)) return 'compte d\'un autre établissement.';
    if (aurel_user_visible($x, $etab)) continue;
    /* seul cas hors établissement : création du PREMIER superadministrateur par l'administrateur */
    if ($u['role'] === 'admin' && $premierSuper && !isset($oldU[$id]) && isset($x['role']) && $x['role'] === 'superadmin') continue;
    return 'un compte ne peut être rattaché qu\'à votre établissement.';
  }
  foreach ((array)(isset($new['bases']) ? $new['bases'] : array()) as $x){
    if (!is_array($x) || !isset($x['id']) || (string)$x['id'] !== (string)$etab) return 'données d\'un autre établissement.';
  }
  $vue = aurel_vue($u, $old);
  if (!aurel_same(aurel_by_id($vue['etablissements']), aurel_by_id(isset($new['etablissements']) ? $new['etablissements'] : array())))
    return 'modification d\'établissement réservée au superadministrateur.';
  return true;
}

/* Reconstitue la base complète : ce que le compte a envoyé (son périmètre)
   + ce qu'il ne voit pas (autres établissements, sels et empreintes). */
function aurel_reintegrer($u, $old, $new){
  unset($new['superadminExiste']);   /* indicateur de lecture, jamais stocké */
  $oldU = aurel_by_id(isset($old['users']) ? $old['users'] : array());
  $users = array();
  $vus = array();
  foreach ((array)$new['users'] as $x){
    $id = (string)$x['id'];
    $vus[$id] = 1;
    if ((!isset($x['hash']) || $x['hash'] === '') && isset($oldU[$id]['hash'])){
      $x['salt'] = isset($oldU[$id]['salt']) ? $oldU[$id]['salt'] : '';
      $x['hash'] = $oldU[$id]['hash'];
    }
    $users[] = $x;
  }
  if ($u['role'] !== 'superadmin'){
    $etab = aurel_etab_de($u, $old);
    foreach ($oldU as $id => $x){ if (!isset($vus[$id]) && !aurel_user_visible($x, $etab)) $users[] = $x; }
    $new['etablissements'] = isset($old['etablissements']) ? $old['etablissements'] : array();
    $mienne = null;
    foreach ((array)(isset($new['bases']) ? $new['bases'] : array()) as $b){ if ((string)$b['id'] === (string)$etab) $mienne = $b; }
    $bases = array();
    $trouvee = false;
    foreach ((array)(isset($old['bases']) ? $old['bases'] : array()) as $b){
      if ($mienne !== null && is_array($b) && (string)$b['id'] === (string)$etab){ $bases[] = $mienne; $trouvee = true; }
      else $bases[] = $b;
    }
    if ($mienne !== null && !$trouvee) $bases[] = $mienne;
    $new['bases'] = $bases;
    /* journal global : entrées visibles reçues + entrées invisibles conservées */
    $uidsVis = array();
    foreach ($oldU as $id => $x){ if (aurel_user_visible($x, $etab)) $uidsVis[$id] = 1; }
    $j = isset($new['journalGlobal']) && is_array($new['journalGlobal']) ? $new['journalGlobal'] : array();
    $ids = aurel_by_id($j);
    foreach ((array)(isset($old['journalGlobal']) ? $old['journalGlobal'] : array()) as $x){
      if (!is_array($x)) continue;
      if (isset($x['uid']) && isset($uidsVis[(string)$x['uid']])) continue;
      if (isset($x['id']) && isset($ids[(string)$x['id']])) continue;
      $j[] = $x;
    }
    usort($j, function($a, $b){ return strcmp(isset($b['date']) ? $b['date'] : '', isset($a['date']) ? $a['date'] : ''); });
    $new['journalGlobal'] = array_slice($j, 0, 250);
  }
  $new['users'] = $users;
  return $new;
}
/* Scelle (bcrypt) les nouvelles empreintes envoyées par l'interface */
function aurel_sceller_comptes($db){
  foreach ($db['users'] as $i => $x){
    if (isset($x['hash']) && is_string($x['hash']) && preg_match('/^[0-9a-f]{64}$/', $x['hash']))
      $db['users'][$i]['hash'] = aurel_pwd_sceller($x['hash']);
  }
  return $db;
}

/* ---------- Authentification ---------- */
function aurel_bearer(){
  $h = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
  /* v7.0 : mod_rewrite transmet parfois l'en-tête sous ce nom (hébergements) */
  if ($h === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  if ($h === '' && function_exists('apache_request_headers')){
    $ah = apache_request_headers();
    if (isset($ah['Authorization'])) $h = $ah['Authorization'];
  }
  if (strpos($h, 'Bearer ') === 0) return substr($h, 7);
  /* v7.0 : LA correction pour les hébergements internet — beaucoup d'hébergeurs
     (PHP en CGI/FastCGI) ne transmettent PAS l'en-tête Authorization à PHP :
     la connexion réussissait puis CHAQUE appel suivant était refusé (401),
     affiché « Serveur injoignable » par l'application. Le jeton est donc
     aussi envoyé dans l'en-tête X-Aurel-Token, toujours transmis. */
  $x = isset($_SERVER['HTTP_X_AUREL_TOKEN']) ? trim($_SERVER['HTTP_X_AUREL_TOKEN']) : '';
  if ($x !== '') return $x;
  return null;
}
function aurel_auth_user(){
  $t = aurel_bearer();
  if (!$t) return null;
  $d = aurel_verify_token($t);
  if (!$d || empty($d['uid'])) return null;
  /* v7.0 : renouvellement glissant — un jeton encore valide à mi-vie est
     réémis dans l'en-tête X-Aurel-Token ; plus de session qui expire en
     pleine journée de travail. */
  if (isset($d['exp']) && ($d['exp'] - round(microtime(true) * 1000)) < AUREL_TTL_MS / 2){
    @header('X-Aurel-Token: ' . aurel_token($d['uid']));
  }
  $db = aurel_store()->getDb();
  foreach ($db['users'] as $u){
    if ($u['id'] === $d['uid'] && !empty($u['actif'])){
      /* un établissement suspendu coupe aussi les sessions déjà ouvertes */
      if ($u['role'] !== 'superadmin' && !empty($u['etablissementId']) && isset($db['etablissements'])){
        foreach ((array)$db['etablissements'] as $e){
          if (is_array($e) && isset($e['id'], $e['actif']) && $e['id'] === $u['etablissementId'] && $e['actif'] === false) return null;
        }
      }
      return $u;
    }
  }
  return null;
}
function aurel_safe_user($u){
  return array(
    'id' => isset($u['id']) ? $u['id'] : null,
    'username' => isset($u['username']) ? $u['username'] : '',
    'nom' => isset($u['nom']) ? $u['nom'] : '',
    'role' => isset($u['role']) ? $u['role'] : '',
    'actif' => !empty($u['actif']),
    'dernierAcces' => isset($u['dernierAcces']) ? $u['dernierAcces'] : null,
  );
}

/* ---------- v5.6 : autorisation des modifications (diff de la base) ----------
   Le client synchronise la base ENTIÈRE ; le serveur vérifie que les
   changements demandés sont compatibles avec le rôle du demandeur :
   • admin / superadmin : tout est permis ;
   • lecteur : consultation seule (seuls son « dernierAcces » et les
     ajouts au journal — plafonnés à 250 — sont acceptés) ;
   • autres rôles : tout SAUF les comptes utilisateurs et les
     établissements (réservés aux administrateurs).
   Empêche notamment l'élévation de privilèges par appel direct de
   l'API (ex. : un lecteur qui s'octroie le rôle administrateur). */
function aurel_canon($v){
  if (is_array($v)){
    $out = array();
    foreach ($v as $k => $x){ $out[(string)$k] = aurel_canon($x); }
    ksort($out, SORT_STRING);
    return $out;
  }
  return $v;
}
function aurel_same($a, $b){
  return json_encode(aurel_canon($a)) === json_encode(aurel_canon($b));
}
function aurel_by_id($rows){
  $m = array();
  if (is_array($rows)) foreach ($rows as $r){ if (is_array($r) && isset($r['id'])) $m[(string)$r['id']] = $r; }
  return $m;
}
function aurel_journal_ok($newList){
  /* le journal ne peut que s'enrichir (250 entrées max côté client) */
  return is_array($newList) && count($newList) <= 260;
}
function aurel_db_changes_allowed($user, $old, $new){
  $role = isset($user['role']) ? $user['role'] : '';
  if ($role === 'admin' || $role === 'superadmin') return true;
  $uid = (string)(isset($user['id']) ? $user['id'] : '');

  /* --- comptes utilisateurs : réservés aux administrateurs --- */
  $oldU = aurel_by_id(isset($old['users']) ? $old['users'] : array());
  $newU = aurel_by_id(isset($new['users']) ? $new['users'] : array());
  foreach ($newU as $id => $doc){
    if (!isset($oldU[$id])) return 'Création de compte réservée à l\'administrateur.';
    if (!aurel_same($oldU[$id], $doc)){
      if ((string)$id === $uid){
        $d = $doc;
        $d['dernierAcces'] = isset($oldU[$id]['dernierAcces']) ? $oldU[$id]['dernierAcces'] : null;
        if (aurel_same($oldU[$id], $d)) continue;   /* seul dernierAcces a changé */
      }
      return 'Modification de compte réservée à l\'administrateur.';
    }
  }
  foreach ($oldU as $id => $doc){ if (!isset($newU[$id])) return 'Suppression de compte réservée à l\'administrateur.'; }

  /* --- établissements : réservés aux administrateurs --- */
  $oldE = aurel_by_id(isset($old['etablissements']) ? $old['etablissements'] : array());
  $newE = aurel_by_id(isset($new['etablissements']) ? $new['etablissements'] : array());
  foreach ($newE as $id => $doc){
    if (!isset($oldE[$id]) || !aurel_same($oldE[$id], $doc)) return 'Modification d\'établissement réservée à l\'administrateur.';
  }
  foreach ($oldE as $id => $doc){ if (!isset($newE[$id])) return 'Suppression d\'établissement réservée à l\'administrateur.'; }

  /* --- lecteur : rien d'autre ne doit changer (hors journal et propre dernierAcces) --- */
  if ($role === 'lecteur'){
    $norm = $new;
    if (isset($norm['users']) && is_array($norm['users'])){
      foreach ($norm['users'] as $i => $nu){ if (is_array($nu) && isset($nu['id']) && (string)$nu['id'] === $uid && isset($oldU[$uid])) $norm['users'][$i] = $oldU[$uid]; }
    }
    if (!aurel_journal_ok(isset($norm['journal']) ? $norm['journal'] : array())) return 'Profil « lecteur » : consultation seule.';
    if (!aurel_journal_ok(isset($norm['journalGlobal']) ? $norm['journalGlobal'] : array())) return 'Profil « lecteur » : consultation seule.';
    unset($norm['journal'], $norm['journalGlobal'], $old['journal'], $old['journalGlobal']);
    if (isset($norm['bases']) && is_array($norm['bases'])){
      $ob = aurel_by_id(isset($old['bases']) ? $old['bases'] : array());
      foreach ($norm['bases'] as $i => $nb){
        if (!is_array($nb) || !isset($nb['id'])) continue;
        if (!aurel_journal_ok(isset($nb['journal']) ? $nb['journal'] : array())) return 'Profil « lecteur » : consultation seule.';
        unset($norm['bases'][$i]['journal']);
      }
      if (isset($old['bases']) && is_array($old['bases'])){
        foreach ($old['bases'] as $i => $obd){ if (is_array($obd)) unset($old['bases'][$i]['journal']); }
      }
    }
    if (!aurel_same($old, $norm)) return 'Profil « lecteur » : consultation seule — aucune modification autorisée pour ce profil.';
  }
  return true;
}

/* ---------- Limitation des tentatives de connexion ----------
   5 échecs pour un couple IP|identifiant → 30 s de blocage ; en v5.6,
   15 échecs pour une IP seule → 120 s (ralentit les attaques qui
   varient les identifiants). */
function aurel_attempts_file(){ return aurel_data_dir() . '/attempts.json'; }
function aurel_is_ip_key($key){ return strpos((string)$key, 'IP|') === 0; }
function aurel_fail_limit($key){ return aurel_is_ip_key($key) ? 15 : 5; }    /* échecs avant blocage */
function aurel_fail_lock($key){ return aurel_is_ip_key($key) ? 120 : 30; }   /* durée du blocage (s) */
function aurel_rate_limited($key){
  $f = aurel_attempts_file();
  $all = is_file($f) ? json_decode(file_get_contents($f), true) : array();
  if (!is_array($all) || !isset($all[$key])) return false;
  $a = $all[$key];
  if (!empty($a['until'])){
    if ($a['until'] > time()) return true;    /* blocage en cours */
    unset($all[$key]);                        /* blocage expiré : on repart à zéro */
    @file_put_contents($f, json_encode($all), LOCK_EX);
  } elseif (!empty($a['ts']) && time() - $a['ts'] > 900){
    unset($all[$key]);                        /* plus aucun échec depuis 15 min : oublié */
    @file_put_contents($f, json_encode($all), LOCK_EX);
  }
  return false;                               /* compteur d'échecs en cours : on garde */
}
function aurel_record_fail($key){
  $f = aurel_attempts_file();
  $all = is_file($f) ? json_decode(file_get_contents($f), true) : array();
  if (!is_array($all)) $all = array();
  $a = isset($all[$key]) && is_array($all[$key]) ? $all[$key] : array('n' => 0, 'until' => 0);
  if (!empty($a['ts']) && time() - $a['ts'] > 900) $a['n'] = 0;   /* fenêtre de 15 min */
  $a['n'] = (int)$a['n'] + 1;
  $a['ts'] = time();
  if ($a['n'] >= aurel_fail_limit($key)){ $a['until'] = time() + aurel_fail_lock($key); $a['n'] = 0; }
  $all[$key] = $a;
  /* purge des entrées expirées */
  foreach ($all as $k => $v){ if (!empty($v['until']) && $v['until'] <= time()) unset($all[$k]); }
  @file_put_contents($f, json_encode($all), LOCK_EX);
}
function aurel_clear_fails($key){
  $f = aurel_attempts_file();
  if (!is_file($f)) return;
  $all = json_decode(file_get_contents($f), true);
  if (!is_array($all)) return;
  unset($all[$key]);
  @file_put_contents($f, json_encode($all), LOCK_EX);
}

/* ---------- v5.6 : journal d'erreurs serveur (hors réponses client) ---------- */
function aurel_log_error($e){
  $l = date('Y-m-d H:i:s') . ' ' . get_class($e) . ' : ' . (string)$e->getMessage()
     . ' [' . basename($e->getFile() ?: '?') . ':' . (string)$e->getLine() . "]\n";
  $f = aurel_data_dir() . '/error.log';
  if (!is_dir(aurel_data_dir())) @mkdir(aurel_data_dir(), 0775, true);
  @file_put_contents($f, $l, FILE_APPEND | LOCK_EX);
  if (filesize($f) > 1048576){                 /* plafonné à 1 Mo */
    @rename($f, $f . '.old');
  }
}

/* ================================================================
   v6.4 — SAUVEGARDE AUTOMATIQUE (répertoire local ou réseau)
   Configuration dans data/backup.json (non servi) : activation,
   répertoire cible, fréquence, nombre de copies conservées.
   Déclenchement paresseux : à chaque requête API (aurel_backup_hook),
   puis à la demande (bouton « Sauvegarder maintenant »).
   ================================================================ */
function aurel_backup_file(){ return aurel_data_dir() . '/backup.json'; }

function aurel_backup_config(){
  $cfg = array('actif' => false, 'dir' => '', 'freq' => '24h', 'garder' => 10, 'derniere' => 0);
  $f = aurel_backup_file();
  if (is_file($f)){
    $j = json_decode((string)file_get_contents($f), true);
    if (is_array($j)) foreach ($j as $k => $v) if (array_key_exists($k, $cfg)) $cfg[$k] = $v;
  }
  return $cfg;
}

function aurel_backup_config_save($cfg){
  if (!is_dir(aurel_data_dir())) @mkdir(aurel_data_dir(), 0775, true);
  @file_put_contents(aurel_backup_file(), json_encode($cfg), LOCK_EX);
}

/* Fréquences proposées (heures pleines → secondes) */
function aurel_backup_freqs(){
  return array('1h' => 3600, '6h' => 21600, '12h' => 43200, '24h' => 86400, '7j' => 604800);
}
function aurel_backup_freq_secondes($f){
  $m = aurel_backup_freqs();
  return isset($m[$f]) ? $m[$f] : 86400;
}

/* Répertoire utilisable ? (local ou réseau — UNC Windows accepté) */
function aurel_backup_dir_ok($dir, &$msg){
  if (!is_string($dir) || trim($dir) === ''){ $msg = 'Indiquez le répertoire des sauvegardes.'; return false; }
  $dir = rtrim(trim($dir), '/\\');
  if ($dir === ''){ $msg = 'Chemin de répertoire invalide.'; return false; }
  if (!is_dir($dir)){ $msg = 'Répertoire introuvable : ' . $dir . ' (créez-le ou vérifiez le chemin réseau).'; return false; }
  $reel = realpath($dir);
  $racine = realpath(aurel_root());
  if ($reel !== false && $racine !== false
    && stripos(rtrim(str_replace('\\', '/', $reel), '/') . '/', rtrim(str_replace('\\', '/', $racine), '/') . '/') === 0){
    $msg = 'Ce répertoire est publié sur le web avec l\'application : choisissez un dossier en dehors de ' . $racine . '.';
    return false;
  }
  if (!is_writable($dir)){ $msg = 'Répertoire non accessible en écriture — vérifiez les droits du serveur PHP.'; return false; }
  return true;
}

/* Exécute une sauvegarde complète (base MySQL → fichier JSON horodaté) */
function aurel_backup_run($force = false){
  $cfg = aurel_backup_config();
  if (!$force && (!$cfg['actif'] || $cfg['dir'] === '')) return array('ok' => false, 'ignore' => true);
  $msg = '';
  if (!aurel_backup_dir_ok($cfg['dir'], $msg)) throw new RuntimeException($msg);
  $store = aurel_store();
  $charge = array(
    'application' => 'aurel-school-siges',
    'format' => 'sauvegarde-automatique',
    'version' => AUREL_VERSION,
    'date' => date('c'),
    'rev' => $store->getRev(),
    'demo' => $store->isDemo(),
    'db' => $store->getDb(),
  );
  $json = json_encode($charge, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) throw new RuntimeException('Export de la base impossible.');
  $dir = rtrim(trim($cfg['dir']), '/\\');
  $nom = 'aurel-sauvegarde-' . date('Ymd-His') . '.json';
  $cible = $dir . DIRECTORY_SEPARATOR . $nom;
  $tmp = $cible . '.tmp';
  if (@file_put_contents($tmp, $json, LOCK_EX) === false)
    throw new RuntimeException('Écriture impossible dans ' . $dir . ' — vérifiez les droits.');
  if (!@rename($tmp, $cible)){ @unlink($tmp); throw new RuntimeException('Finalisation du fichier impossible.'); }
  /* purge : ne conserver que les N sauvegardes les plus récentes */
  $fichiers = glob($dir . DIRECTORY_SEPARATOR . 'aurel-sauvegarde-*.json');
  if (!is_array($fichiers)) $fichiers = array();
  sort($fichiers);
  $purges = 0;
  $garder = max(1, (int)$cfg['garder']);
  while (count($fichiers) > $garder){ @unlink(array_shift($fichiers)); $purges++; }
  $cfg['derniere'] = time();
  aurel_backup_config_save($cfg);
  return array('ok' => true, 'fichier' => $nom, 'taille' => strlen($json), 'purges' => $purges);
}

/* Déclenchement paresseux : appelé à chaque requête API */
function aurel_backup_hook(){
  try {
    $cfg = aurel_backup_config();
    if (!$cfg['actif'] || $cfg['dir'] === '') return;
    if (time() - (int)$cfg['derniere'] < aurel_backup_freq_secondes($cfg['freq'])) return;
    aurel_backup_run(true);
  } catch (Throwable $e){
    aurel_log_error($e);
    /* mémorise la tentative pour ne pas relancer à chaque requête */
    $c = aurel_backup_config();
    $c['derniere'] = time();
    aurel_backup_config_save($c);
  }
}

/* Liste des sauvegardes présentes dans le répertoire (50 max) */
function aurel_backup_liste($cfg){
  $out = array();
  if (is_string($cfg['dir']) && $cfg['dir'] !== '' && is_dir($cfg['dir'])){
    $fichiers = glob(rtrim($cfg['dir'], '/\\') . DIRECTORY_SEPARATOR . 'aurel-sauvegarde-*.json');
    if (is_array($fichiers)){
      foreach ($fichiers as $f){
        $out[] = array('nom' => basename($f), 'taille' => @filesize($f), 'date' => date('Y-m-d H:i:s', @filemtime($f)));
      }
      usort($out, function($a, $b){ return strcmp($b['nom'], $a['nom']); });
    }
  }
  return array_slice($out, 0, 50);
}
