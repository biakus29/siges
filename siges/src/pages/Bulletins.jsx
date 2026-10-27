import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, Select, Modal, WaBtn, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { classesSorted, classesPerimetre, classeParDefaut, optionClasse, niveauById, classById, moyenneMatiere, moyenneGenerale, planOf, coefOf, sequencesSorted, appreciationOf, classementClasse, verifieQrTexte , settingsOf } from '../core/business.js';
import { ReportModal, BulletinReport, RecapAnnuelReport, BordereauClasseReport, ToutEtabReport, HonneurReport, CertificatReport, CartesReport } from '../components/Reports.jsx';
import { TemplateReport, ModeleChooser } from '../components/ModeleReport.jsx';

/* ================================================================
   v5.5 — Documents scolaires & vérification QR */

/* Tableaux d'honneur : seuils paramétrables à la génération. */
export function HonneurConfigModal({ classes, periode, periodeLabel }){
  const { openModal, closeModal } = useApp();
  const [sf, setSf] = useState('14');
  const [sh, setSh] = useState('12');
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const go = () => {
    const seuilF = num(sf) == null ? 14 : num(sf);
    const seuilH = num(sh) == null ? 12 : num(sh);
    if (seuilH > seuilF){ return; }
    openModal(
      <HonneurDocModal classes={classes} periode={periode} periodeLabel={periodeLabel} seuilF={seuilF} seuilH={seuilH}/>
    );
  };
  return (
    <Modal icon="award" title={"Tableaux d'honneur — " + periodeLabel} onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'56%' }}>Félicitations et tableau d'honneur, pour les {classes.length} classe(s) de votre périmètre.</span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="printer"/> Générer</button>
      </>}>
      <div className="frow">
        <div className="inp"><label className="req">Félicitations — moyenne ≥</label>
          <div className="inp-box"><input type="number" min="0" max="20" step="0.5" value={sf} onChange={e => setSf(e.target.value)}/></div>
          <span className="hint">Sur 20 — par défaut 14.</span></div>
        <div className="inp"><label className="req">Tableau d'honneur — moyenne ≥</label>
          <div className="inp-box"><input type="number" min="0" max="20" step="0.5" value={sh} onChange={e => setSh(e.target.value)}/></div>
          <span className="hint">Sur 20 — par défaut 12 (et strictement inférieure au seuil des félicitations).</span></div>
      </div>
      <p className="mut" style={{ fontSize:11.5, marginTop:8 }}>
        Période analysée : <b>{periodeLabel}</b> — changez la période en haut de la page avant de générer.
        Seuls les élèves classés (non NC) sont retenus.
      </p>
    </Modal>
  );
}

/* v6.3 : rendu certificats / cartes / badges avec choix du modèle (standard ou personnalisé). */
export function DocsDocModal({ type, label, sousTitre, eleves }){
  const { db } = useApp();
  const defaut = (db.settings && db.settings.modeleDefaut && db.settings.modeleDefaut[type]) || '';
  const [mid, setMid] = useState(defaut);
  const mdl = (db.modelesDocs || []).find(m => m.id === mid);
  return (
    <ReportModal title={label + ' — ' + sousTitre}>
      <ModeleChooser typeDoc={type} value={mid} onChange={setMid}/>
      {mdl
        ? <TemplateReport modele={mdl} eleves={eleves}/>
        : (type === 'certificat'
          ? <CertificatReport eleves={eleves}/>
          : <CartesReport eleves={eleves} mode={type === 'badge' ? 'badge' : 'carte'}/>)}
    </ReportModal>
  );
}

/* v6.3 : rendu des tableaux d'honneur avec choix du modèle (standard ou personnalisé). */
function HonneurDocModal({ classes, periode, periodeLabel, seuilF, seuilH }){
  const { db } = useApp();
  const defaut = (db.settings && db.settings.modeleDefaut && db.settings.modeleDefaut.honneur) || '';
  const [mid, setMid] = useState(defaut);
  const mdl = (db.modelesDocs || []).find(m => m.id === mid);
  return (
    <ReportModal fit="page" title={"Tableaux d'honneur — " + periodeLabel}>
      <ModeleChooser typeDoc="honneur" value={mid} onChange={setMid}/>
      {mdl
        ? <TemplateReport modele={mdl} classes={classes} periode={periode} periodeLabel={periodeLabel} seuilF={seuilF} seuilH={seuilH}/>
        : <HonneurReport classes={classes} periode={periode} periodeLabel={periodeLabel} seuilF={seuilF} seuilH={seuilH}/>}
    </ReportModal>
  );
}

