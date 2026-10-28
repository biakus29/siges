/* ================================================================
   v5.5 — ENCODEUR QR CODE autonome (aucune dépendance externe).
   Mode octet (UTF-8), versions 1 à 10, correction d'erreur L (~7 %),
   choix du masque par score de pénalité (règles ISO/IEC 18004).
   Utilisé pour le QR code de sécurité des bulletins, cartes et badges.
   Validé en test par décodage round-trip (voir tests/core.test.mjs). */

/* ---------- corps GF(256), polynôme primitif 0x11D ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function(){
  let x = 1;
  for (let i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

/* polynôme générateur Reed-Solomon de degré d (coefficient le plus fort en tête) */
const GEN_CACHE = {};
function rsGen(deg){
  if (GEN_CACHE[deg]) return GEN_CACHE[deg];
  let p = [1];
  for (let i = 0; i < deg; i++){
    const q = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++){ q[j] ^= p[j]; q[j + 1] ^= gmul(p[j], EXP[i]); }
    p = q;
  }
  GEN_CACHE[deg] = p;
  return p;
}
/* reste de la division des données par le générateur (= codes de correction) */
function rsRemain(data, deg){
  const gen = rsGen(deg);
  const r = data.concat(new Array(deg).fill(0));
  for (let i = 0; i < data.length; i++){
    const f = r[i];
    if (f) for (let j = 0; j < gen.length; j++) r[i + j] ^= gmul(gen[j], f);
  }
  return r.slice(data.length);
}

/* ---------- capacités (niveau L) : [total, données] × répétition ----------
   Données utiles (octets) : 19, 34, 55, 80, 108, 136, 156, 194, 232, 274. */
const VERSIONS = {
  1:  { blocks: [[[26, 19], 1]],                 ec: 7  },
  2:  { blocks: [[[44, 34], 1]],                 ec: 10 },
  3:  { blocks: [[[70, 55], 1]],                 ec: 15 },
  4:  { blocks: [[[100, 80], 1]],                ec: 20 },
  5:  { blocks: [[[134, 108], 1]],               ec: 26 },
  6:  { blocks: [[[86, 68], 2]],                 ec: 18 },
  7:  { blocks: [[[98, 78], 2]],                 ec: 20 },
  8:  { blocks: [[[121, 97], 2]],                ec: 24 },
  9:  { blocks: [[[146, 116], 2]],               ec: 30 },
  10: { blocks: [[[86, 68], 2], [[87, 69], 2]],  ec: 18 }
};
function blocksOf(v){
  const out = [];
  VERSIONS[v].blocks.forEach(([bd, rep]) => { for (let i = 0; i < rep; i++) out.push(bd); });
  return out;
}
const dataCapacity = v => blocksOf(v).reduce((t, b) => t + b[1], 0);

/* centres des motifs d'alignement par version */
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

/* ---------- BCH : information de format (15 bits) et de version (18 bits) ---------- */
const bitsOf = n => n.toString(2).length;
function bchRemainder(data, gen, shift){
  let d = data << shift;
  const gd = bitsOf(gen);
  while (bitsOf(d) - gd >= 0) d ^= gen << (bitsOf(d) - gd);
  return d;
}
/* format : 5 bits (niveau L = 0b01 sur 2 bits + masque 3 bits) + BCH(15,5), masqué */
const ECC_L = 1;
const formatBits = mask => (((ECC_L << 3) | mask) << 10 | bchRemainder((ECC_L << 3) | mask, 0x537, 10)) ^ 0x5412;
const versionBits = v => (v << 12) | bchRemainder(v, 0x1F25, 12);

/* ---------- UTF-8 ---------- */
function utf8Bytes(str){
  const out = [];
  const s = unescape(encodeURIComponent(String(str)));
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
  return out;
}

/* ---------- constitution du flux de mots (mode octet + RS + entrelacement) ---------- */
function buildCodewords(bytes, v){
  const cap = dataCapacity(v);
  const ccBits = v <= 9 ? 8 : 16;
  const needed = 4 + ccBits + bytes.length * 8;
  if (needed > cap * 8) throw new Error('Données trop longues pour la version QR ' + v + '.');
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(4, 4);                       /* mode octet */
  push(bytes.length, ccBits);       /* longueur */
  bytes.forEach(b => push(b, 8));
  const room = cap * 8 - bits.length;
  push(0, Math.min(4, Math.max(0, room)));      /* terminaison */
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8){
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  let pad = 0xEC;
  while (data.length < cap){ data.push(pad); pad = pad === 0xEC ? 0x11 : 0xEC; }
  /* découpage en blocs + Reed-Solomon */
  const bl = blocksOf(v), ecLen = VERSIONS[v].ec;
  let off = 0;
  const dataBlocks = [], ecBlocks = [];
  bl.forEach(([ , dCount]) => {
    const d = data.slice(off, off + dCount); off += dCount;
    dataBlocks.push(d);
    ecBlocks.push(rsRemain(d, ecLen));
  });
  /* entrelacement : données puis codes de correction */
  const out = [];
  const maxD = Math.max.apply(null, dataBlocks.map(b => b.length));
  for (let i = 0; i < maxD; i++) dataBlocks.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach(b => out.push(b[i]));
  return out;
}

/* ---------- matrices ---------- */
function newMatrix(size){
  const m = [], f = [];
  for (let y = 0; y < size; y++){ m.push(new Array(size).fill(null)); f.push(new Array(size).fill(0)); }
  return { m, f, size };
}
const setFn = (M, x, y, v) => { if (x >= 0 && y >= 0 && x < M.size && y < M.size){ M.m[y][x] = v; M.f[y][x] = 1; } };

