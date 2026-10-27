import React, { useMemo, useState } from 'react';
import { Badge, EmptyState, Select, Kpi, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { classesSorted, sequencesSorted } from '../core/business.js';
import FormModal from '../components/modals/FormModal.jsx';

/* ================================================================
   v8.0 — COMPÉTENCES ÉVALUÉES
   Saisie / modification / suppression des compétences par classe,
   par trimestre et par matière. Ces lignes (généralement deux)
   apparaissent sur les bulletins des classes concernées (option
   « Compétences » du tableau de notes des modèles de bulletin). */
export default function Competences(){
  const app = useApp();
  const { db, can, anneeId } = app;
  const canW = can('competences', true);
  const [classeId, setClasseId] = useState('');
  const [trimestre, setTrimestre] = useState('1');

  const scope = app.scope || {};
  /* classes de l'année en cours (ayant des élèves inscrits), comme les
     autres pages pédagogiques — les classes ne portent pas d'anneeId */
  const classes = classesSorted(db).filter(c => (db.eleves || []).some(e => e.anneeId === anneeId && e.classeId === c.id)
    && (!scope.classesIds || scope.classesIds.includes(c.id)));
  const cl = classes.find(c => c.id === classeId) || classes[0] || null;
  const trim = parseInt(trimestre, 10) || 1;

  /* matières du plan de la classe — restreintes au périmètre de l'enseignant */
  const matieres = useMemo(() => {
    if (!cl) return [];
    return (db.plan || []).filter(e => e.classeId === cl.id)
      .map(e => (db.matieres || []).find(m => m.id === e.matiereId))
      .filter(Boolean)
      .filter(m => !scope.matieresIds || scope.matieresIds.includes(m.id))
      .sort((a, b) => (a.libelle < b.libelle ? -1 : 1));
  }, [db, cl, scope]);

  const entrees = useMemo(() => {
    if (!cl) return [];
    return (db.competences || [])
      .filter(c => c.classeId === cl.id && (parseInt(c.trimestre, 10) || 0) === trim)
      .map(c => ({ ...c, mat: (db.matieres || []).find(m => m.id === c.matiereId) }))
      .filter(c => c.mat && (!scope.matieresIds || scope.matieresIds.includes(c.matiereId)))
      .sort((a, b) => (a.mat.libelle < b.mat.libelle ? -1 : 1));
  }, [db, cl, trim, scope]);

  const nbLignes = entrees.reduce((t, c) => t + (c.lignes || []).length, 0);
  const sansCompetence = matieres.filter(m => !entrees.some(c => c.matiereId === m.id));

  return (
    <>
      <div className="kpis">
        <Kpi icon="target" val={String(entrees.length)} label="Compétences" sub={'Classe ' + (cl ? cl.libelle : '—') + ' • Trimestre ' + trim} color="var(--navy-700)"/>
        <Kpi icon="book" val={String(matieres.length)} label="Matières au plan" sub="De la classe sélectionnée" color="var(--gold-600)" bg="var(--gold-100)"/>
        <Kpi icon="check" val={String(sansCompetence.length)} label="Matières restantes" sub="Sans compétence saisie" color="var(--bad)" bg="var(--bad-bg)"/>
        <Kpi icon="pencil" val={String(nbLignes)} label="Lignes de texte" sub="Compétences rédigées" color="var(--ok)" bg="var(--ok-bg)"/>
      </div>

      <div className="card" style={{ marginTop:14 }}>
        <div className="card-h">
          <h3>Compétences évaluées{cl ? ' — ' + cl.libelle + ' • Trimestre ' + trim : ''}</h3>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <CsvBtn filename={'competences-' + (cl ? cl.libelle : 'classe') + '-T' + trim + '.csv'}
              header={['Matière', 'Trimestre', 'Ligne', 'Compétence']}
              rows={entrees.flatMap(c => (c.lignes || []).map((l, i) => [c.mat.libelle, 'T' + trim, String(i + 1), l]))}/>
            {canW && cl && matieres.length > 0 && <button className="btn btn-pri" onClick={() => app.openModal(
              <CompetenceFormModal classeId={cl.id} trimestre={trim} matieres={matieres} prises={entrees.map(c => c.matiereId)} onClose={() => {}}/>
            )}><Ic name="plus"/> Nouvelle compétence</button>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <Select value={cl ? cl.id : ''} onChange={setClasseId} style={{ flex:'0 0 220px' }}
            options={classes.map(c => ({ value:c.id, label:c.libelle }))}/>
          <Select value={trimestre} onChange={setTrimestre} style={{ flex:'0 0 160px' }}
            options={[1, 2, 3].map(t => ({ value:String(t), label:'Trimestre ' + t }))}/>
        </div>

        {!cl ? (
          <div style={{ padding:22 }}>
            <EmptyState icon="classroom" title="Aucune classe" text="Créez d'abord des classes et leur plan d'enseignements."/>
          </div>
        ) : !matieres.length ? (
          <div style={{ padding:22 }}>
            <EmptyState icon="book" title="Aucune matière au plan" text={"Définissez le plan d'enseignements de " + cl.libelle + " (menu Plan des enseignements)."}/>
          </div>
        ) : !entrees.length ? (
          <div style={{ padding:22 }}>
            <EmptyState icon="target" title="Aucune compétence saisie"
              text={canW ? 'Ajoutez la ou les compétences évaluées pour chaque matière — elles apparaîtront sur les bulletins de la classe.' : 'Aucune compétence saisie pour le moment.'}/>
          </div>
        ) : (
          <table className="tbl">
            <thead><tr>
              <th style={{ minWidth:160 }}>Matière</th><th>Compétence(s) évaluée(s)</th>
              <th style={{ width:76, textAlign:'center' }}>Lignes</th>
              {canW && <th style={{ width:90 }}></th>}
            </tr></thead>
            <tbody>
              {entrees.map(c => (
                <tr key={c.id}>
                  <td><b>{c.mat.code}</b> — {c.mat.libelle}</td>
                  <td>{(c.lignes || []).map((l, i) => (
                    <div key={i} style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                      <Badge>{i + 1}</Badge>
                      <span style={{ whiteSpace:'pre-wrap' }}>{l}</span>
                    </div>
                  ))}</td>
                  <td style={{ textAlign:'center' }} className="mut">{(c.lignes || []).length}</td>
                  {canW && (
                    <td className="acts">
                      <button className="icon-btn" title="Modifier" onClick={() => app.openModal(
                        <CompetenceFormModal initial={c} classeId={cl.id} trimestre={trim} matieres={matieres} prises={entrees.filter(x => x.id !== c.id).map(x => x.matiereId)} onClose={() => {}}/>
                      )}><Ic name="pencil"/></button>
                      <button className="icon-btn" title="Supprimer" onClick={() => supprimer(c)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {entrees.length > 0 && (
          <p className="mut" style={{ fontSize:11.5, marginTop:8 }}>
            Ces lignes apparaissent sur les bulletins de {cl.libelle} (modèles de bulletin : option « Compétences évaluées » du tableau de notes, ou champ dynamique {'{competences.texte}'}).
          </p>
        )}
      </div>
    </>
  );

  async function supprimer(c){
    const ok = await app.confirm('Supprimer la compétence de ' + c.mat.libelle + ' ?',
      (c.lignes || []).join(' • ').slice(0, 160), 'Supprimer', true);
    if (!ok) return;
    try { app.M.deleteCompetence(c.id); app.toast('Compétence supprimée.', 'ok'); } catch(e){ app.toast(String(e.message || e), 'err'); }
  }
}

/* ---------- Formulaire création / modification ---------- */
export function CompetenceFormModal({ initial = null, classeId, trimestre, matieres, prises = [], onClose }){
  const { M, toast } = useApp();
  const dispo = matieres.filter(m => !prises.includes(m.id) || (initial && initial.matiereId === m.id));
  return (
    <FormModal wide title={initial ? 'Modifier la compétence' : 'Nouvelle compétence'} icon="target"
      fields={[
        { name:'matiereId', label:'Matière', type:'select', required:true,
          options:(dispo.length ? dispo : matieres).map(m => ({ value:m.id, label:m.code + ' — ' + m.libelle })),
          defaultValue:initial ? initial.matiereId : (dispo[0] ? dispo[0].id : '') },
        { name:'ligne1', label:'Compétence évaluée — ligne 1', required:true, type:'textarea', rows:2, maxLength:300,
          placeholder:'Ex. : Traiter un problème lié aux fractions simples.',
          defaultValue:initial && initial.lignes && initial.lignes[0] ? initial.lignes[0] : '' },
        { name:'ligne2', label:'Compétence évaluée — ligne 2 (facultative)', type:'textarea', rows:2, maxLength:300,
          placeholder:'Ex. : Résoudre une situation-problème de proportionnalité.',
          defaultValue:initial && initial.lignes && initial.lignes[1] ? initial.lignes[1] : '' }
      ]}
      note={'Classe et trimestre fixés par la sélection de la page (T' + trimestre + '). Généralement une ou deux lignes.'}
      submitLabel={initial ? 'Enregistrer' : 'Créer la compétence'}
      onSubmit={v => {
        M.saveCompetence({ id:initial ? initial.id : null, classeId, matiereId:v.matiereId, trimestre,
          lignes:[v.ligne1, v.ligne2] });
        toast(initial ? 'Compétence modifiée.' : 'Compétence enregistrée — elle apparaîtra sur les bulletins.', 'ok');
      }}/>
  );
}