/* Certificats de scolarité, cartes scolaires, badges — par classe ou tout le périmètre. */
export function DocsConfigModal({ classes }){
  const { db, anneeId, openModal, closeModal, toast } = useApp();
  const [type, setType] = useState('certificat');
  const [classeId, setClasseId] = useState(() => classeParDefaut(db, anneeId, classes));
  const [toutes, setToutes] = useState(false);
  const LABELS = { certificat:'Certificats de scolarité', carte:'Cartes scolaires', badge:'Badges des élèves' };
  const go = () => {
    const sel = toutes ? classes : classes.filter(c => c.id === classeId);
    const ids = new Set(sel.map(c => c.id));
    const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.statut !== 'radie' && ids.has(e.classeId))
      .sort((a,b) => ((a.classeId === b.classeId) ? ((a.nom + a.prenom < b.nom + b.prenom) ? -1 : 1) : (a.classeId < b.classeId ? -1 : 1)));
    if (!els.length){ toast('Aucun élève dans la sélection.', 'err'); return; }
    openModal(
      <DocsDocModal type={type} label={LABELS[type]} sousTitre={(toutes ? classes.length + ' classe(s)' : ((classes.find(c => c.id === classeId) || {}).libelle || ''))} eleves={els}/>
    );
  };
  return (
    <Modal icon="id" title="Documents scolaires" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'52%' }}>Un certificat par page A4 ; cartes et badges en planche à découper.</span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="printer"/> Imprimer</button>
      </>}>
      <div className="inp"><label className="req">Type de document</label>
        <div className="inp-box">
          <select className="sel" value={type} onChange={e => setType(e.target.value)}>
            <option value="certificat">Certificats de scolarité (1 par élève)</option>
            <option value="carte">Cartes scolaires (planche)</option>
            <option value="badge">Badges des élèves (planche avec QR)</option>
          </select>
        </div></div>
      <div className="inp"><label className="req">Classe</label>
        <div className="inp-box">
          <select className="sel" value={toutes ? '*' : classeId} onChange={e => { if (e.target.value === '*'){ setToutes(true); } else { setToutes(false); setClasseId(e.target.value); } }}>
            {classes.map(c => { const o = optionClasse(db, anneeId, c); return <option key={c.id} value={c.id}>{o.label}</option>; })}
            <option value="*">Toutes les classes ({classes.length})</option>
          </select>
        </div></div>
      <span className="hint">Seules les classes de votre périmètre sont proposées.</span>
    </Modal>
  );
}

/* Vérification d'un bulletin par son QR code (v5.5). */
export function VerifQrModal(){
  const { db, closeModal } = useApp();
  const [txt, setTxt] = useState('');
  const [res, setRes] = useState(null);
  const go = () => setRes(verifieQrTexte(db, txt));
  const L = ({ k, v }) => <div><b style={{ display:'inline-block', minWidth:120 }}>{k} :</b> {v}</div>;
  return (
    <Modal icon="qr" title="Vérifier un bulletin (QR code)" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'52%' }}>Le QR code des bulletins transporte les chiffres clés et une signature.</span>
        <button className="btn btn-ghost" onClick={closeModal}>Fermer</button>
        <button className="btn btn-pri" onClick={go}><Ic name="search"/> Vérifier</button>
      </>}>
      <div className="inp"><label className="req">Contenu du QR code (texte scanné)</label>
        <div className="inp-box">
          <textarea className="ta" rows={4} value={txt} placeholder="AUREL-SIGES|ETAB:…|AN:…|ELV:…|CLA:…|PER:…|MOY:…|RANG:…|EMIS:…|SIG:…"
            onChange={e => { setTxt(e.target.value); setRes(null); }}/>
        </div>
        <span className="hint">Scannez le QR code du bulletin avec un téléphone (application QR) puis collez ici le texte obtenu.</span></div>
      {res && (
        res.ok ? (
          <div className="lc-ok show" style={{ marginTop:12 }}>
            <Ic name="check-circle"/><span><b>Document authentique</b> — la signature correspond au code de sécurité de l'établissement.</span>
            <div style={{ marginTop:8, fontSize:12, lineHeight:1.8, color:'#1c2b45' }}>
              <L k="Établissement" v={res.data.ETAB || '—'}/>
              <L k="Année scolaire" v={res.data.AN || '—'}/>
              <L k="Élève" v={res.data.ELV || '—'}/>
              <L k="Classe" v={res.data.CLA || '—'}/>
              <L k="Période" v={res.data.PER || '—'}/>
              <L k="Moyenne" v={res.data.MOY || '—'}/>
              <L k="Rang" v={res.data.RANG || '—'}/>
              <L k="Émis le" v={res.data.EMIS || '—'}/>
            </div>
          </div>
        ) : (
          <div className="lc-err show" style={{ marginTop:12 }}>
            <Ic name="x-circle"/><span><b>Vérification refusée</b> — {res.raison}</span>
          </div>
        )
      )}
    </Modal>
  );
}

