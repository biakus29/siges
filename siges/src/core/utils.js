/* Utilitaires partagés */
export const MODES = { especes:'Espèces', mobile:'Mobile Money', virement:'Virement', cheque:'Chèque' };

/* ---------- v3.0 : profils d'utilisateurs par établissement ---------- */
export const ROLE_LABEL = {
  admin:'Administrateur de l\u2019établissement', econome:'Économe', lecteur:'Lecteur simple',
  superadmin:'Superadministrateur',
  censeur:'Censeur / Préfet des études', surveillant:'Surveillant général',
  surveillant_secteur:'Surveillant de secteur', titulaire:'Titulaire de classe',
  enseignant:'Enseignant', operateur:'Opérateur de saisie'
};
export const ROLE_SHORT = {
  admin:'Administrateur', econome:'Économe', lecteur:'Lecteur', superadmin:'Superadmin',
  censeur:'Censeur', surveillant:'Surv. général', surveillant_secteur:'Surv. secteur',
  titulaire:'Titulaire', enseignant:'Enseignant', operateur:'Opérateur'
};
export const ROLE_ICON = {
  admin:'shield', econome:'wallet', lecteur:'eye', superadmin:'bank',
  censeur:'book', surveillant:'shield', surveillant_secteur:'shield',
  titulaire:'classroom', enseignant:'book', operateur:'grid'
};
/* Menus : inscriptions, paiements, pédagogie (matieres/notes/bulletins),
   discipline, configuration. w = écriture, r = lecture, n = aucun. */
export const PERM = {
  admin:     { annees:'w', niveaux:'w', classes:'w', frais:'w', grille:'w', eleves:'w', paiements:'w', bourses:'w', rapports:'w', matieres:'w', stats:'w', notes:'w', bulletins:'w', discipline:'w', users:'w', journal:'w', parametres:'w', enseignants:'w', plan:'w', sequences:'w' },
  econome:   { annees:'r', niveaux:'r', classes:'r', frais:'r', grille:'r', eleves:'w', paiements:'w', bourses:'w', rapports:'w', users:'n', journal:'n' },
  lecteur:   { annees:'r', niveaux:'r', classes:'r', frais:'r', grille:'r', eleves:'r', paiements:'r', bourses:'r', rapports:'r', matieres:'r', notes:'r', bulletins:'r', stats:'r', discipline:'r', users:'n', journal:'n', enseignants:'r', plan:'r', sequences:'r' },
  /* Censeur/préfet des études : responsable d'un cycle (ensemble de niveaux) — pédagogie de son cycle */
  censeur:   { annees:'r', niveaux:'r', classes:'r', eleves:'r', matieres:'w', notes:'w', bulletins:'w', stats:'r', discipline:'r', enseignants:'w', plan:'w', sequences:'w' },
  /* Surveillant général : volet disciplinaire de l'établissement */
  surveillant:{ annees:'r', niveaux:'r', classes:'r', eleves:'r', discipline:'w', matieres:'r' },
  /* Surveillant de secteur : discipline des classes attribuées */
  surveillant_secteur:{ annees:'r', niveaux:'r', classes:'r', eleves:'r', discipline:'w' },
  /* Titulaire : toutes les informations de sa classe (consultation) */
  titulaire: { annees:'r', niveaux:'r', classes:'r', eleves:'r', paiements:'r', rapports:'r', matieres:'r', notes:'r', bulletins:'r', stats:'r', discipline:'r', enseignants:'r', plan:'r', sequences:'r' },
  /* Enseignant : saisie de ses notes et impression de ses rapports ; consulte le plan */
  enseignant:{ matieres:'r', notes:'w', bulletins:'w', stats:'r', plan:'r' },
  /* Opérateur de saisie : tous les droits sur les notes et la discipline */
  operateur: { annees:'r', niveaux:'r', classes:'r', eleves:'r', paiements:'r', rapports:'r', matieres:'w', notes:'w', bulletins:'w', stats:'r', discipline:'w', sequences:'r' }
};

/* ---------- Archive ZIP (sans dependance) : ecriture + lecture ----------
   Methode STORE (sans compression) : format officiel PKZIP, lisible par
   tous les outils (Explorateur Windows, WinRAR, unzip...). */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function utf8Bytes(str){ return new TextEncoder().encode(str); }
