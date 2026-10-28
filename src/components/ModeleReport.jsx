import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { QrCode } from './Reports.jsx';
import { settingsOf, classById, niveauById, planOf, coefOf, moyenneMatiere, moyenneGenerale,
  appreciationOf, appreciationMoyenneOf, classementClasse, absencesDe, faitsDe, sequencesSorted,
  bulletinQrData, rangMatiere, classesSorted, bulletinOf } from '../core/business.js';
import { pageOf, interpoler, resolveChamp, normalizeModele } from '../core/modeles.js';
import { Select } from './UI.jsx';

/* =====================================================================
   v6.3 — RENDU D'UN MODÈLE DE DOCUMENT PERSONNALISÉ
   Le modèle décrit la page (format, marges) et des blocs positionnés en
   millimètres. Le présent moteur calcule le contexte (élève, notes,
   absences…) puis rend chaque bloc avec son style (police, taille,
   alignement, couleurs). Documents multi-élèves (certificats, cartes,
   badges) : une vignette/page par élève ; honneur : une page par classe.
   ===================================================================== */

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const p2 = n => String(n).padStart(2, '0');
const frNum = (v, dec) => (v == null || isNaN(v)) ? '—' : String(Number(v).toFixed(dec == null ? 2 : dec)).replace('.', ',');

/* ---------- Contexte commun (établissement, année, date) ---------- */
function ctxCommun(db, anneeId){
  const st = settingsOf(db);
  const d = new Date();
  return {
    etab: st,
    annee: (db.annees || []).find(a => a.id === anneeId) || {},
    dateJour: p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(),
    dateTexte: d.getDate() + ' ' + MOIS_FR[d.getMonth()] + ' ' + d.getFullYear(),
    lieu: (bulletinOf(db).lieu) || '',
    signataire: (bulletinOf(db).signature) || 'Le Chef d\u2019établissement'
  };
}

/* ---------- Données d'un bulletin (séquence, trimestre ou année) ---------- */
export function donneesBulletin(db, anneeId, eleveId, periode, periodeLabel){
  const el = (db.eleves || []).find(e => e.id === eleveId);
  if (!el) return null;
  const classe = classById(db, el.classeId) || {};
  const niveau = niveauById(db, classe.niveauId) || {};
  const plan = planOf(db, el.classeId);
  const eleves = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === el.classeId && e.statut !== 'radie');
  const classement = classementClasse(db, anneeId, el.classeId, periode);
  const moy = moyenneGenerale(db, anneeId, el.id, periode);
  const lignes = plan.map(en => {
    const mat = (db.matieres || []).find(m => m.id === en.matiereId);
    if (!mat) return null;
    const coef = coefOf(db, el.classeId, mat.id);
    const note = moyenneMatiere(db, anneeId, el.id, mat.id, periode);
    const rm = rangMatiere(db, anneeId, el.classeId, el.id, mat.id, periode);
    return { mat, coef, note, points: note == null ? null : Math.round(note * coef * 100) / 100, ...rm };
  }).filter(Boolean);
  /* regroupement par groupe du plan */
  const groupes = [];
  lignes.forEach(l => {
    const entry = plan.find(e => e.matiereId === l.mat.id);
    const gid = (entry && entry.groupeId) || '';
    let g = groupes.find(x => x.id === gid);
    if (!g){ const grp = (db.groupes || []).find(x => x.id === gid);
      g = { id: gid, libelle: (grp && grp.libelle) || 'Autres matières', lignes: [], totP: 0, totC: 0 }; groupes.push(g); }
    g.lignes.push(l);
    if (l.note != null){ g.totP += l.points; g.totC += l.coef; }
  });
  const totP = Math.round(groupes.reduce((t, g) => t + g.totP, 0) * 100) / 100;
  const totC = groupes.reduce((t, g) => t + g.totC, 0);
  const moys = classement.classes.map(c => c.moy);
  const abs = absencesDe(db, anneeId, el.id, /^T[1-3]$/.test(String(periode)) ? periode : '');
  const nbConsignes = faitsDe(db, anneeId, el.id).filter(f => f.categorie !== 'absence').length;
  const nbNotes = lignes.filter(l => l.note != null).length;
  return {
    ...ctxCommun(db, anneeId),
    eleve: el, classe, niveau, effectif: eleves.length, periodeLabel: periodeLabel || '',
    lignes, groupes, plan,
    moy, rang: classement.rangs.get(el.id) || null, rangSur: classement.classes.length,
    totalPoints: totP, totalCoef: totC, nbMatieres: nbNotes,
    moyenneClasse: moys.length ? Math.round(moys.reduce((a, b) => a + b, 0) / moys.length * 100) / 100 : null,
    minClasse: moys.length ? Math.min(...moys) : null, maxClasse: moys.length ? Math.max(...moys) : null,
    mention: moy != null ? (appreciationMoyenneOf(db, classe, moy) || '') : '',
    appreciation: moy != null ? (appreciationOf(db, moy) || '') : '',
    absNJ: abs.nonJust, absJ: abs.just, consignes: nbConsignes
  };
}

