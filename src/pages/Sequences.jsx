import React, { useState } from 'react';
import { Badge, EmptyState, Kpi , CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Modal } from '../components/UI.jsx';
import FormModal from '../components/modals/FormModal.jsx';
import { sequencesSorted, appreciationsSorted, appreciationsApcSorted, appreciationsMoyenneSorted, devoirsDe, devoirsValides } from '../core/business.js';

/* ---------- Formulaire séquence ---------- */
function SequenceFormModal({ initial=null, onClose }){
  const { M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier la séquence' : 'Nouvelle séquence'} icon="calendar"
      fields={[
        { name:'libelle', label:'Libellé', required:true, maxLength:40, half:true, placeholder:'Séquence 1',
          defaultValue:initial ? initial.libelle : '' },
        { name:'trimestre', label:'Trimestre d\u2019appartenance', type:'select', half:true,
          options:[{ value:'1', label:'1er trimestre' }, { value:'2', label:'2ème trimestre' }, { value:'3', label:'3ème trimestre' }],
          defaultValue:initial ? String(initial.trimestre || 1) : '1' },
        { name:'poids', label:'Poids dans le trimestre (%)', type:'number', half:true, step:'1', min:'1', max:'100',
          defaultValue:initial ? String(initial.poids || 50) : '50',
          hint:'La moyenne trimestrielle pondère chaque séquence par ce pourcentage.' }
      ]}
      onSubmit={v => { M.saveSequence({ ...v, id: initial ? initial.id : null }); toast('Séquence enregistrée.', 'ok'); }}/>
  );
}

/* ---------- Formulaire appréciation (v6.0 : coll = échelle visée) ---------- */
function AppreciationFormModal({ initial=null, onClose, coll='appreciations' }){
  const { M, toast } = useApp();
  return (
    <FormModal title={initial ? 'Modifier l\u2019appréciation' : 'Nouvelle appréciation'} icon="check"
      fields={[
        { name:'min', label:'Note minimale (incluse)', type:'number', required:true, half:true, step:'0.25', min:'0', max:'20',
          defaultValue:initial ? String(initial.min) : '' },
        { name:'max', label:'Note maximale (exclue)', type:'number', required:true, half:true, step:'0.25', min:'0', max:'20',
          defaultValue:initial ? String(initial.max) : '' },
        { name:'libelle', label:'Appréciation', required:true, maxLength:40, half:true, placeholder:'ex : Assez bien',
          defaultValue:initial ? initial.libelle : '',
          hint:'Exemple : 0–10 Insuffisant, 10–12 Passable, 12–14 Assez bien, 14–16 Bien, 16–18 Très bien, 18–20 Excellent.' }
      ]}
      onSubmit={v => { M.saveAppreciation({ ...v, id: initial ? initial.id : null, coll }); toast('Appréciation enregistrée.', 'ok'); }}/>
  );
}

