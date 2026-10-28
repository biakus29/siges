import React, { useMemo, useState } from 'react';
import { Badge, Select, CsvBtn } from '../components/UI.jsx';
import { PrintListeBtn } from '../components/Reports.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, fmtDT } from '../core/utils.js';
import { mergedJournal } from '../core/business.js';

const LBL = { connexion:'Connexion', deconnexion:'Déconnexion', echec:'Échec', paiement:'Paiement', annulation:'Annulation',
  configuration:'Configuration', annee:'Année scolaire', eleve:'Élève', utilisateur:'Utilisateur', bourse:'Bourse',
  suppression:'Suppression', import:'Import', 'pédagogie':'Pédagogie', notes:'Notes', plan:'Plan', etablissement:'Établissement' };

/* v6.6 — périmètre du journal :
   • SUPERADMINISTRATEUR : les actions de TOUT LE MONDE — tous les
     établissements + l'administration générale (journal global), avec un
     filtre par établissement ;
   • ADMINISTRATEUR D'ÉTABLISSEMENT (et autres profils autorisés) : UNIQUEMENT
     les actions de SON établissement — le journal de sa base + les
     connexions / déconnexions de ses propres comptes (le journal global est
     filtré sur les utilisateurs rattachés à l'établissement). */
export default function Journal(){
  const { db, dbRoot, user, etabId, etabs } = useApp();
  const [cat, setCat] = useState('all');
  const [etabF, setEtabF] = useState(etabId || 'all');
  const isSuper = !!user && user.role === 'superadmin';
  const usersRoot = (dbRoot && dbRoot.users) || [];

  const nameOf = j => {
    const u = usersRoot.find(x => x.id === j.uid);
    return u ? u.username : (j.user || '—');
  };

  const entries = useMemo(() => {
    if (isSuper){
      /* superadmin : journal fusionné de tout le réseau */
      return mergedJournal(dbRoot, 250);
    }
    /* établissement : journal de SA base + événements globaux de SES comptes
       (connexions, déconnexions). Les comptes des autres établissements et
       les actions du superadministrateur restent invisibles. */
    const glob = ((dbRoot && dbRoot.journalGlobal) || []).filter(j => {
      const u = usersRoot.find(x => x.id === j.uid);
      return u && u.etablissementId === etabId;
    });
    return (db.journal || []).concat(glob)
      .sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1)
      .slice(0, 250);
  }, [db, dbRoot, isSuper, etabId]);

  const list = useMemo(() => entries
    .filter(j => (isSuper ? (etabF === 'all' || j.etabId === etabF || (etabF === '__gen__' && j.etabId == null)) : true))
    .filter(j => cat === 'all' || j.action === cat)
    .slice(0, 150), [entries, cat, etabF, isSuper]);

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="activity"/> {fmt(entries.length)} événements conservés (250 max)</span>
        {isSuper
          ? <span className="chip" title="Le superadministrateur voit les actions de tous les établissements et de l'administration générale"><Ic name="bank"/> Toutes les actions — tous les établissements</span>
          : <span className="chip" title="Votre périmètre : les actions de votre établissement uniquement"><Ic name="shield"/> Actions de votre établissement uniquement</span>}
        <span style={{ flex:1 }}/>
        <PrintListeBtn titre="Journal d'activité" sous={list.length + ' événement(s) affiché(s)'}
          colonnes={isSuper ? ['Date','Utilisateur','Établissement','Action','Détails'] : ['Date','Utilisateur','Action','Détails']}
          lignes={list.slice(0, 120).map(j => isSuper
            ? [fmtDT(j.date), nameOf(j), j.etabNom || '—', LBL[j.action] || j.action, j.details]
            : [fmtDT(j.date), nameOf(j), LBL[j.action] || j.action, j.details])}/>
        <CsvBtn filename="journal_activite.csv"
          header={isSuper ? ['Date','Utilisateur','Établissement','Action','Détails'] : ['Date','Utilisateur','Action','Détails']}
          rows={list.map(j => isSuper
            ? [j.date, nameOf(j), j.etabNom || '', j.action, j.details]
            : [j.date, nameOf(j), j.action, j.details])}/>
        {isSuper && (
          <Select value={etabF} onChange={setEtabF}
            options={[{ value:'all', label:'Tous les établissements' },
              { value:'__gen__', label:'Administration générale' },
              ...etabs.map(e => ({ value:e.id, label:e.nom }))]}/>
        )}
        <Select value={cat} onChange={setCat}
          options={[{ value:'all', label:'Toutes les actions' }, ...Object.entries(LBL).map(([k,v]) => ({ value:k, label:v }))]}/>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th>Date</th><th>Utilisateur</th>{isSuper && <th>Établissement</th>}<th>Action</th><th>Détails</th>
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={isSuper ? 5 : 4} className="center mut" style={{ padding:22 }}>Aucun événement.</td></tr>}
            {list.map(j => {
              const cls = j.action === 'echec' ? 'b-bad' : (j.action === 'paiement' ? 'b-ok' : (j.action === 'annulation' || j.action === 'suppression' ? 'b-warn' : (j.action === 'bourse' ? 'b-gold' : 'b-info')));
              return (
                <tr key={j.id}>
                  <td className="nowrap mut">{fmtDT(j.date)}</td>
                  <td className="nowrap"><b>{nameOf(j)}</b></td>
                  {isSuper && <td className="nowrap mut">{j.etabNom || '—'}</td>}
                  <td><Badge cls={cls}>{LBL[j.action] || j.action}</Badge></td>
                  <td className="mut">{j.details}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