function drawFinder(M, x, y){
  for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++){
    const dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    setFn(M, x + c, y + r, dark ? 1 : 0);
  }
}
function drawAlign(M, x, y){
  for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++){
    const dark = (r === -2 || r === 2 || c === -2 || c === 2) || (r === 0 && c === 0);
    setFn(M, x + c, y + r, dark ? 1 : 0);
  }
}
function buildMatrix(v, codewords, maskId){
  const size = 17 + 4 * v;
  const M = newMatrix(size);
  /* repères + séparateurs */
  drawFinder(M, 0, 0); drawFinder(M, size - 7, 0); drawFinder(M, 0, size - 7);
  /* motifs d'alignement (hors zones de repères) */
  const pos = ALIGN[v];
  pos.forEach(r => pos.forEach(c => { if (M.m[r][c] == null) drawAlign(M, c, r); }));
  /* minutage */
  for (let i = 8; i < size - 8; i++){ if (M.m[6][i] == null) setFn(M, i, 6, i % 2 === 0 ? 1 : 0); if (M.m[i][6] == null) setFn(M, 6, i, i % 2 === 0 ? 1 : 0); }
  /* module fixe sombre */
  setFn(M, 8, size - 8, 1);
  /* information de version (v ≥ 7) */
  if (v >= 7){
    const vb = versionBits(v);
    for (let i = 0; i < 18; i++){
      const b = (vb >>> i) & 1;
      setFn(M, size - 11 + (i % 3), Math.floor(i / 3), b);          /* en haut à droite */
      setFn(M, Math.floor(i / 3), size - 11 + (i % 3), b);          /* en bas à gauche */
    }
  }
  /* réservation de l'information de format (remplie après masquage) */
  for (let i = 0; i <= 8; i++){ if (M.m[8][i] == null) setFn(M, i, 8, 0); if (M.m[i][8] == null) setFn(M, 8, i, 0); }
  for (let i = 0; i < 8; i++){ if (M.m[8][size - 1 - i] == null) setFn(M, size - 1 - i, 8, 0); if (M.m[size - 1 - i][8] == null) setFn(M, 8, size - 1 - i, 0); }
  /* placement des données en zigzag */
  const maskFn = MASKS[maskId];
  let inc = -1, row = size - 1, bitIdx = 7, byteIdx = 0;
  for (let col = size - 1; col > 0; col -= 2){
    if (col === 6) col--;
    for (;;){
      for (let c = 0; c < 2; c++){
        const x = col - c;
        if (M.m[row][x] == null){
          let dark = false;
          if (byteIdx < codewords.length) dark = ((codewords[byteIdx] >>> bitIdx) & 1) === 1;
          if (maskFn(x, row)) dark = !dark;
          M.m[row][x] = dark ? 1 : 0;
          bitIdx--;
          if (bitIdx === -1){ byteIdx++; bitIdx = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= size){ row -= inc; inc = -inc; break; }
    }
  }
  /* information de format (2 copies) */
  const fb = formatBits(maskId);
  for (let i = 0; i < 15; i++){
    const b = (fb >>> i) & 1;
    /* verticale (colonne 8) */
    if (i < 6) M.m[i][8] = b;
    else if (i < 8) M.m[i + 1][8] = b;
    else M.m[size - 15 + i][8] = b;
    /* horizontale (ligne 8) */
    if (i < 8) M.m[8][size - 1 - i] = b;
    else if (i < 9) M.m[8][7] = b;
    else M.m[8][14 - i] = b;
  }
  return M;
}

/* ---------- masques ---------- */
const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x * y) % 3 + (x + y) % 2) % 2 === 0
];

/* ---------- score de pénalité (choix du masque) ---------- */
function penalty(M){
  const n = M.size, m = M.m;
  let p = 0;
  /* N1 : suites de ≥ 5 modules identiques */
  for (let y = 0; y < n; y++){
    let run = 1;
    for (let x = 1; x < n; x++){
      if (m[y][x] === m[y][x - 1]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) p += 3 + (run - 5);
  }
  for (let x = 0; x < n; x++){
    let run = 1;
    for (let y = 1; y < n; y++){
      if (m[y][x] === m[y - 1][x]) run++; else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) p += 3 + (run - 5);
  }
  /* N2 : blocs 2×2 uniformes */
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++){
    if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  /* N3 : motifs type 1011101 bordés de 4 modules clairs */
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (get, i, pat) => pat.every((b, k) => get(i + k) === b);
  for (let y = 0; y < n; y++) for (let x = 0; x <= n - 11; x++){
    if (match(i => m[y][i], x, pat1) || match(i => m[y][i], x, pat2)) p += 40;
  }
  for (let x = 0; x < n; x++) for (let y = 0; y <= n - 11; y++){
    if (match(i => m[i][x], y, pat1) || match(i => m[i][x], y, pat2)) p += 40;
  }
  /* N4 : proportion de modules sombres */
  let dark = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) dark += m[y][x];
  p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return p;
}

/* ---------- API : qrEncode(texte) → { size, modules, version, mask } ---------- */
export function qrEncode(text){
  const bytes = utf8Bytes(text);
  if (!bytes.length) throw new Error('QR : contenu vide.');
  let v = 1;
  for (; v <= 10; v++){
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + bytes.length * 8 <= dataCapacity(v) * 8) break;
  }
  if (v > 10) throw new Error('QR : contenu trop long (max ~274 octets).');
  const codewords = buildCodewords(bytes, v);
  let best = null, bestScore = Infinity, bestMask = 0;
  for (let mk = 0; mk < 8; mk++){
    const M = buildMatrix(v, codewords, mk);
    const s = penalty(M);
    if (s < bestScore){ bestScore = s; best = M; bestMask = mk; }
  }
  return { size: best.size, modules: best.m, version: v, mask: bestMask };
}