/* ---------- v6.5 : Devoirs pondérés d'une séquence (administrateur) ---------- */
function DevoirsFormModal({ seq, onClose }){
  const { db, M, toast, confirm, closeModal } = useApp();
  const [rows, setRows] = useState(() => (seq.devoirs && seq.devoirs.length
    ? seq.devoirs.map(d => ({ id:d.id, libelle:String(d.libelle || ''),
        pourcentage:String(d.pourcentage == null ? '' : d.pourcentage) }))
    : []));
  const total = rows.reduce((t, d) => t + (parseFloat(String(d.pourcentage).replace(',', '.')) || 0), 0);
  const maj = (i, champ, val) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [champ]:val } : r)));
  const ajouter = () => setRows(rs => rs.concat([{ id:null, libelle:'Devoir ' + (rs.length + 1), pourcentage:'' }]));
  const retirer = i => setRows(rs => rs.filter((_, j) => j !== i));
  const go = async () => {
    const v = devoirsValides(rows);
    if (!v.ok){ toast(v.msg, 'err'); return; }
    const notes = (db.notes || []).filter(n => String(n.sequence) === String(seq.id));
    const ids = new Set(rows.filter(r => r.id != null && String(r.id) !== '').map(r => String(r.id)));
    const orphelines = notes.filter(n => n.type === 'devoir' && n.devoirId != null && !ids.has(String(n.devoirId))).length;
    const evaluations = rows.length ? notes.filter(n => !(n.type === 'devoir' && n.devoirId != null)).length : 0;
    if (orphelines + evaluations > 0){
      const ok = await confirm('Modifier les devoirs de « ' + seq.libelle + ' » ?',
        (orphelines ? '<b>' + orphelines + '</b> note(s) de devoir seront supprimées (devoir(s) retiré(s) ou séquence remise en saisie directe). ' : '')
        + (evaluations ? '<b>' + evaluations + '</b> note(s) d\u2019évaluation seront annulées : la note séquentielle de cette séquence sera désormais <b>calculée automatiquement</b> depuis les devoirs.' : ''),
        'Appliquer', true);
      if (!ok) return;
    }
    try {
      M.saveDevoirs(seq.id, rows);
      toast(rows.length ? 'Devoirs enregistrés — la note séquentielle sera calculée automatiquement.'
        : 'Devoirs supprimés — saisie directe rétablie.', 'ok');
      closeModal();
    } catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title={'Devoirs de « ' + seq.libelle + ' »'} icon="book" onClose={closeModal}
      footer={<>
        <span className="left" style={{ fontSize:11.5, color: Math.round(total) === 100 || !rows.length ? 'var(--ok)' : 'var(--bad)', fontWeight:700 }}>
          Total : {String(Math.round(total * 10) / 10).replace('.', ',')} %
          {rows.length ? (Math.round(total) === 100 ? ' — correct' : ' — doit faire 100 %') : ' — aucun devoir'}
        </span>
        <button className="btn btn-ghost" onClick={closeModal}>Annuler</button>
        <button className="btn btn-pri" onClick={go}><Ic name="check"/> Enregistrer</button>
      </>}>
      <p style={{ fontSize:12.4, lineHeight:1.6, color:'var(--muted)' }}>
        Définissez les devoirs de cette séquence et leurs pourcentages (le total doit faire <b>100 %</b>).
        Les enseignants saisissent ensuite une note par devoir : la <b>note séquentielle est calculée
        automatiquement</b> (Σ note × pourcentage). Les notes de devoir <b>ne figurent pas dans les
        bulletins</b> — seules les notes séquentielles et trimestrielles y apparaissent. Une séquence
        sans devoir garde sa saisie directe.
      </p>
      {rows.length ? (
        <table className="tbl" style={{ marginTop:10 }}>
          <thead><tr>
            <th>Devoir</th><th className="num" style={{ width:130 }}>Pourcentage</th><th style={{ width:44 }}></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input className="dv-lib" type="text" maxLength={40} value={r.libelle}
                  onChange={e => maj(i, 'libelle', e.target.value)} placeholder="ex : Devoir 1"/></td>
                <td className="num"><input className="dv-pct" type="number" min="1" max="100" step="1" style={{ width:90, textAlign:'right' }}
                  value={r.pourcentage} onChange={e => maj(i, 'pourcentage', e.target.value)}/></td>
                <td className="acts"><button className="icon-btn" title="Retirer ce devoir" onClick={() => retirer(i)}><Ic name="trash"/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding:'14px 0' }}><EmptyState icon="book" title="Aucun devoir"
          text="Cette séquence est notée en saisie directe : une note unique par élève et par matière."/></div>
      )}
      <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={ajouter}><Ic name="plus"/> Ajouter un devoir</button>
    </Modal>
  );
}