/* Bulletins & rapports : moyennes par matière, moyenne générale, rang.
   L'enseignant imprime le rapport de SES matières. */
export default function Bulletins(){
  /* v5.7 : nom de l'établissement pour les messages WhatsApp */
  const { db, anneeId, openModal, scope } = useApp();
  const st2 = settingsOf(db);

  const classes = useMemo(() => {
    return classesPerimetre(db, scope.classesIds);
  }, [db, scope.classesIds]);

  const matieres = useMemo(() => {
    const all = (db.matieres || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
    return scope.matieresIds ? all.filter(m => scope.matieresIds.includes(m.id)) : all;
  }, [db, scope.matieresIds]);

  const [classeId, setClasseId] = useState(() => classeParDefaut(db, anneeId, classes));
  const [periode, setPeriode] = useState('');   /* '' = année, T1-T3 = trimestre, sinon id de séquence */
  /* v6.3 : modèle d'impression des bulletins (standard par défaut) */
  const [mdlId, setMdlId] = useState((db.settings && db.settings.modeleDefaut && db.settings.modeleDefaut.bulletin) || '');
  const mdlBulletin = (db.modelesDocs || []).find(m => m.id === mdlId) || null;
  const periodeType = periode === '' ? 'annee' : (/^T[1-3]$/.test(periode) ? 'trimestre' : 'sequence');

  /* v4 : quand la classe a un plan, on affiche SES matières, dans l'ordre du bulletin */
  const matieresClasse = useMemo(() => {
    const plan = planOf(db, classeId);
    if (!plan.length) return matieres;
    /* le plan définit le curriculum ET l'ordre d'affichage au bulletin */
    const ordre = new Map(plan.map((e, i) => [e.matiereId, i]));
    return matieres.filter(m => ordre.has(m.id)).sort((a,b) => ordre.get(a.id) - ordre.get(b.id));
  }, [matieres, db, classeId]);


  const cl = classeId ? classById(db, classeId) : null;
  const eleves = useMemo(() => (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1)), [db, anneeId, classeId]);

  const lignes = useMemo(() => eleves.map(el => {
    const parMat = {};
    matieresClasse.forEach(m => { parMat[m.id] = moyenneMatiere(db, anneeId, el.id, m.id, periode); });
    const gen = moyenneGenerale(db, anneeId, el.id, periode);
    return { el, parMat, gen };
  }), [eleves, matieresClasse, db, anneeId, periode]);

  /* v5.2 : classement de la classe — les élèves sans note dans une matière
     indispensable sont « non classés » (NC), exclus de la numérotation. */
  const cls = classementClasse(db, anneeId, classeId, periode);
  const rang = cls.rangs;
  const nbClasses = cls.classes.length;
  const avecNotes = lignes.filter(l => l.gen != null).sort((a,b) => b.gen - a.gen);
  const moyClasse = avecNotes.length ? Math.round((avecNotes.reduce((t, l) => t + l.gen, 0) / avecNotes.length) * 100) / 100 : null;
  const sequences = sequencesSorted(db);
  const periodeLabel = periode === '' ? 'Année complète'
    : (/^T[1-3]$/.test(periode) ? 'Trimestre ' + periode[1]
      : ((sequences.find(sq => String(sq.id) === String(periode)) || {}).libelle || 'Séquence'));
  const periodeOpts = [{ value:'', label:'Année complète' }]
    .concat([1, 2, 3].map(t => ({ value:'T' + t, label:'Trimestre ' + t })))
    .concat(sequences.map(sq => ({ value:String(sq.id), label:sq.libelle + ' (T' + sq.trimestre + ')' })));

  /* impression du tableau de la classe */
  const imprimer = () => {
    const st = (db.settings || {});
    openModal(
      <ReportModal autoPrint title={'Bulletin de classe — ' + (cl ? cl.libelle : '') + ' (' + periodeLabel + ')'}>
        <p style={{ fontSize:11.5, margin:'0 0 8px' }}>Période : <b>{periodeLabel}</b> — composition ×2, coefficients du plan, poids des séquences pour les trimestres.</p>
        <table className="rcp-tbl">
          <thead><tr>
            <th>N°</th><th>Élève</th>
            {matieresClasse.map(m => <th key={m.id}>{m.code}<div style={{ fontSize:9, fontWeight:400, opacity:.75 }}>coef {coefOf(db, classeId, m.id)}</div></th>)}
            <th>Moy.</th><th>Rang</th>
          </tr></thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.el.id} className={l.gen != null && l.gen < 10 ? 'rcp-rowbad' : ''}>
                <td>{i+1}</td><td style={{ whiteSpace:'nowrap' }}>{l.el.nom} {l.el.prenom}</td>
                {matieresClasse.map(m => <td key={m.id} style={{ textAlign:'center' }}>{l.parMat[m.id] == null ? '—' : l.parMat[m.id].toFixed(2).replace('.', ',')}</td>)}
                <td style={{ textAlign:'center', fontWeight:700 }}>{l.gen == null ? '—' : l.gen.toFixed(2).replace('.', ',')}</td>
                <td style={{ textAlign:'center' }}>{rang.has(l.el.id) ? rang.get(l.el.id) + '/' + nbClasses : (l.gen != null ? 'NC' : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop:8, fontSize:11 }}>Moyenne de la classe : <b>{moyClasse == null ? '—' : moyClasse.toFixed(2).replace('.', ',')}</b> / 20 — {st.nomEtablissement || ''}</p>
      </ReportModal>
    );
  };

  if (!classes.length || !matieresClasse.length){
    return (
      <div className="card"><div className="card-b">
        <EmptyState icon="printer" title="Aucun bulletin"
          text={!matieres.length ? 'Aucune matière disponible pour votre compte.' : 'Aucune classe dans votre périmètre pour cette année.'}/>
      </div></div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-h">
          <h3>Bulletins &amp; rapports</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" title="Moyennes par groupe, moyenne générale et rangs"
              onClick={() => openModal(<BordereauClasseReport classeId={classeId} periode={periode} periodeLabel={periodeLabel}/>)}><Ic name="printer"/> Bordereau de résultats</button>
            <button className="btn btn-ghost btn-sm" title="Bordereaux de toutes les classes en une seule impression"
              onClick={() => openModal(<ToutEtabReport classes={classes} periode={periode} periodeLabel={periodeLabel}/>)}><Ic name="printer"/> Tout l'établissement</button>
            <CsvBtn filename={'resultats_' + ((classes.find(c => c.id === classeId) || {}).libelle || 'classe') + '_' + periodeLabel + '.csv'}
              header={['Matricule','Élève', ...matieresClasse.map(m => m.code), 'Moyenne / 20', 'Rang', 'Appréciation']}
              rows={lignes.map(l => [l.el.matricule || '—', l.el.nom + ' ' + l.el.prenom,
                ...matieresClasse.map(m => l.parMat[m.id] == null ? '' : String(l.parMat[m.id]).replace('.', ',')),
                l.gen == null ? '' : (rang.has(l.el.id) ? String(l.gen).replace('.', ',') : 'NC'),
                rang.has(l.el.id) ? String(rang.get(l.el.id)) : (l.gen != null ? 'NC' : ''),
                l.gen == null ? '' : (appreciationOf(db, l.gen) || '')])}/>
            <button className="btn btn-ghost btn-sm" title="Félicitations et tableau d'honneur, seuils au choix"
              onClick={() => openModal(<HonneurConfigModal classes={classes} periode={periode} periodeLabel={periodeLabel}/>)}><Ic name="award"/> Tableaux d'honneur</button>
            <button className="btn btn-ghost btn-sm" title="Certificats de scolarité, cartes scolaires, badges"
              onClick={() => openModal(<DocsConfigModal classes={classes}/>)}><Ic name="id"/> Certificats, cartes &amp; badges</button>
            <button className="btn btn-ghost btn-sm" title="Contrôler l'authenticité d'un bulletin par son QR code"
              onClick={() => openModal(<VerifQrModal/>)}><Ic name="qr"/> Vérifier un bulletin</button>
            <button className="btn btn-pri btn-sm" onClick={imprimer}><Ic name="printer"/> Imprimer {scope.matieresIds ? '(mes matières)' : 'la classe'}</button>
          </div>
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <label style={{ flex:'1 1 200px' }}>Classe
              <Select value={classeId} onChange={setClasseId}
                options={classes.map(c => optionClasse(db, anneeId, c))}/>
            </label>
            <label style={{ flex:'0 0 220px' }}>Période
              <Select value={periode} onChange={setPeriode} options={periodeOpts}/>
            </label>
          </div>
          <div style={{ marginTop:8 }}>
            <ModeleChooser typeDoc="bulletin" periodeType={periodeType} value={mdlId} onChange={setMdlId}/>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h"><h3>{cl ? cl.libelle : ''} <span className="mut">/ {periodeLabel}</span></h3>
          <span className="mut" style={{ fontSize:12 }}>Moyenne de classe : {moyClasse == null ? '—' : moyClasse.toFixed(2).replace('.', ',')} / 20
            {' '}{nbClasses} classé(s){eleves.length - nbClasses > 0 ? ' — ' + (eleves.length - nbClasses) + ' non classé(s) (NC)' : ''}</span></div>
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th style={{ width:46, textAlign:'center' }}>N°</th><th style={{ minWidth:160 }}>Élève</th>
              {matieresClasse.map(m => <th key={m.id} style={{ textAlign:'center' }} title={m.libelle}>{m.code}<div className="mut" style={{ fontSize:9, fontWeight:400 }}>coef {coefOf(db, classeId, m.id)}</div></th>)}
              <th style={{ textAlign:'center' }}>Moy. /20</th><th style={{ textAlign:'center' }}>Rang</th><th style={{ minWidth:110 }}>Appréciation</th><th></th>
            </tr></thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.el.id} className={l.gen != null && l.gen < 10 ? 'row-bad' : ''}>
                  <td style={{ textAlign:'center' }} className="mut">{i+1}</td>
                  <td><b>{l.el.nom}</b> {l.el.prenom}</td>
                  {matieresClasse.map(m => <td key={m.id} style={{ textAlign:'center' }}>{l.parMat[m.id] == null ? <span className="mut">—</span> : l.parMat[m.id].toFixed(2).replace('.', ',')}</td>)}
                  <td style={{ textAlign:'center', fontWeight:700 }}>{l.gen == null ? '—' : <Badge cls={l.gen >= 14 ? 'ok' : (l.gen >= 10 ? '' : 'bad')}>{l.gen.toFixed(2).replace('.', ',')}</Badge>}</td>
                  <td style={{ textAlign:'center' }}>
                    {rang.has(l.el.id) ? <b>{rang.get(l.el.id)}<span className="mut">/{nbClasses}</span></b>
                      : (l.gen != null ? <Badge cls="b-mut" title="Non classé : matière indispensable sans note">NC</Badge> : <span className="mut">—</span>)}
                  </td>
                  <td>{l.gen == null ? <span className="mut">—</span> : <Badge cls={l.gen >= 14 ? 'b-ok' : (l.gen >= 10 ? 'b-warn' : 'b-bad')}>{appreciationOf(db, l.gen) || '—'}</Badge>}</td>
                  <td style={{ textAlign:'center' }}>
                    <button className="btn btn-ghost btn-sm" title={periode === '' ? 'Récapitulatif annuel des notes (A4 portrait)' : 'Bulletin individuel (A4 portrait)'}
                      onClick={() => openModal(
                        <ReportModal fit="page" title={(periode === '' ? 'Récapitulatif annuel — ' : 'Bulletin — ') + l.el.nom + ' ' + l.el.prenom}>
                          {(periode === ''
                            ? (mdlBulletin ? <TemplateReport modele={mdlBulletin} eleveId={l.el.id} matieres={matieresClasse}/>
                                           : <RecapAnnuelReport eleveId={l.el.id} matieres={matieresClasse}/>)
                            : (mdlBulletin ? <TemplateReport modele={mdlBulletin} eleveId={l.el.id} periode={periode} periodeLabel={periodeLabel} matieres={matieresClasse}/>
                                           : <BulletinReport eleveId={l.el.id} periode={periode} periodeLabel={periodeLabel} matieres={matieresClasse}/>))}
                        </ReportModal>
                      )}><Ic name="printer"/> {periode === '' ? 'Récapitulatif' : 'Bulletin'}</button>
                    {' '}<WaBtn title={'Envoyer le résumé du bulletin au parent par WhatsApp — ' + (l.el.tel || 'aucun contact enregistré')} label="" small
                      tel={l.el.tel}
                      msg={st2.nomEtablissement + ' — ' + (periode === '' ? 'Récapitulatif annuel' : 'Bulletin ' + periodeLabel) + ' de ' + l.el.nom + ' ' + l.el.prenom
                        + ' (' + ((classes.find(c => c.id === l.el.classeId) || {}).libelle || '') + ') :'
                        + (l.gen == null ? ' aucune note à ce jour.'
                          : ' Moyenne ' + l.gen.toFixed(2).replace('.', ',') + '/20 — Rang ' + (rang.get(l.el.id) || 'NC') + '/' + nbClasses
                          + ' — Appréciation : ' + (appreciationOf(db, l.gen) || '—') + '.')
                        + ' Le document complet est disponible à l\u2019établissement.'}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
