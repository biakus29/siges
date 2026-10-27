import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, Select, CsvBtn } from '../components/UI.jsx';
import { BarChart } from '../components/Charts.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { ReportModal, StatsReport } from '../components/Reports.jsx';
import { classesSorted, classesPerimetre, classeParDefaut, optionClasse, niveauxSorted, niveauById, classById, planOf, coefOf, sequencesSorted, statsNotes,
  classementClasse, moyenneMatiere, moyenneGenerale } from '../core/business.js';

/* v5.4 — Statistiques pédagogiques : QUATRE analyses au choix.
   • CLASSE : moyennes par matière pour la classe choisie ;
   • MATIÈRE : la matière choisie analysée dans toutes les classes où
     elle est enseignée (+ ensemble) ;
   • NIVEAU : toutes les classes du niveau choisi (+ ensemble du niveau) ;
   • CYCLE : tous les niveaux du cycle choisi, collège ou lycée (+ ensemble).
   Période au choix (séquence, trimestre ou année) ; export CSV et
   impression A4 de chaque analyse ; périmètres de profils respectés. */
const fmt2 = v => v == null ? '—' : v.toFixed(2).replace('.', ',');
const fmt2csv = v => v == null ? '' : String(v.toFixed(2)).replace('.', ',');

export default function Stats(){
  const { db, anneeId, openModal, scope } = useApp();

  const classes = useMemo(() => {
    return classesPerimetre(db, scope.classesIds);
  }, [db, scope.classesIds]);

  const matieresAll = useMemo(() => {
    const all = (db.matieres || []).slice().sort((a,b) => (a.libelle < b.libelle ? -1 : 1));
    return scope.matieresIds ? all.filter(m => scope.matieresIds.includes(m.id)) : all;
  }, [db, scope.matieresIds]);

  const niveaux = useMemo(() => niveauxSorted(db).filter(nv => classes.some(c => c.niveauId === nv.id)), [db, classes]);
  const cycles = useMemo(() => [...new Set(niveaux.map(nv => nv.cycle))].filter(Boolean), [niveaux]);

  const [mode, setMode] = useState('classe');
  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [cycle, setCycle] = useState('');
  const [periode, setPeriode] = useState('');

  const clId = classes.some(c => c.id === classeId) ? classeId : classeParDefaut(db, anneeId, classes);
  const mid = matieresAll.some(m => m.id === matiereId) ? matiereId : (matieresAll[0] ? matieresAll[0].id : '');
  const nvId = niveaux.some(n => n.id === niveauId) ? niveauId : (niveaux[0] ? niveaux[0].id : '');
  const cyc = cycles.includes(cycle) ? cycle : (cycles[0] || '');

  const sequences = sequencesSorted(db);
  const periodeLabel = periode === '' ? 'Année complète'
    : (/^T[1-3]$/.test(periode) ? 'Trimestre ' + periode[1]
      : ((sequences.find(sq => String(sq.id) === String(periode)) || {}).libelle || 'Séquence'));
  const periodeOpts = [{ value:'', label:'Année complète' }]
    .concat([1, 2, 3].map(t => ({ value:'T' + t, label:'Trimestre ' + t })))
    .concat(sequences.map(sq => ({ value:String(sq.id), label:sq.libelle + ' (T' + sq.trimestre + ')' })));

  const cl = clId ? classById(db, clId) : null;
  const mat = mid ? (db.matieres || []).find(m => m.id === mid) : null;

  /* matières de la classe dans l'ordre du plan (celui du bulletin) */
  const matieresClasse = useMemo(() => {
    const plan = planOf(db, clId);
    if (!plan.length) return matieresAll;
    const ordre = new Map(plan.map((e, i) => [e.matiereId, i]));
    return matieresAll.filter(m => ordre.has(m.id)).sort((a,b) => ordre.get(a.id) - ordre.get(b.id));
  }, [matieresAll, db, clId]);

  const elevesDe = useMemo(() => (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === clId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1)), [db, anneeId, clId]);

  /* ============ MODE CLASSE : moyennes par matière ============ */
  const rowsMat = useMemo(() => matieresClasse.map(m => {
    const vals = elevesDe.map(el => moyenneMatiere(db, anneeId, el.id, m.id, periode)).filter(v => v != null);
    const st = statsNotes(db, vals);
    return { m, coef: coefOf(db, clId, m.id) || 1, evalues: st.n, effectif: elevesDe.length,
      moy: st.moy, min: st.min, max: st.max, pct: st.pct };
  }), [matieresClasse, elevesDe, db, anneeId, clId, periode]);

  /* ============ MODE MATIÈRE : la matière dans chaque classe ============ */
  const rowsMatParClasse = useMemo(() => {
    if (!mid) return { rows: [], ens: null };
    const cibles = classes.filter(c => planOf(db, c.id).some(e => e.matiereId === mid));
    const rows = cibles.map(c => {
      const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie');
      const vals = els.map(el => moyenneMatiere(db, anneeId, el.id, mid, periode)).filter(v => v != null);
      const st = statsNotes(db, vals);
      return { c, effectif: els.length, evalues: st.n, moy: st.moy, min: st.min, max: st.max, pct: st.pct };
    });
    const tous = [];
    cibles.forEach(c => (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie')
      .forEach(el => { const v = moyenneMatiere(db, anneeId, el.id, mid, periode); if (v != null) tous.push(v); }));
    const st = statsNotes(db, tous);
    return { rows, ens: { n: st.n, moy: st.moy, min: st.min, max: st.max, pct: st.pct } };
  }, [classes, db, anneeId, mid, periode]);

  /* ============ MODE NIVEAU : synthèse par classe du niveau ============ */
  const rowsNiveau = useMemo(() => {
    const cibles = classes.filter(c => c.niveauId === nvId);
    const rows = cibles.map(c => {
      const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie');
      const cls = classementClasse(db, anneeId, c.id, periode);
      const vals = els.map(el => moyenneGenerale(db, anneeId, el.id, periode)).filter(v => v != null);
      const st = statsNotes(db, vals);
      return { c, effectif: els.length, classesN: cls.classes.length, nc: els.length - cls.classes.length,
        moy: st.moy, best: st.max, pct: st.pct };
    });
    const tous = [];
    cibles.forEach(c => (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie')
      .forEach(el => { const v = moyenneGenerale(db, anneeId, el.id, periode); if (v != null) tous.push(v); }));
    const st = statsNotes(db, tous);
    return { rows, ens: { effectif: rows.reduce((t, r) => t + r.effectif, 0), classesN: rows.reduce((t, r) => t + r.classesN, 0),
      nc: rows.reduce((t, r) => t + r.nc, 0), moy: st.moy, best: st.max, pct: st.pct } };
  }, [classes, db, anneeId, nvId, periode]);

  /* ============ MODE CYCLE : synthèse par niveau du cycle ============ */
  const rowsCycle = useMemo(() => {
    const nvs = niveaux.filter(nv => nv.cycle === cyc);
    const rows = nvs.map(nv => {
      const cibles = classes.filter(c => c.niveauId === nv.id);
      let effectif = 0, classesN = 0, nc = 0;
      const tous = [];
      cibles.forEach(c => {
        const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie');
        effectif += els.length;
        const cls = classementClasse(db, anneeId, c.id, periode);
        classesN += cls.classes.length;
        nc += els.length - cls.classes.length;
        els.forEach(el => { const v = moyenneGenerale(db, anneeId, el.id, periode); if (v != null) tous.push(v); });
      });
      const st = statsNotes(db, tous);
      return { nv, nbClasses: cibles.length, effectif, classesN, nc, moy: st.moy, best: st.max, pct: st.pct };
    });
    const tous = [];
    nvs.forEach(nv => classes.filter(c => c.niveauId === nv.id).forEach(c =>
      (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie')
        .forEach(el => { const v = moyenneGenerale(db, anneeId, el.id, periode); if (v != null) tous.push(v); })));
    const st = statsNotes(db, tous);
    return { rows, ens: { effectif: rows.reduce((t, r) => t + r.effectif, 0), classesN: rows.reduce((t, r) => t + r.classesN, 0),
      nc: rows.reduce((t, r) => t + r.nc, 0), moy: st.moy, best: st.max, pct: st.pct } };
  }, [niveaux, classes, db, anneeId, cyc, periode]);

  if (!classes.length){
    return (
      <div className="card"><div className="card-b">
        <EmptyState icon="chart" title="Aucune statistique"
          text="Aucune classe avec élèves inscrits dans votre périmètre pour cette année."/>
      </div></div>
    );
  }

  /* ---------- exports CSV + impression selon le mode ---------- */
  const MODES = [
    ['classe', 'Par classe', 'Analyse d\u2019une classe : moyennes par matière'],
    ['matiere', 'Par matière', 'Analyse d\u2019une matière dans toutes les classes'],
    ['niveau', 'Par niveau', 'Synthèse des classes d\u2019un niveau'],
    ['cycle', 'Par cycle', 'Synthèse des niveaux d\u2019un cycle (collège / lycée)']
  ];

  let csvHead, csvRows, printColonnes, printLignes, printTitre, graphItems = null, entete;

  if (mode === 'classe'){
    entete = cl ? cl.libelle : '';
    printTitre = 'Classe ' + entete;
    csvHead = ['Matière','Code','Coef','Évalués','Effectif','Moyenne /20','Min','Max','% ≥ 10'];
    csvRows = rowsMat.map(r => [r.m.libelle, r.m.code, r.coef, r.evalues, r.effectif, fmt2csv(r.moy), fmt2csv(r.min), fmt2csv(r.max), r.pct == null ? '' : r.pct + ' %']);
    printColonnes = [{ label:'Matière' }, { label:'Coef', num:true }, { label:'Évalués', num:true }, { label:'Effectif', num:true },
      { label:'Moyenne /20', num:true }, { label:'Min', num:true }, { label:'Max', num:true }, { label:'% ≥ 10', num:true }];
    printLignes = rowsMat.map(r => [r.m.libelle, r.coef, r.evalues, r.effectif, fmt2(r.moy), fmt2(r.min), fmt2(r.max), r.pct == null ? '—' : r.pct + ' %']);
    if (rowsMat.some(r => r.moy != null)) graphItems = rowsMat.map(r => ({ l:r.m.code, v:r.moy == null ? 0 : r.moy, title:r.m.libelle }));
  } else if (mode === 'matiere'){
    entete = mat ? mat.libelle : '';
    printTitre = 'Matière ' + entete;
    csvHead = ['Classe','Effectif','Évalués','Moyenne /20','Min','Max','% ≥ 10'];
    csvRows = rowsMatParClasse.rows.map(r => [r.c.libelle, r.effectif, r.evalues, fmt2csv(r.moy), fmt2csv(r.min), fmt2csv(r.max), r.pct == null ? '' : r.pct + ' %'])
      .concat([['ENSEMBLE', rowsMatParClasse.rows.reduce((t, r) => t + r.effectif, 0), rowsMatParClasse.ens.n, fmt2csv(rowsMatParClasse.ens.moy), fmt2csv(rowsMatParClasse.ens.min), fmt2csv(rowsMatParClasse.ens.max), rowsMatParClasse.ens.pct == null ? '' : rowsMatParClasse.ens.pct + ' %']]);
    printColonnes = [{ label:'Classe' }, { label:'Effectif', num:true }, { label:'Évalués', num:true },
      { label:'Moyenne /20', num:true }, { label:'Min', num:true }, { label:'Max', num:true }, { label:'% ≥ 10', num:true }];
    printLignes = rowsMatParClasse.rows.map(r => [r.c.libelle, r.effectif, r.evalues, fmt2(r.moy), fmt2(r.min), fmt2(r.max), r.pct == null ? '—' : r.pct + ' %'])
      .concat([['ENSEMBLE — ' + (mat ? mat.libelle : ''), rowsMatParClasse.rows.reduce((t, r) => t + r.effectif, 0), rowsMatParClasse.ens.n,
        fmt2(rowsMatParClasse.ens.moy), fmt2(rowsMatParClasse.ens.min), fmt2(rowsMatParClasse.ens.max), rowsMatParClasse.ens.pct == null ? '—' : rowsMatParClasse.ens.pct + ' %']]);
    if (rowsMatParClasse.rows.some(r => r.moy != null)) graphItems = rowsMatParClasse.rows.map(r => ({ l:r.c.libelle, v:r.moy == null ? 0 : r.moy, title:(mat ? mat.libelle : '') + ' — ' + r.c.libelle }));
  } else if (mode === 'niveau'){
    const nv = niveauById(db, nvId);
    entete = nv ? nv.libelle : '';
    printTitre = 'Niveau ' + entete;
    csvHead = ['Classe','Effectif','Classés','Non classés','Moyenne /20','Meilleure /20','% ≥ 10'];
    const lignesR = rowsNiveau.rows.map(r => [r.c.libelle, r.effectif, r.classesN, r.nc, fmt2csv(r.moy), fmt2csv(r.best), r.pct == null ? '' : r.pct + ' %'])
      .concat([['ENSEMBLE DU NIVEAU', rowsNiveau.ens.effectif, rowsNiveau.ens.classesN, rowsNiveau.ens.nc, fmt2csv(rowsNiveau.ens.moy), fmt2csv(rowsNiveau.ens.best), rowsNiveau.ens.pct == null ? '' : rowsNiveau.ens.pct + ' %']]);
    csvRows = lignesR;
    printColonnes = [{ label:'Classe' }, { label:'Effectif', num:true }, { label:'Classés', num:true }, { label:'NC', num:true },
      { label:'Moyenne /20', num:true }, { label:'Meilleure /20', num:true }, { label:'% ≥ 10', num:true }];
    printLignes = rowsNiveau.rows.map(r => [r.c.libelle, r.effectif, r.classesN, r.nc || '0', fmt2(r.moy), fmt2(r.best), r.pct == null ? '—' : r.pct + ' %'])
      .concat([['ENSEMBLE DU NIVEAU', rowsNiveau.ens.effectif, rowsNiveau.ens.classesN, rowsNiveau.ens.nc || '0', fmt2(rowsNiveau.ens.moy), fmt2(rowsNiveau.ens.best), rowsNiveau.ens.pct == null ? '—' : rowsNiveau.ens.pct + ' %']]);
    if (rowsNiveau.rows.some(r => r.moy != null)) graphItems = rowsNiveau.rows.map(r => ({ l:r.c.libelle, v:r.moy == null ? 0 : r.moy, title:r.c.libelle }));
  } else {
    entete = cyc || '';
    printTitre = 'Cycle ' + entete;
    csvHead = ['Niveau','Classes','Effectif','Classés','Non classés','Moyenne /20','Meilleure /20','% ≥ 10'];
    csvRows = rowsCycle.rows.map(r => [r.nv.libelle, r.nbClasses, r.effectif, r.classesN, r.nc, fmt2csv(r.moy), fmt2csv(r.best), r.pct == null ? '' : r.pct + ' %'])
      .concat([['ENSEMBLE DU CYCLE', rowsCycle.rows.reduce((t, r) => t + r.nbClasses, 0), rowsCycle.ens.effectif, rowsCycle.ens.classesN, rowsCycle.ens.nc, fmt2csv(rowsCycle.ens.moy), fmt2csv(rowsCycle.ens.best), rowsCycle.ens.pct == null ? '' : rowsCycle.ens.pct + ' %']]);
    printColonnes = [{ label:'Niveau' }, { label:'Classes', num:true }, { label:'Effectif', num:true }, { label:'Classés', num:true }, { label:'NC', num:true },
      { label:'Moyenne /20', num:true }, { label:'Meilleure /20', num:true }, { label:'% ≥ 10', num:true }];
    printLignes = rowsCycle.rows.map(r => [r.nv.libelle, r.nbClasses, r.effectif, r.classesN, r.nc || '0', fmt2(r.moy), fmt2(r.best), r.pct == null ? '—' : r.pct + ' %'])
      .concat([['ENSEMBLE DU CYCLE', rowsCycle.rows.reduce((t, r) => t + r.nbClasses, 0), rowsCycle.ens.effectif, rowsCycle.ens.classesN, rowsCycle.ens.nc || '0', fmt2(rowsCycle.ens.moy), fmt2(rowsCycle.ens.best), rowsCycle.ens.pct == null ? '—' : rowsCycle.ens.pct + ' %']]);
    if (rowsCycle.rows.some(r => r.moy != null)) graphItems = rowsCycle.rows.map(r => ({ l:r.nv.code, v:r.moy == null ? 0 : r.moy, title:r.nv.libelle }));
  }

  const imprimer = () => {
    openModal(
      <ReportModal title={'Statistiques — ' + printTitre + ' — ' + periodeLabel}>
        <StatsReport titre={printTitre} periodeLabel={periodeLabel} colonnes={printColonnes} lignes={printLignes}
          note={mode === 'classe' ? 'Moyennes des élèves de la classe par matière du plan — ' + periodeLabel.toLowerCase() + '.'
            : (mode === 'matiere' ? 'Moyennes des élèves dans chaque classe où la matière est enseignée.'
            : 'Moyennes générales des élèves ; NC = non classé (aucune note dans l\u2019ensemble des matières indispensables).')}/>
      </ReportModal>
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-h">
          <h3><Ic name="chart"/> Statistiques pédagogiques</h3>
          <button className="btn btn-ghost btn-sm" onClick={imprimer}><Ic name="printer"/> Imprimer</button>
        </div>
        <div className="card-b">
          <div className="tabs" style={{ marginBottom:14 }} role="tablist" aria-label="Type d'analyse">
            {MODES.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={mode === k} className={'tab' + (mode === k ? ' on' : '')}
                onClick={() => setMode(k)}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            {mode === 'classe' && (
              <label style={{ flex:'1 1 240px' }}>Classe analysée
                <Select value={clId} onChange={setClasseId}
                  options={classes.map(c => optionClasse(db, anneeId, c))}/>
              </label>
            )}
            {mode === 'matiere' && (
              <label style={{ flex:'1 1 240px' }}>Matière analysée
                <Select value={mid} onChange={setMatiereId}
                  options={matieresAll.map(m => ({ value:m.id, label:m.code + ' — ' + m.libelle }))}/>
              </label>
            )}
            {mode === 'niveau' && (
              <label style={{ flex:'1 1 240px' }}>Niveau analysé
                <Select value={nvId} onChange={setNiveauId}
                  options={niveaux.map(nv => ({ value:nv.id, label:nv.libelle + ' (' + nv.cycle + ')' }))}/>
              </label>
            )}
            {mode === 'cycle' && (
              <label style={{ flex:'1 1 240px' }}>Cycle analysé
                <Select value={cyc} onChange={setCycle}
                  options={cycles.map(c => ({ value:c, label:c === 'Collège' ? 'Collège (6ème → 3ème)' : c }))}/>
              </label>
            )}
            <label style={{ flex:'0 0 220px' }}>Période
              <Select value={periode} onChange={setPeriode} options={periodeOpts}/>
            </label>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>{printTitre} <span className="mut">/ {periodeLabel}</span></h3>
          <CsvBtn filename={'stats-' + mode + '.csv'} header={csvHead} rows={csvRows}/>
        </div>
        {graphItems && (
          <div className="card-b" style={{ paddingBottom:0 }}>
            <BarChart unit="/20" items={graphItems}/>
          </div>
        )}
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr>
              {printColonnes.map((c, i) => <th key={i} style={c.num ? { textAlign:'center' } : undefined}>{c.label}</th>)}
            </tr></thead>
            <tbody>
              {mode === 'classe' && rowsMat.map(r => (
                <tr key={r.m.id}>
                  <td><b>{r.m.libelle}</b> <span className="mut">{r.m.code}</span></td>
                  <td className="num">{r.coef}</td>
                  <td className="num">{r.evalues}{r.evalues < r.effectif ? <span className="mut">/{r.effectif}</span> : ''}</td>
                  <td className="num">{r.effectif}</td>
                  <td className="num" style={{ fontWeight:700 }}>{r.moy == null ? <span className="mut">—</span> : <Badge cls={r.moy >= 14 ? 'ok' : (r.moy >= 10 ? '' : 'bad')}>{fmt2(r.moy)}</Badge>}</td>
                  <td className="num">{fmt2(r.min)}</td>
                  <td className="num">{fmt2(r.max)}</td>
                  <td className="num">{r.pct == null ? '—' : <Badge cls={r.pct >= 50 ? 'ok' : (r.pct >= 25 ? 'b-warn' : 'bad')}>{r.pct} %</Badge>}</td>
                </tr>
              ))}
              {mode === 'matiere' && rowsMatParClasse.rows.map(r => (
                <tr key={r.c.id}>
                  <td><b>{r.c.libelle}</b> <span className="mut">{(niveauById(db, r.c.niveauId) || {}).libelle || ''}</span></td>
                  <td className="num">{r.effectif}</td>
                  <td className="num">{r.evalues}{r.evalues < r.effectif ? <span className="mut">/{r.effectif}</span> : ''}</td>
                  <td className="num" style={{ fontWeight:700 }}>{r.moy == null ? <span className="mut">—</span> : <Badge cls={r.moy >= 14 ? 'ok' : (r.moy >= 10 ? '' : 'bad')}>{fmt2(r.moy)}</Badge>}</td>
                  <td className="num">{fmt2(r.min)}</td>
                  <td className="num">{fmt2(r.max)}</td>
                  <td className="num">{r.pct == null ? '—' : <Badge cls={r.pct >= 50 ? 'ok' : (r.pct >= 25 ? 'b-warn' : 'bad')}>{r.pct} %</Badge>}</td>
                </tr>
              ))}
              {mode === 'matiere' && (
                <tr className="tot-row">
                  <td><b>ENSEMBLE — {mat ? mat.libelle : ''}</b></td>
                  <td className="num">{rowsMatParClasse.rows.reduce((t, r) => t + r.effectif, 0)}</td>
                  <td className="num">{rowsMatParClasse.ens.n}</td>
                  <td className="num"><b>{fmt2(rowsMatParClasse.ens.moy)}</b></td>
                  <td className="num">{fmt2(rowsMatParClasse.ens.min)}</td>
                  <td className="num">{fmt2(rowsMatParClasse.ens.max)}</td>
                  <td className="num">{rowsMatParClasse.ens.pct == null ? '—' : rowsMatParClasse.ens.pct + ' %'}</td>
                </tr>
              )}
              {mode === 'niveau' && rowsNiveau.rows.map(r => (
                <tr key={r.c.id}>
                  <td><b>{r.c.libelle}</b></td>
                  <td className="num">{r.effectif}</td>
                  <td className="num">{r.classesN}</td>
                  <td className="num">{r.nc ? <Badge cls="b-mut" title="Non classés : aucune note dans l'ensemble des matières indispensables">{r.nc}</Badge> : 0}</td>
                  <td className="num" style={{ fontWeight:700 }}>{r.moy == null ? <span className="mut">—</span> : <Badge cls={r.moy >= 14 ? 'ok' : (r.moy >= 10 ? '' : 'bad')}>{fmt2(r.moy)}</Badge>}</td>
                  <td className="num">{fmt2(r.best)}</td>
                  <td className="num">{r.pct == null ? '—' : <Badge cls={r.pct >= 50 ? 'ok' : (r.pct >= 25 ? 'b-warn' : 'bad')}>{r.pct} %</Badge>}</td>
                </tr>
              ))}
              {mode === 'niveau' && (
                <tr className="tot-row">
                  <td><b>ENSEMBLE DU NIVEAU</b></td>
                  <td className="num">{rowsNiveau.ens.effectif}</td>
                  <td className="num">{rowsNiveau.ens.classesN}</td>
                  <td className="num">{rowsNiveau.ens.nc || 0}</td>
                  <td className="num"><b>{fmt2(rowsNiveau.ens.moy)}</b></td>
                  <td className="num">{fmt2(rowsNiveau.ens.best)}</td>
                  <td className="num">{rowsNiveau.ens.pct == null ? '—' : rowsNiveau.ens.pct + ' %'}</td>
                </tr>
              )}
              {mode === 'cycle' && rowsCycle.rows.map(r => (
                <tr key={r.nv.id}>
                  <td><b>{r.nv.libelle}</b> <span className="mut">{r.nbClasses} classe(s)</span></td>
                  <td className="num">{r.nbClasses}</td>
                  <td className="num">{r.effectif}</td>
                  <td className="num">{r.classesN}</td>
                  <td className="num">{r.nc ? <Badge cls="b-mut" title="Non classés : aucune note dans l'ensemble des matières indispensables">{r.nc}</Badge> : 0}</td>
                  <td className="num" style={{ fontWeight:700 }}>{r.moy == null ? <span className="mut">—</span> : <Badge cls={r.moy >= 14 ? 'ok' : (r.moy >= 10 ? '' : 'bad')}>{fmt2(r.moy)}</Badge>}</td>
                  <td className="num">{fmt2(r.best)}</td>
                  <td className="num">{r.pct == null ? '—' : <Badge cls={r.pct >= 50 ? 'ok' : (r.pct >= 25 ? 'b-warn' : 'bad')}>{r.pct} %</Badge>}</td>
                </tr>
              ))}
              {mode === 'cycle' && (
                <tr className="tot-row">
                  <td><b>ENSEMBLE DU CYCLE</b></td>
                  <td className="num">{rowsCycle.rows.reduce((t, r) => t + r.nbClasses, 0)}</td>
                  <td className="num">{rowsCycle.ens.effectif}</td>
                  <td className="num">{rowsCycle.ens.classesN}</td>
                  <td className="num">{rowsCycle.ens.nc || 0}</td>
                  <td className="num"><b>{fmt2(rowsCycle.ens.moy)}</b></td>
                  <td className="num">{fmt2(rowsCycle.ens.best)}</td>
                  <td className="num">{rowsCycle.ens.pct == null ? '—' : rowsCycle.ens.pct + ' %'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

