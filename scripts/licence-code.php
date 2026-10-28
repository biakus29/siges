<?php
/* ================================================================
   Générateur de codes de maintenance — Aurel School SIGES
   ----------------------------------------------------------------
   À GARDER POUR VOUS (ne pas livrer au client). Produit le code à
   saisir dans l'écran « Maintenance requise ».

   Usage :
     php scripts/licence-code.php <SECRET> <REFERENCE>

     <SECRET>    : votre phrase secrète privée (identique à la clé
                   'lic_secret' du config.php installé chez le client).
     <REFERENCE> : le numéro « Référence » affiché à l'écran de maintenance
                   (1 au premier blocage, 2 au suivant, etc.).

   Exemple :
     php scripts/licence-code.php "mon-secret-prive-42" 1
   ================================================================ */

$secret = isset($argv[1]) ? (string)$argv[1] : '';
$ref    = isset($argv[2]) ? (int)$argv[2] : 0;

if ($secret === '' || $ref < 1){
  fwrite(STDERR, "Usage : php scripts/licence-code.php <SECRET> <REFERENCE>\n");
  fwrite(STDERR, "  <SECRET>    phrase secrète privée (clé lic_secret du config.php client)\n");
  fwrite(STDERR, "  <REFERENCE> numéro affiché à l'écran de maintenance (1, 2, 3, ...)\n");
  exit(1);
}

/* Même formule que api/licence.php : aurel_lic_code() */
$raw = hash_hmac('sha256', 'AUREL-LIC:' . $ref, $secret, true);
$alpha = '34679ACDEFGHJKLMNPQRTUVWXY';
$n = strlen($alpha);
$out = '';
for ($i = 0; $i < 12; $i++) $out .= $alpha[ord($raw[$i]) % $n];
$code = substr($out, 0, 4) . '-' . substr($out, 4, 4) . '-' . substr($out, 8, 4);

echo "Référence $ref  ->  code de maintenance :  $code\n";
