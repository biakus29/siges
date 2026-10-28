/* Smoke v1.11 — grille nouveaux/anciens, badges, ergonomie (connexion épurée v2.2) */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { ({ JSDOM } = require('/tmp/jsdomtest/node_modules/jsdom')); }
const fs = require('fs');
const bundle = fs.readFileSync('/tmp/bundle.react.test.js', 'utf8');
const css = fs.readFileSync('/home/user/aurel-react/src/styles.css', 'utf8');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body><div id="root"></div><scr'+'ipt>' + bundle + '</scr'+'ipt></body></html>';
const errors = [];
const dom = new JSDOM(html, { runScripts:'dangerously', url:'https://app.local/', pretendToBeVisual:true,
  beforeParse(w){
    w.scrollTo = () => {};
    w.addEventListener('error', e => errors.push(e.message));
    w.console.error = (...a) => { const s = a.join(' '); if (!/Warning|act\(|defaultProps|navigation/i.test(s)) errors.push('console.error: ' + s); };
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
const norm = s => s.replace(/\u202f|\u00a0/g, ' ');
const LS = () => { const d = JSON.parse(w.localStorage.getItem('aurel_school_compta_react_v1')); const b = (Array.isArray(d && d.bases) && (d.bases.find(x => x.id === 'etab-001') || d.bases[0])) || d;
  return (d && d.bases) ? Object.assign({}, b, { users:d.users, etablissements:d.etablissements, bases:d.bases }) : d; };
function setInput(el, v){ Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles:true })); }
function click(el){ el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true })); }
const nav = x => click($$('.nav-i').find(n => x.test(n.textContent)));
let fails = 0;
async function step(n, fn){ try { await fn(); console.log('✓', n); } catch(e){ console.error('✗', n, '—', e.message); fails++; } }

