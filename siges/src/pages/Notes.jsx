import React, { useMemo, useState, useEffect } from 'react';
import { Badge, EmptyState, Select, Kpi, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/UI.jsx';
import { classesSorted, classesPerimetre, classeParDefaut, optionClasse, niveauById, classById, planOf, sequencesSorted, moyenneMatiere,
  moyenneGenerale, appreciationOf, statsNotes, coefOf, classementClasse, matieresManquantes,
  scanNotesManquantes, scanNotesManquantesAnnee, devoirsDe } from '../core/business.js';
import { ReportModal } from '../components/Reports.jsx';
import { settingsOf } from '../core/business.js';

/* =====================================================================
   Saisie des notes (v5.4) :
   • UNE SEULE ÉVALUATION PAR SÉQUENCE : un seul champ de note par élève
     et par matière (plus de distinction devoir / composition) ;
   • deux modes : PAR MATIÈRE (grille de la classe) et PAR ÉLÈVE
     (toutes les notes de l'élève, moyenne et rang en temps réel, photo) ;
   • navigation clavier : Entrée ou flèche bas = note suivante,
     flèche haut = note précédente ;
   • seules les matières du PLAN d'enseignements de la classe ;
   • séquences libres (trimestre + poids) ; appréciations par fourchettes ;
   • matières indispensables au classement : élève non classé (NC)
     uniquement s'il n'obtient AUCUNE note dans l'ensemble de ces
     matières — une seule note suffit à le classer ;
   • impression directe du bordereau et des statistiques ;
   • reconduction des notes vers une autre séquence ;
   • annulation de la note d'un élève ;
   • v6.1 : onglet « Notes manquantes » — scan automatique de la saisie
     pour une séquence donnée (matières vides / partielles, élèves sans
     note, feuille de contrôle imprimable, export CSV) ;
   • v6.2 : synthèse matricielle — liste des matières avec le nombre de
     notes manquantes PAR ÉVALUATION et PAR CLASSE (toutes les séquences
     en colonnes, totaux, clic-cellule vers la saisie) ;
   • v6.5 : DEVOIRS pondérés par séquence — l'administrateur définit 0 à N
     devoirs par séquence (pourcentages totalisant 100 %) ; la saisie
     propose alors une colonne par devoir et la note séquentielle est
     CALCULÉE automatiquement (Σ note × pourcentage). Les notes de devoir
     ne figurent ni dans les bulletins ni dans les statistiques générales —
     seules les notes séquentielles (calculées) et trimestrielles y
     apparaissent.
   ===================================================================== */

/* ---------- Reconduire les notes vers une autre séquence ---------- */
function ReconduireModal({ classeId, matiereId, fromSeq }){
  const { M, toast, db, confirm, closeModal } = useApp();
  const seqs = sequencesSorted(db).filter(s => String(s.id) !== String(fromSeq));
  const [to, setTo] = useState(seqs[0] ? String(seqs[0].id) : '');
  const [ecrase, setEcrase] = useState(false);
  const src = (db.sequences || []).find(s => String(s.id) === String(fromSeq)) || {};
  const go = async () => {
    if (!to){ toast('Choisissez une séquence cible.', 'err'); return; }
    const cible = (db.sequences || []).find(s => String(s.id) === String(to));
    const ok = await confirm('Reconduire les notes ?',
      'Les notes de <b>' + (src.libelle || '?') + '</b> seront recopiées vers <b>' + (cible ? cible.libelle : to) + '</b> pour cette classe et cette matière.', 'Reconduire', false);
    if (!ok) return;
    try { const r = M.reconduireNotes(classeId, matiereId, fromSeq, to, ecrase);
      toast(r.n + ' note(s) reconduite(s)' + (r.skips ? ' — ' + r.skips + ' ignorée(s) (déjà saisies)' : '') + '.', 'ok');
      closeModal(); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title="Reconduire les notes" icon="refresh" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>Source : {src.libelle || '—'}</span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="refresh"/> Reconduire</button>
      </>}>
      <p style={{ fontSize:12.4, lineHeight:1.6, color:'var(--muted)' }}>
        Recopie les notes déjà saisies pour <b> cette classe et cette matière </b>
        de la séquence courante vers la séquence choisie ci-dessous.
      </p>
      {((db.sequences || []).find(s => String(s.id) === String(fromSeq)) || {}).devoirs ? (
        <p className="mut" style={{ fontSize:11.5, marginTop:8 }}>
          <Ic name="info"/> Séquence source notée par devoirs : chaque note de devoir sera recopiée
          vers le devoir de <b>même libellé</b> de la séquence cible (les devoirs absents de la cible sont ignorés).
        </p>
      ) : null}
      <div className="field" style={{ marginTop:12 }}>
        <label>Séquence cible</label>
        <Select value={to} onChange={setTo} options={seqs.map(s => ({ value:String(s.id), label:s.libelle + ' (T' + s.trimestre + ')' }))}/>
      </div>
      <label className="chk" style={{ display:'inline-flex', gap:7, marginTop:12, cursor:'pointer' }}>
        <input type="checkbox" checked={ecrase} onChange={e => setEcrase(e.target.checked)}/>
        <span>Écraser les notes déjà présentes sur la séquence cible</span>
      </label>
    </Modal>
  );
}

/* ---------- Page principale ---------- */
export default function Notes(){
  const { db, anneeId, can, M, openModal, toast, scope, user, confirm } = useApp();
  const canW = can('notes', true);

  const classes = useMemo(() => {
    return classesPerimetre(db, scope.classesIds);
  }, [db, scope.classesIds]);

  const [mode, setMode] = useState('matiere');   /* 'matiere' | 'eleve' */
  const [classeId, setClasseId] = useState(() => classeParDefaut(db, anneeId, classes));
  const sequences = sequencesSorted(db);

  /* matières = PLAN d'enseignements de la classe (∩ périmètre enseignant) */
  const planMat = useMemo(() => planOf(db, classeId)
    .map(e => ({ entry:e, mat:(db.matieres || []).find(m => m.id === e.matiereId) }))
    .filter(x => x.mat && (!scope.matieresIds || scope.matieresIds.includes(x.mat.id))), [db, classeId, scope.matieresIds]);

  const [matiereId, setMatiereId] = useState('');
  const [eleveId, setEleveId] = useState('');
  const [sequenceId, setSequenceId] = useState(sequences[0] ? String(sequences[0].id) : '');
  const [nonce, setNonce] = useState(0);   /* force le rafraîchissement des champs après annulation */

  /* la matière suit le plan de la classe ; la séquence suit la liste */
  useEffect(() => {
    if (planMat.length && !planMat.some(x => x.mat.id === matiereId)) setMatiereId(planMat[0].mat.id);
    if (!planMat.length) setMatiereId('');
  }, [classeId, planMat]);
  useEffect(() => {
    if (sequences.length && !sequences.some(s => String(s.id) === String(sequenceId))) setSequenceId(String(sequences[0].id));
  }, [sequences]);

  const cl = classeId ? classById(db, classeId) : null;
  const mat = matiereId ? (db.matieres || []).find(m => m.id === matiereId) : null;
  const entry = planMat.find(x => x.mat.id === matiereId);
  const seqObj = (db.sequences || []).find(s => String(s.id) === String(sequenceId)) || null;
  const enseignant = entry && entry.entry.enseignantId ? (db.enseignants || []).find(t => t.id === entry.entry.enseignantId) : null;

  /* la liste des élèves s'actualise avec la classe sélectionnée */
  const eleves = useMemo(() => (db.eleves || []).filter(e => e.anneeId === anneeId && e.classeId === classeId && e.statut !== 'radie')
    .sort((a,b) => (a.nom + a.prenom < b.nom + b.prenom ? -1 : 1)), [db, anneeId, classeId]);

  /* en mode « par élève », l'élève suit la classe */
  useEffect(() => {
    if (!eleves.some(e => e.id === eleveId)) setEleveId(eleves[0] ? eleves[0].id : '');
  }, [eleves]);
  const eleve = eleves.find(e => e.id === eleveId) || null;

  /* v5.4 : une seule note par élève, matière et séquence ;
     v6.5 : pour une séquence à devoirs, une note PAR DEVOIR — la note
     séquentielle est calculée automatiquement (moyenneMatiere). */
  const devoirs = seqObj ? devoirsDe(db, seqObj) : [];
  const noteOf = (el, mid, dvId) => {
    const n = (db.notes || []).find(x => x.eleveId === el.id && x.matiereId === mid
      && String(x.sequence) === String(sequenceId)
      && (dvId != null
        ? (x.type === 'devoir' && String(x.devoirId) === String(dvId))
        : !(x.type === 'devoir' && x.devoirId != null)));
    return n ? String(n.valeur) : '';
  };
  const moyOf = (el, mid) => (mid && sequenceId) ? moyenneMatiere(db, anneeId, el.id, mid, sequenceId) : null;

  const editable = canW && scope.canClasse(classeId);

  const valider = (el, mid, val, dvId) => {
    try { M.saveNote({ eleveId:el.id, matiereId:mid, sequence:sequenceId, valeur:val, devoirId: dvId || null }); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };
  const annulerNotes = async el => {
    const ok = await confirm(`Annuler la note de ${el.nom} ${el.prenom} ?`,
      'Sa note de <b>' + (mat ? mat.libelle : 'cette matière') + '</b> pour la <b>' + (seqObj ? seqObj.libelle : 'séquence') + '</b> sera effacée.', 'Annuler la note', true);
    if (!ok) return;
    try { const r = M.annulerNotesEleve(el.id, matiereId, sequenceId);
      toast(r.n + ' note(s) annulée(s) pour ' + el.nom + ' ' + el.prenom + '.', 'ok'); setNonce(n => n + 1); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };

  /* ---------- navigation clavier : Entrée / flèches entre les notes ---------- */
  const navClavier = e => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll('.note-in')];
    const ix = inputs.indexOf(e.target);
    if (ix < 0) return;
    const cible = e.key === 'ArrowUp' ? inputs[ix - 1] : inputs[ix + 1];
    /* enregistre la note en cours : le focusout déclenche l'enregistrement
       (double déclenchement inoffensif — l'écriture est idempotente) */
    try { e.target.dispatchEvent(new Event('focusout', { bubbles:true })); } catch(_){}
    e.target.blur();
    if (cible){ cible.focus(); try { cible.select(); } catch(_){} }
  };

  /* ---------- classement de la classe pour la séquence (temps réel) ---------- */
  const classement = useMemo(() => classeId ? classementClasse(db, anneeId, classeId, sequenceId) : { rangs:new Map(), nonClasses:new Set(), classes:[] },
    [db, anneeId, classeId, sequenceId]);
  const stats = useMemo(() => statsNotes(db, eleves.map(el => moyOf(el, matiereId)).filter(v => v != null)), [db, eleves, matiereId, sequenceId]);
  const st = settingsOf(db);

  /* stats du bordereau : moyennes de la matière pour tous les élèves */
  const statsMat = useMemo(() => statsNotes(db, eleves.map(el => moyOf(el, matiereId)).filter(v => v != null)), [db, eleves, matiereId, sequenceId]);

  /* élève courant : moyenne, rang, appréciation, matières manquantes */
  const moyEleve = eleve ? moyenneGenerale(db, anneeId, eleve.id, sequenceId) : null;
  const rangEleve = eleve ? classement.rangs.get(eleve.id) : null;
  /* v5.7 : suivi de la moyenne ANNUELLE pendant la saisie par élève */
  const classementAn = useMemo(() => classeId ? classementClasse(db, anneeId, classeId, '') : { rangs:new Map(), nonClasses:new Set(), classes:[] },
    [db, anneeId, classeId]);
  const moyAnnee = eleve ? moyenneGenerale(db, anneeId, eleve.id, '') : null;
  const rangAnnee = eleve ? classementAn.rangs.get(eleve.id) : null;
  const ncEleve = eleve ? (classement.nonClasses.has(eleve.id) && moyEleve != null) : false;
  const manqEleve = eleve ? matieresManquantes(db, anneeId, eleve.id, sequenceId) : [];

  /* ---------- v6.1 : scan automatique des notes manquantes (agent de saisie) ---------- */
  const scan = useMemo(() => scanNotesManquantes(db, anneeId, classeId, sequenceId), [db, anneeId, classeId, sequenceId]);
  const scanLignes = useMemo(() => {
    const ordre = { vide:0, partielle:1, complete:2 };
    return [...scan.lignes].sort((a, b) => (ordre[a.statut] - ordre[b.statut])
      || String(a.libelle).localeCompare(String(b.libelle), 'fr'));
  }, [scan]);
  const horodatage = () => { const t = new Date();
    return ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + ':' + ('0' + t.getSeconds()).slice(-2); };
  const [scanAt, setScanAt] = useState('');
  /* le scan est recalculé à chaque changement (db/classe/séquence) : l'horodatage suit */
  useEffect(() => { if (mode === 'scan') setScanAt(horodatage()); }, [mode, db, classeId, sequenceId]);

  /* ---------- v6.2 : synthèse par évaluation et par classe (matrice) ---------- */
  const [scanVue, setScanVue] = useState('matrice');     /* 'matrice' | 'detail' */
  const [mxClasse, setMxClasse] = useState('__all__');   /* '__all__' = toutes les classes */
  const scanAnnee = useMemo(() => scanNotesManquantesAnnee(db, anneeId,
    mxClasse === '__all__' ? classes.map(c => c.id) : [mxClasse]), [db, anneeId, mxClasse, classes]);
  const allerSaisirMx = (cid, mid, sid) => { setClasseId(cid); setMatiereId(mid); setSequenceId(String(sid)); setMode('matiere'); };

  if (!classes.length){
    return <div className="card"><div className="card-b">
      <EmptyState icon="book" title="Rien à noter" text="Aucune classe dans votre périmètre pour cette année."/>
    </div></div>;
  }

  /* ---------- bordereau imprimable ---------- */
  const bordereau = () => {
    const rows = eleves.map((el, i) => {
      const n = noteOf(el, matiereId), m = moyOf(el, matiereId);
      const nc = classement.nonClasses.has(el.id) && m != null;
      return { n:i + 1, matricule:el.matricule || '—', nom:el.nom + ' ' + el.prenom,
        note:n === '' ? '—' : String(n).replace('.', ','),
        dev:devoirs.map(d => { const v = noteOf(el, matiereId, d.id); return v === '' ? '—' : String(v).replace('.', ','); }),
        moy:nc ? 'NC' : (m == null ? '—' : String(m).replace('.', ',')),
        app:nc ? 'Non classé' : (m == null ? '—' : (appreciationOf(db, m) || '—')) };
    });
    return (
      <ReportModal autoPrint title={'Bordereau de notes — ' + (cl ? cl.libelle : '') + ' — ' + (mat ? mat.libelle : '')}>
      <div className="rcp" id="print-zone">
        <div className="rcp-scope" style={{ marginBottom:10 }}>
          <b>{st.nomEtablissement || 'Établissement'}</b> — Année {((db.annees || []).find(a => a.id === anneeId) || {}).libelle || ''}<br/>
          Classe : <b>{cl ? cl.libelle : ''}</b> • Matière : <b>{mat ? mat.libelle : ''}</b> (coef. {entry ? entry.entry.coefficient : 1})<br/>
          Période : <b>{seqObj ? seqObj.libelle : ''}</b> (T{seqObj ? seqObj.trimestre : '—'}, poids {seqObj ? seqObj.poids : '—'} %)
          {enseignant ? <>• Enseignant : <b>{enseignant.nom} {enseignant.prenom}</b></> : null}
        </div>
        <p style={{ fontSize:11.5, margin:'0 0 8px' }}>Période : <b>{seqObj ? seqObj.libelle : ''}</b> — {devoirs.length
          ? <>notes de devoir pondérées ({devoirs.map(d => d.libelle + ' ' + d.pourcentage + ' %').join(' + ')}) — la note séquentielle est <b>calculée automatiquement</b> et les notes de devoir ne figurent pas sur les bulletins.</>
          : <>une seule note par matière et par séquence.</>} NC = non classé (aucune note dans l'ensemble des matières indispensables).</p>
        <table className="rcp-tbl">
          <thead><tr>
            <th style={{ width:34 }}>N°</th><th style={{ width:96 }}>Matricule</th><th>Nom et prénom</th>
            {devoirs.length ? (
              <>
                {devoirs.map(d => <th key={d.id} style={{ width:86 }}>{d.libelle} /20</th>)}
                <th style={{ width:96 }}>Note séq. /20</th>
              </>
            ) : (
              <th style={{ width:90 }}>Note /20</th>
            )}
            <th style={{ width:120 }}>Appréciation</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.n} className={r.moy !== '—' && r.moy !== 'NC' && parseFloat(r.moy.replace(',', '.')) < 10 ? 'rcp-rowbad' : ''}>
                <td>{r.n}</td><td>{r.matricule}</td><td style={{ whiteSpace:'nowrap' }}>{r.nom}</td>
                {devoirs.length ? (
                  <>
                    {r.dev.map((v, k) => <td key={k} style={{ textAlign:'center' }}>{v}</td>)}
                    <td style={{ textAlign:'center', fontWeight:700 }}>{r.moy === 'NC' ? 'NC' : r.moy}</td>
                  </>
                ) : (
                  <td style={{ textAlign:'center', fontWeight:700 }}>{r.note}</td>
                )}
                <td>{r.app}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Moyenne de la classe : <b>{statsMat.moy == null ? '—' : String(statsMat.moy).replace('.', ',')}</b> / 20
                {' '}• Min : <b>{statsMat.min == null ? '—' : String(statsMat.min).replace('.', ',')}</b>
                {' '}• Max : <b>{statsMat.max == null ? '—' : String(statsMat.max).replace('.', ',')}</b></td>
              <td style={{ textAlign:'center' }}><b>{statsMat.ge10}/{statsMat.n}</b></td>
              <td>{statsMat.pct == null ? '—' : statsMat.pct + ' % ≥ 10'}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-lettres" style={{ marginTop:10 }}>
          {statsMat.n > 0
            ? statsMat.repartition.filter(r => r.n > 0).map(r => r.libelle + ' : ' + r.n + ' (' + r.pct + ' %)').join('  •  ')
            : 'Aucune note saisie.'}
        </div>
        <div className="rcp-foot" style={{ display:'flex', justifyContent:'space-between', marginTop:26 }}>
          <span className="sig">L'enseignant</span>
          <span className="sig">Le censeur / préfet des études</span>
        </div>
      </div>
      </ReportModal>
    );
  };

  /* ---------- statistiques ---------- */
  const statistiques = () => {
    return (
      <ReportModal title={'Statistiques — ' + (cl ? cl.libelle : '') + ' — ' + (mat ? mat.libelle : '') + ' — ' + (seqObj ? seqObj.libelle : '')}>
      <div className="rcp" id="print-zone">
        <div className="rcp-scope" style={{ marginBottom:10 }}>
          <b>{st.nomEtablissement || 'Établissement'}</b> — {cl ? cl.libelle : ''} • {mat ? mat.libelle : ''} • {seqObj ? seqObj.libelle : ''} (T{seqObj ? seqObj.trimestre : '—'})
        </div>
        {statsMat.n ? <>
          <table className="rcp-tbl">
            <tbody>
              <tr><th>Notes saisies (moyennes élèves)</th><td style={{ textAlign:'center' }}><b>{statsMat.n}</b></td></tr>
              <tr><th>Moyenne de la classe</th><td style={{ textAlign:'center' }}><b>{String(statsMat.moy).replace('.', ',')} / 20</b> — {appreciationOf(db, statsMat.moy) || '—'}</td></tr>
              <tr><th>Note la plus basse</th><td style={{ textAlign:'center' }}>{String(statsMat.min).replace('.', ',')} / 20</td></tr>
              <tr><th>Note la plus haute</th><td style={{ textAlign:'center' }}>{String(statsMat.max).replace('.', ',')} / 20</td></tr>
              <tr><th>Élèves ≥ 10 / 20</th><td style={{ textAlign:'center' }}><b>{statsMat.ge10}</b> sur {statsMat.n} ({statsMat.pct} %)</td></tr>
            </tbody>
          </table>
          <h4 style={{ margin:'14px 0 6px', fontSize:12.5 }}>Répartition par appréciation</h4>
          <table className="rcp-tbl">
            <thead><tr><th>Appréciation</th><th className="num">Élèves</th><th style={{ width:200 }}>Part</th></tr></thead>
            <tbody>
              {statsMat.repartition.map(r => (
                <tr key={r.libelle}>
                  <td>{r.libelle}</td>
                  <td className="num">{r.n}</td>
                  <td><div className="bar thin"><i style={{ width:(statsMat.n ? Math.round(r.n / statsMat.n * 100) : 0) + '%' }}/></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </> : <p style={{ fontSize:12.5 }}>Aucune note saisie pour cette matière et cette séquence.</p>}
      </div>
      </ReportModal>
    );
  };

  /* ---------- v6.1 : feuille de contrôle imprimable (notes manquantes) ---------- */
  const feuilleControle = () => {
    const aFaire = scanLignes.filter(l => l.statut !== 'complete');
    return (
      <ReportModal autoPrint title={'Feuille de contrôle — ' + (cl ? cl.libelle : '') + ' — ' + (seqObj ? seqObj.libelle : '')}>
      <div className="rcp" id="print-zone">
        <div className="rcp-scope" style={{ marginBottom:10 }}>
          <b>{st.nomEtablissement || 'Établissement'}</b> — Année {((db.annees || []).find(a => a.id === anneeId) || {}).libelle || ''}<br/>
          Classe : <b>{cl ? cl.libelle : ''}</b> ({scan.eleves.length} élèves) • Période : <b>{seqObj ? seqObj.libelle : ''}</b> (T{seqObj ? seqObj.trimestre : '—'}, poids {seqObj ? seqObj.poids : '—'} %)<br/>
          Scan du <b>{new Date().toLocaleDateString('fr-FR')}</b> à <b>{scanAt || horodatage()}</b> — {scan.resume.completes} matière(s) complète(s), {scan.resume.partielles} partielle(s), {scan.resume.vides} sans note • <b>{scan.resume.notesManquantes} note(s) manquante(s)</b>.
        </div>
        {aFaire.length ? (
          <table className="rcp-tbl">
            <thead><tr>
              <th style={{ width:34 }}>N°</th><th>Matière</th><th style={{ width:64, textAlign:'center' }}>Coef.</th>
              <th style={{ width:96, textAlign:'center' }}>Saisies</th><th>Élèves sans note (à saisir)</th>
              <th style={{ width:86, textAlign:'center' }}>Saisie faite</th>
            </tr></thead>
            <tbody>
              {aFaire.map((l, i) => (
                <tr key={l.matiereId}>
                  <td>{i + 1}</td>
                  <td style={{ whiteSpace:'nowrap' }}><b>{l.code}</b> — {l.libelle}{l.indispensable ? ' ★' : ''}</td>
                  <td style={{ textAlign:'center' }}>{l.coefficient}</td>
                  <td style={{ textAlign:'center' }}>{l.saisies}/{l.effectif}</td>
                  <td>{l.manquantes === 0 ? '—' : l.elevesManquants.map(e => e.nom).join(', ')}</td>
                  <td style={{ textAlign:'center' }}>☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ fontSize:12.5 }}>Toutes les matières du plan ont leurs notes pour cette séquence — rien à compléter.</p>}
        {scan.sansAucune.length > 0 && (
          <p style={{ fontSize:11.5, marginTop:8 }}><b>Élèves sans aucune note :</b> {scan.sansAucune.map(e => e.nom).join(', ')}.</p>
        )}
        <div className="rcp-foot" style={{ display:'flex', justifyContent:'space-between', marginTop:26 }}>
          <span className="sig">L’agent de saisie</span>
          <span className="sig">Le censeur / préfet des études</span>
        </div>
      </div>
      </ReportModal>
    );
  };

  /* ---------- champ de note (partagé par les deux modes ; v6.5 : devoir) ---------- */
  const champNote = (el, mid, clsExtra, dvId) => (
    <input className={'note-in' + (clsExtra || '')} type="text" inputMode="decimal"
      defaultValue={noteOf(el, mid, dvId)} key={el.id + mid + sequenceId + (dvId || '') + nonce}
      disabled={!editable}
      onBlur={e => { if (e.target.value !== noteOf(el, mid, dvId)) valider(el, mid, e.target.value, dvId); }}
      onKeyDown={navClavier}
      placeholder="—" aria-label={'Note — ' + ((db.matieres || []).find(m => m.id === mid) || {}).libelle
        + (dvId != null ? ' — ' + ((devoirs.find(d => String(d.id) === String(dvId)) || {}).libelle || 'devoir') : '')}/>
  );

  return (
    <>
      <div className="card">
        <div className="card-h">
          <h3>Saisie des notes</h3>
          {mode === 'matiere' && mat && editable && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openModal(<ReconduireModal classeId={classeId} matiereId={matiereId} fromSeq={sequenceId} onClose={() => {}}/>)}>
                <Ic name="refresh"/> Reconduire…
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => openModal(statistiques())}>
                <Ic name="chart"/> Statistiques
              </button>
              <button className="btn btn-pri btn-sm" onClick={() => openModal(bordereau())}>
                <Ic name="printer"/> Imprimer le bordereau
              </button>
              <CsvBtn filename={'notes_' + (cl ? cl.libelle : 'classe') + '_' + (mat ? mat.code : 'matiere') + '_' + (seqObj ? seqObj.libelle : '') + '.csv'}
                header={devoirs.length
                  ? ['Matricule','Élève'].concat(devoirs.map(d => d.libelle + ' / 20'), ['Note séquentielle / 20','Appréciation'])
                  : ['Matricule','Élève','Note / 20','Moyenne / 20','Appréciation']}
                rows={eleves.map(el => {
                  const m = moyOf(el, matiereId);
                  const nc = classement.nonClasses.has(el.id) && m != null;
                  if (devoirs.length){
                    return [el.matricule || '—', el.nom + ' ' + el.prenom].concat(
                      devoirs.map(d => { const v = noteOf(el, matiereId, d.id); return v === '' ? '' : String(v).replace('.', ','); }),
                      [nc ? 'NC' : (m == null ? '' : String(m).replace('.', ',')),
                       nc ? 'Non classé' : (m == null ? '' : (appreciationOf(db, m) || ''))]);
                  }
                  const n = noteOf(el, matiereId);
                  return [el.matricule || '—', el.nom + ' ' + el.prenom, n === '' ? '' : String(n).replace('.', ','),
                    nc ? 'NC' : (m == null ? '' : String(m).replace('.', ',')), nc ? 'Non classé' : (m == null ? '' : (appreciationOf(db, m) || ''))];
                })}/>
            </div>
          )}
        </div>
        <div className="card-b">
          <div className="tabs" style={{ marginBottom:14 }} role="tablist" aria-label="Mode de saisie">
            <button role="tab" aria-selected={mode === 'matiere'} className={'tab' + (mode === 'matiere' ? ' on' : '')}
              onClick={() => setMode('matiere')}><Ic name="grid"/> Par matière</button>
            <button role="tab" aria-selected={mode === 'eleve'} className={'tab' + (mode === 'eleve' ? ' on' : '')}
              onClick={() => setMode('eleve')}><Ic name="user"/> Par élève</button>
            <button role="tab" aria-selected={mode === 'scan'} className={'tab' + (mode === 'scan' ? ' on' : '')}
              onClick={() => setMode('scan')}><Ic name="search"/> Notes manquantes
              {scan.resume.aSaisir > 0 && <span className="tab-badge"
                title={scan.resume.aSaisir + ' matière(s) à compléter pour ' + (seqObj ? seqObj.libelle : 'cette séquence')}>{scan.resume.aSaisir}</span>}
            </button>
          </div>
          <div className="form-grid">
            {(mode !== 'scan' || scanVue === 'detail') && (
              <label>Classe
                <Select value={classeId} onChange={setClasseId}
                  options={classes.map(c => optionClasse(db, anneeId, c))}/>
              </label>
            )}
            {mode === 'matiere' ? (
              <>
                <label>Matière <span className="mut">(plan de la classe)</span>
                  <Select value={matiereId} onChange={setMatiereId}
                    options={planMat.map(x => ({ value:x.mat.id, label:x.mat.code + ' — ' + x.mat.libelle + ' (coef. ' + x.entry.coefficient + ')' }))}/>
                </label>
                <label>Séquence
                  <Select value={sequenceId} onChange={setSequenceId}
                    options={sequences.map(sq => ({ value:String(sq.id), label:sq.libelle + ' — T' + sq.trimestre + ' (' + sq.poids + ' %)' }))}/>
                </label>
              </>
            ) : mode === 'scan' ? (
              scanVue === 'detail' ? (
                <>
                  <label>Séquence <span className="mut">(évaluation à scanner)</span>
                    <Select value={sequenceId} onChange={setSequenceId}
                      options={sequences.map(sq => ({ value:String(sq.id), label:sq.libelle + ' — T' + sq.trimestre + ' (' + sq.poids + ' %)' }))}/>
                  </label>
                </>
              ) : null
            ) : (
              <>
                <label>Élève
                  <Select value={eleveId} onChange={setEleveId}
                    options={eleves.map(e => ({ value:e.id, label:e.nom + ' ' + e.prenom + (e.matricule ? ' — ' + e.matricule : '') }))}/>
                </label>
                <label>Séquence
                  <Select value={sequenceId} onChange={setSequenceId}
                    options={sequences.map(sq => ({ value:String(sq.id), label:sq.libelle + ' — T' + sq.trimestre + ' (' + sq.poids + ' %)' }))}/>
                </label>
              </>
            )}
          </div>
          {mode === 'matiere' && enseignant && <p className="mut" style={{ fontSize:11.5, marginTop:8 }}>
            <Ic name="user"/> Enseignant de la matière dans cette classe : <b>{enseignant.nom} {enseignant.prenom}</b>
            {coefOf(db, classeId, matiereId) ? ' — coefficient ' + coefOf(db, classeId, matiereId) : ''}
          </p>}
        </div>
      </div>

      {mode === 'scan' ? (
        /* ================= MODE NOTES MANQUANTES (v6.1) ================= */
        <div className="card" style={{ marginTop:14 }}>
          <div className="card-h">
            <h3>Notes manquantes <span className="mut">/ {scanVue === 'detail'
              ? (cl ? cl.libelle : '') + ' — ' + (seqObj ? seqObj.libelle : '')
              : 'par évaluation et par classe'}</span></h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <span className="mut" style={{ fontSize:11.5 }}><Ic name="check-circle"/> Scan actualisé à <b>{scanAt || '—'}</b></span>
              <button className="btn btn-ghost btn-sm" onClick={() => { const h = horodatage(); setScanAt(h); toast('Scan actualisé à ' + h + '.', 'ok'); }}>
                <Ic name="refresh"/> Actualiser</button>
              {scanVue === 'detail' && (
                <button className="btn btn-ghost btn-sm" onClick={() => openModal(feuilleControle())}><Ic name="printer"/> Feuille de contrôle</button>
              )}
              {scanVue === 'matrice' ? (
                <CsvBtn filename={'notes_manquantes_synthese_' + (mxClasse === '__all__' ? 'etablissement' : ((classById(db, mxClasse) || {}).libelle || 'classe')) + '.csv'}
                  header={(mxClasse === '__all__' ? ['Classe'] : []).concat(['Code','Matière','Coef'], scanAnnee.sequences.map(sq => sq.court), ['Total manquantes'])}
                  rows={scanAnnee.classes.flatMap(c => c.matieres.map(m =>
                    (mxClasse === '__all__' ? [c.libelle] : []).concat([m.code, m.libelle, m.coefficient],
                      m.parSequence.map(x => x.manquantes), [m.totalManquantes])))}/>
              ) : (
                <CsvBtn filename={'notes_manquantes_' + (cl ? cl.libelle : 'classe') + '_' + (seqObj ? seqObj.libelle : '') + '.csv'}
                  header={['Code','Matière','Coef','Notes saisies','Effectif','Manquantes','Statut','Élèves sans note']}
                  rows={scanLignes.map(l => [l.code, l.libelle, l.coefficient, l.saisies, l.effectif, l.manquantes,
                    l.statut === 'complete' ? 'Complète' : (l.statut === 'partielle' ? 'Partielle' : 'Aucune note'),
                    l.elevesManquants.map(e => e.nom).join(' ; ')])}/>
              )}
            </div>
          </div>
          <div className="card-b">
            <div className="seg" role="tablist" aria-label="Vue du scan des notes manquantes" style={{ marginBottom:12 }}>
              <button role="tab" aria-selected={scanVue === 'matrice'} className={scanVue === 'matrice' ? 'on' : ''}
                onClick={() => setScanVue('matrice')}><Ic name="grid"/> Toutes les évaluations</button>
              <button role="tab" aria-selected={scanVue === 'detail'} className={scanVue === 'detail' ? 'on' : ''}
                onClick={() => setScanVue('detail')}><Ic name="search"/> Séquence donnée</button>
            </div>
            {scanVue === 'matrice' ? (
              !classes.length || !scanAnnee.classes.length ? (
                <EmptyState icon="users" title="Aucune classe à scanner"
                  text="Aucune classe de votre périmètre n'a à la fois des élèves inscrits et un plan d'enseignements."/>
              ) : (
                <>
                  <div className="form-grid" style={{ marginBottom:12 }}>
                    <label>Classe <span className="mut">(synthèse des évaluations)</span>
                      <Select value={mxClasse} onChange={setMxClasse}
                        options={[{ value:'__all__', label:'Toutes les classes' }]
                          .concat(classes.map(c => optionClasse(db, anneeId, c)))}/>
                    </label>
                  </div>
                  <div className="scan-kpis">
                    <Kpi icon="alert" val={scanAnnee.totalGeneral} label="Notes manquantes" sub="toutes évaluations"
                      color="var(--bad)" bg="var(--bad-bg)"/>
                    <Kpi icon="pencil" val={scanAnnee.cellsToDo} label="Matière-éval. à compléter"
                      sub={'sur ' + scanAnnee.cellsTotal + ' au total'} color="var(--gold-600)" bg="rgba(227,167,60,.13)"/>
                    <Kpi icon="check-circle" val={scanAnnee.cellsTotal - scanAnnee.cellsToDo} label="Matière-éval. complètes"
                      sub="saisies intégralement" color="var(--ok)" bg="var(--ok-bg)"/>
                    <Kpi icon="classroom" val={scanAnnee.classes.filter(c => c.totalManquantes > 0).length}
                      label="Classes concernées" sub={'sur ' + scanAnnee.classes.length + ' avec plan'} color="var(--navy-800)" bg="rgba(44,58,99,.07)"/>
                  </div>
                  <div className="tbl-wrap">
                    <table className="mx-tbl">
                      <thead><tr>
                        <th>Matière <span className="mut">(plan de la classe)</span></th>
                        <th style={{ width:52, textAlign:'center' }}>Coef.</th>
                        {scanAnnee.sequences.map(sq => (
                          <th key={sq.id} className="mx-seq" style={{ textAlign:'center' }}
                            title={sq.libelle + ' — T' + sq.trimestre + ' (' + sq.poids + ' %)'}>{sq.court}</th>
                        ))}
                        <th style={{ textAlign:'center' }}>Total</th>
                      </tr></thead>
                      <tbody>
                        {scanAnnee.classes.map(c => (
                          <React.Fragment key={c.classeId}>
                            <tr className="mx-class">
                              <td colSpan={2 + scanAnnee.sequences.length + 1}>{c.libelle} — {c.effectif} élève(s)</td>
                            </tr>
                            {c.matieres.map(m => (
                              <tr key={m.matiereId}>
                                <td><b>{m.code}</b> — {m.libelle}{m.indispensable
                                  ? <span className="mut" title="Matière indispensable au classement"> ★</span> : null}</td>
                                <td className="num">{m.coefficient}</td>
                                {m.parSequence.map((x, i) => {
                                  const tt = x.saisies + '/' + c.effectif + ' note(s) saisie(s)';
                                  if (!x.manquantes) return <td key={i} className="mx-c mx-okk" title={tt}>✓</td>;
                                  return (
                                    <td key={i} className={'mx-c ' + (x.statut === 'vide' ? 'mx-miss' : 'mx-part')}
                                      title={tt + ' — ' + x.manquantes + ' manquante(s)'}>
                                      {canW && scope.canClasse(c.classeId) ? (
                                        <button className="mx-go" title="Ouvrir la saisie de cette matière et séquence"
                                          onClick={() => allerSaisirMx(c.classeId, m.matiereId, x.sequenceId)}>{x.manquantes}</button>
                                      ) : x.manquantes}
                                    </td>
                                  );
                                })}
                                <td className="mx-c">{m.totalManquantes ? <b>{m.totalManquantes}</b> : <span className="mx-okk">✓</span>}</td>
                              </tr>
                            ))}
                            <tr className="mx-tot">
                              <td colSpan={2}>Manquantes — {c.libelle}</td>
                              {c.totauxParSequence.map((v, i) => <td key={i} className="mx-c">{v || <span className="mx-okk">✓</span>}</td>)}
                              <td className="mx-c">{c.totalManquantes}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                        {scanAnnee.classes.length > 1 && (
                          <tr className="mx-tot mx-gen">
                            <td colSpan={2}>TOTAL GÉNÉRAL</td>
                            {scanAnnee.totauxGlobaux.map((v, i) => <td key={i} className="mx-c">{v || <span className="mx-okk">✓</span>}</td>)}
                            <td className="mx-c">{scanAnnee.totalGeneral}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : (
              <>
            <div className="scan-kpis">
              <Kpi icon="check-circle" val={scan.resume.completes} label="Matières complètes" sub={'sur ' + scan.resume.matieres + ' au plan'}
                color="var(--ok)" bg="var(--ok-bg)"/>
              <Kpi icon="pencil" val={scan.resume.partielles} label="Matières partielles" sub="saisies en partie"
                color="var(--gold-600)" bg="rgba(227,167,60,.13)"/>
              <Kpi icon="ban" val={scan.resume.vides} label="Matières sans note" sub="aucune saisie"
                color="var(--bad)" bg="var(--bad-bg)"/>
              <Kpi icon="alert" val={scan.resume.notesManquantes} label="Notes manquantes"
                sub={'sur ' + (scan.resume.notesSaisies + scan.resume.notesManquantes) + ' attendues'}
                color="var(--navy-800)" bg="rgba(44,58,99,.07)"/>
            </div>
            {!planMat.length ? (
              <EmptyState icon="grid" title="Aucune matière au plan de cette classe"
                text="Seules les matières du plan des enseignements de la classe peuvent être notées. Définissez d’abord le plan (menu Pédagogie)."/>
            ) : !scan.eleves.length ? (
              <EmptyState icon="users" title="Aucun élève" text="Cette classe n’a aucun élève inscrit pour l’année."/>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th>Matière <span className="mut">(plan de la classe)</span></th>
                    <th style={{ width:56, textAlign:'center' }}>Coef.</th>
                    <th style={{ width:110, textAlign:'center' }}>Saisies</th>
                    <th style={{ width:130 }}>Statut</th>
                    <th>Élèves sans note <span className="mut">(à saisir)</span></th>
                    {editable && <th style={{ width:96 }}></th>}
                  </tr></thead>
                  <tbody>
                    {scanLignes.map(l => (
                      <tr key={l.matiereId}>
                        <td><b>{l.code}</b> — {l.libelle}{l.indispensable
                          ? <span className="mut" title="Matière indispensable au classement"> ★</span> : null}</td>
                        <td className="num">{l.coefficient}</td>
                        <td style={{ textAlign:'center' }}><b>{l.saisies}</b><span className="mut">/{l.effectif}</span></td>
                        <td>{l.statut === 'complete' ? <Badge cls="b-ok">Complète</Badge>
                          : (l.statut === 'partielle' ? <Badge cls="b-warn">Partielle</Badge> : <Badge cls="b-bad">Aucune note</Badge>)}</td>
                        <td>{l.manquantes === 0 ? <span className="mut">—</span> : (
                          <details className="manq">
                            <summary>{l.manquantes} élève{l.manquantes > 1 ? 's' : ''} sans note</summary>
                            <span style={{ fontSize:11.5 }}>{l.elevesManquants.map(e => e.nom).join(', ')}</span>
                          </details>
                        )}</td>
                        {editable && (
                          <td className="acts">{l.statut !== 'complete' && (
                            <button className="btn btn-pri btn-sm" onClick={() => { setMatiereId(l.matiereId); setMode('matiere'); }}>
                              <Ic name="pencil"/> Saisir</button>)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}
          </div>
          <div className="card-f">
            {scanVue === 'matrice' ? (
              <><Ic name="info"/> Synthèse <b>par évaluation et par classe</b> : chaque cellule donne le nombre de notes manquantes
              {' '}— cliquez sur un nombre pour ouvrir la saisie correspondante. <span className="mx-okk">✓</span> = saisie complète.
              {scanAnnee.classes.length > 1 && <> Total général : <b>{scanAnnee.totalGeneral}</b> note(s) manquante(s) sur {scanAnnee.cellsTotal} matière-éval.</>}
              {scanAnnee.classes.length === 1 && <> Total de la classe : <b>{scanAnnee.totalGeneral}</b> note(s) manquante(s).</>}
              {scanAnnee.classes.length < classes.length && <> Les classes sans plan d'enseignements ne sont pas scannables.</>}</>
            ) : (
              <><Ic name="info"/> Scan automatique de <b>{seqObj ? seqObj.libelle : ''}</b> pour <b>{cl ? cl.libelle : ''}</b> — {' '}
              {scan.resume.aSaisir === 0
                ? <b>toutes les matières du plan sont complètes.</b>
                : <>{scan.resume.aSaisir} matière(s) à compléter • {scan.resume.notesManquantes} note(s) manquante(s) • {scan.resume.notesSaisies} déjà saisie(s).</>}
              {scan.sansAucune.length > 0 && <> Élèves sans aucune note : <b>{scan.sansAucune.map(e => e.nom).join(', ')}</b>.</>}</>
            )}
          </div>
        </div>
      ) : mode === 'matiere' ? (
        /* ================= MODE PAR MATIÈRE ================= */
        <div className="card" style={{ marginTop:14 }}>
          <div className="card-h">
            <h3>{cl ? cl.libelle : ''} — {mat ? mat.libelle : 'aucune matière'} <span className="mut">/ {seqObj ? seqObj.libelle : ''}</span></h3>
            <span className="mut" style={{ fontSize:12 }}>
              {devoirs.length ? <Badge cls="b-navy" title="Notes de devoir pondérées — note séquentielle calculée automatiquement, invisible dans les bulletins">
                {devoirs.length} devoir{devoirs.length > 1 ? 's' : ''} — note calculée</Badge> : null}
              {' '}{stats.n}/{eleves.length} note(s) saisie(s)
              {classement.nonClasses.size ? ' — ' + classement.nonClasses.size + ' non classé(s)' : ''}</span>
          </div>
          <div className="card-b" style={{ padding:0 }}>
            {!planMat.length ? (
              <div style={{ padding:22 }}><EmptyState icon="grid" title="Aucune matière au plan de cette classe"
                text="Seules les matières du plan des enseignements de la classe peuvent être notées. Définissez d'abord le plan (menu Pédagogie)."/></div>
            ) : !eleves.length ? (
              <div style={{ padding:22 }}><EmptyState icon="users" title="Aucun élève" text="Cette classe n'a aucun élève inscrit pour l'année."/></div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ width:42, textAlign:'center' }}>N°</th><th>Élève</th><th style={{ width:86 }}>Matricule</th>
                    {devoirs.length ? (
                      <>
                        {devoirs.map(d => (
                          <th key={d.id} style={{ width:104, textAlign:'center' }}
                            title={d.libelle + ' — ' + d.pourcentage + ' % de la note séquentielle'}>
                            {d.libelle} <span className="mut">({d.pourcentage} %)</span></th>
                        ))}
                        <th style={{ width:112, textAlign:'center' }} title="Calculée automatiquement : Σ (note × pourcentage)">Note séquentielle</th>
                      </>
                    ) : (
                      <th style={{ width:110, textAlign:'center' }}>Note / 20</th>
                    )}
                    <th style={{ width:130 }}>Appréciation</th>
                    <th style={{ width:76, textAlign:'center' }}>Rang</th>
                    {editable && <th style={{ width:56 }}></th>}
                  </tr></thead>
                  <tbody>
                    {eleves.map((el, i) => {
                      const moy = moyOf(el, matiereId);
                      const nc = classement.nonClasses.has(el.id) && moy != null;
                      const rg = classement.rangs.get(el.id);
                      return (
                        <tr key={el.id}>
                          <td style={{ textAlign:'center' }} className="mut">{i+1}</td>
                          <td><b>{el.nom}</b> {el.prenom}</td>
                          <td className="mut">{el.matricule}</td>
                          {devoirs.length ? (
                            <>
                              {devoirs.map(d => (
                                <td key={d.id} style={{ textAlign:'center' }}>{champNote(el, matiereId, '', d.id)}</td>
                              ))}
                              <td className="dv-moy" style={{ textAlign:'center' }}>
                                {moy == null ? <span className="mut">—</span> : <b>{String(moy).replace('.', ',')}</b>}
                              </td>
                            </>
                          ) : (
                            <td style={{ textAlign:'center' }}>
                              {champNote(el, matiereId)}
                            </td>
                          )}
                          <td>{moy == null ? <span className="mut">—</span> : <Badge cls={moy >= 14 ? 'b-ok' : (moy >= 10 ? 'b-warn' : 'b-bad')}>{appreciationOf(db, moy) || '—'}</Badge>}</td>
                          <td style={{ textAlign:'center' }}>{nc ? <Badge cls="b-mut">NC</Badge> : (rg ? <b>{rg}<span className="mut">/{classement.classes.length}</span></b> : <span className="mut">—</span>)}</td>
                          {editable && (
                            <td className="acts">
                              <button className="icon-btn" title="Annuler la note de cet élève (matière et séquence courantes)"
                                onClick={() => annulerNotes(el)}><Ic name="x"/></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {stats.n > 0 && (
            <div className="card-f">
              <span><Ic name="chart"/> <b>{String(stats.moy).replace('.', ',')}</b> / 20 de moyenne</span>
              <span>min <b>{String(stats.min).replace('.', ',')}</b></span>
              <span>max <b>{String(stats.max).replace('.', ',')}</b></span>
              <span><b>{stats.ge10}</b>/{stats.n} ≥ 10 (<b>{stats.pct} %</b>)</span>
              <span className="mut">{stats.repartition.filter(r => r.n > 0).map(r => r.libelle + ' : ' + r.n).join(' • ')}</span>
            </div>
          )}
        </div>
      ) : (
        /* ================= MODE PAR ÉLÈVE ================= */
        !eleve ? (
          <div className="card" style={{ marginTop:14 }}><div className="card-b">
            <EmptyState icon="users" title="Aucun élève" text="Cette classe n'a aucun élève inscrit pour l'année."/>
          </div></div>
        ) : (
          <>
            <div className="card" style={{ marginTop:14 }}>
              <div className="card-b eleve-head">
                <img className="eleve-photo" src={eleve.photo} alt="" onError={e => { e.target.style.display = 'none'; }}/>
                {!eleve.photo && <span className="eleve-photo ava">{(eleve.nom || '?').charAt(0)}{(eleve.prenom || '').charAt(0)}</span>}
                <div className="eh-t">
                  <b>{eleve.nom} {eleve.prenom}</b>
                  <span>{eleve.matricule || 'sans matricule'} • {cl ? cl.libelle : ''} — {(niveauById(db, cl.niveauId) || {}).libelle || ''}</span>
                </div>
                <div className="eh-kpis">
                  <Kpi icon="target" val={moyEleve == null ? '—' : String(moyEleve).replace('.', ',')} label="Moyenne / 20"
                    sub={moyEleve == null ? '' : (appreciationOf(db, moyEleve) || '')}
                    color={moyEleve != null && moyEleve >= 10 ? 'var(--ok)' : 'var(--bad)'}
                    bg={moyEleve != null && moyEleve >= 10 ? 'var(--ok-bg)' : 'var(--bad-bg)'}/>
                  <Kpi icon="flag" val={ncEleve ? 'NC' : (rangEleve ? rangEleve + ' / ' + classement.classes.length : '—')} label="Rang"
                    sub={ncEleve ? 'non classé' : 'dans la classe'}
                    color={ncEleve ? 'var(--bad)' : 'var(--navy-800)'} bg={ncEleve ? 'var(--bad-bg)' : 'rgba(44,58,99,.07)'}/>
                  <Kpi icon="book" val={String(planMat.filter(x => moyOf(eleve, x.mat.id) != null).length) + ' / ' + planMat.length}
                    label="Matières notées" sub={seqObj ? seqObj.libelle : ''} color="var(--gold-600)" bg="rgba(227,167,60,.13)"/>
                  <Kpi icon="calendar" val={moyAnnee == null ? '—' : String(moyAnnee).replace('.', ',')}
                    label="Moyenne annuelle / 20"
                    sub={moyAnnee == null ? 'aucune note à ce jour' : (rangAnnee ? 'rang annuel : ' + rangAnnee + ' / ' + classementAn.classes.length : 'non classé à ce jour')}
                    color={moyAnnee != null && moyAnnee >= 10 ? 'var(--ok)' : 'var(--bad)'}
                    bg={moyAnnee != null && moyAnnee >= 10 ? 'var(--ok-bg)' : 'var(--bad-bg)'}/>
                </div>
              </div>
              {ncEleve && manqEleve.length > 0 && (
                <div className="card-f">
                  <Ic name="alert"/> <b>Non classé</b> pour cette séquence — aucune note dans l'ensemble des matières indispensables :
                  {' '}<b>{manqEleve.map(m => m.code + ' ' + m.libelle).join(', ')}</b> (définies dans la fiche de la classe).
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop:14 }}>
              <div className="card-h">
                <h3>Notes de l'élève <span className="mut">/ {seqObj ? seqObj.libelle : ''}</span></h3>
                <span className="mut" style={{ fontSize:11.5 }}>Entrée ou flèche bas : note suivante • flèche haut : note précédente</span>
              </div>
              <div className="card-b" style={{ padding:0 }}>
                {!planMat.length ? (
                  <div style={{ padding:22 }}><EmptyState icon="grid" title="Aucune matière au plan de cette classe"
                    text="Seules les matières du plan des enseignements de la classe peuvent être notées."/></div>
                ) : (
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead><tr>
                        <th>Matière <span className="mut">(plan de la classe)</span></th>
                        <th style={{ width:66, textAlign:'center' }}>Coef.</th>
                        {devoirs.length ? (
                          <>
                            {devoirs.map(d => (
                              <th key={d.id} style={{ width:98, textAlign:'center' }}
                                title={d.libelle + ' — ' + d.pourcentage + ' % de la note séquentielle'}>
                                {d.libelle} <span className="mut">({d.pourcentage} %)</span></th>
                            ))}
                            <th style={{ width:104, textAlign:'center' }}>Note séq.</th>
                          </>
                        ) : (
                          <th style={{ width:110, textAlign:'center' }}>Note / 20</th>
                        )}
                        <th style={{ width:130 }}>Appréciation</th>
                      </tr></thead>
                      <tbody>
                        {planMat.map(x => {
                          const m = moyOf(eleve, x.mat.id);
                          return (
                            <tr key={x.mat.id}>
                              <td><b>{x.mat.code}</b> — {x.mat.libelle}</td>
                              <td className="num">{x.entry.coefficient}</td>
                              {devoirs.length ? (
                                <>
                                  {devoirs.map(d => (
                                    <td key={d.id} style={{ textAlign:'center' }}>{champNote(eleve, x.mat.id, '', d.id)}</td>
                                  ))}
                                  <td className="dv-moy" style={{ textAlign:'center' }}>
                                    {m == null ? <span className="mut">—</span> : <b>{String(m).replace('.', ',')}</b>}
                                  </td>
                                </>
                              ) : (
                                <td style={{ textAlign:'center' }}>{champNote(eleve, x.mat.id)}</td>
                              )}
                              <td>{m == null ? <span className="mut">—</span> : <Badge cls={m >= 14 ? 'b-ok' : (m >= 10 ? 'b-warn' : 'b-bad')}>{appreciationOf(db, m) || '—'}</Badge>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card-f">
                <Ic name="info"/> {devoirs.length
                  ? <>Séquence notée par <b>devoirs pondérés</b> — la note séquentielle de chaque matière est <b>calculée automatiquement</b> (Σ note × pourcentage) et les notes de devoir ne figurent pas sur les bulletins.</>
                  : <>Une seule note par matière et par séquence.</>} Moyenne de la séquence = moyennes des matières
                pondérées par les coefficients du plan. Le rang tient compte des matières indispensables définies pour la classe.
              </div>
            </div>
          </>
        )
      )}
      {!canW && <p className="mut" style={{ marginTop:10, fontSize:12 }}><Ic name="eye"/> Consultation seule — votre profil ({user.role}) ne permet pas la saisie des notes.</p>}
    </>
  );
}
