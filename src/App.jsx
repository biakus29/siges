import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { Sprite, Ic } from './components/Icons.jsx';
import LogoImg from './assets/logo.png';
import { Logo, BrandLogo, Avatar, ToastHost } from './components/UI.jsx';
import { ROLE_SHORT } from './core/utils.js';
import { appliquerTheme } from './core/modeles.js';
import Login from './pages/Login.jsx';
import SyncDiag from './components/modals/SyncDiag.jsx';
import Etablissements from './pages/Etablissements.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Eleves from './pages/Eleves.jsx';
import Paiements from './pages/Paiements.jsx';
import Annees from './pages/Annees.jsx';
import Niveaux from './pages/Niveaux.jsx';
import Classes from './pages/Classes.jsx';
import Frais from './pages/Frais.jsx';
import Grille from './pages/Grille.jsx';
import Users from './pages/Users.jsx';
import Parametres from './pages/Parametres.jsx';
import Journal from './pages/Journal.jsx';
import Bourses from './pages/Bourses.jsx';
import Rapports from './pages/Rapports.jsx';
import Matieres from './pages/Matieres.jsx';
import Enseignants from './pages/Enseignants.jsx';
import Plan from './pages/Plan.jsx';
import Sequences from './pages/Sequences.jsx';
import Notes from './pages/Notes.jsx';
import Bulletins from './pages/Bulletins.jsx';
import Stats from './pages/Stats.jsx';
import Discipline from './pages/Discipline.jsx';
import Guide, { AideEcran, BienvenueGuide } from './pages/Guide.jsx';
import ConfirmModal from './components/modals/ConfirmModal.jsx';
import ChangePwdModal from './components/modals/ChangePwd.jsx';

/* v6.4 — menus regroupés logiquement et de façon cohérente :
   • Scolarité : suivi quotidien des élèves (inscriptions, discipline) ;
   • Finances : encaissements et suivi d'abord, puis paramétrage des frais ;
   • Pédagogie — structure : année, niveaux, classes, matières, enseignants,
     plan des enseignements, séquences (prérequis de la saisie) ;
   • Pédagogie — notes & bilans : saisie des notes, bulletins, statistiques ;
   • Administration : comptes, personnalisation, journal.
   Chaque profil ne voit que les menus autorisés par ses droits. */
const NAV = [
  { id:'dashboard', label:'Tableau de bord', icon:'home' },
  { hdr:'Scolarité' },
  { id:'eleves', label:'Élèves & inscriptions', icon:'users' },
  { id:'discipline', label:'Discipline & absences', icon:'shield' },
  { hdr:'Finances' },
  { id:'paiements', label:'Encaissements', icon:'receipt' },
  { id:'bourses', label:'Bourses & réductions', icon:'coins' },
  { id:'rapports', label:'Rapports financiers', icon:'printer' },
  { id:'frais', label:'Types de frais', icon:'cash' },
  { id:'grille', label:'Grille tarifaire', icon:'grid' },
  { hdr:'Pédagogie — structure' },
  { id:'annees', label:'Années scolaires', icon:'calendar' },
  { id:'niveaux', label:'Niveaux', icon:'layers' },
  { id:'classes', label:'Classes', icon:'classroom' },
  { id:'matieres', label:'Matières', icon:'book' },
  { id:'enseignants', label:'Enseignants', icon:'user' },
  { id:'plan', label:'Plan des enseignements', icon:'grid' },
  { id:'sequences', label:'Séquences & appréciations', icon:'calendar' },
  { hdr:'Pédagogie — notes & bilans' },
  { id:'notes', label:'Saisie des notes', icon:'pencil' },
  { id:'bulletins', label:'Bulletins & rapports', icon:'printer' },
  { id:'stats', label:'Statistiques', icon:'chart' },
  { hdr:'Administration' },
  { id:'users', label:'Utilisateurs & profils', icon:'user' },
  { id:'parametres', label:'Personnalisation des états', icon:'wrench' },
  { id:'journal', label:"Journal d'activité", icon:'activity' },
  { hdr:'Aide' },
  { id:'guide', label:"Guide d'utilisation", icon:'book' }
];
const TITLES = {
  dashboard:  ['Tableau de bord', "Vue d'ensemble des encaissements"],
  bourses:    ['Bourses & réductions', 'Exonérations et remises accordées aux élèves'],
  rapports:   ['Rapports financiers', 'Documents officiels imprimables'],
  eleves:     ['Élèves & inscriptions', 'Effectifs et situations de paiement'],
  paiements:  ['Encaissements', 'Encaissements, reçus et situation des classes'],
  annees:     ['Années scolaires', 'Gestion des exercices et archives'],
  niveaux:    ['Niveaux', 'Regroupements de classes — collège / lycée'],
  classes:    ['Classes', 'Effectifs et capacités par classe'],
  frais:      ['Types de frais', 'Nature des frais, périodicité et obligation'],
  grille:     ['Grille tarifaire', 'Montants des frais par niveau ou par classe'],
  sequences:  ['Séquences & appréciations', 'Trimestres, poids des séquences et fourchettes de notes'],
  users:      ['Utilisateurs & profils', "Comptes, rôles et niveaux d'accès"],
  parametres: ['Personnalisation des états', 'Logo, en-têtes et pieds de page des documents'],
  journal:    ["Journal d'activité", 'Traçabilité des connexions et opérations'],
  etablissements: ['Console réseau', 'Supervision et pilotage de l\u2019ensemble des établissements'],
  matieres:   ['Matières', 'Catalogue des matières et groupes de matières'],
  enseignants:['Enseignants', 'Corps enseignant de l’établissement'],
  plan:       ['Plan des enseignements', 'Matières, enseignants et coefficients par classe'],
  notes:      ['Saisie des notes', 'Évaluations par classe, matière et séquence'],
  bulletins:  ['Bulletins & rapports', 'Moyennes, classements et impressions'],
  stats:      ['Statistiques', 'Moyennes et réussite par matière et par classe'],
  discipline: ['Discipline & absences', 'Faits, absences, sanctions et bilans'],
  guide:      ["Guide d'utilisation", 'Premiers pas, aide par écran et questions fréquentes']
};
const PAGES = { dashboard:Dashboard, eleves:Eleves, paiements:Paiements, annees:Annees,
  niveaux:Niveaux, classes:Classes, frais:Frais, grille:Grille, users:Users, journal:Journal,
  bourses:Bourses, rapports:Rapports, parametres:Parametres, etablissements:Etablissements,
  matieres:Matieres, enseignants:Enseignants, plan:Plan, sequences:Sequences, notes:Notes, bulletins:Bulletins, stats:Stats, discipline:Discipline, guide:Guide };

