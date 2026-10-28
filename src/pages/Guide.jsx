import React, { useMemo, useState } from 'react';
import { Badge, Bar, Modal, Search } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { ROLE_LABEL } from '../core/utils.js';
import { GUIDE_PAGES, ROLE_INTRO, FAQ, premiersPas, etapesDemarrage } from '../core/guide.js';

/* Pages que l'utilisateur peut ouvrir (mêmes règles que le menu) */
export function usePagesAccessibles(){
  const { user, can, isAdmin, etab } = useApp();
  return useMemo(() => Object.keys(GUIDE_PAGES).filter(id => {
    if (!user) return false;
    if (id === 'dashboard') return true;
    if (id === 'etablissements') return user.role === 'superadmin';
    if (id === 'users' || id === 'parametres') return isAdmin();
    if (id === 'journal') return isAdmin() || !!(user.perms && user.perms.journal && user.perms.journal !== 'n');
    return can(id);
  }).filter(id => id === 'etablissements' || !!etab || user.role !== 'superadmin'), [user, can, isAdmin, etab]);
}

function FicheEcran({ id, onOuvrir }){
  const g = GUIDE_PAGES[id];
  if (!g) return null;
  return (
    <div className="gd-fiche">
      <p className="gd-resume">{g.resume}</p>
      <ol className="gd-etapes">{g.etapes.map((t, i) => <li key={i}>{t}</li>)}</ol>
      {g.astuces && g.astuces.map((t, i) => <div key={'a' + i} className="gd-note gd-astuce"><Ic name="info"/><span>{t}</span></div>)}
      {g.attention && g.attention.map((t, i) => <div key={'w' + i} className="gd-note gd-attention"><Ic name="alert"/><span>{t}</span></div>)}
      {onOuvrir && <button className="btn btn-ghost btn-sm" onClick={() => onOuvrir(id)}>Ouvrir « {g.titre} »</button>}
    </div>
  );
}

/* Aide contextuelle : fenêtre ouverte par le bouton « ? » de la barre supérieure */
export function AideEcran({ pageId, onClose }){
  const { go } = useApp();
  const g = GUIDE_PAGES[pageId] || GUIDE_PAGES.dashboard;
  return (
    <Modal icon="info" title={'Aide — ' + g.titre} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        <button className="btn btn-pri" onClick={() => { onClose(); go('guide'); }}><Ic name="book"/> Guide complet</button>
      </>}>
      <FicheEcran id={GUIDE_PAGES[pageId] ? pageId : 'dashboard'}/>
    </Modal>
  );
}

/* Accueil affiché à la première connexion de chaque utilisateur */
export function BienvenueGuide({ onClose }){
  const { user, go } = useApp();
  const pas = premiersPas(user.role).filter(id => GUIDE_PAGES[id]);
  return (
    <Modal icon="book" title={'Bienvenue, ' + (user.nom || user.username)} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Plus tard</button>
        <button className="btn btn-pri" onClick={() => { onClose(); go('guide'); }}><Ic name="book"/> Ouvrir le guide</button>
      </>}>
      <p style={{ marginBottom:10 }}><b>{ROLE_LABEL[user.role] || user.role}</b> — {ROLE_INTRO[user.role] || ''}</p>
      <p className="mut" style={{ marginBottom:8 }}>Les écrans que vous utiliserez le plus :</p>
      <ol className="gd-etapes">{pas.map(id => <li key={id}><b>{GUIDE_PAGES[id].titre}</b> — {GUIDE_PAGES[id].resume}</li>)}</ol>
      <div className="gd-note gd-astuce"><Ic name="info"/><span>Le bouton <b>?</b> en haut de chaque écran explique son fonctionnement. Le guide complet reste accessible dans le menu, rubrique « Aide ».</span></div>
    </Modal>
  );
}

