/* Impression isolée d'un état : le contenu de #print-zone est cloné dans un
   hôte dédié directement sous <body>, tout le reste de la page est masqué à
   l'impression. Fonctionne quelle que soit la structure de l'application
   (modales, défilement, aperçus) et dans les navigateurs réels. */

export function printZone(){
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return false;
  const node = doc.getElementById('print-zone');
  if (!node) return false;
  const w = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  if (!w) return false;

  /* hôte propre à chaque impression */
  let host = doc.getElementById('print-host');
  if (host && host.parentNode) host.parentNode.removeChild(host);
  host = doc.createElement('div');
  host.id = 'print-host';
  host.appendChild(node.cloneNode(true));
  doc.body.appendChild(host);
  doc.body.classList.add('printing-host');

  let cleaned = false;
  const done = () => {
    if (cleaned) return;
    cleaned = true;
    doc.body.classList.remove('printing-host');
    if (host && host.parentNode) host.parentNode.removeChild(host);
    try { w.removeEventListener('afterprint', done); } catch(e){}
  };
  w.addEventListener('afterprint', done);

  try { w.print(); }
  catch(e){ done(); return false; }
  /* filet de sécurité si l'événement afterprint ne se déclenche pas */
  setTimeout(done, 1500);
  return true;
}