function ModalHost(){
  const { modalEl } = useApp();
  if (!modalEl) return null;
  if (modalEl.__confirm){
    const c = modalEl;
    return <ConfirmModal title={c.title} msg={c.msg} okLabel={c.okLabel} danger={c.danger} onEnd={c.onEnd}/>;
  }
  return modalEl;
}

/* Écran de maintenance (verrou de licence). Volontairement sobre et neutre :
   l'accès est suspendu jusqu'à la saisie du code fourni par le prestataire. */
function VerrouMaintenance(){
  const { verrou, activerLicence } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const envoyer = async e => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    const r = await activerLicence(code.trim());
    if (!r.ok){ setErr(r.msg || 'Code incorrect.'); setBusy(false); }
  };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'#0f1424',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <form onSubmit={envoyer} style={{ background:'#fff', borderRadius:14, padding:'28px 26px',
        width:'min(420px,92vw)', boxShadow:'0 20px 60px rgba(0,0,0,.45)', textAlign:'center' }}>
        <div style={{ fontSize:40, lineHeight:1, marginBottom:10 }}>🛠️</div>
        <h2 style={{ margin:'0 0 6px', font:'700 18px Tahoma', color:'#2c3a63' }}>Maintenance requise</h2>
        <p style={{ margin:'0 0 16px', font:'13px/1.5 Tahoma', color:'#555' }}>
          L&apos;accès à l&apos;application est momentanément suspendu. Saisissez le
          code de maintenance fourni par votre prestataire pour la réactiver.
        </p>
        <input autoFocus value={code} onChange={e => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX" spellCheck={false}
          style={{ width:'100%', boxSizing:'border-box', textAlign:'center', letterSpacing:2,
            textTransform:'uppercase', font:'700 16px Consolas,monospace', padding:'11px 12px',
            border:'1px solid #c7ccd8', borderRadius:9 }}/>
        {verrou && verrou.ref != null && (
          <div style={{ margin:'10px 0 0', font:'12px Tahoma', color:'#8a8f9c' }}>
            Référence : <b>{verrou.ref}</b>
          </div>
        )}
        {err && <div style={{ margin:'10px 0 0', font:'12px Tahoma', color:'#c0392b' }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ marginTop:16, width:'100%', padding:'11px 0',
          font:'700 14px Tahoma', color:'#fff', background:busy ? '#9aa' : '#2c3a63',
          border:0, borderRadius:9, cursor:busy ? 'default' : 'pointer' }}>
          {busy ? 'Vérification…' : 'Réactiver l’application'}
        </button>
      </form>
    </div>
  );
}

