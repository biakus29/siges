import React from 'react';
import { Badge, Bar, Kpi, EmptyState, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { BarChart, Donut } from '../components/Charts.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pctTxt } from '../core/utils.js';
import { yearById, niveauxSorted, classesSorted, classesOf, tarifEffectif, tarifFor, eleveById, classById, niveauById, yearAggregates, solvabiliteAnnee, scopeClassesIds, scopeMatieresIds, moyenneGenerale, sequencesSorted, matieresObligatoires, DISCIPLINE_CATS, GRAVITE_LABEL } from '../core/business.js';
import ReceiptModal from '../components/modals/ReceiptModal.jsx';
import PayModal from '../components/modals/PayModal.jsx';
import { AnneeFormModal } from '../components/modals/EntityForms.jsx';

function FinDash(){
  const { db, anneeId, can, isAdmin, go, openModal } = useApp();
  const an = yearById(db, anneeId);

  if (!an){
    return (
      <div className="card"><div className="card-b">
        <EmptyState icon="calendar" title="Aucune année scolaire" text="Créez et activez une année scolaire pour commencer.">
          {isAdmin() && <button className="btn btn-pri" onClick={() => openModal(<AnneeFormModal/>)}><Ic name="plus"/> Nouvelle année scolaire</button>}
        </EmptyState>
      </div></div>
    );
  }

  const stats = yearAggregates(db, an.id);
  const sv = solvabiliteAnnee(db, an.id);
  const ay = db.annees.find(a => a.active);

  /* Encaissements mensuels */
  const mois = ['sept.','oct.','nov.','déc.','janv.','févr.','mars','avr.','mai','juin','juil.'];
  const y1 = parseInt(an.libelle.slice(0,4), 10);
  const buckets = mois.map(() => 0);
  db.paiements.forEach(p => {
    if (p.anneeId !== an.id || p.statut !== 'valide') return;
    const d = new Date(p.date); if (isNaN(d)) return;
    const m = d.getMonth()+1, yy = d.getFullYear();
    if (yy === y1 && m >= 8 && m <= 12) buckets[m === 8 ? 0 : m-9] += p.montant;
    else if (yy === y1+1 && m <= 7) buckets[m+3] += p.montant;
  });
  const now = new Date();
  const curM = now.getMonth()+1, curY = now.getFullYear();
  const curIdx = (curY === y1 && curM >= 8) ? (curM === 8 ? 0 : curM-9) : ((curY === y1+1 && curM <= 7) ? curM+3 : -1);
  const chartItems = mois.map((l, i) => ({ l, v:buckets[i], hl:i === curIdx, title:l + ' ' + an.libelle }));

  const quick = [];
  if (can('paiements', true) && ay && an.id === ay.id && ay.statut === 'ouverte')
    quick.push(<button className="btn btn-gold" key="pay" onClick={() => openModal(<PayModal/>)}><Ic name="plus"/> Nouvel encaissement</button>);
  if (can('eleves', true))
    quick.push(<button className="btn btn-pri" key="el" onClick={() => go('eleves')}><Ic name="users"/> Élèves &amp; inscriptions</button>);
  if (isAdmin())
    quick.push(<button className="btn btn-ghost" key="an" onClick={() => go('annees')}><Ic name="calendar"/> Années scolaires</button>);
  quick.push(<button className="btn btn-ghost" key="gr" onClick={() => go('grille')}><Ic name="grid"/> Grille tarifaire</button>);
  quick.push(<button className="btn btn-ghost" key="pa" onClick={() => go('paiements')}><Ic name="receipt"/> Journal des paiements</button>);
  quick.push(<button className="btn btn-ghost" key="rp" onClick={() => go('rapports')}><Ic name="printer"/> Rapports</button>);
  quick.push(<CsvBtn key="csv" filename={'synthese_' + an.libelle + '.csv'}
    header={['Classe','Niveau','Effectif actif','À jour','Insolvables','Attendu net (FCFA)','Encaissé (FCFA)','Reste (FCFA)','Taux']}
    rows={classesSorted(db).filter(c => stats.perClasse[c.id]).map(c => {
      const a = stats.perClasse[c.id];
      const s = sv.parClasse[c.id];
      return [c.libelle, (niveauById(db, c.niveauId) || {}).libelle || '', a.effectif, a.aJour, s ? s.insolvables : 0,
        a.attendu, a.encaisse, Math.max(0, a.attendu - a.encaisse),
        (Math.round((a.attendu > 0 ? a.encaisse / a.attendu : 0) * 1000) / 10).toString().replace('.', ',') + ' %'];
    })}/>)

  /* Alertes de cohérence */
  const alerts = [];
  if (sv.insolvables > 0) alerts.push({ t:'bad', txt:fmt(sv.insolvables) + ' élève(s) insolvable(s) : échéances de tranches dépassées et non réglées (' + fmt(sv.soldeExigible) + ' FCFA). Rapport de solvabilité disponible.', pg:'rapports' });
  if (!ay) alerts.push({ t:'bad', txt:'Aucune année scolaire active — activez une année pour autoriser les encaissements.', pg:'annees' });
  if (an.statut === 'cloturee') alerts.push({ t:'info', txt:'Année ' + an.libelle + ' clôturée : consultation en lecture seule.' });
  niveauxSorted(db).forEach(nv => {
    const cls = classesOf(db, nv.id);
    if (!cls.length) return;
    db.frais.forEach(f => {
      if (!f.obligatoire) return;
      const manque = cls.some(cl => tarifEffectif(db, an.id, f.id, cl.id) == null);
      if (manque && tarifFor(db, an.id, f.id, 'niveau', nv.id) == null){
        const tousOverr = cls.every(cl => tarifFor(db, an.id, f.id, 'classe', cl.id) != null);
        if (!tousOverr) alerts.push({ t:'warn', txt:'Tarif manquant : « ' + f.libelle + ' » pour le niveau ' + nv.libelle + '.', pg:'grille' });
      }
    });
  });
  classesSorted(db).forEach(cl => {
    const n = db.eleves.filter(e => e.anneeId === an.id && e.classeId === cl.id).length;
    if (!n) alerts.push({ t:'warn', txt:'Classe « ' + cl.libelle + ' » sans aucun élève inscrit.', pg:'eleves' });
  });

  const last = db.paiements.filter(p => p.anneeId === an.id && p.statut === 'valide')
    .sort((a,b) => a.date < b.date ? 1 : -1).slice(0, 8);

  return (
    <>
      <div className="quick">{quick}</div>
      <div className="kpis">
        <Kpi icon="users" val={fmt(stats.effectif)} label="Élèves inscrits"
          sub={stats.effectifTotal > stats.effectif ? fmt(stats.effectifTotal - stats.effectif) + ' radié(s) inclus au suivi' : 'Année ' + an.libelle}
          color="#14406e" bg="#dbe6f4"/>
        <Kpi icon="bank" val={fmt(stats.attendu)} label="Total attendu (net)"
          sub={stats.totalReductions > 0
            ? 'Après ' + fmt(stats.totalReductions) + ' FCFA de réductions accordées'
            : 'Somme des frais applicables'}
          color="#1f5fbf" bg="#e7effc"/>
        <Kpi icon="cash" val={fmt(stats.encaisse)} label="Total encaissé"
          sub={'Reste à recouvrer : ' + fmt(Math.max(0, stats.attendu - stats.encaisse)) + ' FCFA'}
          color="#177a4c" bg="#e3f4ea"/>
        <Kpi icon="target" val={pctTxt(stats.taux)} label="Taux de recouvrement"
          sub={<Bar pct={stats.taux*100} cls={stats.taux >= .75 ? 'g' : (stats.taux >= .4 ? 'o' : 'r')}/>}
          color="#a8871e" bg="#f7efd8"/>
        <Kpi icon="alert" val={fmt(sv.insolvables)} label="Insolvables"
          sub={sv.insolvables ? fmt(sv.soldeExigible) + ' FCFA d\u2019exigible non réglé (échéances dépassées)' : 'Aucune échéance dépassée'}
          color="#b3261e" bg="#fbe9e7"/>
      </div>

      <div className="dash-g1">
        <div className="card">
          <div className="card-h"><h3><Ic name="chart"/> Encaissements mensuels — {an.libelle}</h3><Badge cls="b-navy">FCFA</Badge></div>
          <div className="card-b"><BarChart items={chartItems}/></div>
        </div>
        <div className="card">
          <div className="card-h"><h3><Ic name="target"/> Recouvrement</h3></div>
          <div className="card-b">
            <div className="donut-wrap">
              <Donut pct={stats.taux} top={pctTxt(stats.taux).replace(' %','%')} bottom="RECOUVRÉ"/>
              <div style={{ minWidth:0 }}>
                <div className="mrow" style={{ padding:'2px 0' }}><span className="ml" style={{ width:'auto', marginRight:8 }}>Encaissé</span><b style={{ color:'var(--ok)' }}>{fmt(stats.encaisse)}</b></div>
                <div className="mrow" style={{ padding:'2px 0' }}><span className="ml" style={{ width:'auto', marginRight:8 }}>Reste</span><b style={{ color:'var(--bad)' }}>{fmt(Math.max(0, stats.attendu - stats.encaisse))}</b></div>
                <div className="mrow" style={{ padding:'2px 0' }}><span className="ml" style={{ width:'auto', marginRight:8 }}>Attendu</span><b>{fmt(stats.attendu)}</b></div>
                <hr style={{ border:'none', borderTop:'1px dashed var(--line)', margin:'8px 0' }}/>
                <div style={{ fontSize:'11.5px', color:'var(--muted)' }}>
                  <Ic name="clock"/> Aujourd&apos;hui : <b>{stats.aujourdhui.n}</b> encaissement(s) — <b>{fmt(stats.aujourdhui.montant)} FCFA</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-g2">
        <div className="card">
          <div className="card-h"><h3><Ic name="layers"/> Recouvrement par niveau</h3></div>
          <div className="card-b">
            {niveauxSorted(db).map(nv => {
              const a = stats.perNiveau[nv.id];
              if (!a) return null;
              const taux = a.attendu > 0 ? a.encaisse/a.attendu : 0;
              return (
                <div className="nvrow" key={nv.id}>
                  <div className="nvh">
                    <b>{nv.libelle}</b>
                    <span>{fmt(a.encaisse)} / {fmt(a.attendu)} FCFA</span>
                  </div>
                  <Bar pct={taux*100} cls={taux >= .75 ? 'g' : (taux >= .4 ? 'o' : 'r')}/>
                </div>
              );
            })}
            {!Object.keys(stats.perNiveau).length && <p style={{ color:'var(--faint)' }}>Aucun élève inscrit pour cette année.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3><Ic name="receipt"/> Derniers encaissements</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => go('paiements')}><Ic name="arrow-r"/> Tout voir</button>
          </div>
          <div className="tbl-wrap" style={{ border:'none', borderRadius:0 }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>N° reçu</th><th>Élève</th><th>Classe</th><th className="num">Montant (FCFA)</th><th></th></tr></thead>
              <tbody>
                {last.length === 0 && <tr><td colSpan={6} className="center mut" style={{ padding:22 }}>Aucun encaissement pour le moment.</td></tr>}
                {last.map(p => {
                  const e = eleveById(db, p.eleveId);
                  const cl = e ? classById(db, e.classeId) : null;
                  return (
                    <tr key={p.id}>
                      <td className="nowrap mut">{fmtD(p.date)}</td>
                      <td className="nowrap"><b>{p.numero}</b></td>
                      <td>{e ? e.nom + ' ' + e.prenom : '—'} {e && <span className="mut">{e.matricule}</span>}</td>
                      <td className="mut nowrap">{cl ? cl.libelle : '—'}</td>
                      <td className="num bld">{fmt(p.montant)}</td>
                      <td className="rowacts">
                        <button className="icon-btn" title="Voir le reçu" onClick={() => openModal(<ReceiptModal p={p}/>)}><Ic name="printer"/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h"><h3><Ic name="shield"/> Contrôles &amp; alertes</h3>
          <Badge cls={alerts.length ? 'b-warn' : 'b-ok'}>{alerts.length ? alerts.length + ' point(s)' : 'conforme'}</Badge></div>
        <div className="card-b">
          {!alerts.length
            ? <div className="alert-line al-ok"><Ic name="check-circle"/> <span>Aucune anomalie détectée : grille tarifaire complète et classes pourvues.</span></div>
            : alerts.slice(0, 6).map((a, i) => (
              <div key={i} className={'alert-line al-' + a.t} style={a.pg ? { cursor:'pointer' } : undefined} onClick={() => a.pg && go(a.pg)}>
                <Ic name={a.t === 'info' ? 'info' : 'alert'}/><span>{a.txt}</span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

function fmtD(iso){
  return new Date(String(iso).length === 10 ? iso + 'T12:00' : iso)
    .toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}


/* ================= v3.0 : TABLEAU DE BORD ADAPTATIF PAR PROFIL ================= */
function elevesScoped(app){
  const { db, anneeId, user } = app;
  const sc = user ? scopeClassesIds(db, user) : null;
  return (db.eleves || []).filter(e => e.anneeId === anneeId && e.statut !== 'radie' && (!sc || sc.includes(e.classeId)));
}
function DashCard({ icon, title, children, quick }){
  return (
    <div className="card">
      <div className="card-h"><h3><Ic name={icon}/> {title}</h3>{quick}</div>
      <div className="card-b">{children}</div>
    </div>
  );
}

/* ---------- Surveillant général / de secteur : discipline ---------- */
function DiscDash(){
  const app = useApp();
  const { db, anneeId, go, scope } = app;
  const an = yearById(db, anneeId);
  if (!an) return <div className="card"><div className="card-b"><EmptyState icon="calendar" title="Aucune année scolaire active"/></div></div>;
  const sc = scope.classesIds;
  const faits = (db.discipline || []).filter(f => f.anneeId === anneeId && (!sc || sc.includes(f.classeId)));
  const mois = faits.filter(f => f.date.slice(0,7) === nowMonth());
  const graves = faits.filter(f => f.gravite === 3);
  const parCat = {};
  faits.forEach(f => { parCat[f.categorie] = (parCat[f.categorie] || 0) + 1; });
  const derniers = faits.slice().sort((a,b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  return (
    <>
      <div className="kpis">
        <Kpi icon="shield" val={String(faits.length)} label="Faits — année" bg="c-navy"/>
        <Kpi icon="alert" val={String(mois.length)} label="Ce mois-ci" bg="c-gold"/>
        <Kpi icon="flag" val={String(graves.length)} label="Faits graves" bg="c-bad"/>
        <Kpi icon="users" val={String(new Set(faits.map(f => f.eleveId)).size)} label="Élèves concernés" bg="c-ok"/>
      </div>
      <div style={{ height:14 }}/>
      <DashCard icon="shield" title="Derniers faits de discipline" quick={
        <button className="btn btn-pri btn-sm" onClick={() => go('discipline')}><Ic name="arrow-r"/> Tout voir</button>}>
        {!derniers.length ? <EmptyState icon="shield" title="Aucun fait enregistré" text="Le volet disciplinaire est au calme."/> : (
          <table className="tbl"><thead><tr><th>Date</th><th>Élève</th><th>Classe</th><th>Catégorie</th><th>Gravité</th></tr></thead>
          <tbody>{derniers.map(f => {
            const el = eleveById(db, f.eleveId) || {}, cl = classById(db, f.classeId) || {};
            return <tr key={f.id} style={{ cursor:'pointer' }} onClick={() => go('discipline')}>
              <td className="mut">{f.date.slice(8,10) + '/' + f.date.slice(5,7)}</td><td><b>{el.nom}</b> {el.prenom}</td>
              <td>{cl.libelle}</td><td><Badge>{DISCIPLINE_CATS[f.categorie] || f.categorie}</Badge></td>
              <td><Badge cls={f.gravite === 3 ? 'bad' : (f.gravite === 2 ? 'warn' : '')}>{GRAVITE_LABEL[f.gravite]}</Badge></td></tr>;
          })}</tbody></table>
        )}
      </DashCard>
      <div style={{ height:14 }}/>
      <DashCard icon="chart" title="Répartition par catégorie">
        {!faits.length ? <p className="mut">Aucune donnée.</p> : (
          <table className="tbl"><thead><tr><th>Catégorie</th><th className="num">Faits</th><th style={{ width:'45%' }}></th></tr></thead>
          <tbody>{Object.entries(parCat).sort((a,b) => b[1] - a[1]).map(([k, n]) => (
            <tr key={k}><td>{DISCIPLINE_CATS[k] || k}</td><td className="num">{n}</td>
            <td><Bar pct={faits.length ? n / faits.length * 100 : 0} cls="b-bad"/></td></tr>
          ))}</tbody></table>
        )}
      </DashCard>
      <div style={{ height:14 }}/>
      <DashCard icon="users" title="Élèves les plus signalés" quick={
        <button className="btn btn-ghost btn-sm" onClick={() => go('discipline')}><Ic name="arrow-r"/> Discipline</button>}>
        {!faits.length ? <p className="mut">Aucune donnée.</p> : (() => {
          const parEl = {};
          faits.forEach(f => { parEl[f.eleveId] = (parEl[f.eleveId] || 0) + 1; });
          const top = Object.entries(parEl).sort((a,b) => b[1] - a[1]).slice(0, 6);
          return (
            <table className="tbl"><thead><tr><th>Élève</th><th>Classe</th><th className="num">Faits</th><th style={{ width:'40%' }}></th></tr></thead>
            <tbody>{top.map(([eid, n]) => {
              const el = eleveById(db, eid) || {}, c = classById(db, el.classeId) || {};
              return <tr key={eid}><td><b>{el.nom || '?'}</b> {el.prenom || ''}</td><td className="mut">{c.libelle || '—'}</td>
                <td className="num"><Badge cls={n > 2 ? 'bad' : 'warn'}>{n}</Badge></td>
                <td><Bar pct={n / top[0][1] * 100} cls="b-bad"/></td></tr>;
            })}</tbody></table>
          );
        })()}
      </DashCard>
    </>
  );
}

/* ---------- Censeur / préfet des études : pédagogie du cycle ---------- */
function CenseurDash(){
  const app = useApp();
  const { db, anneeId, user, go } = app;
  const an = yearById(db, anneeId);
  if (!an) return <div className="card"><div className="card-b"><EmptyState icon="calendar" title="Aucune année scolaire active"/></div></div>;
  const sc = scopeClassesIds(db, user);
  const classes = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id) && (!sc || sc.includes(c.id)));
  const els = elevesScoped(app);
  const notes = (db.notes || []).filter(n => n.anneeId === anneeId);
  const moyennes = classes.map(c => {
    const ce = els.filter(e => e.classeId === c.id);
    const ms = ce.map(e => moyenneGenerale(db, anneeId, e.id)).filter(m => m != null);
    const evalues = ce.filter(e => moyenneGenerale(db, anneeId, e.id) != null).length;
    return { c, effectif: ce.length, evalues, moyenne: ms.length ? Math.round(ms.reduce((t, m) => t + m, 0) / ms.length * 100) / 100 : null, notes: ce.reduce((t, e) => t + notes.filter(n => n.eleveId === e.id).length, 0) };
  });
  const avecMoy = moyennes.filter(m => m.moyenne != null);
  return (
    <>
      <div className="kpis">
        <Kpi icon="classroom" val={String(classes.length)} label="Classes du cycle" bg="c-navy"/>
        <Kpi icon="users" val={String(els.length)} label="Élèves du cycle" bg="c-ok"/>
        <Kpi icon="book" val={String(notes.length)} label="Notes saisies" bg="c-gold"/>
        <Kpi icon="target" val={avecMoy.length ? (Math.round(avecMoy.reduce((t, m) => t + m.moyenne, 0) / avecMoy.length * 100) / 100).toFixed(2).replace('.', ',') : '—'} label="Moyenne du cycle" sub="/ 20" bg="c-bad"/>
      </div>
      <div style={{ height:14 }}/>
      <DashCard icon="chart" title="Suivi pédagogique par classe" quick={
        <span>
          <button className="btn btn-pri btn-sm" onClick={() => go('notes')}><Ic name="pencil"/> Saisir des notes</button>{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => go('bulletins')}><Ic name="printer"/> Bulletins</button>
        </span>}>
        {!moyennes.length ? <EmptyState icon="classroom" title="Aucune classe dans votre cycle" text="Les classes vous seront accessibles dès que l'administrateur vous attribue des niveaux."/> : (
          <table className="tbl"><thead><tr><th>Classe</th><th className="num">Effectif</th><th className="num">Élèves évalués</th><th className="num">Notes saisies</th><th className="num">Moyenne /20</th><th style={{ width:'26%' }}></th></tr></thead>
          <tbody>{moyennes.map(m => {
            const oblig = matieresObligatoires(db, m.c.id);
            return (
            <tr key={m.c.id}><td><b>{m.c.libelle}</b> <span className="mut">— {(niveauById(db, m.c.niveauId) || {}).libelle}</span>
                {oblig.length ? <div className="mut" style={{ fontSize:10.5 }}>classement : {oblig.length} matière(s) exigée(s)</div> : null}</td>
            <td className="num">{m.effectif}</td><td className="num">{m.evalues}/{m.effectif}</td><td className="num">{m.notes}</td>
            <td className="num"><b>{m.moyenne == null ? '—' : m.moyenne.toFixed(2).replace('.', ',')}</b></td>
            <td><Bar pct={m.moyenne == null ? 0 : m.moyenne / 20 * 100} cls={m.moyenne >= 10 ? 'b-ok' : 'b-bad'}/></td></tr>
            );
          })}</tbody></table>
        )}
      </DashCard>
    </>
  );
}

/* ---------- Enseignant : ses matières, sa saisie ---------- */
function EnseignantDash(){
  const app = useApp();
  const { db, anneeId, user, go } = app;
  const an = yearById(db, anneeId);
  if (!an) return <div className="card"><div className="card-b"><EmptyState icon="calendar" title="Aucune année scolaire active"/></div></div>;
  const mi = new Set((user && user.matieresIds) || []);
  const mesMat = (db.matieres || []).filter(m => mi.has(m.id));
  const mesNotes = (db.notes || []).filter(n => n.anneeId === anneeId && mi.has(n.matiereId));
  const seqs = sequencesSorted(db);
  const parSeq = seqs.map(sq => mesNotes.filter(n => String(n.sequence) === String(sq.id)).length);
  const classes = [...new Set(mesNotes.map(n => n.classeId))];
  return (
    <>
      <div className="kpis">
        <Kpi icon="book" val={String(mesMat.length)} label="Mes matières" bg="c-navy"/>
        <Kpi icon="pencil" val={String(mesNotes.length)} label="Notes saisies" sub="Année en cours" bg="c-gold"/>
        <Kpi icon="classroom" val={String(classes.length)} label="Classes couvertes" bg="c-ok"/>
        <Kpi icon="target" val={String(seqs.length - parSeq.filter(n => n > 0).length)} label="Séquences vides" sub="sans aucune note" bg="c-bad"/>
      </div>
      <div style={{ height:14 }}/>
      <DashCard icon="pencil" title="Mon suivi de saisie" quick={
        <button className="btn btn-pri btn-sm" onClick={() => go('notes')}><Ic name="pencil"/> Saisir des notes</button>}>
        {!mesMat.length ? <EmptyState icon="book" title="Aucune matière attribuée" text="Contactez l'administrateur ou le censeur pour qu'il vous attribue vos matières."/> : (
          <table className="tbl"><thead><tr><th>Matière</th><th className="num">Notes</th>{seqs.map(sq => <th key={sq.id} className="num" style={{ textAlign:'center' }} title={sq.libelle + ' — T' + sq.trimestre}>S{sq.libelle.replace(/^\D+/, '') || sq.id}</th>)}</tr></thead>
          <tbody>{mesMat.map(m => {
            const ns = mesNotes.filter(n => n.matiereId === m.id);
            return <tr key={m.id}><td><b>{m.libelle}</b></td>
            <td className="num">{ns.length}</td>
            {seqs.map(sq => { const n = ns.filter(x => String(x.sequence) === String(sq.id)).length;
              return <td key={sq.id} style={{ textAlign:'center' }}><Badge cls={n ? 'ok' : ''}>{n || '·'}</Badge></td>; })}</tr>;
          })}</tbody></table>
        )}
      </DashCard>
      <div style={{ height:14 }}/>
      <DashCard icon="printer" title="Mes rapports" quick={
        <button className="btn btn-ghost btn-sm" onClick={() => go('bulletins')}><Ic name="printer"/> Bulletins &amp; rapports</button>}>
        <p className="mut" style={{ fontSize:12.5 }}>Imprimez le relevé de notes de vos matières, par classe et par séquence — bouton « Imprimer » sur la page Bulletins.</p>
      </DashCard>
    </>
  );
}

/* ---------- Titulaire : toutes les informations de sa classe ---------- */
function TitulaireDash(){
  const app = useApp();
  const { db, anneeId, user, go } = app;
  const an = yearById(db, anneeId);
  if (!an) return <div className="card"><div className="card-b"><EmptyState icon="calendar" title="Aucune année scolaire active"/></div></div>;
  const cids = new Set((user && user.classesIds) || []);
  const mesClasses = classesSorted(db).filter(c => cids.has(c.id));
  if (!mesClasses.length) return <div className="card"><div className="card-b"><EmptyState icon="classroom" title="Aucune classe attribuée" text="L'administrateur ou le surveillant général doit vous attribuer une classe."/></div></div>;
  const c = mesClasses[0];
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === c.id && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1));
  const ms = els.map(e => moyenneGenerale(db, anneeId, e.id)).filter(m => m != null);
  const moy = ms.length ? Math.round(ms.reduce((t, m) => t + m, 0) / ms.length * 100) / 100 : null;
  const faits = (db.discipline || []).filter(f => f.anneeId === anneeId && f.classeId === c.id);
  const stats = yearAggregates(db, anneeId);
  const ag = stats.perClasse[c.id];
  const sv = solvabiliteAnnee(db, anneeId);
  const svC = sv.parClasse[c.id];
  return (
    <>
      <div className="kpis">
        <Kpi icon="classroom" val={String(els.length)} label="Effectif de la classe" sub={c.libelle} bg="c-navy"/>
        <Kpi icon="target" val={moy == null ? '—' : moy.toFixed(2).replace('.', ',')} label="Moyenne de la classe" sub="/ 20" bg="c-gold"/>
        <Kpi icon="shield" val={String(faits.length)} label="Faits de discipline" bg="c-bad"/>
        <Kpi icon="alert" val={String(svC ? svC.insolvables : 0)} label="Insolvables" sub={ag ? fmt(Math.max(0, ag.attendu - ag.encaisse)) + ' FCFA restants' : ''} bg="c-ok"/>
      </div>
      <div style={{ height:14 }}/>
      <DashCard icon="classroom" title={'Ma classe — ' + c.libelle} quick={<span>
        <button className="btn btn-pri btn-sm" onClick={() => go('bulletins')}><Ic name="printer"/> Bulletins</button>{' '}
        <button className="btn btn-ghost btn-sm" onClick={() => go('eleves')}><Ic name="users"/> Élèves</button>{' '}
        <button className="btn btn-ghost btn-sm" onClick={() => go('discipline')}><Ic name="shield"/> Discipline</button>
      </span>}>
        <table className="tbl"><thead><tr><th>Élève</th><th className="num">Moyenne /20</th><th>Faits discipline</th></tr></thead>
        <tbody>{els.slice(0, 12).map(e => {
          const m = moyenneGenerale(db, anneeId, e.id);
          const nf = faits.filter(f => f.eleveId === e.id).length;
          return <tr key={e.id}><td><b>{e.nom}</b> {e.prenom}</td>
            <td className="num">{m == null ? '—' : <Badge cls={m >= 10 ? 'ok' : 'bad'}>{m.toFixed(2).replace('.', ',')}</Badge>}</td>
            <td>{nf ? <Badge cls={nf > 2 ? 'bad' : 'warn'}>{nf}</Badge> : <span className="mut">—</span>}</td></tr>;
        })}</tbody></table>
        {els.length > 12 && <p className="mut" style={{ marginTop:8, fontSize:12 }}>+ {els.length - 12} autre(s) élève(s) — voir la page Élèves.</p>}
      </DashCard>
    </>
  );
}

/* ---------- Opérateur de saisie : notes + discipline ---------- */
function OperateurDash(){
  const app = useApp();
  const { db, anneeId, go } = app;
  const an = yearById(db, anneeId);
  if (!an) return <div className="card"><div className="card-b"><EmptyState icon="calendar" title="Aucune année scolaire active"/></div></div>;
  const els = (db.eleves || []).filter(e => e.anneeId === anneeId && e.statut !== 'radie');
  const notes = (db.notes || []).filter(n => n.anneeId === anneeId);
  const faits = (db.discipline || []).filter(f => f.anneeId === anneeId);
  const mois = faits.filter(f => f.date.slice(0,7) === nowMonth());
  const avecMoy = els.map(e => moyenneGenerale(db, anneeId, e.id)).filter(m => m != null);
  return (
    <>
      <div className="kpis">
        <Kpi icon="users" val={String(els.length)} label="Élèves inscrits" bg="c-navy"/>
        <Kpi icon="pencil" val={String(notes.length)} label="Notes saisies" bg="c-gold"/>
        <Kpi icon="shield" val={String(faits.length)} label="Faits de discipline" sub={mois.length + ' ce mois'} bg="c-bad"/>
        <Kpi icon="target" val={avecMoy.length ? (Math.round(avecMoy.reduce((t, m) => t + m, 0) / avecMoy.length * 100) / 100).toFixed(2).replace('.', ',') : '—'} label="Moyenne générale" sub="/ 20" bg="c-ok"/>
      </div>
      <div style={{ height:14 }}/>
      <DashCard icon="grid" title="Saisie" quick={<span>
        <button className="btn btn-pri btn-sm" onClick={() => go('notes')}><Ic name="pencil"/> Notes</button>{' '}
        <button className="btn btn-gold btn-sm" onClick={() => go('discipline')}><Ic name="shield"/> Discipline</button>{' '}
        <button className="btn btn-ghost btn-sm" onClick={() => go('bulletins')}><Ic name="printer"/> Bulletins</button>
      </span>}>
        <p className="mut" style={{ fontSize:12.5 }}>Vous disposez de tous les droits sur la gestion des notes et de la discipline :
        saisie et correction des évaluations, bulletins, faits et sanctions.</p>
      </DashCard>
    </>
  );
}

function nowMonth(){ return new Date().toISOString().slice(0,7); }

export default function Dashboard(){
  const { user } = useApp();
  const R = user && user.role;
  if (R === 'surveillant' || R === 'surveillant_secteur') return <DiscDash/>;
  if (R === 'censeur') return <CenseurDash/>;
  if (R === 'enseignant') return <EnseignantDash/>;
  if (R === 'titulaire') return <TitulaireDash/>;
  if (R === 'operateur') return <OperateurDash/>;
  return <FinDash/>;
}
