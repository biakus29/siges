import React, { useState } from 'react';
import { Badge, Avatar, EmptyState, Search, Select, Pager, usePage, CsvBtn, ImportBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, norm, ROLE_SHORT } from '../core/utils.js';
import { yearById, classesSorted, elevesOfYear, situationTotals, yearAggregates, solvabiliteAnnee, statutEleveOf } from '../core/business.js';
import SituationModal from '../components/modals/SituationModal.jsx';
import { EleveFormModal } from '../components/modals/EntityForms.jsx';
import { InscriptionChooserModal, AnciensImportModal } from '../components/modals/Anciens.jsx';
import { DocsConfigModal, DocsDocModal } from './Bulletins.jsx';

export default function Eleves(){
  const { db, anneeId, can, openModal, confirm, M, toast, isAdmin, user } = useApp();
  /* v5.4 : les informations de paiement des élèves sont réservées à l'économe */
  const voitPaiements = !!user && user.role === 'econome';
  const an = yearById(db, anneeId);
  const [q, setQ] = useState('');
  const [classeF, setClasseF] = useState('all');
  const [statutF, setStatutF] = useState('all');
  const [echF, setEchF] = useState('all');
  /* v6.6 : suppression multiple — sélection par cases à cocher */
  const [sel, setSel] = useState(() => new Set());

  if (!an) return <EmptyState icon="calendar" title="Aucune année" text="Sélectionnez une année scolaire."/>;
  const canW = can('eleves', true);

  const ag = yearAggregates(db, an.id);
  const sv = solvabiliteAnnee(db, an.id);
  const scopeCls = useApp().scope.classesIds;   /* v3.0 : périmètre du profil */
  const list = elevesOfYear(db, an.id).filter(e => {
    if (scopeCls && !scopeCls.includes(e.classeId)) return false;
    if (echF === 'retard' && !(sv.parEleve[e.id] && sv.parEleve[e.id].insolvable && e.statut === 'actif')) return false;
    if (classeF !== 'all' && e.classeId !== classeF) return false;
    if (statutF !== 'all' && e.statut !== statutF) return false;
    if (q && norm(e.nom + ' ' + e.prenom + ' ' + e.matricule).indexOf(norm(q)) < 0) return false;
    return true;
  });
  const [page, setPage, rows] = usePage(list, 15);
  /* la sélection ne retient que des élèves visibles (filtres appliqués) */
  React.useEffect(() => { setSel(s => { const ids = new Set(list.map(e => e.id)); const n = new Set([...s].filter(id => ids.has(id))); return n.size === s.size ? s : n; }); }, [list.length, q, classeF, statutF, echF]); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async e => {
    if (!await confirm('Supprimer l\u2019élève ' + e.nom + ' ' + e.prenom + ' ?', 'Cette action est définitive.', 'Supprimer', true)) return;
    try { M.deleteEleve(e.id); toast('Élève supprimé.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  /* v6.6 : suppression multiple */
  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pageIds = rows.map(e => e.id);
  const toutesCochees = pageIds.length > 0 && pageIds.every(id => sel.has(id));
  const togglePage = () => setSel(s => {
    const n = new Set(s);
    if (pageIds.every(id => n.has(id))) pageIds.forEach(id => n.delete(id));
    else pageIds.forEach(id => n.add(id));
    return n;
  });
  const delSel = async () => {
    const noms = list.filter(e => sel.has(e.id)).map(e => e.nom + ' ' + e.prenom);
    if (!noms.length) return;
    const ok = await confirm('Supprimer ' + noms.length + ' élève(s) sélectionné(s) ?',
      (noms.slice(0, 8).join(', ') + (noms.length > 8 ? '…' : '')) +
      '<br/><br/>Cette action est définitive : leurs notes, faits disciplinaires et bourses seront également supprimés.' +
      '<br/>Les élèves ayant des <b>paiements enregistrés</b> seront ignorés (aucun risque de perte comptable).',
      'Supprimer la sélection', true);
    if (!ok) return;
    try {
      const r = M.deleteEleves([...sel]);
      setSel(new Set());
      toast(r.supprimes + ' élève(s) supprimé(s)' + (r.purges ? ' — ' + r.purges + ' donnée(s) associée(s) purgée(s)' : '')
        + (r.ignores ? ' — ' + r.ignores + ' ignoré(s) (paiements enregistrés)' : '') + '.', 'ok');
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  const toggle = e => {
    try { M.toggleEleve(e.id); toast('Élève ' + (e.statut === 'actif' ? 'radié' : 'réactivé') + '.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="users"/> Effectif actif : <b>&nbsp;{fmt(ag.effectif)}</b></span>
        {voitPaiements && <>
        <span className="chip" title="Ayant soldé la totalité des frais obligatoires de l'année"><Ic name="check-circle"/> À jour : <b>&nbsp;{fmt(ag.aJourTotal)}</b></span>
        <span className="chip"><Ic name="alert"/> Avec solde : <b>&nbsp;{fmt(Math.max(0, ag.effectif - ag.aJourTotal))}</b></span>
        <span className="chip chip-bad" title="Au moins un frais obligatoire échu non réglé à la date du jour"><Ic name="alert"/> Insolvables : <b>&nbsp;{fmt(sv.insolvables)}</b></span>
        </>}
        <span style={{ flex:1 }}/>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <Search value={q} onChange={v => { setQ(v); setPage(0); }} placeholder="Nom, prénom ou matricule…" style={{ width:250 }}/>
        <Select value={classeF} onChange={v => { setClasseF(v); setPage(0); }}
          options={[{ value:'all', label:'Toutes les classes' }, ...classesSorted(db)
            .filter(c => !scopeCls || scopeCls.includes(c.id))
            .map(c => ({ value:c.id, label:c.libelle }))]}/>
        <Select value={statutF} onChange={v => { setStatutF(v); setPage(0); }}
          options={[{ value:'all', label:'Tous statuts' }, { value:'actif', label:'Actifs' }, { value:'radie', label:'Radiés' }]}/>
        {voitPaiements && <Select value={echF} onChange={v => { setEchF(v); setPage(0); }}
          options={[{ value:'all', label:'Toutes échéances' }, { value:'retard', label:'Insolvables (échus non réglés)' }]}/>}
        <span style={{ flex:1 }}/>
        <CsvBtn filename={'eleves_' + an.libelle + '.csv'}
          header={voitPaiements
            ? ['Matricule','Nom','Prénom','Sexe','Classe','Statut de scolarité','Tuteur','Téléphone','Statut','Net à payer (FCFA)','Réductions (FCFA)','Payé (FCFA)','Solde (FCFA)','Insolvable']
            : ['Matricule','Nom','Prénom','Sexe','Classe','Statut de scolarité','Tuteur','Téléphone','Statut']}
          rows={list.map(e => {
            const c = db.classes.find(x => x.id === e.classeId);
            const base = [e.matricule, e.nom, e.prenom, e.sexe, c ? c.libelle : '', e.regime === 'interne' ? 'Interne' : 'Externe', e.tuteur || '', e.tel || '',
              e.statut === 'actif' ? 'Actif' : 'Radié'];
            if (!voitPaiements) return base;
            const t = situationTotals(db, e);
            const ins = sv.parEleve[e.id] && sv.parEleve[e.id].insolvable && e.statut === 'actif';
            return base.concat([t.net, t.reduction, t.paye, t.solde, ins ? 'Oui' : 'Non']);
          })}/>
        {canW && <ImportBtn label="Importer des élèves" onRows={(h, rows) => {
          const ix = n => h.findIndex(x => x.toLowerCase().includes(n));
          const iM = ix('matricule'), iN = ix('nom'), iP = ix('prénom') >= 0 ? ix('prénom') : ix('prenom'),
            iS = ix('sexe'), iC = ix('classe'), iT = ix('tél') >= 0 ? ix('tél') : ix('tel'), iTu = ix('tuteur'),
            iR = ix('régime') >= 0 ? ix('régime') : ix('regime');
          let ok = 0, ko = 0;
          rows.forEach(r => {
            try {
              if (iM < 0 || iN < 0 || iP < 0 || !r[iM] || !r[iN] || !r[iP]) throw new Error('colonnes « matricule », « nom » et « prénom » requises');
              const clLib = String(iC >= 0 ? r[iC] : '').trim();
              const cl = clLib ? (db.classes || []).find(c => c.libelle.toLowerCase() === clLib.toLowerCase()) : null;
              if (clLib && !cl) throw new Error('classe inconnue : ' + clLib);
              M.saveEleve({ matricule:r[iM], nom:r[iN], prenom:r[iP],
                sexe:(iS >= 0 && /^f/i.test(r[iS] || '')) ? 'F' : 'M',
                classeId:cl ? cl.id : ((classesSorted(db)[0] || {}).id || ''),
                tel:iT >= 0 ? r[iT] : '', tuteur:iTu >= 0 ? r[iTu] : '',
                regime:(iR >= 0 && /interne/i.test(r[iR] || '')) ? 'interne' : 'externe', statut:'actif' });
              ok++;
            } catch(e){ ko++; }
          });
          return { ok, ko };
        }}/>}
        <button className="btn btn-ghost" title="Certificats de scolarité, cartes scolaires, badges — par classe"
          onClick={() => openModal(<DocsConfigModal classes={classesSorted(db).filter(c => !scopeCls || scopeCls.includes(c.id))}/>)}><Ic name="id"/> Certificats, cartes &amp; badges</button>
        {canW && <button className="btn btn-ghost" onClick={() => openModal(<AnciensImportModal/>)}><Ic name="upload"/> Anciens élèves ({(db.anciens || []).length})</button>}
        {canW && <button className="btn btn-pri" onClick={() => openModal(<InscriptionChooserModal/>)}><Ic name="plus"/> Inscrire un élève</button>}
      </div>
      {canW && sel.size > 0 && (
        <div className="card" style={{ marginBottom:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', borderColor:'var(--bad)' }}>
          <b style={{ fontSize:13 }}>{sel.size} élève(s) sélectionné(s)</b>
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}><Ic name="x"/> Vider la sélection</button>
          <span style={{ flex:1 }}/>
          <button className="btn btn-danger" onClick={delSel}><Ic name="trash"/> Supprimer la sélection…</button>
        </div>
      )}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            {canW && <th style={{ width:34 }}><input type="checkbox" checked={toutesCochees} onChange={togglePage}
              title="Cocher / décocher les élèves de la page" aria-label="Tout cocher sur la page"/></th>}
            <th>Matricule</th><th>Élève</th><th>Classe</th><th>Tuteur</th><th>Statut</th>{voitPaiements && <th className="num">Solde (FCFA)</th>}<th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={(canW ? 1 : 0) + (voitPaiements ? 7 : 6)} className="center mut" style={{ padding:22 }}>Aucun élève trouvé.</td></tr>}
            {rows.map(e => {
              const cl = db.classes.find(c => c.id === e.classeId);
              const tot = situationTotals(db, e);
              const svE = sv.parEleve[e.id];
              const insol = voitPaiements && svE && svE.insolvable && e.statut === 'actif';
              return (
                <tr key={e.id} className={insol ? 'row-late' : ''}>
                  {canW && (
                    <td><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)}
                      aria-label={'Sélectionner ' + e.nom + ' ' + e.prenom}/></td>
                  )}
                  <td className="nowrap"><b>{e.matricule}</b></td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <Avatar name={e.nom + ' ' + e.prenom} sm photo={e.photo}/>
                      <span><b>{e.nom}</b> {e.prenom} <span className="mut">({e.sexe === 'M' ? 'G' : 'F'})</span></span>
                    </div>
                  </td>
                  <td className="nowrap">{cl ? cl.libelle : '—'}</td>
                  <td className="mut nowrap">{e.tuteur}<br/><span style={{ fontSize:11 }}>{e.tel}</span></td>
                  <td>
                    {e.statut === 'actif' ? <Badge cls="b-ok">Actif</Badge> : <Badge cls="b-mut">Radié</Badge>}
                    {' '}<Badge cls={e.regime === 'interne' ? 'b-gold' : 'b-mut'} title={e.regime === 'interne' ? 'Pensionnaire — tarifs internes' : 'Externat — tarifs externes'}>{e.regime === 'interne' ? 'Interne' : 'Externe'}</Badge>
                    {' '}<Badge cls={statutEleveOf(db, e) === 'ancien' ? 'b-navy' : 'b-info'} title={statutEleveOf(db, e) === 'ancien' ? 'Ancien élève — réinscrit ou déjà scolarisé une année antérieure (tarifs « anciens »)' : 'Nouvel élève — première inscription (tarifs « nouveaux »)'}>{statutEleveOf(db, e) === 'ancien' ? 'Ancien' : 'Nouveau'}</Badge>
                  </td>
                  {voitPaiements && <td className="num">
                    {insol && <Badge cls="b-bad" title={(svE.retards || []).map(r => r.libelle + ' : ' + fmt(r.solde) + ' FCFA').join('\n')}>Insolvable</Badge>}
                    {!tot.aJour && <b style={{ color:'var(--bad)' }}>{insol ? ' ' : ''}{fmt(tot.solde)}</b>}
                    {tot.aJour && !insol && <Badge cls="b-ok">À jour</Badge>}
                  </td>}
                  <td className="rowacts">
                    <button className="icon-btn" title="Certificat de scolarité" aria-label={'Certificat de scolarité de ' + e.nom + ' ' + e.prenom}
                      onClick={() => openModal(<DocsDocModal type="certificat" label="Certificat de scolarité" sousTitre={e.nom + ' ' + e.prenom} eleves={[e]}/>)}><Ic name="id"/></button>
                    {voitPaiements && <button className="icon-btn" title="Situation des frais" onClick={() => openModal(<SituationModal eleve={e}/>)}><Ic name="wallet"/></button>}
                    {canW && <>
                      <button className="icon-btn" title="Modifier" onClick={() => openModal(<EleveFormModal initial={e}/>)}><Ic name="pencil"/></button>
                      <button className="icon-btn" title={e.statut === 'actif' ? 'Radier' : 'Réactiver'} onClick={() => toggle(e)}>
                        <Ic name={e.statut === 'actif' ? 'ban' : 'refresh'}/>
                      </button>
                      <button className="icon-btn danger" title="Supprimer" onClick={() => del(e)}><Ic name="trash"/></button>
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager page={page} total={list.length} per={15} onPage={setPage}/>
      </div>
    </>
  );
}
