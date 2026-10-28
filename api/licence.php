<?php
/* ================================================================
   Aurel School SIGES — activation différée (verrou de maintenance)
   ----------------------------------------------------------------
   Licence d'exploitation à durée limitée : passé le délai, l'accès est
   suspendu jusqu'à la saisie d'un code de maintenance que seul le
   prestataire peut produire (dérivé d'un secret privé). Verrou SOUPLE :
   il ne bloque que l'accès, ne supprime et ne modifie AUCUNE donnée.

   • Le compteur démarre au premier appel réel de l'API (≈ mise en service).
   • Chaque code valide repousse l'échéance d'une nouvelle période.
   • Le code dépend d'une « référence » affichée à l'écran (incrémentée à
     chaque déblocage) : un code déjà utilisé ne resert pas.
   ================================================================ */

/* Durée d'une période, en jours (2 mois ≈ 60). Modifiable ici. */
if (!defined('AUREL_LIC_PERIODE_JOURS')) define('AUREL_LIC_PERIODE_JOURS', 60);

/* Secret privé des codes : clé 'lic_secret' de config.php si présente,
   sinon dérivée du secret des jetons. À DÉFINIR chez vous (voir procédure)
   pour pouvoir générer les codes hors ligne. */
function aurel_lic_secret(){
  $c = aurel_config();
  if (!empty($c['lic_secret'])) return (string)$c['lic_secret'];
  return hash('sha256', 'aurel-lic|' . (isset($c['secret']) ? $c['secret'] : ''));
}

/* Code attendu pour une référence donnée : 12 caractères non ambigus,
   groupés par 4 (ex. ACDF-7H3K-MNPQ). Même formule que le générateur. */
function aurel_lic_code($ref){
  $raw = hash_hmac('sha256', 'AUREL-LIC:' . (int)$ref, aurel_lic_secret(), true);
  $alpha = '34679ACDEFGHJKLMNPQRTUVWXY';   /* ni 0/O, 1/I/L, 2/Z, 5/S, 8/B */
  $n = strlen($alpha);
  $out = '';
  for ($i = 0; $i < 12; $i++) $out .= $alpha[ord($raw[$i]) % $n];
  return substr($out, 0, 4) . '-' . substr($out, 4, 4) . '-' . substr($out, 8, 4);
}

/* Normalise une saisie : majuscules, sans séparateurs ni espaces. */
function aurel_lic_norm($s){
  return strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string)$s));
}

/* État courant. Initialise paresseusement le compteur et l'échéance. */
function aurel_lic_etat(){
  $s = aurel_store();
  $t0 = (int)$s->getMeta('lic_t0');
  if ($t0 <= 0){ $t0 = time(); $s->putMeta('lic_t0', (string)$t0); }
  $seq = (int)$s->getMeta('lic_seq');                 /* nombre de déblocages déjà faits */
  $jusqua = (int)$s->getMeta('lic_jusqua');
  if ($jusqua <= 0){ $jusqua = $t0 + AUREL_LIC_PERIODE_JOURS * 86400; $s->putMeta('lic_jusqua', (string)$jusqua); }
  return array(
    'bloque' => time() > $jusqua,
    'jusqua' => $jusqua,
    'seq'    => $seq,
    'ref'    => $seq + 1,                              /* référence affichée à l'écran */
  );
}

/* Tente un déblocage. Retourne array('ok'=>bool). */
function aurel_lic_activer($code){
  $e = aurel_lic_etat();
  $attendu = aurel_lic_norm(aurel_lic_code($e['ref']));
  $saisi = aurel_lic_norm($code);
  if ($saisi === '' || !hash_equals($attendu, $saisi)) return array('ok' => false);
  $s = aurel_store();
  $base = max(time(), (int)$e['jusqua']);             /* on cumule le temps restant */
  $s->putMeta('lic_jusqua', (string)($base + AUREL_LIC_PERIODE_JOURS * 86400));
  $s->putMeta('lic_seq', (string)((int)$e['seq'] + 1));
  return array('ok' => true);
}

/* Garde : coupe toute route sauf les routes libres si la licence est échue. */
function aurel_lic_guard($route){
  static $libres = array('/health', '/etablissements', '/licence/etat', '/licence/activer');
  if (in_array($route, $libres, true)) return;
  if (!aurel_installed()) return;
  $e = aurel_lic_etat();
  if ($e['bloque']){
    jout(423, array(
      'ok' => false, 'locked' => true, 'ref' => $e['ref'],
      'msg' => 'Accès momentanément suspendu pour maintenance. Saisissez le code de maintenance fourni par votre prestataire pour réactiver l\'application.',
    ));
  }
}