/* ---------- Données d'un tableau d'honneur ---------- */
function donneesHonneur(db, anneeId, classes, periode, periodeLabel, seuilF, seuilH){
  const listes = classes.map(cl => {
    const classement = classementClasse(db, anneeId, cl.id, periode);
    const eleves = classement.classes.map((c, i) => {
      const el = (db.eleves || []).find(e => e.id === c.eleveId) || {};
      return { nom: (el.nom || '') + ' ' + (el.prenom || ''), matricule: el.matricule || '—',
        moyenne: c.moy, rang: i + 1, felicitation: c.moy >= seuilF };
    }).filter(x => x.moyenne >= seuilH);
    return { classe: cl, eleves };
  }).filter(x => x.eleves.length);
  return { ...ctxCommun(db, anneeId), periodeLabel: periodeLabel || '', listes };
}

/* ---------- Rendu d'un bloc ---------- */
function BlocDoc({ b, ctx, props, dims }){
  const st = b.style || {};
  const pos = {
    position:'absolute', left:b.x + 'mm', top:b.y + 'mm', width:b.w + 'mm', minHeight:b.h + 'mm',
    fontFamily: st.police + ', Tahoma, sans-serif', fontSize: st.taille + 'pt',
    fontWeight: st.gras ? 700 : 400, fontStyle: st.italique ? 'italic' : 'normal',
    textDecoration: st.souligne ? 'underline' : 'none',
    textAlign: st.alignement === 'centre' ? 'center' : (st.alignement === 'justifie' ? 'justify' : (st.alignement === 'droite' ? 'right' : 'left')),
    color: st.couleur || undefined, background: st.fond || undefined,
    border: st.bordure ? '1px solid #b9c2d2' : undefined,
    overflow:'hidden', lineHeight:1.35
  };
  const txt = (
    <div style={{ ...pos, whiteSpace:'pre-wrap' }}>{interpoler(b.texte, ctx)}</div>
  );
  switch (b.type){
    case 'texte': return txt;
    case 'champ': return <div style={pos}>{resolveChamp(b.champ, ctx)}</div>;
    case 'ligne': return <div style={{ ...pos, minHeight:0, borderTop:(st.taille / 4 + 0.25) + 'mm ' + (st.gras ? 'double' : 'solid') + ' ' + (st.couleur || '#7e8aa5') }}/>;
    case 'logo': {
      const logo = (ctx.etab && ctx.etab.logo) || '';
      return <div style={{ ...pos, height:b.h + 'mm' }}>{logo
        ? <img src={logo} alt="logo" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
        : <div style={{ border:'1px dashed #b9c2d2', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#7e8aa5' }}>LOGO</div>}</div>;
    }
    case 'photo': {
      const el = ctx.eleve || {};
      return <div style={{ ...pos, height:b.h + 'mm' }}>{el.photo
        ? <img src={el.photo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <div style={{ width:'100%', height:'100%', background:'#eef1f6', display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:700, color:'#7e8aa5', fontSize:(st.taille * 1.6) + 'pt' }}>{(el.nom || '?').charAt(0)}{(el.prenom || '').charAt(0)}</div>}</div>;
    }
    case 'qr': {
      let payload = '';
      if (b._typeDoc === 'bulletin'){
        payload = bulletinQrData(ctx._db, { eleveId: ctx.eleve && ctx.eleve.id, periodeLabel: ctx.periodeLabel,
          moy: ctx.moy, rang: ctx.rang }) || '';
      } else {
        payload = 'AUREL-SIGES|ETAB:' + ((ctx.etab && ctx.etab.nomEtablissement) || '').slice(0, 30)
          + '|ELV:' + ((ctx.eleve && ctx.eleve.matricule) || '—') + '|CLA:' + ((ctx.classe && ctx.classe.libelle) || '');
      }
      if (!payload) return <div style={pos} className="mdl-qr-off">QR indisponible<br/>(code de sécurité requis)</div>;
      return <div style={pos}><QrCode text={payload} size={Math.round(b.w * 3.6)}/></div>;
    }
    case 'entete': {
      const bul = bulletinOf(ctx._db || {});
      return (
        <div style={{ ...pos, display:'flex', gap:'4mm' }}>
          <div style={{ flex:1, whiteSpace:'pre-line', textAlign:'left' }}>{bul.blocGauche}</div>
          <div style={{ flex:1, whiteSpace:'pre-line', textAlign:'right' }}>{bul.blocDroit}</div>
        </div>
      );
    }
    case 'tableau-notes': {
      const o = b.options || {};
      const cellSt = { fontFamily:'inherit', fontSize:'inherit' };
      const th = { ...cellSt, borderBottom:'1px solid #99a5bd', padding:'1px 2mm', textAlign:'left', fontWeight:700 };
      const td = { ...cellSt, borderBottom:'.4px solid #d8dee9', padding:'1px 2mm', textAlign:'left' };
      const num = v => ({ ...td, textAlign:'center', fontVariantNumeric:'tabular-nums' });
      const t = (v, d) => (v == null ? '—' : frNum(v, d));
      return (
        <table className="mdl-tbl" style={{ ...pos, width:b.w + 'mm', borderCollapse:'collapse', tableLayout:'fixed' }}>
          <thead><tr>
            <th style={{ ...th, width:'32%' }}>Discipline</th>
            {o.note !== false && <th style={{ ...th, textAlign:'center' }}>Note /20</th>}
            {o.coef !== false && <th style={{ ...th, textAlign:'center' }}>Coef</th>}
            {o.points !== false && <th style={{ ...th, textAlign:'center' }}>Points</th>}
            {o.moyClasse !== false && <th style={{ ...th, textAlign:'center' }}>Moy.Cla.</th>}
            {o.rang !== false && <th style={{ ...th, textAlign:'center' }}>Rang</th>}
            {o.appreciation !== false && <th style={{ ...th, width:'19%' }}>Appréciation</th>}
          </tr></thead>
          <tbody>
            {(ctx.groupes || []).map(g => (
              <React.Fragment key={g.id || g.libelle}>
                {o.groupes !== false && (
                  <tr><td colSpan={8} style={{ ...td, fontWeight:700, background:'rgba(44,58,99,.07)' }}>{g.libelle}
                    {' '}<span style={{ fontWeight:400 }}>({t(g.totP)} pts / {t(g.totC, 0)})</span></td></tr>
                )}
                {g.lignes.map(l => (
                  <tr key={l.mat.id}>
                    <td style={td}><b>{l.mat.code}</b> — {l.mat.libelle}</td>
                    {o.note !== false && <td style={{ ...num(), fontWeight:700 }}>{t(l.note)}</td>}
                    {o.coef !== false && <td style={num()}>{t(l.coef, 0)}</td>}
                    {o.points !== false && <td style={num()}>{t(l.points)}</td>}
                    {o.moyClasse !== false && <td style={num()}>{t(l.moyClasse)}</td>}
                    {o.rang !== false && <td style={num()}>{l.rang == null ? '—' : l.rang + '/' + l.n}</td>}
                    {o.appreciation !== false && <td style={td}>{l.note == null ? '—' : (appreciationOf(ctx._db, l.note) || '—')}</td>}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      );
    }
    case 'bilan':
      return (
        <div style={pos}>
          <div style={{ fontWeight:700, marginBottom:'.6mm' }}>Bilan disciplinaire</div>
          <div>Absences non justifiées : <b>{ctx.absNJ || 0} h</b> • justifiées : <b>{ctx.absJ || 0} h</b>
            {' '}• consignes / faits : <b>{ctx.consignes || 0}</b></div>
        </div>
      );
    case 'resultats':
      return (
        <div style={pos}>
          <div style={{ fontWeight:700, marginBottom:'.6mm' }}>Résultats{ctx.periodeLabel ? ' — ' + ctx.periodeLabel : ''}</div>
          <div style={{ display:'flex', gap:'3mm' }}>
            <table className="mdl-tbl" style={{ borderCollapse:'collapse', flex:1 }}>
              <tbody>
                <tr><td>ÉLÈVE</td><td style={{ textAlign:'right' }}><b>T-Points : {frNum(ctx.totalPoints)} / T-Coef : {frNum(ctx.totalCoef, 0)}</b></td></tr>
                <tr><td></td><td style={{ textAlign:'right' }}><b>Moyenne : {frNum(ctx.moy)} / 20 — Rang : {ctx.rang || '—'}/{ctx.rangSur || '—'}</b></td></tr>
                <tr><td>CLASSE</td><td style={{ textAlign:'right' }}>Moy. : {frNum(ctx.moyenneClasse)} • Min : {frNum(ctx.minClasse)} • Max : {frNum(ctx.maxClasse)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:'.6mm' }}>Mention(s) travail : <b>{ctx.mention || '—'}</b></div>
        </div>
      );
    case 'decision':
      return (
        <div style={pos}>
          <b>Décision du conseil :</b> ☐ Promu(e) &nbsp; ☐ Redouble &nbsp; ☐ Exclu(e) pour …
        </div>
      );
    case 'signatures': {
      const o = b.options || {};
      return (
        <div style={{ ...pos, display:'flex', justifyContent:'space-between', gap:'6mm' }}>
          <div style={{ flex:1, textAlign:'center', whiteSpace:'pre-line' }}>{interpoler(o.gauche || '', ctx)}<br/>{'\u00a0'}</div>
          <div style={{ flex:1, textAlign:'center', whiteSpace:'pre-line' }}>{interpoler(o.droite || '', ctx)}<br/>{'\u00a0'}</div>
        </div>
      );
    }
    case 'liste': {
      const o = b.options || {};
      const th = { borderBottom:'1px solid #99a5bd', padding:'1px 2mm', textAlign:'left', fontWeight:700, fontSize:'inherit' };
      const td = { borderBottom:'.4px solid #d8dee9', padding:'1px 2mm', fontSize:'inherit' };
      return (
        <div style={pos}>
          {(ctx.listes || []).map(L => (
            <div key={L.classe.id} style={{ marginBottom:'4mm', pageBreakInside:'avoid' }}>
              <div style={{ fontWeight:700, marginBottom:'1mm' }}>{L.classe.libelle} — {L.eleves.length} élève(s)</div>
              <table className="mdl-tbl" style={{ borderCollapse:'collapse', width:'100%' }}>
                <thead><tr>
                  <th style={{ ...th, width:'8%' }}>N°</th><th style={th}>Nom et prénoms</th>
                  {o.moyenne !== false && <th style={{ ...th, textAlign:'center' }}>Moy. /20</th>}
                  {o.rang !== false && <th style={{ ...th, textAlign:'center' }}>Rang</th>}
                  {o.appreciation !== false && <th style={th}>Appréciation</th>}
                </tr></thead>
                <tbody>
                  {L.eleves.map((e, i) => (
                    <tr key={i}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{e.felicitation ? '★ ' : ''}{e.nom}</td>
                      {o.moyenne !== false && <td style={{ ...td, textAlign:'center' }}><b>{frNum(e.moyenne)}</b></td>}
                      {o.rang !== false && <td style={{ ...td, textAlign:'center' }}>{e.rang}</td>}
                      {o.appreciation !== false && <td style={td}>{appreciationOf(ctx._db, e.moyenne) || ''}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      );
    }
    default: return null;
  }
}

/* ---------- Une page (ou vignette) du document ---------- */
function PageDoc({ modele, ctx, tuile }){
  const dims = pageOf({ ...modele.page, typeDoc: modele.typeDoc });
  const mg = modele.page.marges || {};
  return (
    <div className={'mdl-page' + (tuile ? ' mdl-tuile' : '')}
      style={{ width:dims.w + 'mm', minHeight:dims.h + 'mm',
        padding:mg.h + 'mm ' + mg.d + 'mm ' + mg.b + 'mm ' + mg.g + 'mm',
        background:modele.page.fond || '#fff' }}>
      {modele.blocs.map(b => (
        <BlocDoc key={b.id} b={{ ...b, _typeDoc: modele.typeDoc }} ctx={ctx} dims={dims}/>
      ))}
    </div>
  );
}

/* ---------- Composant principal : rendu d'un modèle ---------- */
export function TemplateReport({ modele, eleveId, periode, periodeLabel, matieres,
  classes, seuilF, seuilH, eleves }){
  const { db, anneeId } = useApp();
  let m;
  try { m = normalizeModele(modele); }
  catch(e){ return <div className="rcp" id="print-zone"><p style={{ color:'#b3402a' }}>Modèle invalide : {String(e.message || e)}</p></div>; }
  const pages = [];
  if (m.typeDoc === 'bulletin'){
    const ctx = { ...ctxCommun(db, anneeId), _db:db, periodeLabel: periodeLabel || '' };
    const d = donneesBulletin(db, anneeId, eleveId, periode, periodeLabel);
    pages.push({ key:'b', ctx: d ? { ...ctx, ...d, _db:db } : ctx });
  } else if (m.typeDoc === 'honneur'){
    const ctx = { ...donneesHonneur(db, anneeId, classes || [], periode, periodeLabel, seuilF == null ? 14 : seuilF, seuilH == null ? 12 : seuilH), _db:db };
    pages.push({ key:'h', ctx });
  } else {
    /* certificat, carte, badge : une vignette par élève */
    (eleves || []).forEach((el, i) => {
      const classe = classById(db, el.classeId) || {};
      const niveau = niveauById(db, classe.niveauId) || {};
      pages.push({ key:'e' + i, ctx: { ...ctxCommun(db, anneeId), _db:db, eleve:el, classe, niveau,
        effectif: (db.eleves || []).filter(x => x.anneeId === anneeId && x.classeId === el.classeId).length } });
    });
    if (!pages.length) pages.push({ key:'vide', ctx:{ ...ctxCommun(db, anneeId), _db:db } });
  }
  const tuile = (m.typeDoc === 'carte' || m.typeDoc === 'badge');
  return (
    <div className={'rcp mdl-doc' + (tuile ? ' mdl-planche' : '')} id="print-zone">
      {pages.map((pg, i) => (
        <React.Fragment key={pg.key}>
          <PageDoc modele={m} ctx={pg.ctx} tuile={tuile}/>
          {i < pages.length - 1 && <div className="mdl-saut"/>}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- Sélecteur de modèle (page d'impression) ---------- */
export function ModeleChooser({ typeDoc, periodeType, value, onChange }){
  const { db } = useApp();
  const modeles = (db.modelesDocs || []).filter(m => m.typeDoc === typeDoc
    && (!periodeType || !m.periode || m.periode === 'tous' || m.periode === periodeType));
  if (!modeles.length) return null;
  const cur = (db.settings && db.settings.modeleDefaut) || {};
  return (
    <div className="mdl-choose">
      <label>Modèle du document
        <Select value={value} onChange={onChange}
          options={[{ value:'', label:'Modèle standard (conforme au modèle officiel)' }]
            .concat(modeles.map(m => ({ value:m.id, label:m.nom + (cur[typeDoc] === m.id ? ' (par défaut)' : '') })))}/>
      </label>
    </div>
  );
}