function dosTime(d){ return { t:(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d:(((d.getFullYear() - 1980) & 0x7F) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

/* Construit une archive ZIP a partir de entrees [{ name, data:string|Uint8Array }] */
export function makeZip(entries){
  const enc = utf8Bytes, parts = [], central = [];
  let offset = 0;
  const now = dosTime(new Date());
  entries.forEach(e => {
    const nameB = enc(e.name);
    const data = typeof e.data === 'string' ? enc(e.data) : e.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);   /* signature */
    lh.setUint16(4, 20, true);           /* version minimale */
    lh.setUint16(6, 0x0800, true);       /* nom UTF-8 */
    lh.setUint16(8, 0, true);            /* methode STORE */
    lh.setUint16(10, now.t, true); lh.setUint16(12, now.d, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nameB, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, now.t, true); ch.setUint16(14, now.d, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + data.length;
  });
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true); eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  [...parts, ...central, new Uint8Array(eocd.buffer)].forEach(p => { out.set(p, pos); pos += p.length; });
  return out;
}

/* Lit une archive ZIP (STORE ; DEFLATE via DecompressionStream si present).
   Retourne [{ name, data:Uint8Array }] — asynchrone. */
export async function readZip(u8){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  /* recherche de la fin de repertoire central (EOCD) */
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65536); i--){
    if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier ZIP invalide (repertoire central introuvable).');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);
  const files = [];
  const td = new TextDecoder();
  for (let n = 0; n < count; n++){
    if (dv.getUint32(ptr, true) !== 0x02014b50) throw new Error('Archive ZIP corrompue.');
    const method = dv.getUint16(ptr + 10, true);
    const csize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localOff = dv.getUint32(ptr + 42, true);
    const name = td.decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
    /* en-tete local : nom + eventual prefixe extra */
    const lnameLen = dv.getUint16(localOff + 26, true);
    const lextraLen = dv.getUint16(localOff + 28, true);
    const dstart = localOff + 30 + lnameLen + lextraLen;
    const raw = u8.subarray(dstart, dstart + csize);
    let data = raw;
    if (method === 8){
      if (typeof DecompressionStream !== 'function') throw new Error('Archive compressee non supportee par ce navigateur.');
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([raw]).stream().pipeThrough(ds);
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else if (method !== 0){
      throw new Error('Methode d\u2019archive non supportee (code ' + method + ').');
    }
    files.push({ name, data });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* Delai de verrouillage de session (5 minutes) — surchargeable pour les tests */
export function inactiviteMs(){
  try {
    const v = (typeof window !== 'undefined' && window.__AUREL_INACTIVITE_MS) || 0;
    if (v > 0) return v;
  } catch(e){}
  return 5 * 60 * 1000;
}
/* Intervalle de rafraichissement automatique (mode serveur) */
export function pollMs(){
  try {
    const v = (typeof window !== 'undefined' && window.__AUREL_POLL_MS) || 0;
    if (v > 0) return v;
  } catch(e){}
  return 20000;
}

/* ---------- Liste des anciens élèves : import CSV / JSON ----------
   En-têtes tolérants (accents, casse, séparateurs ; ou ,) :
   matricule, nom, prénom, sexe, date/lieu de naissance, parents,
   adresse, tuteur, téléphone, régime, ancien établissement… */
const ANCIENS_MAP = {
  'matricule':'matricule','mat':'matricule','numero':'matricule','numero eleve':'matricule','id':'matricule',
  'nom':'nom','nom de famille':'nom','nom eleve':'nom','nom de l eleve':'nom',
  'prenom':'prenom','prenom de l eleve':'prenom','nom usage':'prenom',
  'sexe':'sexe','genre':'sexe',
  'date de naissance':'dateNaissance','date naissance':'dateNaissance','naissance':'dateNaissance','date de naissance eleve':'dateNaissance','ne le':'dateNaissance','nee le':'dateNaissance',
  'lieu de naissance':'lieuNaissance','lieu naissance':'lieuNaissance','lieu':'lieuNaissance',
  'nom du pere':'pereNom','pere':'pereNom','nom pere':'pereNom',
  'profession du pere':'pereProfession','profession pere':'pereProfession','metier pere':'pereProfession',
  'telephone du pere':'pereTel','tel pere':'pereTel','contact pere':'pereTel','telephone pere':'pereTel',
  'nom de la mere':'mereNom','mere':'mereNom','nom mere':'mereNom',
  'profession de la mere':'mereProfession','profession mere':'mereProfession','metier mere':'mereProfession',
  'telephone de la mere':'mereTel','tel mere':'mereTel','contact mere':'mereTel','telephone mere':'mereTel',
  'ancien etablissement':'ancienEtablissement','ancienne ecole':'ancienEtablissement','etablissement d origine':'ancienEtablissement','provenance':'ancienEtablissement','dernier etablissement':'ancienEtablissement',
  'adresse':'adresse','quartier':'adresse','domicile':'adresse',
  'tuteur':'tuteur','tutrice':'tuteur','responsable':'tuteur',
  'telephone':'tel','tel':'tel','contact':'tel','telephone tuteur':'tel','contact tuteur':'tel','telephone responsable':'tel',
  'regime':'regime','statut interne':'regime','pension':'regime',
  'matricule national':'matricule','matricule candidat':'matricule',
  'nom prenom':'nomPrenom','nom et prenom':'nomPrenom','nom prenom eleve':'nomPrenom','nom complet':'nomPrenom',
  'identite eleve':'nomPrenom','identite':'nomPrenom','eleve':'nomPrenom','nom de l eleve complet':'nomPrenom',
  'telephone candidat':'tel','telephone eleve':'tel','contact candidat':'tel','contact eleve':'tel'
};
function _normHead(h){
  return String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function _normDate(v){
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(String(v).trim());
  if (m) return m[3] + '-' + (m[2].length === 1 ? '0' : '') + m[2] + '-' + (m[1].length === 1 ? '0' : '') + m[1];
  return String(v).trim();
}
function _csvLine(line, sep){
  const out = []; let cur = '', q = false;
  for (const ch of line){
    if (ch === '"') q = !q;
    else if (ch === sep && !q){ out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}
/* Convertit des lignes CSV (avec en-têtes) en fiches normalisées */
/* v5.7 : analyseur CSV générique (séparateur ; , ou tabulation, guillemets,
   fins de ligne Windows) — utilisé par les imports (élèves, matières…). */
export function parseCsvText(text){
  const t = String(text || '').replace(/^\uFEFF/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ((t.split('\n')[0].match(/\t/g) || []).length > 0 ? '\t' : ',');
  const rows = [];
  let cur = [], cell = '', inQ = false, wasQ = false;
  const push = () => { cur.push(cell); cell = ''; };
  const endRow = () => { push(); rows.push(cur); cur = []; };
  for (let i = 0; i < t.length; i++){
    const c = t[i];
    if (inQ){
      if (c === '"'){ if (t[i+1] === '"'){ cell += '"'; i++; } else { inQ = false; wasQ = true; } }
      else cell += c;
    } else if (c === '"' && cell === '' && !wasQ){ inQ = true; }
    else if (c === sep){ push(); wasQ = false; }
    else if (c === '\n' || c === '\r'){ if (c === '\r' && t[i+1] === '\n') i++; endRow(); wasQ = false; }
    else cell += c;
  }
  if (cell !== '' || cur.length) endRow();
  /* première ligne = en-tête */
  const header = (rows.shift() || []).map(h => String(h).trim());
  return { sep, header, rows: rows.filter(r => r.some(c => String(c).trim() !== '')).map(r => r.map(c => String(c).trim())) };
}

/* v5.7 : envoi WhatsApp au parent — normalise le numéro enregistré
   (Cameroun : 9 chiffres locaux → +237 ; +237… et 237… acceptés). */
export function waPhone(tel){
  let n = String(tel || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (/^237\d{9}$/.test(n)) return n;
  if (/^6\d{8}$/.test(n)) return '237' + n;         /* format local camerounais */
  if (n.length >= 10 && n.length <= 15) return n;     /* numéro international tel quel */
  return '';
}
export function waLink(tel, texte){
  const n = waPhone(tel);
  if (!n) return '';
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(String(texte || '').slice(0, 1500));
}

export function parseAnciensCsv(text){
  /* ne PAS rogner les lignes : une tabulation initiale signifie « première colonne vide » */
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return { rows:[], colonnes:[], inconnues:[] };
  let sep = ';', best = 0;
  for (const c of [';', '\t', ',']){ const n = lines[0].split(c).length; if (n > best){ best = n; sep = c; } }
  const heads = _csvLine(lines[0], sep).map(_normHead);
  const keys = heads.map(h => ANCIENS_MAP[h] || null);
  const rows = [];
  for (let i = 1; i < lines.length; i++){
    const cells = _csvLine(lines[i], sep);
    if (!cells.filter(Boolean).length) continue;
    const o = {};
    heads.forEach((h, j) => { const k = keys[j]; if (k && cells[j]) o[k] = cells[j]; });
    if (o.dateNaissance) o.dateNaissance = _normDate(o.dateNaissance);
    if (o.sexe) o.sexe = /^f/i.test(o.sexe) ? 'F' : 'M';
    if (o.regime) o.regime = /int/i.test(o.regime) ? 'interne' : 'externe';
    if (o.nomPrenom && !o.nom){
      const parts = String(o.nomPrenom).trim().split(/\s+/);
      let cut = 1;
      if (o.pereNom){
        const pere = String(o.pereNom).trim().split(/\s+/);
        let i = 0;
        while (i < parts.length - 1 && i < pere.length && parts[i].toUpperCase() === pere[i].toUpperCase()) i++;
        if (i >= 1) cut = i;   /* préfixe commun au nom du père = nom de famille */
      }
      o.nom = parts.slice(0, cut).join(' ');
      o.prenom = parts.slice(cut).join(' ');
      delete o.nomPrenom;
    }
    if (o.nom || o.prenom || o.matricule) rows.push(o);
  }
  return { rows, colonnes:heads.filter((h, j) => keys[j]), inconnues:[...new Set(heads.filter((h, j) => !keys[j]))] };
}
/* Convertit un tableau JSON (clés françaises ou internes) en fiches normalisées */
export function parseAnciensJson(arr){
  if (!Array.isArray(arr)) return { rows:[], colonnes:[], inconnues:[] };
  const rows = [];
  arr.forEach(it => {
    if (!it || typeof it !== 'object') return;
    const o = {};
    Object.entries(it).forEach(([k, v]) => {
      const kk = ANCIENS_MAP[_normHead(k)];
      if (kk && v != null && v !== '') o[kk] = String(v).trim();
    });
    if (o.dateNaissance) o.dateNaissance = _normDate(o.dateNaissance);
    if (o.sexe) o.sexe = /^f/i.test(o.sexe) ? 'F' : 'M';
    if (o.regime) o.regime = /int/i.test(o.regime) ? 'interne' : 'externe';
    if (o.nom || o.prenom || o.matricule) rows.push(o);
  });
  return { rows, colonnes:[...new Set(rows.flatMap(r => Object.keys(r)))], inconnues:[] };
}

export function sum(arr, f){ return arr.reduce((s,x)=> s + (f ? f(x) : x), 0); }
export function fmt(n){ return new Intl.NumberFormat('fr-FR').format(Math.round(n||0)); }
export function fcfa(n){ return fmt(n) + ' FCFA'; }
export function pad2(n){ return (n<10?'0':'')+n; }
export function nowISO(){ const d = new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+'T'+pad2(d.getHours())+':'+pad2(d.getMinutes()); }
export function todayISO(){ return nowISO().slice(0,10); }
export function fmtD(iso){
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? iso+'T12:00' : iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}
export function fmtDT(iso){
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return fmtD(iso) + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
export function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
export function parseMoney(v){ const n = parseInt(String(v==null?'':v).replace(/[^\d]/g,''),10); return isNaN(n) ? 0 : n; }
export function uid(){ return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
export function round500(n){ return Math.round(n/500)*500; }
export function initials(nom){
  const p = String(nom||'?').trim().split(/\s+/);
  return ((p[0]||'').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase();
}
export function pctTxt(x){ return (Math.round(Math.min(x,9.999)*1000)/10).toFixed(1).replace('.',',') + ' %'; }

/* ---------- Montant en lettres (français) ---------- */
const _U = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
function _u99(x){
  if (x < 20) return _U[x];
  const t = Math.floor(x/10), r = x%10;
  if (t === 8) return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + _U[r];
  if (t === 7 || t === 9) {
    const base = (t === 7 ? 'soixante' : 'quatre-vingt');
    if (r === 1 && t === 7) return 'soixante et onze';
    return base + '-' + _U[10+r];
  }
  const b = ['','dix','vingt','trente','quarante','cinquante','soixante'][t];
  if (r === 0) return b;
  if (r === 1) return b + ' et un';
  return b + '-' + _U[r];
}
function _u999(x){
  const c = Math.floor(x/100), r = x%100;
  let s = '';
  if (c === 1) s = 'cent';
  else if (c > 1) s = _U[c] + ' cent' + (r === 0 ? 's' : '');
  if (r) s += (s ? ' ' : '') + _u99(r);
  return s;
}
export function enLettres(n){
  n = Math.floor(Math.abs(n||0));
  if (n === 0) return 'zéro';
  const mil = Math.floor(n/1000)%1000, mils = Math.floor(n/1000000), rest = n%1000, parts = [];
  if (mils) parts.push(mils === 1 ? 'un million' : _u999(mils) + ' millions');
  if (mil) parts.push(mil === 1 ? 'mille' : _u999(mil) + ' mille');
  if (rest) parts.push(_u999(rest));
  return parts.join(' ');
}

/* ---------- Générateur pseudo-aléatoire déterministe ---------- */
export function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed>>>15, 1|seed);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14)>>>0)/4294967296;
  };
}

/* ---------- Téléchargement de fichier ---------- */
export function downloadFile(name, content, mime){
  try {
    const blob = new Blob([content], { type: (mime||'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 3000);
    return true;
  } catch(e){ return false; }
}

/* Clonage profond (repli JSON si structuredClone indisponible) */
export function deepClone(obj){
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- Export CSV ---------- */
export function csvCell(v){
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCSV(header, rows){
  return '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
}
export function downloadCSV(filename, headerOrCsv, rows){
  try {
    const csv = rows ? toCSV(headerOrCsv, rows) : headerOrCsv;
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(e){} }, 500);
    return true;
  } catch(e){ return false; }
}
