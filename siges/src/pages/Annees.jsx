import React from 'react';
import { Badge, CsvBtn } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, fmtD, pctTxt } from '../core/utils.js';
import { yearAggregates } from '../core/business.js';
import { AnneeFormModal } from '../components/modals/EntityForms.jsx';

export default function Annees(){
  const { db, can, openModal, confirm, M, toast, setAnneeId, isAdmin } = useApp();
  const canW = can('annees', true);
  const years = db.annees.slice().sort((a,b) => a.libelle < b.libelle ? 1 : -1);

  const act = async a => {
    if (!await confirm('Activer l\u2019année ' + a.libelle + ' ?',
      'Elle deviendra l\u2019année <b>en cours</b> : l\u2019année actuellement active sera désactivée, et les encaissements se feront sur ' + a.libelle + '.',
      'Activer', false)) return;
    try { M.activateAnnee(a.id); setAnneeId(a.id); toast('Année ' + a.libelle + ' activée.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const close = async a => {
    if (!await confirm('Clôturer l\u2019année ' + a.libelle + ' ?',
      'L\u2019année sera <b>archivée en lecture seule</b> : plus aucun encaissement ne pourra y être enregistré. Les consultations resteront possibles.',
      'Clôturer', true)) return;
    try { M.closeAnnee(a.id); toast('Année ' + a.libelle + ' clôturée et archivée.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const reopen = async a => {
    if (!await confirm('Réouvrir l\u2019année ' + a.libelle + ' ?', 'Elle redeviendra modifiable (grille tarifaire) et pourra être activée.', 'Réouvrir', false)) return;
    try { M.reopenAnnee(a.id); toast('Année ' + a.libelle + ' réouverte.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const del = async a => {
    if (!await confirm('Supprimer l\u2019année ' + a.libelle + ' ?', 'Cette action est définitive (la grille tarifaire associée sera également supprimée).', 'Supprimer', true)) return;
    try { M.deleteAnnee(a.id); toast('Année supprimée.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err', 'Action refusée'); }
  };

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span style={{ flex:1 }}/>
        <CsvBtn filename="annees_scolaires.csv"
          header={['Année','Début','Fin','Statut','Active']}
          rows={db.annees.slice().sort((a,b) => a.libelle < b.libelle ? 1 : -1).map(a => [a.libelle, a.debut, a.fin, a.statut, a.active ? 'Oui' : 'Non'])}/>
        {canW && <button className="btn btn-pri" onClick={() => openModal(<AnneeFormModal/>)}><Ic name="plus"/> Nouvelle année scolaire</button>}
      </div>
      <div className="year-grid">
        {years.map(a => {
          const ag = yearAggregates(db, a.id);
          return (
            <div className={'ycard' + (a.active ? ' on' : '')} key={a.id}>
              <div className="yc-band"/>
              <div className="yc-b">
                <div className="yc-h">
                  <h3>{a.libelle}</h3>
                  {a.active ? <Badge cls="b-gold b-lg">EN COURS</Badge>
                    : (a.statut === 'cloturee' ? <Badge cls="b-mut b-lg">CLÔTURÉE</Badge> : <Badge cls="b-info b-lg">EN PRÉPARATION</Badge>)}
                </div>
                <div className="yc-dates"><Ic name="calendar"/> Du {fmtD(a.debut)} au {fmtD(a.fin)}</div>
                <div className="yc-stats">
                  <div><b>{fmt(ag.effectif)}</b><span>Élèves actifs</span></div>
                  <div><b>{fmt(ag.encaisse)}</b><span>Encaissé (FCFA)</span></div>
                  <div><b>{pctTxt(ag.taux)}</b><span>Recouvrement</span></div>
                </div>
                {canW && (
                  <div className="yc-acts">
                    {!a.active && a.statut === 'ouverte' &&
                      <button className="btn btn-gold btn-sm" onClick={() => act(a)}><Ic name="check"/> Activer</button>}
                    {a.statut === 'ouverte' &&
                      <button className="btn btn-ghost btn-sm" onClick={() => close(a)}><Ic name="lock"/> Clôturer</button>}
                    {a.statut === 'cloturee' &&
                      <button className="btn btn-ghost btn-sm" onClick={() => reopen(a)}><Ic name="refresh"/> Réouvrir</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => openModal(<AnneeFormModal initial={a}/>)}><Ic name="pencil"/> Modifier</button>
                    <button className="btn btn-ghost btn-sm" style={{ color:'var(--bad)' }} onClick={() => del(a)}><Ic name="trash"/></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop:16 }}>
        <div className="card-h"><h3><Ic name="info"/> À propos des années scolaires</h3></div>
        <div className="card-b" style={{ fontSize:'12.3px', color:'var(--muted)', lineHeight:1.7 }}>
          • Une seule année peut être <b>en cours</b> à la fois : c&apos;est la seule qui autorise les encaissements.<br/>
          • À la création d&apos;une nouvelle année, la <b>grille tarifaire</b> et les <b>réinscriptions</b> peuvent être copiées depuis l&apos;année précédente.<br/>
          • Une année <b>clôturée</b> reste consultable (paiements, situations) mais devient une archive en lecture seule.
        </div>
      </div>
    </>
  );
}