function Root(){
  const app = useApp();
  const { user, db, page, go, anneeId, setAnneeId, isAdmin, can, logout, etabs, etab, setEtab } = app;
  const [burger, setBurger] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);   /* v7.1 : diagnostic de connexion (badge) */
  const [aideOpen, setAideOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [bienvenue, setBienvenue] = useState(false);
  /* accueil du guide à la première connexion de chaque utilisateur (mémorisé sur ce poste) */
  const cleGuide = user ? 'asc_guide_vu_' + user.id : null;
  useEffect(() => {
    if (!cleGuide) return;
    let vu = true;
    try { vu = !!localStorage.getItem(cleGuide); } catch(e){}
    setBienvenue(!vu);
  }, [cleGuide]);
  const fermerBienvenue = () => {
    try { localStorage.setItem(cleGuide, '1'); } catch(e){}
    setBienvenue(false);
  };
  const isSuper = !!user && user.role === 'superadmin';
  const consoleMode = isSuper && !etab;

  if (!user){
    return (
      <>
        <Login/>
        <div id="modal-root"><ModalHost/></div>
        <ToastHost toasts={app.toasts}/>
        {app.verrou && <VerrouMaintenance/>}
      </>
    );
  }

  let safePage = (page === 'users' || page === 'parametres') && !isAdmin() ? 'dashboard'
    : (page !== 'dashboard' && page !== 'guide' && user && user.role !== 'admin' && user.role !== 'superadmin' && !can(page)) ? 'dashboard' : page;
  if (isSuper && page === 'etablissements') safePage = 'etablissements';
  if (consoleMode) safePage = 'etablissements';
  if (safePage === 'etablissements' && !isSuper) safePage = 'dashboard';
  const Page = PAGES[safePage] || Dashboard;
  const title = TITLES[safePage] || TITLES.dashboard;
  const ay = db.annees.find(a => a.active);
  const an = db.annees.find(a => a.id === anneeId);
  const todayN = (() => {
    const t = new Date();
    const tISO = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
    return db.paiements.filter(p => p.anneeId === anneeId && p.statut === 'valide' && p.date.slice(0,10) === tISO).length;
  })();

  return (
    <div id="app">
      <aside id="sidebar" className={burger ? 'open' : ''}>
        <div className="sb-brand">
          <img className="sb-logo" src={LogoImg} alt="Aurel School SIGES"/>
          <div className="lg-t"><b>Aurel School <i>SIGES</i></b><span>{etab ? etab.nom : 'Administration générale'}</span></div>
        </div>
        <nav id="sb-nav">
          {isSuper && (
            <div className={'nav-i nav-super' + (safePage === 'etablissements' ? ' on' : '')}
              onClick={() => { setBurger(false); go('etablissements'); }}>
              <Ic name="bank"/><span>Administration générale</span>
              <span className="cnt">{etabs.length}</span>
            </div>
          )}
          {NAV.map((it, i) => {
            if (it.hdr){
              if (it.hdr === 'Administration' && !isAdmin()) return null;
              if (it.hdr === 'Aide' && !consoleMode) return <div className="nav-g" key={i}>{it.hdr}</div>;
              if (consoleMode) return null;
              /* masquer un groupe dont aucun élément n'est visible pour ce profil */
              const grp = [];
              let j = i + 1;
              while (j < NAV.length && !NAV[j].hdr){ grp.push(NAV[j]); j++; }
              const visible = grp.some(x => (x.id === 'users' || x.id === 'parametres') ? isAdmin() : can(x.id));
              if (!visible) return null;
              return <div className="nav-g" key={i}>{it.hdr}</div>;
            }
            if (consoleMode) return null;
            if ((it.id === 'users' || it.id === 'parametres') && !isAdmin()) return null;
            if (it.id !== 'dashboard' && it.id !== 'guide' && user && user.role !== 'admin' && !can(it.id)) return null;
            let cnt = null;
            if (it.id === 'eleves') cnt = <span className="cnt">{db.eleves.filter(e => e.anneeId === anneeId).length}</span>;
            if (it.id === 'paiements' && todayN) cnt = <span className="cnt">{todayN}</span>;
            if (it.id === 'discipline'){ const dm = (db.discipline || []).filter(f => f.anneeId === anneeId && f.date.slice(0,7) === new Date().toISOString().slice(0,7)).length; if (dm) cnt = <span className="cnt">{dm}</span>; }
            return (
              <div key={it.id} className={'nav-i' + (safePage === it.id ? ' on' : '')} onClick={() => { setBurger(false); go(it.id); }}>
                <Ic name={it.icon}/><span>{it.label}</span>{cnt}
              </div>
            );
          })}
        </nav>
        {isSuper && etab && (
          <select className="sb-etabsel" value={etab.id} onChange={e => setEtab(e.target.value)} title="Changer d'établissement">
            {etabs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        )}
        <div className="sb-foot">v7.0 React — <b>{consoleMode ? 'administration générale' : (ay ? ay.libelle : 'aucune année active')}</b><br/>
          {app.serverMode === 'server' ? 'Serveur API connecté' : (app.persistent ? 'Données locales (navigateur)' : 'Données en mémoire (aperçu)')}</div>
      </aside>

      <div className="main">
        <header id="topbar">
          <button id="burger" className="icon-btn" onClick={() => setBurger(b => !b)} title="Menu"><Ic name="grid"/></button>
          <div className="tb-title">
            <h1>{title[0]}</h1>
            <p>{title[1]}</p>
          </div>
          <div className="tb-right">
            {app.serverMode === 'server' && user && (
              <span id="sync-badge" className={'sync-badge sync-' + app.syncState} role="button" tabIndex={0}
                onClick={() => setDiagOpen(true)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setDiagOpen(true); }}
                title={app.syncState === 'offline'
                  ? 'Serveur injoignable — vos modifications sont en file d\u2019attente. CLIQUEZ pour ouvrir le diagnostic de connexion.'
                  : (app.syncState === 'pending' ? 'Envoi des modifications vers le serveur MySQL… — cliquez pour le diagnostic.' : 'Toutes les données sont enregistrées dans la base MySQL — cliquez pour le diagnostic de connexion.')}>
                {app.syncState === 'offline' ? '⚠ Hors ligne — file d\u2019attente' : (app.syncState === 'pending' ? '⟳ Enregistrement…' : '✓ Base à jour')}
              </span>
            )}
            {!consoleMode && <label className="year-sel">
              <span className="yl">Année</span>
              <select value={anneeId || ''} onChange={e => setAnneeId(e.target.value)}>
                {db.annees.slice().sort((a,b) => a.libelle < b.libelle ? 1 : -1).map(a => (
                  <option key={a.id} value={a.id}>{a.libelle + (a.active ? ' • en cours' : (a.statut === 'cloturee' ? ' — clôturée' : ''))}</option>
                ))}
              </select>
            </label>}
            <div className="user-chip" role="button" tabIndex={0} style={{ cursor:'pointer' }} title="Changer mon mot de passe"
              onClick={() => setPwdOpen(true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPwdOpen(true); }}>
              <Avatar name={user.nom} sm/>
              <div className="uc-t">
                <b>{user.nom}</b>
                <span>{ROLE_SHORT[user.role] || user.role}{etab && isSuper ? ' — ' + etab.nom : ''}</span>
              </div>
            </div>
            <button className="icon-btn gd-help" onClick={() => setAideOpen(true)} title="Aide sur cet écran" aria-label="Aide sur cet écran">?</button>
            <button className="icon-btn" onClick={() => logout(false)} title="Se déconnecter"><Ic name="logout"/></button>
          </div>
        </header>

        {!ay && (
          <div id="year-banner">
            <Ic name="alert"/> Aucune année scolaire active.&nbsp;
            {isAdmin() && <span style={{ cursor:'pointer', textDecoration:'underline', fontWeight:700 }} onClick={() => go('annees')}>Créer ou activer une année</span>}
          </div>
        )}
        {ay && an && an.id !== ay.id && (
          <div id="year-banner">
            <Ic name="info"/> Vous consultez l&apos;année <b>&nbsp;{an.libelle}&nbsp;</b> ({an.statut === 'cloturee' ? 'clôturée' : 'en préparation'}) — données en lecture seule.
            <span style={{ marginLeft:'auto', cursor:'pointer', textDecoration:'underline', fontWeight:700 }} onClick={() => setAnneeId(ay.id)}>Revenir à {ay.libelle}</span>
          </div>
        )}

        <main id="view"><Page/></main>
        <footer className="app-foot">
          <b>Aurel School SIGES</b> — {etab ? etab.nom + ' • ' + [etab.ville, etab.pays].filter(Boolean).join(', ') : 'Administration générale de tous les établissements'}<br/>
          Système intégré de gestion des établissements scolaires • Version React 5.4 • © 2026 — Tous droits réservés
        </footer>
      </div>

      {diagOpen && <SyncDiag onClose={() => setDiagOpen(false)}/>}
      {pwdOpen && <ChangePwdModal onClose={() => setPwdOpen(false)}/>}
      {aideOpen && <AideEcran pageId={safePage} onClose={() => setAideOpen(false)}/>}
      {bienvenue && !aideOpen && <BienvenueGuide onClose={fermerBienvenue}/>}
      <div id="modal-root"><ModalHost/></div>
      <ToastHost toasts={app.toasts}/>
      {app.verrou && <VerrouMaintenance/>}
    </div>
  );
}

/* v6.3 : applique le thème de couleurs défini par l'administrateur */
function ThemeApplier(){
  const { db } = useApp();
  useEffect(() => { appliquerTheme((db.settings || {}).theme); }, [db]);
  return null;
}

export default function App(){
  return (
    <AppProvider>
      <Sprite/>
      <ThemeApplier/>
      <Root/>
    </AppProvider>
  );
}
