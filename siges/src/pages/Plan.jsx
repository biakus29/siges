import React, { useState, useEffect } from 'react';
import { Badge, EmptyState, Select, Kpi, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { classesSorted, planOf, coefOf } from '../core/business.js';
import { PlanEntryFormModal, ClonePlanModal, CloneEntryModal, EnseignementsDeModal, EnseignantsDeMatiereModal } from '../components/modals/EntityForms.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';

/* ---------- Plan des enseignements (Pédagogie) : par classe,
   quel enseignant enseigne quelle matière, avec quel coefficient,
   dans quel groupe et dans quel ordre au bulletin. ---------- */
export default function Plan(){
  const { db, can, M, openModal, toast, confirm, scope } = useApp();
  const canW = can('plan', true);
  const classes = classesSorted(db).filter(c => (scope.classesIds ? scope.classesIds.includes(c.id) : true));
  const [classeId, setClasseId] = useState(classes[0] ? classes[0].id : '');
  useEffect(() => { if (classes.length && !classes.some(c => c.id === classeId)) setClasseId(classes[0].id); }, [classes.length]);

  const grpOf = id => (db.groupes || []).find(g => g.id === id) || null;
  const matOf = id => (db.matieres || []).find(m => m.id === id) || null;
  const ensOf = id => (db.enseignants || []).find(t => t.id === id) || null;
  const clsOf = id => (db.classes || []).find(c => c.id === id) || null;

  const entries = planOf(db, classeId);
  const classe = clsOf(classeId);

  /* totaux : par groupe et global */
  const parGroupe = {};
  entries.forEach(e => {
    const gid = e.groupeId || '_';
    if (!parGroupe[gid]) parGroupe[gid] = { n:0, coef:0, grp:grpOf(gid) };
    parGroupe[gid].n++; parGroupe[gid].coef += (e.coefficient || 0);
  });
  const totalCoef = entries.reduce((t, e) => t + (e.coefficient || 0), 0);
  const nbSansEns = entries.filter(e => !e.enseignantId).length;

  const supprimer = async e => {
    const m = matOf(e.matiereId);
    const ok = await confirm(`Retirer « ${m ? m.libelle : 'cette matière'} » du plan de ${classe ? classe.libelle : 'cette classe'} ?`,
      'Les notes déjà saisies pour cette matière sont conservées.', 'Retirer', true);
    if (!ok) return;
    try { M.deletePlanEntry(e.id); toast('Enseignement retiré.', 'ok'); } catch(err){ toast(String(err.message || err), 'err'); }
  };

  if (!classes.length){
    return <div className="card"><div className="card-b">
      <EmptyState icon="grid" title="Aucune classe" text="Créez d'abord les classes de l'établissement."/>
    </div></div>;
  }

  return (
    <>
      <div className="kpis">
        <Kpi icon="grid" val={String(entries.length)} label="Matières au plan" sub={classe ? classe.libelle : ''} color="var(--navy-700)"/>
        <Kpi icon="chart" val={'coef. ' + totalCoef} label="Total des coefficients" sub="Toutes matières" color="var(--gold-600)" bg="var(--gold-100)"/>
        <Kpi icon="layers" val={String(Object.keys(parGroupe).length)} label="Groupes représentés" sub="Familles de matières" color="var(--ok)" bg="var(--ok-bg)"/>
        <Kpi icon="user" val={String(new Set(entries.filter(e => e.enseignantId).map(e => e.enseignantId)).size)} label="Enseignants affectés"
          sub={nbSansEns ? nbSansEns + ' matière(s) sans enseignant' : 'Toutes affectées'} color={nbSansEns ? 'var(--bad)' : 'var(--ok)'} bg={nbSansEns ? 'var(--bad-bg)' : 'var(--ok-bg)'}/>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Plan des enseignements</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Select value={classeId} onChange={setClasseId} style={{ minWidth:200 }}
              options={classes.map(c => ({ value:c.id, label:c.libelle }))}/>
            <PrintListeBtn titre={'Plan des enseignements — ' + (classe ? classe.libelle : '')}
              colonnes={['Matière','Enseignant','Groupe','Coef.']}
              lignes={entries.map(e => [((db.matieres || []).find(m => m.id === e.matiereId) || {}).libelle || '—',
                e.enseignantId ? (((ensOf(e.enseignantId) || {}).nom || '') + ' ' + ((ensOf(e.enseignantId) || {}).prenom || '')).trim() : 'à attribuer',
                e.groupeId ? ((db.groupes || []).find(g => g.id === e.groupeId) || {}).libelle || '—' : '—',
                String(e.coefficient || 1)])}/>
            <CsvBtn filename={'plan_' + (classe ? classe.libelle : 'classe') + '.csv'}
              header={['Matière','Enseignant','Groupe','Coef.']}
              rows={entries.map(e => [((db.matieres || []).find(m => m.id === e.matiereId) || {}).libelle || '—',
                e.enseignantId ? (((ensOf(e.enseignantId) || {}).nom || '') + ' ' + ((ensOf(e.enseignantId) || {}).prenom || '')).trim() : 'à attribuer',
                e.groupeId ? ((db.groupes || []).find(g => g.id === e.groupeId) || {}).libelle || '—' : '—',
                String(e.coefficient || 1)])}/>
            {canW && <>
              <button className="btn btn-ghost btn-sm" onClick={() => openModal(<ClonePlanModal fromClasseId={classeId} onClose={() => {}}/>)}>
                <Ic name="copy"/> Cloner ce plan…
              </button>
              <button className="btn btn-pri btn-sm" onClick={() => openModal(<PlanEntryFormModal classeId={classeId} ordre={entries.length + 1} onClose={() => {}}/>)}>
                <Ic name="plus"/> Ajouter un enseignement
              </button>
            </>}
          </div>
        </div>
        <div className="card-b" style={{ padding:0 }}>
          {entries.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  <th className="num" style={{ width:64 }}>Ordre</th>
                  <th style={{ width:84 }}>Code</th><th>Matière</th>
                  <th>Groupe</th><th>Enseignant</th>
                  <th className="num" style={{ width:110 }}>Coefficient</th>
                  {canW && <th style={{ width:185 }}></th>}
                </tr></thead>
                <tbody>
                  {entries.map((e, i) => {
                    const m = matOf(e.matiereId) || { libelle:'—', code:'—' };
                    const t = ensOf(e.enseignantId);
                    const g = grpOf(e.groupeId);   /* v5.4 : le groupe est défini sur l'entrée du plan */
                    return (
                      <tr key={e.id}>
                        <td className="num"><b>{i + 1}</b>{canW && <span className="mut" style={{ fontSize:10 }}> (n°{e.ordre})</span>}</td>
                        <td><b>{m.code}</b></td>
                        <td>
                          <button className="link-btn" title="Enseignants qui dispensent cette matière"
                            onClick={() => openModal(<EnseignantsDeMatiereModal matiere={m} onClose={() => {}}/>)}>{m.libelle}</button>
                        </td>
                        <td>{g ? <Badge cls="b-gold" title={g.code}>{g.libelle}</Badge> : <span className="mut">—</span>}</td>
                        <td>
                          {t ? (
                            <button className="link-btn" title="Enseignements de cet enseignant"
                              onClick={() => openModal(<EnseignementsDeModal enseignant={t} onClose={() => {}}/>)}>{t.nom} {t.prenom}</button>
                          ) : <Badge cls="b-warn">à affecter</Badge>}
                          {t && <div className="mut" style={{ fontSize:10.5 }}>{t.specialite || ''}</div>}
                        </td>
                        <td className="num"><Badge cls="b-navy">coef. {e.coefficient || 1}</Badge></td>
                        {canW && (
                          <td className="acts">
                            <button className="icon-btn" title="Monter au bulletin" disabled={i === 0}
                              onClick={() => M.reorderPlan(classeId, e.id, 'up')}><Ic name="chev-l"/></button>
                            <button className="icon-btn" title="Descendre au bulletin" disabled={i === entries.length - 1}
                              onClick={() => M.reorderPlan(classeId, e.id, 'down')}><Ic name="chev-r"/></button>
                            <button className="icon-btn" title="Modifier" onClick={() => openModal(<PlanEntryFormModal initial={e} classeId={classeId} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                            <button className="icon-btn" title="Cloner cet enseignement vers d'autres classes"
                              onClick={() => openModal(<CloneEntryModal entry={e} onClose={() => {}}/>)}><Ic name="copy"/></button>
                            <button className="icon-btn" title="Retirer" onClick={() => supprimer(e)}><Ic name="trash"/></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* ligne de totaux */}
                  <tr className="tot-row">
                    <td colSpan={2}></td>
                    <td><b>{entries.length} matière(s)</b></td>
                    <td></td>
                    <td></td>
                    <td className="num"><b>coef. {totalCoef}</b></td>
                    {canW && <td></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-b"><EmptyState icon="grid" title="Plan vide pour cette classe"
              text={canW ? 'Ajoutez les enseignements (matière, enseignant, coefficient) ou clonez le plan d\\u2019une autre classe.' : 'Aucun enseignement défini.'}>
              {canW && <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                <button className="btn btn-pri" onClick={() => openModal(<PlanEntryFormModal classeId={classeId} ordre={1} onClose={() => {}}/>)}><Ic name="plus"/> Ajouter un enseignement</button>
                <button className="btn btn-ghost" onClick={() => openModal(<ClonePlanModal fromClasseId={classeId} onClose={() => {}}/>)}><Ic name="copy"/> Cloner depuis une autre classe</button>
              </div>}
            </EmptyState></div>
          )}
        </div>
      </div>

      {/* synthèse par groupe de matières */}
      {entries.length > 0 && (
        <div className="card" style={{ marginTop:14 }}>
          <div className="card-h"><h3>Synthèse par groupe de matières <span className="mut">— {classe ? classe.libelle : ''}</span></h3></div>
          <div className="card-b" style={{ padding:0 }}>
            <table className="tbl">
              <thead><tr><th style={{ width:90 }}>Code</th><th>Groupe</th><th className="num">Matières</th><th className="num">Total coefficients</th><th>Part du plan</th></tr></thead>
              <tbody>
                {Object.values(parGroupe).sort((a,b) => b.coef - a.coef).map(g => (
                  <tr key={g.grp ? g.grp.id : '_'}>
                    <td><b>{g.grp ? g.grp.code : '—'}</b></td>
                    <td>{g.grp ? g.grp.libelle : 'Sans groupe'}</td>
                    <td className="num">{g.n}</td>
                    <td className="num"><Badge cls="b-gold">coef. {g.coef}</Badge></td>
                    <td>
                      <div className="bar" style={{ minWidth:120, maxWidth:260 }}>
                        <i style={{ width:(totalCoef ? (g.coef / totalCoef * 100).toFixed(1) : 0) + '%' }} className="on"/>
                      </div>
                      <span className="mut" style={{ fontSize:10.5 }}>{totalCoef ? Math.round(g.coef / totalCoef * 100) : 0} % du total</span>
                    </td>
                  </tr>
                ))}
                <tr className="tot-row">
                  <td colSpan={2}><b>Ensemble du plan</b></td>
                  <td className="num"><b>{entries.length}</b></td>
                  <td className="num"><b>coef. {totalCoef}</b></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