(async () => {
  await wait(700);
  await step('connexion : écran SIGES opérationnel', async () => {
    if (!$('.lw-card')) throw new Error('carte connexion absente');
    if (!$('#li-user') || !$('#li-pass')) throw new Error('champs identifiant/mot de passe absents');
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(500);
    if (!$('#app')) throw new Error('app absente');
  });

  await step('grille : couche « Nouveaux / Anciens » présente (frais d\u2019inscription)', async () => {
    nav(/Grille/); await wait(400);
    const segs = $$('.seg').map(s => norm(s.textContent));
    if (!segs.some(t => t.includes('Nouveaux') && t.includes('Anciens'))) throw new Error('sélecteur élèves absent : ' + segs.join(' | '));
  });

  await step('grille matrice : INSCR 25 000 (nouveaux) puis 10 000 (anciens) — 6ème', async () => {
    /* vue matrice, lignes niveaux */
    click($$('.seg button').find(b => norm(b.textContent) === 'Matrice')); await wait(400);
    const cells = () => $$('#view tbody tr');
    const rowNv6 = () => cells().find(r => norm(r.textContent).startsWith('Sixième'));
    const valInscr = () => {
      const tr = rowNv6();
      const idx = [...$$('#view thead th')].findIndex(h => norm(h.textContent) === 'INSCR');
      const cell = tr.cells[idx];
      const inp = cell && cell.querySelector('input');
      return inp ? norm(inp.value) : (cell ? norm(cell.textContent) : '?');
    };
    /* couche tous : tarif commun (25 000) */
    if (!valInscr().includes('25 000')) throw new Error('couche Tous : INSCR nv6 = ' + valInscr());
    /* couche nouveaux */
    click($$('.seg button').find(b => norm(b.textContent) === 'Nouveaux')); await wait(350);
    if (!valInscr().includes('25 000')) throw new Error('couche Nouveaux : INSCR nv6 = ' + valInscr());
    /* couche anciens */
    click($$('.seg button').find(b => norm(b.textContent) === 'Anciens')); await wait(350);
    if (!valInscr().includes('10 000')) throw new Error('couche Anciens : INSCR nv6 = ' + valInscr());
    /* les frais sans distinction (SCOL) restent lisibles mais non modifiables */
    const badge = $$('.badge').find(b => norm(b.textContent).includes('anciens élèves'));
    if (!badge) throw new Error('badge couche anciens absent');
    click($$('.seg button').find(b => norm(b.textContent) === 'Tous élèves')); await wait(300);
  });

  await step('situation : un ANCIEN paie 10 000, un NOUVEAU 25 000 (même classe)', async () => {
    const ls = LS();
    const an26 = ls.eleves.filter(e => e.anneeId === 'an26' && e.statut === 'actif');
    const ancien = an26.find(e => e.statutEleve === 'ancien');
    const nouveau = an26.find(e => e.statutEleve === 'nouveau' && e.classeId === ancien.classeId);
    if (!ancien || !nouveau) throw new Error('pas de pair ancien/nouveau dans la même classe');
    const lireInscr = () => {
      const row = $$('#modal-root tbody tr').find(r => norm(r.textContent).includes("Frais d'inscription"));
      return row ? norm(row.textContent).replace(/\s+/g, ' ').slice(0, 90) : 'absent';
    };
    /* v5.4 : situations de frais réservées à l'économe */
    click($('button[title="Se déconnecter"]')); await wait(600);
    setInput($('#li-user'), 'econome'); setInput($('#li-pass'), 'econome2026');
    click($('.lw-btn')); await wait(800);
    /* ancien */
    nav(/Élèves/); await wait(300);
    setInput($('.srch input'), ancien.matricule); await wait(400);
    click($('button[title="Situation des frais"]')); await wait(450);
    const vAncien = lireInscr();
    click($('#modal-root .m-x')); await wait(250);
    /* nouveau */
    setInput($('.srch input'), nouveau.matricule); await wait(400);
    click($('button[title="Situation des frais"]')); await wait(450);
    const vNouveau = lireInscr();
    click($('#modal-root .m-x')); await wait(250);
    if (!/10\s*000/.test(vAncien)) throw new Error('ancien : INSCR = ' + vAncien);
    if (!/25\s*000/.test(vNouveau)) throw new Error('nouveau : INSCR = ' + vNouveau);
    /* retour au compte admin pour la suite du parcours */
    click($('button[title="Se déconnecter"]')); await wait(600);
    setInput($('#li-user'), 'admin'); setInput($('#li-pass'), 'admin2026');
    click($('.lw-btn')); await wait(800);
    console.log('   ' + ancien.matricule + ' (ancien) → ' + vAncien + ' FCFA · ' + nouveau.matricule + ' (nouveau) → ' + vNouveau + ' FCFA');
  });

  await step('liste élèves : badges Nouveau / Ancien', async () => {
    nav(/Élèves/); await wait(400);
    setInput($('.srch input'), ''); await wait(300);
    const vue = norm($('#view').textContent);
    if (!vue.includes('Ancien')) throw new Error('badge Ancien absent');
    if (!vue.includes('Nouveau')) throw new Error('badge Nouveau absent');
  });

  await step('formulaire frais : option « Tarifs distincts nouveaux / anciens »', async () => {
    nav(/Types de frais/); await wait(400);
    click($$('button').filter(b => !b.closest('.nav-i')).find(b => /Nouveau type de frais/i.test(norm(b.textContent)))); await wait(350);
    const lbl = norm($('#modal-root').textContent);
    if (!lbl.includes('Tarifs distincts nouveaux / anciens élèves')) throw new Error('option absente');
    click($('#modal-root .m-x')); await wait(250);
  });

  await step('ergonomie : en-têtes figés (sticky) et dégradé connexion', async () => {
    const th = $('#view .tbl thead th');
    if (!th) throw new Error('en-tête absent');
    const pos = w.getComputedStyle(th).position;
    if (pos !== 'sticky') throw new Error('position = ' + pos);
  });

  await step('aucune erreur React', () => {
    const real = errors.filter(e => !/Warning/.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  console.log(fails ? '\n=== ' + fails + ' ÉCHEC(S) ===' : '\n=== SMOKE TEST v1.11 : OK ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
