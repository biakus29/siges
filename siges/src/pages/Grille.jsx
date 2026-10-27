import React, { useRef, useState } from 'react';
import { Badge, EmptyState, Select, CsvBtn, Modal } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, fmtD, parseMoney, todayISO } from '../core/utils.js';
import { yearById, niveauxSorted, classesSorted, classesOf, niveauById, fraisSorted,
         tarifFor, tarifEffectif, tranchesOfFrais, trancheISO, trancheMontants } from '../core/business.js';
import { TrancheFormModal } from '../components/modals/EntityForms.jsx';

/* Clonage de la grille tarifaire spécifique d'une classe vers d'autres classes */

export default function Grille(){
  const { db, anneeId, can, M, openModal } = useApp();
  const an = yearById(db, anneeId);
  const [view, setView] = useState('classe');        /* 'classe' : vue détaillée par classe — 'matrice' : vue compacte */
  const [classId, setClassId] = useState('');
  const [matMode, setMatMode] = useState('niveau');  /* matrice : lignes niveaux ou classes */
  const [regime, setRegime] = useState('');           /* '' = commun | 'interne' | 'externe' */
  const [statut, setStatut] = useState('');           /* '' = tous | 'nouveau' | 'ancien' (frais concernés) */
  const [niveauF, setNiveauF] = useState('all');
  const [flash, setFlash] = useState(false);
  const flashT = useRef(null);

  if (!an) return <EmptyState icon="calendar" title="Aucune année" text="Sélectionnez ou créez une année scolaire."/>;
  const canW = can('grille', true);
  const editable = canW && an.statut !== 'cloturee';
  const nvs = niveauxSorted(db);
  const fra = fraisSorted(db);
  const classes = classesSorted(db);
  const today = todayISO();

  const notify = () => {
    setFlash(true);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(false), 1600);
  };
  const save = (type, cibleId, fraisId, rawVal) => {
    try {
      M.setTarif(an.id, type, cibleId, fraisId, parseMoney(rawVal) || null, regime, statut);
      notify();
    } catch(e){ /* silencieux : la cellule reviendra à sa valeur */ }
  };

  const nbTarifs = db.tarifs.filter(t => t.anneeId === an.id).length;

  /* ---------- Vue par classe (détaillée : frais, total, tranches, échéances) ---------- */
  const sel = classId || (classes.length ? classes[0].id : '');
  const cl = classes.find(c => c.id === sel) || null;
  const niv = cl ? niveauById(db, cl.niveauId) : null;
  const effectif = cl ? db.eleves.filter(e => e.anneeId === an.id && e.classeId === cl.id && e.statut === 'actif').length : 0;
  let totalClass = 0;
  const rowsClasse = cl ? fra.map(f => {
    const tn = tarifFor(db, an.id, f.id, 'niveau', cl.niveauId, regime, statut);
    const tc = tarifFor(db, an.id, f.id, 'classe', cl.id, regime, statut);
    const eff = tarifEffectif(db, an.id, f.id, cl.id, regime, statut);
    if (eff != null) totalClass += eff;
    const trs = tranchesOfFrais(db, f.id);
    const montants = trancheMontants(eff || 0, trs);
    return { f, tn, tc, eff, tranches:trs.map((t, i) => ({ ...t, montant:montants[i], iso:trancheISO(an, t) })) };
  }) : [];
  const nbEch = rowsClasse.reduce((s, r) => s + r.tranches.length, 0);

  /* ---------- Vue matrice (compacte) ---------- */
  const matRows = matMode === 'niveau'
    ? nvs.map(nv => ({ type:'niveau', id:nv.id, label:nv.libelle, sub:nv.cycle }))
    : (niveauF === 'all' ? classes : classesOf(db, niveauF))
        .map(c => ({ type:'classe', id:c.id, label:c.libelle, sub:(niveauById(db, c.niveauId) || {}).libelle || '' }));

  return (
    <>
      <div className="grille-tools">
        <span className="chip"><Ic name="calendar"/> Année : <b>&nbsp;{an.libelle}</b>
          {an.statut === 'cloturee' && <> <Badge cls="b-mut">CLÔTURÉE</Badge></>}</span>
        <div className="seg">
          <button className={view === 'classe' ? 'on' : ''} onClick={() => setView('classe')}>Par classe</button>
          <button className={view === 'matrice' ? 'on' : ''} onClick={() => setView('matrice')}>Matrice</button>
        </div>
        <div className="seg" title="Couche de tarifs : le statut interne/externe modifie les montants applicables">
          <button className={regime === '' ? 'on' : ''} onClick={() => setRegime('')}>Commun</button>
          <button className={regime === 'interne' ? 'on' : ''} onClick={() => setRegime('interne')}>Internes</button>
          <button className={regime === 'externe' ? 'on' : ''} onClick={() => setRegime('externe')}>Externes</button>
        </div>
        {fra.some(f => f.parStatut) && (
          <div className="seg" title="Couche élèves : distinguer les nouveaux des anciens élèves (frais concernés, ex : inscriptions)">
            <button className={statut === '' ? 'on' : ''} onClick={() => setStatut('')}>Tous élèves</button>
            <button className={statut === 'nouveau' ? 'on' : ''} onClick={() => setStatut('nouveau')}>Nouveaux</button>
            <button className={statut === 'ancien' ? 'on' : ''} onClick={() => setStatut('ancien')}>Anciens</button>
          </div>
        )}
        {view === 'matrice' && (
          <>
            <div className="seg">
              <button className={matMode === 'niveau' ? 'on' : ''} onClick={() => setMatMode('niveau')}>Niveaux</button>
              <button className={matMode === 'classe' ? 'on' : ''} onClick={() => setMatMode('classe')}>Classes</button>
            </div>
            {matMode === 'classe' && (
              <select className="flt" value={niveauF} onChange={e => setNiveauF(e.target.value)}>
                <option value="all">Tous les niveaux</option>
                {nvs.map(nv => <option key={nv.id} value={nv.id}>{nv.libelle}</option>)}
              </select>
            )}
          </>
        )}
        <span style={{ flex:1 }}/>
        {statut && <Badge cls="b-warn" title="Couche active : ces montants s'appliquent uniquement aux élèves concernés">Inscriptions : {statut === 'nouveau' ? 'nouveaux élèves' : 'anciens élèves'}</Badge>}
        <span className="badge b-navy">{fmt(nbTarifs)} montant(s) définis</span>
        <CsvBtn filename={'grille_' + an.libelle + (view === 'classe' ? '_' + (cl ? cl.libelle : '') : '_' + matMode) + '.csv'}
          header={view === 'classe'
            ? ['Classe','Frais','Tarif du niveau (FCFA)','Tarif de la classe (FCFA)','Total (FCFA)','Tranches (montant · part · échéance)']
            : [matMode === 'niveau' ? 'Niveau' : 'Classe', ...fra.map(f => f.code), 'Total/élève']}
          rows={view === 'classe'
            ? rowsClasse.map(r => [cl.libelle, r.f.code + ' — ' + r.f.libelle, r.tn != null ? r.tn : '', r.eff != null ? r.eff : '', r.eff != null ? r.eff : '',
                r.eff != null ? r.tranches.map(t => t.label + ' : ' + t.montant + ' · ' + t.pourcentage + ' % · ' + fmtD(t.iso)).join(' | ') : ''])
            : matRows.map(r => {
                const vals = fra.map(f => r.type === 'niveau' ? tarifFor(db, an.id, f.id, 'niveau', r.id) : tarifEffectif(db, an.id, f.id, r.id));
                return [r.label, ...vals.map(v => v != null ? v : ''), vals.reduce((s, v) => s + (v || 0), 0)];
              })}/>
        {cl && <span className="badge b-gold" style={{ marginLeft:0 }}>{fmt(totalClass)} FCFA / élève — {cl.libelle}</span>}
        <span className="flash-ok" style={{ display: flash ? 'inline-flex' : 'none' }}><Ic name="check"/> Enregistré</span>
      </div>

      {view === 'classe' && cl && (
        <>
          <div className="gr-head">
            <div className="gr-hl">
              <Select value={sel} onChange={setClassId} style={{ minWidth:210 }}
                options={classes.map(c => ({ value:c.id, label:c.libelle + ' — ' + ((niveauById(db, c.niveauId) || {}).libelle || '') }))}/>
              {editable && (
                <button className="btn btn-ghost btn-sm" title="Copier les tarifs spécifiques de cette classe vers d'autres classes"
                  onClick={() => openModal(<CloneGrilleModal classId={cl.id}/>)}>
                  <Ic name="layers"/> Cloner vers…
                </button>
              )}
              <Badge cls="b-navy">{niv ? niv.libelle : ''}</Badge>
              {regime && <Badge cls="b-gold">Tarifs {regime === 'interne' ? 'internes (pensionnaires)' : 'externes (externats)'}</Badge>}
              <Badge cls="b-mut">{fmt(effectif)} élève(s) actif(s)</Badge>
            </div>
            <div className="gr-tot">
              <span>Total des frais — {cl.libelle}</span>
              <b>{fmt(totalClass)} <small>FCFA / élève</small></b>
              <span className="mut" style={{ textTransform:'none', letterSpacing:0 }}>{nbEch} échéance(s) répartie(s) en tranches</span>
            </div>
          </div>
          <div className="tbl-wrap" style={{ borderTop:'none', borderRadius:'0 0 var(--r) var(--r)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth:190 }}>Frais à payer</th>
                  <th className="num">Tarif du niveau</th>
                  <th className="num gcell">Tarif de la classe</th>
                  <th style={{ minWidth:280 }}>Répartition en tranches (échéances)</th>
                  <th className="num gcell">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rowsClasse.map(r => (
                  <tr key={r.f.id}>
                    <td><b>{r.f.code}</b> — {r.f.libelle} {!r.f.obligatoire && <span className="mut">(optionnel)</span>}</td>
                    <td className="num mut">{r.tn != null ? fmt(r.tn) : '—'}</td>
                    <td className="gcell">
                      {editable && !(statut && !r.f.parStatut)
                        ? <MoneyCell value={r.eff} onCommit={raw => save('classe', cl.id, r.f.id, raw)}/>
                        : <span className="num" title={statut && !r.f.parStatut ? "Ce frais n'utilise pas la distinction nouveaux / anciens" : undefined}>{r.eff != null ? fmt(r.eff) : '—'}</span>}
                      {r.tc != null && <span className="dot" title="Tarif spécifique à la classe"/>}
                    </td>
                    <td className="gr-trs">
                      {r.eff == null
                        ? <span className="mut" style={{ fontSize:11 }}>Non applicable à cette classe</span>
                        : r.tranches.map(t => (
                            <span key={t.id}
                              className={'tr-chip' + (t.iso <= today ? ' due' : '')}
                              title={(t.iso <= today ? 'Échéance échue — ' : 'Échéance à venir — ') + fmtD(t.iso)}>
                              <b>{t.label}</b>&nbsp;{fmt(t.montant)} <span className="mut">· {t.pourcentage}&nbsp;%</span> · {fmtD(t.iso)}
                              {t.iso <= today ? <Ic name="alert"/> : <Ic name="clock"/>}
                            </span>
                          ))}
                    </td>
                    <td className="num tot-cell gcell">{r.eff != null ? fmt(r.eff) : '—'}</td>
                    <td className="rowacts">
                      {editable && r.eff != null && <>
                        {r.tc != null && (
                          <button className="icon-btn" title="Revenir au tarif du niveau"
                            onClick={() => { M.setTarif(an.id, 'classe', cl.id, r.f.id, null, regime, statut); notify(); }}>
                            <Ic name="refresh"/>
                          </button>
                        )}
                        <button className="icon-btn" title="Modifier les tranches et échéances"
                          onClick={() => openModal(<TrancheFormModal fraisId={r.f.id}/>)}>
                          <Ic name="layers"/>
                        </button>
                      </>}
                    </td>
                  </tr>
                ))}
                {rowsClasse.length === 0 && <tr><td colSpan={6} className="center mut" style={{ padding:22 }}>Aucun frais défini.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight:700 }}>MONTANT TOTAL DES FRAIS PAR ÉLÈVE</td>
                  <td className="num tot-cell gcell" style={{ fontWeight:700 }}>{fmt(totalClass)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="card" style={{ marginTop:14 }}>
            <div className="card-b" style={{ padding:'10px 16px', fontSize:'11.3px', color:'var(--muted)', lineHeight:1.8 }}>
              • Modifiez une cellule <b>Tarif de la classe</b> pour créer un tarif spécifique <span className="dot"/> ; le bouton <Ic name="refresh"/> rétablit le tarif du niveau.<br/>
              • Les <b>tranches</b> (bouton <Ic name="layers"/>) définissent la répartition du paiement : part en % du tarif et <b>échéance</b>. Les montants se recalculent automatiquement.<br/>
              • Les échéances échues <Ic name="alert"/> alimentent le <b>signalement des insolvables</b> (tableau de bord, élèves, rapport de solvabilité).<br/>
              • <b>Statut interne / externe</b> : la couche « Commun » définit les tarifs de base ; les couches « Internes » et « Externes » permettent des montants spécifiques par statut (prioritaires sur le commun pour les élèves concernés).<br/>
              • <b>Nouveaux / anciens élèves</b> : pour les frais concernés (ex : frais d'inscription, obligatoires pour tous), la couche « Nouveaux » / « Anciens » définit des montants distincts — un élève réinscrit ou repris d'une année antérieure est automatiquement reconnu comme <b>ancien</b>.
              {!editable && <><br/>• <b>Lecture seule</b> : {(an.statut === 'cloturee') ? 'année clôturée.' : 'modification réservée à l\u2019administrateur.'}</>}
            </div>
          </div>
        </>
      )}

      {view === 'matrice' && (
        <>
          <div className="tbl-wrap">
            <table className="tbl gtab">
              <thead>
                <tr>
                  <th className="rowlab">{matMode === 'niveau' ? 'Niveau' : 'Classe'}</th>
                  {fra.map(f => <th key={f.id} className="center gcell" title={f.libelle}>{f.code}</th>)}
                  <th className="num gcell">Total/élève</th>
                </tr>
              </thead>
              <tbody>
                {matRows.map(r => {
                  let total = 0;
                  return (
                    <tr key={r.type + r.id}>
                      <td className="rowlab">{r.label} <span style={{ fontWeight:400, fontSize:11 }} className="mut">{r.sub}</span></td>
                      {fra.map(f => {
                        const v = r.type === 'niveau'
                          ? tarifFor(db, an.id, f.id, 'niveau', r.id, regime, statut)
                          : tarifEffectif(db, an.id, f.id, r.id, regime, statut);
                        if (v != null) total += v;
                        const isOverride = r.type === 'classe' && tarifFor(db, an.id, f.id, 'classe', r.id, regime, statut) != null;
                        return (
                          <td key={f.id} className="gcell">
                            {editable && !(statut && !f.parStatut)
                              ? <MoneyCell value={v} onCommit={raw => save(r.type, r.id, f.id, raw)}/>
                              : <span className="num" title={statut && !f.parStatut ? "Ce frais n'utilise pas la distinction nouveaux / anciens" : undefined}>{v != null ? fmt(v) : '—'}</span>}
                            {isOverride && <span className="dot" title="Tarif spécifique à la classe"/>}
                          </td>
                        );
                      })}
                      <td className="num tot-cell gcell">{total ? fmt(total) : '—'}</td>
                    </tr>
                  );
                })}
                {matRows.length === 0 && <tr><td colSpan={fra.length + 2} className="center mut" style={{ padding:22 }}>Aucune ligne à afficher.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ marginTop:14, borderRadius:'0 0 var(--r) var(--r)', borderTop:'none' }}>
            <div className="card-b" style={{ padding:'10px 16px', fontSize:'11.3px', color:'var(--muted)', lineHeight:1.8 }}>
              {matMode === 'niveau'
                ? <>• Saisissez le montant <b>par élève</b> de chaque frais pour le niveau. Laissez vide (—) un frais non applicable à ce niveau (ex : examens).<br/>
                   • Un tarif défini <b>au niveau</b> s&apos;applique à toutes ses classes, sauf si la classe possède un tarif spécifique.</>
                : <>• Vue par classe : le montant affiché est le <b>tarif effectif</b> (tarif spécifique à la classe s&apos;il existe, sinon tarif du niveau).<br/>
                   • Modifiez une cellule pour créer un <b>tarif spécifique</b> à la classe <span className="dot"/> ; remettez la valeur du niveau (ou videz la cellule) pour revenir au tarif du niveau.</>}
              {!editable && <><br/>• <b>Lecture seule</b> : {(an.statut === 'cloturee') ? 'année clôturée.' : 'modification réservée à l\u2019administrateur.'}</>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* Cellule montant : saisie en chiffres, formatage à la sortie */
function MoneyCell({ value, onCommit }){
  const [val, setVal] = useState(value != null ? fmt(value) : '');
  const [focused, setFocused] = useState(false);
  React.useEffect(() => { if (!focused) setVal(value != null ? fmt(value) : ''); }, [value, focused]);
  return (
    <div className="mny">
      <input className="money" inputMode="numeric"
        value={val}
        placeholder="—"
        onFocus={e => { setFocused(true); e.target.select(); }}
        onBlur={() => { setFocused(false); onCommit(val); }}
        onChange={e => setVal(e.target.value.replace(/[^\d]/g,'').slice(0,9))}/>
    </div>
  );
}


function CloneGrilleModal({ classId, onClose }){
  const { db, anneeId, M, toast, closeModal } = useApp();
  const close = onClose || closeModal;
  const src = db.classes.find(c => c.id === classId);
  const [sel, setSel] = useState({});
  const [regimes, setRegimes] = useState(true);
  if (!src) return null;
  const nbSrc = db.tarifs.filter(t => t.anneeId === anneeId && t.cibleType === 'classe'
    && t.cibleId === classId && (regimes || !t.regime)).length;
  const nvs = niveauxSorted(db);
  const nbSel = Object.keys(sel).filter(k => sel[k]).length;

  const submit = e => {
    e.preventDefault();
    const ids = Object.keys(sel).filter(k => sel[k]);
    if (!ids.length){ toast('Sélectionnez au moins une classe destination.', 'err'); return; }
    try {
      const r = M.cloneGrille(anneeId, classId, ids, regimes);
      toast('Grille de ' + src.libelle + ' clonée vers ' + ids.length + ' classe(s) — ' + r.n + ' tarif(s) copié(s).', 'ok');
      close();
    } catch(err){ toast(String(err.message || err), 'err'); }
  };

  return (
    <Modal icon="layers" title={'Cloner la grille de ' + src.libelle} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)', maxWidth:'50%' }}>
            {nbSrc} tarif(s) spécifique(s) · {nbSel} classe(s) sélectionnée(s)
          </span>
          <button className="btn btn-ghost" onClick={close}>Annuler</button>
          <button className="btn btn-pri" type="submit" form="clone-form"><Ic name="check"/> Cloner</button>
        </>
      }>
      <form id="clone-form" onSubmit={submit}>
        <p className="mut" style={{ fontSize:12.2, lineHeight:1.65, marginBottom:12 }}>
          Copie les <b>tarifs spécifiques de {src.libelle}</b> (la répartition en tranches, définie par type de frais, est conservée)
          vers les classes cochées. Les tarifs spécifiques existants des classes destinations sont <b>remplacés</b> ;
          les tarifs de niveau restent inchangés.
        </p>
        <label className="chk" style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, fontSize:12.4 }}>
          <input type="checkbox" checked={regimes} onChange={e => setRegimes(e.target.checked)}/>
          <span>Inclure les tarifs par statut <b>interne / externe</b></span>
        </label>
        <div className="clone-list">
          {nvs.map(nv => {
            const cls = classesOf(db, nv.id).filter(c => c.id !== classId);
            if (!cls.length) return null;
            return (
              <React.Fragment key={nv.id}>
                <div className="clone-g">{nv.libelle}</div>
                {cls.map(c => (
                  <label className="clone-row" key={c.id}>
                    <input type="checkbox" checked={!!sel[c.id]}
                      onChange={e => setSel(s => ({ ...s, [c.id]:e.target.checked }))}/>
                    <span><b>{c.libelle}</b> <span className="mut" style={{ fontSize:11 }}>
                      — {db.eleves.filter(e2 => e2.anneeId === anneeId && e2.classeId === c.id).length} élève(s)</span></span>
                  </label>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
