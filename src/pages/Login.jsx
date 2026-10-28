import React, { useState } from 'react';
import LogoImg from '../assets/logo.png';
import T1 from '../assets/mosaic/t1.jpg';
import T2 from '../assets/mosaic/t2.jpg';
import T3 from '../assets/mosaic/t3.jpg';
import T4 from '../assets/mosaic/t4.jpg';
import T5 from '../assets/mosaic/t5.jpg';
import T6 from '../assets/mosaic/t6.jpg';
import T7 from '../assets/mosaic/t7.jpg';
import T8 from '../assets/mosaic/t8.jpg';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';

/* ---- Diapositives décoratives (vie scolaire) — volet gauche de la connexion ---- */
const SLIDES = [T1, T6, T3, T8, T5, T2, T7, T4];
const SLIDE_S = 5.5; /* durée d'affichage de chaque diapositive (s) */

/* ---- Étoile dorée du drapeau du Cameroun (décorative) ---- */
export function EtoileDoree({ size = 18, className = '' }){
  return (
    <svg className={'lw-star ' + className} width={size} height={size} viewBox="0 0 24 24"
      fill="#fcd116" aria-hidden="true">
      <polygon points="12,2 14.5,8.6 21.5,8.9 16,13.3 17.9,20.1 12,16.2 6.1,20.1 8,13.3 2.5,8.9 9.5,8.6"/>
    </svg>
  );
}

/* ---- Drapeau du Cameroun (SVG embarqué, aucune ressource externe) ---- */
export function FlagCameroun({ w = 42, className = '' }){
  const h = Math.round(w * 2 / 3);
  return (
    <svg className={'cm-flag ' + className} width={w} height={h} viewBox="0 0 30 20" role="img"
      aria-label="Drapeau de la République du Cameroun" preserveAspectRatio="xMidYMid meet">
      <rect width="10" height="20" fill="#007a5e"/>
      <rect x="10" width="10" height="20" fill="#ce1126"/>
      <rect x="20" width="10" height="20" fill="#fcd116"/>
      <path fill="#fcd116" d="M15 6.9 L15.73 9 L17.95 9.04 L16.18 10.38 L16.82 12.51 L15 11.24 L13.18 12.51 L13.82 10.38 L12.05 9.04 L14.27 9 Z"/>
    </svg>
  );
}

/* =====================================================================
   Page de connexion — volontairement ÉPURÉE (style Tailwind : neutre,
   aéré, une seule carte centrée). Aucune indication ne doit trahir un
   compte : pas d'identifiant d'exemple, pas de mention de rôles, pas
   d'information d'infrastructure, message d'erreur unique.
   ===================================================================== */
export default function Login(){
  const { login, toast, persistent, etabsForLogin, serverMode } = useApp();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [etab, setEtab] = useState('auto');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [caps, setCaps] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (!user.trim() || !pass){ setErr('Renseignez votre identifiant et votre mot de passe.'); return; }
    setBusy(true);
    try {
      const res = await login(user, pass, remember, etab);
      if (!res.ok) setErr(res.msg || 'Identifiants incorrects.');
      else toast('Bienvenue ' + res.user.nom, 'ok', 'Session ouverte');
    } catch(e2){
      setErr('Connexion impossible — réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const etabs = Array.isArray(etabsForLogin) ? etabsForLogin : [];

  return (
    <div id="login" className="lw-wrap">
      {/* Volet diapositives — vie scolaire, purement décoratif (aucune information) */}
      <div className="lw-slides" aria-hidden="true">
        {SLIDES.map((t, i) => (
          <img key={i} className="lw-slide" src={t} alt=""
            style={{ animationDelay: (i * SLIDE_S) + 's' }}/>
        ))}
        <span className="lw-scrim"/>
      </div>

      {/* Volet carte — fond vert forêt, couleurs du drapeau sur la carte */}
      <div className="lw-main">
        <span className="lw-seam" aria-hidden="true"/>
        <div className="lw-card">

        <div className="lw-brand">
          <img className="lw-logo" src={LogoImg} alt="Logo Aurel School SIGES"/>
          <h1 className="lw-title">Aurel School <i>SIGES</i></h1>
          <p className="lw-sub">Système Intégré de Gestion des Établissements Scolaires</p>
        </div>

        {err && <div id="li-err" className="lw-err" role="alert"><Ic name="alert"/>{err}</div>}
        {!persistent && <div className="lw-note">Stockage local indisponible — la session vit en mémoire.</div>}
        {/* v6.9 : le repli local n'est plus silencieux — l'utilisateur doit
            savoir que ses données n'iront PAS sur le serveur. */}
        {serverMode === 'local' && <div className="lw-note" id="li-localwarn" style={{ background:'#fdf3d7', borderColor:'#e5c76b', color:'#7a5c0e' }}>Serveur injoignable — <b>mode local de secours</b> : les données seraient enregistrées uniquement dans ce navigateur, pas sur le serveur de l'établissement. Si le serveur vient de démarrer, patientez quelques secondes puis reconnectez-vous.</div>}

        <form onSubmit={submit} noValidate>
          <div className="lw-field">
            <label htmlFor="li-etab">Établissement</label>
            <div className="lw-box">
              <Ic name="bank"/>
              <select id="li-etab" value={etab} onChange={e => setEtab(e.target.value)}>
                <option value="auto">Détection automatique</option>
                {etabs.map(t => (
                  <option key={t.id} value={t.id}>{t.nom}{t.ville ? ' — ' + t.ville : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lw-field">
            <label htmlFor="li-user">Identifiant</label>
            <div className="lw-box">
              <Ic name="user"/>
              <input id="li-user" value={user} onChange={e => setUser(e.target.value)}
                autoComplete="username" autoCapitalize="none" spellCheck="false"/>
            </div>
          </div>

          <div className="lw-field">
            <label htmlFor="li-pass">Mot de passe</label>
            <div className="lw-box">
              <Ic name="lock"/>
              <input id="li-pass" type={showPass ? 'text' : 'password'} value={pass}
                onChange={e => setPass(e.target.value)} autoComplete="current-password"
                onKeyUp={e => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); }}
                onKeyDown={e => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); }}/>
              <button type="button" className="lw-eye" onClick={() => setShowPass(s => !s)}
                title="Afficher / masquer" aria-label="Afficher ou masquer le mot de passe">
                <Ic name={showPass ? 'eye-off' : 'eye'}/>
              </button>
            </div>
            {caps && <span className="lw-caps">⚠ Verr. maj. activé</span>}
          </div>

          <div className="lw-opts">
            <label className="chk">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> Se souvenir de moi
            </label>
            <button type="button" className="lw-forgot"
              onClick={() => toast('Pour réinitialiser votre accès, adressez-vous à l\'administrateur de votre établissement.', 'info', 'Mot de passe oublié')}>
              Mot de passe oublié&nbsp;?
            </button>
          </div>

          <button className="lw-btn" type="submit" disabled={busy}>
            {busy ? 'Connexion…' : <>Se connecter <Ic name="arrow-r"/></>}
          </button>
        </form>

        <div className="lw-sep" aria-hidden="true"><EtoileDoree/></div>

        <div className="lw-foot">
          <span className="lw-flag"><FlagCameroun w={18}/> République du Cameroun — Paix · Travail · Patrie</span>
          <span>Accès strictement réservé au personnel habilité. Toute tentative est enregistrée.</span>
        </div>
        </div>
      </div>
    </div>
  );
}