export default function Guide(){
  const { db, anneeId, user, users, etab, go, isAdmin } = useApp();
  const accessibles = usePagesAccessibles();
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const [faqOuverte, setFaqOuverte] = useState(null);

  const etapes = useMemo(() => {
    if (!isAdmin() || !etab) return null;
    const usersEtab = (users || []).filter(u => u.etablissementId === etab.id);
    return etapesDemarrage(db, anneeId, usersEtab);
  }, [db, anneeId, users, etab, isAdmin]);
  const faites = etapes ? etapes.filter(e => e.fait).length : 0;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q.trim());
  const correspond = txt => !nq || norm(txt).includes(nq);
  const ecrans = accessibles.filter(id => {
    const g = GUIDE_PAGES[id];
    return correspond([g.titre, g.resume].concat(g.etapes, g.astuces || [], g.attention || []).join(' '));
  });
  const faq = FAQ.filter(f => correspond(f.q + ' ' + f.r));
  const pas = premiersPas(user.role).filter(id => accessibles.includes(id));

  return (
    <div className="gd">
      <div className="card gd-intro">
        <div className="card-b">
          <h2>Guide d'utilisation</h2>
          <p><b>{ROLE_LABEL[user.role] || user.role}</b> — {ROLE_INTRO[user.role] || ''}</p>
          <Search value={q} onChange={setQ} placeholder="Rechercher dans le guide (ex : reçu, notes, mot de passe)…" style={{ maxWidth:460, marginTop:12 }}/>
        </div>
      </div>

      {!nq && etapes && (
        <div className="card">
          <div className="card-h"><h3><Ic name="check"/> Mise en route de l'établissement</h3>
            <Badge cls={faites === etapes.length ? 'b-ok' : 'b-gold'}>{faites} / {etapes.length}</Badge></div>
          <div className="card-b">
            <Bar pct={Math.round(faites * 100 / etapes.length)}/>
            <ul className="gd-check">
              {etapes.map((e, i) => (
                <li key={e.page} className={e.fait ? 'ok' : ''}>
                  <span className="gd-num">{e.fait ? <Ic name="check"/> : i + 1}</span>
                  <span className="gd-check-t"><b>{e.titre}</b><small>{e.detail}</small></span>
                  <button className="btn btn-ghost btn-sm" onClick={() => go(e.page)}>{e.fait ? 'Voir' : 'Commencer'}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!nq && pas.length > 0 && (
        <div className="card">
          <div className="card-h"><h3><Ic name="target"/> Vos premiers pas</h3></div>
          <div className="card-b gd-pas">
            {pas.map((id, i) => (
              <button key={id} className="gd-pas-i" onClick={() => setOuvert(id)}>
                <span className="gd-num">{i + 1}</span>
                <span><b>{GUIDE_PAGES[id].titre}</b><small>{GUIDE_PAGES[id].resume}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h"><h3><Ic name="book"/> Aide par écran</h3><span className="mut">{ecrans.length} écran(s)</span></div>
        <div className="card-b" style={{ padding:0 }}>
          {ecrans.length === 0 && <p className="mut" style={{ padding:16 }}>Aucun écran ne correspond à « {q} ».</p>}
          {ecrans.map(id => {
            const on = ouvert === id || !!nq;
            return (
              <div key={id} className={'gd-acc' + (on ? ' on' : '')}>
                <button className="gd-acc-h" aria-expanded={on} onClick={() => setOuvert(ouvert === id ? null : id)}>
                  <span>{GUIDE_PAGES[id].titre}</span><Ic name={on ? 'x' : 'plus'}/>
                </button>
                {on && <FicheEcran id={id} onOuvrir={go}/>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3><Ic name="info"/> Questions fréquentes</h3></div>
        <div className="card-b" style={{ padding:0 }}>
          {faq.length === 0 && <p className="mut" style={{ padding:16 }}>Aucune question ne correspond à « {q} ».</p>}
          {faq.map((f, i) => {
            const on = faqOuverte === i || !!nq;
            return (
              <div key={i} className={'gd-acc' + (on ? ' on' : '')}>
                <button className="gd-acc-h" aria-expanded={on} onClick={() => setFaqOuverte(faqOuverte === i ? null : i)}>
                  <span>{f.q}</span><Ic name={on ? 'x' : 'plus'}/>
                </button>
                {on && <div className="gd-fiche"><p>{f.r}</p></div>}
              </div>
            );
          })}
        </div>
      </div>

      {!nq && (
        <div className="card">
          <div className="card-h"><h3><Ic name="users"/> Les profils</h3></div>
          <div className="card-b">
            <table className="tbl gd-roles">
              <thead><tr><th>Profil</th><th>Rôle dans l'application</th></tr></thead>
              <tbody>
                {Object.keys(ROLE_INTRO).map(r => (
                  <tr key={r} className={r === user.role ? 'gd-moi' : ''}>
                    <td><b>{ROLE_LABEL[r] || r}</b>{r === user.role && <> <Badge cls="b-navy">vous</Badge></>}</td>
                    <td>{ROLE_INTRO[r]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