/* ---------- Page : Séquences & appréciations ---------- */
export default function Sequences(){
  const { db, can, M, openModal, toast, confirm } = useApp();
  const canW = can('sequences', true);
  const [onglet, setOnglet] = useState('sequences');

  const seqs = sequencesSorted(db);
  /* v6.0 : quatre échelles — notes classiques, notes APC, moyennes classiques,
     moyennes APC. Le mode (classique / APC) est choisi PAR CLASSE (fiche classe). */
  const apps = appreciationsSorted(db);
  const appsApc = appreciationsApcSorted(db);
  const appsMoy = appreciationsMoyenneSorted(db, 'classique');
  const appsMoyApc = appreciationsMoyenneSorted(db, 'apc');
  const nbNotesSeq = id => (db.notes || []).filter(n => String(n.sequence) === String(id)).length;

  const poidsTrim = t => seqs.filter(s => parseInt(s.trimestre, 10) === t).reduce((x, s) => x + (s.poids || 0), 0);

  const supprimerSeq = async sq => {
    const ok = await confirm(`Supprimer « ${sq.libelle} » ?`,
      'Les notes déjà saisies sur cette séquence doivent être annulées au préalable.', 'Supprimer', true);
    if (!ok) return;
    try { M.deleteSequence(sq.id); toast('Séquence supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };
  const supprimerApp = async (a, coll='appreciations') => {
    const ok = await confirm(`Supprimer l'appréciation « ${a.libelle} » (${a.min} – ${a.max}) ?`,
      'Les notes de cette fourchette n\u2019auront plus d\u2019appréciation.', 'Supprimer', true);
    if (!ok) return;
    try { M.deleteAppreciation(a.id, coll); toast('Appréciation supprimée.', 'ok'); } catch(e){ toast(String(e.message || e), 'err'); }
  };
  /* une table d'échelle (classique / APC, notes / moyennes) */
  const EchelleCard = ({ titre, sous, liste, coll, apc=false, compterNotes=false }) => (
    <div className="card">
      <div className="card-h"><h3>{titre}</h3>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span className="mut" style={{ fontSize:11.5 }}>{sous}</span>
          {canW && <button className="btn btn-pri btn-sm" onClick={() => openModal(<AppreciationFormModal coll={coll} onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle appréciation</button>}
        </div></div>
      <div className="card-b" style={{ padding:0 }}>
        {liste.length ? (
          <table className="tbl">
            <thead><tr>
              <th className="num" style={{ width:170 }}>Fourchette / 20</th><th>Appréciation</th>
              {compterNotes && <th className="num" style={{ width:130 }}>Notes concernées</th>}
              {canW && <th style={{ width:90 }}></th>}
            </tr></thead>
            <tbody>
              {liste.map(a => (
                <tr key={a.id}>
                  <td className="num"><b>{String(a.min).replace('.', ',')} – {String(a.max).replace('.', ',')}</b></td>
                  <td><Badge cls={apc
                      ? (/non acquis/i.test(a.libelle) ? 'b-bad' : (/en cours/i.test(a.libelle) ? 'b-warn' : (/expert/i.test(a.libelle) ? 'b-gold' : 'b-ok')))
                      : (a.max <= 10 ? 'b-bad' : (a.max <= 14 ? 'b-warn' : 'b-ok'))}>{a.libelle}</Badge></td>
                  {compterNotes && <td className="num">{(db.notes || []).filter(n => n.valeur >= a.min && n.valeur < a.max).length || <span className="mut">—</span>}</td>}
                  {canW && (
                    <td className="acts">
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<AppreciationFormModal initial={a} coll={coll} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn" title="Supprimer" onClick={() => supprimerApp(a, coll)}><Ic name="trash"/></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="card-b"><EmptyState icon="check" title="Aucune appréciation"
            text="Définissez les fourchettes de notes et leurs appréciations.">
            {canW && <button className="btn btn-pri" onClick={() => openModal(<AppreciationFormModal coll={coll} onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle appréciation</button>}
          </EmptyState></div>}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:12 }}>
        <div className="tabs" role="tablist" aria-label="Sections">
          <button role="tab" aria-selected={onglet === 'sequences'} className={'tab' + (onglet === 'sequences' ? ' on' : '')}
            onClick={() => setOnglet('sequences')}><Ic name="calendar"/> Séquences <span className="mut">({seqs.length})</span></button>
          <button role="tab" aria-selected={onglet === 'notes'} className={'tab' + (onglet === 'notes' ? ' on' : '')}
            onClick={() => setOnglet('notes')}><Ic name="check"/> Appréciations des notes <span className="mut">({apps.length + appsApc.length})</span></button>
          <button role="tab" aria-selected={onglet === 'moyennes'} className={'tab' + (onglet === 'moyennes' ? ' on' : '')}
            onClick={() => setOnglet('moyennes')}><Ic name="star"/> Appréciations des moyennes <span className="mut">({appsMoy.length + appsMoyApc.length})</span></button>
        </div>
        {canW && onglet === 'sequences' && <button className="btn btn-pri" onClick={() => openModal(<SequenceFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle séquence</button>}
      </div>

      {onglet === 'sequences' ? (
        <>
          <div className="kpis">
            {[1, 2, 3].map(t => (
              <Kpi key={t} icon="calendar" val={poidsTrim(t) + ' %'} label={'Trimestre ' + t}
                sub={seqs.filter(s => parseInt(s.trimestre, 10) === t).length + ' séquence(s)'}
                color={poidsTrim(t) === 100 ? 'var(--ok)' : 'var(--bad)'}
                bg={poidsTrim(t) === 100 ? 'var(--ok-bg)' : 'var(--bad-bg)'}/>
            ))}
          </div>
          <div className="card" style={{ marginTop:14 }}>
              <div className="card-h"><h3>Séquences de l'année</h3>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <span className="mut" style={{ fontSize:11.5 }}>Le total des poids par trimestre doit faire 100 % ; les devoirs (optionnels) définissent des notes intermédiaires pondérées</span>
                <PrintListeBtn titre="Séquences de l'année" sous={seqs.length + ' séquence(s)'}
                  colonnes={['Séquence','Trimestre','Poids (%)','Devoirs']}
                  lignes={seqs.map(sq => [sq.libelle, 'T' + sq.trimestre, String(sq.poids),
                    devoirsDe(db, sq).length ? devoirsDe(db, sq).map(d => d.libelle + ' ' + d.pourcentage + ' %').join(' + ') : '—'])}/>
                <CsvBtn filename="sequences.csv" header={['Séquence','Trimestre','Poids (%)','Devoirs']}
                  rows={seqs.map(sq => [sq.libelle, 'T' + sq.trimestre, String(sq.poids),
                    devoirsDe(db, sq).length ? devoirsDe(db, sq).map(d => d.libelle + ' ' + d.pourcentage + ' %').join(' + ') : ''])}/>
              </div></div>
            <div className="card-b" style={{ padding:0 }}>
              {seqs.length ? (
                <table className="tbl">
                  <thead><tr>
                    <th>Séquence</th><th className="num" style={{ width:130 }}>Trimestre</th>
                    <th className="num" style={{ width:150 }}>Poids dans le trimestre</th>
                    <th className="num" style={{ width:170 }}>Devoirs</th>
                    <th className="num" style={{ width:130 }}>Notes saisies</th>
                    {canW && <th style={{ width:118 }}></th>}
                  </tr></thead>
                  <tbody>
                    {seqs.map(sq => {
                      const dv = devoirsDe(db, sq);
                      return (
                        <tr key={sq.id}>
                          <td><b>{sq.libelle}</b></td>
                          <td className="num"><Badge cls="b-navy">T{sq.trimestre}</Badge></td>
                          <td className="num"><Badge cls="b-gold">{sq.poids} %</Badge></td>
                          <td className="num">
                            {dv.length ? (
                              <span title={dv.map(d => d.libelle + ' : ' + d.pourcentage + ' %').join(' • ')}>
                                <Badge cls="b-navy">{dv.length} devoir{dv.length > 1 ? 's' : ''}</Badge>
                                <div className="mut" style={{ fontSize:10.5, marginTop:3 }}>
                                  {dv.map(d => d.pourcentage + ' %').join(' + ')} — note calculée</div>
                              </span>
                            ) : <span className="mut">saisie directe</span>}
                          </td>
                          <td className="num">{nbNotesSeq(sq.id) || <span className="mut">—</span>}</td>
                          {canW && (
                            <td className="acts">
                              <button className="icon-btn" title="Devoirs de la séquence (notes intermédiaires pondérées)"
                                onClick={() => openModal(<DevoirsFormModal seq={sq} onClose={() => {}}/>)}><Ic name="book"/></button>
                              <button className="icon-btn" title="Modifier" onClick={() => openModal(<SequenceFormModal initial={sq} onClose={() => {}}/>)}><Ic name="pencil"/></button>
                              <button className="icon-btn" title="Supprimer" onClick={() => supprimerSeq(sq)}><Ic name="trash"/></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="card-b"><EmptyState icon="calendar" title="Aucune séquence"
                  text="Définissez les périodes de l'année (libellé, trimestre, poids).">
                  {canW && <button className="btn btn-pri" onClick={() => openModal(<SequenceFormModal onClose={() => {}}/>)}><Ic name="plus"/> Nouvelle séquence</button>}
                </EmptyState></div>}
            </div>
          </div>
        </>
      ) : onglet === 'notes' ? (
        <>
          <div className="kpis" style={{ marginTop:0 }}>
            <Kpi icon="check" val={db.classes.filter(c => c.appreciationMode !== 'apc').length + ' classe(s)'}
              label="Mode classique" sub="fourchettes de notes" color="var(--navy-800)" bg="var(--navy-100)"/>
            <Kpi icon="star" val={db.classes.filter(c => c.appreciationMode === 'apc').length + ' classe(s)'}
              label="Mode APC" sub="niveaux de maîtrise" color="#7d6410" bg="var(--gold-100)"/>
            <Kpi icon="info" val="Fiche classe"
              label="Mode par classe" sub="Classique ou APC, au choix pour chaque classe"/>
          </div>
          <EchelleCard titre="Mode CLASSIQUE — appréciation des notes" coll="appreciations" liste={apps} compterNotes
            sous="min ≤ note < max — saisie des notes, bulletins et bordereaux des classes en mode classique"/>
          <div style={{ height:14 }}/>
          <EchelleCard titre="Mode APC — appréciation des notes (Approche Par Compétences)" coll="appreciationsApc" liste={appsApc} apc
            sous="niveaux de maîtrise (Non Acquis, En cours d'acquisition, Acquis, Expert) — classes en mode APC"/>
        </>
      ) : (
        <>
          <EchelleCard titre="Appréciation des MOYENNES — échelle classique" coll="appreciationsMoyenne" liste={appsMoy}
            sous="appliquée aux moyennes générales et par groupe (bulletins, récapitulatifs, mentions) — classes en mode classique"/>
          <div style={{ height:14 }}/>
          <EchelleCard titre="Appréciation des MOYENNES — échelle APC" coll="appreciationsMoyenneApc" liste={appsMoyApc} apc
            sous="mention de travail annuelle des classes en mode APC (ex : En cours d'acquisition)"/>
        </>
      )}
    </>
  );
}

