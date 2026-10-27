import React, { useState, useRef, useEffect } from 'react';
import { EmptyState, Badge, Select, Modal } from '../components/UI.jsx';
import { Ic } from '../components/Icons.jsx';
import { useApp } from '../context/AppContext.jsx';
import { settingsOf, SETTINGS_DEFAUT, BULLETIN_DEFAUT, sanctionsAbsOf } from '../core/business.js';
import { TYPES_DOCS, typeDocOf, defaultModele, NOMS_MODELES_DEFAUT, modeleVersJson, modeleDepuisJson, PRESETS_THEME, THEME_DEFAUT } from '../core/modeles.js';
import { ModeleDesigner } from '../components/ModeleDesigner.jsx';
import { makeZip, readZip } from '../core/utils.js';
import { getRev as apiRev, isAvailable, backupGet, backupSettings, backupTest, backupNow } from '../core/api.js';
import { downloadFile } from '../core/utils.js';
import { Logo } from '../components/UI.jsx';

/* Personnalisation des états : logo, en-têtes, pieds de page (administrateur) */
export default function Parametres(){
  const { db, dbRoot, isAdmin, M, toast, confirm, user, openModal, closeModal } = useApp();
  const ok = isAdmin();
  const st = settingsOf(db);

  /* ---------- Sauvegarde / restauration au format ZIP (admin) ---------- */
  const stamp = () => {
    const d = new Date();
    const p = n => (n < 10 ? '0' : '') + n;
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  };
  const exporterZip = () => {
    try {
      const charge = { application:'aurel-school-siges', format:'sauvegarde-zip', version:1, date:new Date().toISOString(), rev:apiRev, db: dbRoot };
      const zip = makeZip([{ name:'aurel-base.json', data:JSON.stringify(charge) }]);
      const okDl = downloadFile('aurel-sauvegarde-' + stamp() + '.zip', zip, 'application/zip');
      const bIds = Object.keys(dbRoot.bases || {});
      const nEl = bIds.reduce((n, k) => n + ((dbRoot.bases[k].eleves || []).length), 0);
      const nPa = bIds.reduce((n, k) => n + ((dbRoot.bases[k].paiements || []).length), 0);
      toast(okDl ? 'Sauvegarde ZIP générée — ' + (dbRoot.etablissements || []).length + ' établissement(s), ' + nEl + ' élève(s), ' + nPa + ' paiement(s).'
                 : 'Archive générée mais le téléchargement est bloqué dans cet aperçu — réessayez dans le navigateur.', okDl ? 'ok' : 'err');
    } catch(err){ toast('Échec de la sauvegarde : ' + (err.message || err), 'err'); }
  };
  const importerZip = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let charge;
      if (/\.json$/i.test(file.name)){
        /* v6.4 : fichier de sauvegarde automatique (.json) — restauration directe */
        charge = JSON.parse(new TextDecoder().decode(await file.arrayBuffer()));
      } else {
        const u8 = new Uint8Array(await file.arrayBuffer());
        const files = await readZip(u8);
        const jsonEntry = files.find(f => f.name.endsWith('.json'));
        if (!jsonEntry) throw new Error('aucun fichier .json trouvé dans l\u2019archive');
        charge = JSON.parse(new TextDecoder().decode(jsonEntry.data));
      }
      if (!charge || !charge.db || !charge.db.users || !charge.db.users.length) throw new Error('archive ne contenant pas de base valide');
      const n = charge.db;
      const bIds = Object.keys(n.bases || {});
      const nb = (n.bases && (bIds.length === 1 ? n.bases[bIds[0]] : null)) || n;
      const cEl = bIds.reduce((a, k) => a + ((n.bases[k].eleves || []).length), 0) || (n.eleves || []).length;
      const cPa = bIds.reduce((a, k) => a + ((n.bases[k].paiements || []).length), 0) || (n.paiements || []).length;
      if (!await confirm('Importer cette base ?',
        'Contenu de l\u2019archive : <b>' + ((n.etablissements || []).length || (bIds.length || 1)) + ' établissement(s)</b>, <b>' + cEl + ' élève(s)</b>, <b>' + cPa + ' paiement(s)</b>, <b>' +
        (n.users || []).length + ' compte(s)</b>.<br/><br/>' +
        '<b>Toutes les données actuelles seront remplacées</b> (y compris les comptes utilisateurs — vous serez peut-être déconnecté).', 'Importer et remplacer', true)) return;
      const r = M.importDb(n);
      toast('Base importée — ' + r.eleves + ' élève(s), ' + r.paiements + ' paiement(s), ' + r.users + ' compte(s).', 'ok');
    } catch(err){ toast('Import impossible : ' + (err.message || err), 'err'); }
  };

  /* Suppression des données de test (élèves, paiements, bourses, journal) */
  const vides = !db.eleves.length && !db.paiements.length && !db.bourses.length;
  const purgerTest = async () => {
    if (!await confirm('Supprimer toutes les données de test ?',
      'Cette action est <b>irréversible</b> : ' + db.eleves.length + ' élève(s) (photos incluses), ' +
      db.paiements.length + ' paiement(s) et ' + db.bourses.length + ' bourse(s) seront définitivement supprimés, ainsi que l\u2019ensemble du journal.<br/><br/>' +
      'La configuration est <b>conservée</b> : années scolaires, niveaux, classes, types de frais, grilles tarifaires, comptes utilisateurs et personnalisation. ' +
      'La numérotation des reçus repartira à 1.', 'Supprimer définitivement', true)) return;
    const r = M.purgerDonneesTest();
    toast('Données de test supprimées — ' + r.eleves + ' élève(s), ' + r.paiements + ' paiement(s), ' + r.bourses + ' bourse(s).', 'ok');
  };
  const [onglet, setOnglet] = useState('etabs');   /* 'etabs' | 'theme' | 'modeles' | 'sauvegarde' */
  /* ---------- v6.4 : sauvegarde automatique (serveur) ---------- */
  const serveur = isAvailable();
  const FREQUENCES = [['1h','Toutes les heures'],['6h','Toutes les 6 heures'],['12h','Toutes les 12 heures'],
    ['24h','Tous les jours'],['7j','Toutes les semaines']];
  const [bk, setBk] = useState(null);          /* { cfg, fichiers } — null = chargement */
  const [bkForm, setBkForm] = useState({ actif:false, dir:'', freq:'24h', garder:10 });
  const [bkErr, setBkErr] = useState('');
  const bkCharge = async () => {
    try {
      const j = await backupGet();
      setBk(j);
      setBkForm({ actif:!!j.cfg.actif, dir:j.cfg.dir || '', freq:j.cfg.freq || '24h', garder:j.cfg.garder || 10 });
      setBkErr('');
    } catch(e){ setBkErr(String(e.message || e)); }
  };
  useEffect(() => { if (onglet === 'sauvegarde' && serveur && bk === null) bkCharge(); }, [onglet, serveur, bk]);
  const bkSet = (k, v) => setBkForm(f => ({ ...f, [k]:v }));
  const bkProchaine = () => {
    if (!bk || !bk.cfg.actif) return '—';
    const heures = { '1h':1, '6h':6, '12h':12, '24h':24, '7j':168 }[bk.cfg.freq] || 24;
    const reste = bk.cfg.derniere + heures * 3600000 - Date.now();
    return reste <= 0 ? 'imminente' : 'dans ~' + Math.ceil(reste / 3600000) + ' h';
  };
  /* ---------- v6.3 : thème de couleurs ---------- */
  const [theme, setTheme] = useState(() => ({ ...THEME_DEFAUT, ...((st && st.theme) || {}) }));
  const themeEstDefaut = theme.primaire.toLowerCase() === THEME_DEFAUT.primaire.toLowerCase() && theme.accent.toLowerCase() === THEME_DEFAUT.accent.toLowerCase();
  const setThemeCouleur = (k, v) => setTheme(t => ({ ...t, preset:'perso', [k]:v }));
  const choisirPreset = p => setTheme({ preset:p.id, primaire:p.primaire, accent:p.accent });
  const saveTheme = () => {
    try {
      M.saveSettings({ theme: themeEstDefaut ? null : { preset: theme.preset, primaire: theme.primaire, accent: theme.accent } });
      toast(themeEstDefaut ? 'Thème par défaut rétabli — l\u2019interface retrouve ses couleurs d\u2019origine.'
                           : 'Thème enregistré — l\u2019interface est recolorée immédiatement.', 'ok');
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  const resetTheme = () => setTheme({ ...THEME_DEFAUT });
  /* ---------- v6.3 : modèles de documents ---------- */
  const [mdType, setMdType] = useState('bulletin');
  const [mdNom, setMdNom] = useState('');
  const modeles = (db.modelesDocs || []);
  const defauts = (db.settings && db.settings.modeleDefaut) || {};
  const creerModele = () => {
    const nom = mdNom.trim() || NOMS_MODELES_DEFAUT[mdType] || '';
    const m = defaultModele(mdType, nom);
    setMdNom('');
    openModal(<ModeleDesigner initial={m} onClose={closeModal}/>);
  };
  const installerModeles = () => {
    try {
      const r = M.installerModelesDefaut();
      toast(r.ajoutes ? r.ajoutes + ' modèle(s) prêt(s) à l\u2019emploi ajouté(s) : bulletin, tableau d\u2019honneur, certificat, carte et badge.'
        : 'Les modèles prêts à l\u2019emploi sont déjà installés.', r.ajoutes ? 'ok' : 'info');
    } catch(e){ toast(String(e.message || e), 'err'); }
  };
  const modifierModele = m => openModal(<ModeleDesigner initial={m} onClose={closeModal}/>);
  const dupliquerModele = m => { const c = defaultModele(m.typeDoc, m.nom + ' (copie)');
    c.periode = m.periode; c.page = JSON.parse(JSON.stringify(m.page));
    c.blocs = JSON.parse(JSON.stringify(m.blocs)).map(b => ({ ...b, id: b.id + '_c' }));
    openModal(<ModeleDesigner initial={c} onClose={closeModal}/>); };
  const exporterModele = m => {
    try {
      const json = modeleVersJson(m);
      const slug = m.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modele';
      const okDl = downloadFile('modele_' + m.typeDoc + '_' + slug + '.json', json, 'application/json');
      toast(okDl ? 'Modèle « ' + m.nom + ' » exporté (JSON).' : 'Export généré mais le téléchargement est bloqué dans cet aperçu.', okDl ? 'ok' : 'err');
    } catch(err){ toast('Export impossible : ' + (err.message || err), 'err'); }
  };
  const importerModele = () => {
    openModal(<ModalImportModele onImporte={m => { closeModal(); openModal(<ModeleDesigner initial={m} onClose={closeModal}/>); }} onClose={closeModal}/>);
  };
  const supprimerModele = async m => {
    const okC = await confirm('Supprimer ce modèle ?', 'Le modèle <b>' + m.nom + '</b> (' + m.blocs.length + ' bloc(s)) sera définitivement supprimé. Les documents reviendront au modèle standard.', 'Supprimer', true);
    if (!okC) return;
    try { M.delModeleDoc(m.id); toast('Modèle « ' + m.nom + ' » supprimé.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const definirDefaut = (m, on) => {
    try { M.saveSettings({ modeleDefaut: { [m.typeDoc]: on ? m.id : '' } });
      toast(on ? '« ' + m.nom + ' » devient le modèle par défaut des ' + (typeDocOf(m.typeDoc) || {}).label.toLowerCase() + 's.'
               : 'Modèle standard rétabli pour ce type de document.', 'ok'); }
    catch(err){ toast(String(err.message || err), 'err'); }
  };
  const [form, setForm] = useState({ ...st });
  /* v5.4 : personnalisation du bulletin (récapitulatif annuel) —
     v5.5 : sections affichées + QR code de sécurité */
  const [bul, setBul] = useState(() => {
    const sv = (st && st.bulletin) || {};
    return { ...BULLETIN_DEFAUT, ...sv, sections:{ ...BULLETIN_DEFAUT.sections, ...(sv.sections || {}) } };
  });
  const setB = (k, v) => setBul(o => ({ ...o, [k]:v }));
  const setBSec = (k, v) => setBul(o => ({ ...o, sections:{ ...o.sections, [k]:v } }));
  /* v5.5 : plages de sanctions d'absences (édition locale puis validation) */
  const [san, setSan] = useState(() => sanctionsAbsOf(db).map(x => ({ ...x })));
  const setSanRow = (i, k, v) => setSan(l => l.map((r, j) => (j === i ? { ...r, [k]:v } : r)));
  const genCode = () => {
    const c = Array.from({ length:16 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    setB('codeSecurite', c);
  };
  const saveSanctions = () => {
    try {
      M.setSanctionsAbs(san);
      toast('Plages de sanctions enregistrées.', 'ok');
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  const [logoMsg, setLogoMsg] = useState('');
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  if (!ok) return <EmptyState icon="lock" title="Accès réservé" text="Seul l'administrateur peut personnaliser les états."/>;

  const onFile = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)){ setLogoMsg('Fichier ignoré : choisissez une image (PNG, JPG, SVG…).'); return; }
    if (file.size > 400 * 1024){ setLogoMsg('Image trop lourde (' + Math.round(file.size/1024) + ' Ko) — 400 Ko maximum.'); return; }
    const rd = new FileReader();
    rd.onload = () => { set('logo', String(rd.result)); setLogoMsg('Logo chargé — pensez à enregistrer.'); };
    rd.onerror = () => setLogoMsg('Lecture du fichier impossible.');
    rd.readAsDataURL(file);
  };

  const save = () => {
    try {
      M.saveSettings({ ...form, bulletin:bul });
      toast('Personnalisation enregistrée — tous les états sont mis à jour.', 'ok');
    } catch(err){ toast(String(err.message || err), 'err'); }
  };
  const resetAll = () => { setForm({ ...SETTINGS_DEFAUT }); setBul({ ...BULLETIN_DEFAUT }); setSan(sanctionsAbsOf({}).map(x => ({ ...x }))); };
  const contact = [form.adresse, form.telephone, form.email].filter(Boolean).join('  •  ');

  const F = ({ k, label, ph, half }) => (
    <div className="field" style={half ? { flex:1, minWidth:210 } : undefined}>
      <label>{label}</label>
      <input value={form[k] || ''} maxLength={160} placeholder={ph} onChange={e => set(k, e.target.value)}/>
    </div>
  );

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        <span className="chip"><Ic name="wrench"/> En-têtes, pieds de page et logo repris sur <b>&nbsp;tous les états et reçus</b></span>
        <span style={{ flex:1 }}/>
        <button className="btn btn-ghost" onClick={resetAll}><Ic name="refresh"/> Valeurs par défaut</button>
        <button className="btn btn-pri" onClick={save}><Ic name="check"/> Enregistrer</button>
      </div>

      <div className="tabs" style={{ marginBottom:14 }} role="tablist" aria-label="Sections de la personnalisation">
        {[['etabs', 'Établissement & états'], ['theme', 'Thème de couleurs'], ['modeles', 'Modèles de documents'], ['sauvegarde', 'Sauvegarde auto']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={onglet === k} className={'tab' + (onglet === k ? ' on' : '')}
            onClick={() => setOnglet(k)}>{l}{k === 'modeles' && modeles.length ? <span className="tab-badge">{modeles.length}</span> : null}</button>
        ))}
      </div>

      {onglet === 'etabs' && (
      <div className="set-grid">
        {/* Logo */}
        <div className="card">
          <div className="card-h"><h3><Ic name="home"/> Logo de l'établissement</h3></div>
          <div className="card-b">
            <div className="logo-prev">
              {form.logo
                ? <img src={form.logo} alt="logo"/>
                : <><Logo size={46}/><span className="mut" style={{ fontSize:11 }}>Logo par défaut (aucun importé)</span></>}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onFile}/>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
                <Ic name="download"/> Importer un logo…
              </button>
              {form.logo && <button className="btn btn-ghost btn-sm" onClick={() => { set('logo', ''); setLogoMsg(''); }}>
                <Ic name="x"/> Retirer le logo
              </button>}
            </div>
            {logoMsg && <p className="mut" style={{ fontSize:11.5, marginTop:8 }}>{logoMsg}</p>}
            <p className="mut" style={{ fontSize:11.3, marginTop:8, lineHeight:1.6 }}>
              PNG, JPG ou SVG — 400 Ko maximum. Le logo remplace l'icône par défaut dans l'en-tête des reçus, rapports et états imprimés.
            </p>
          </div>
        </div>

        {/* Aperçu en-tête */}
        <div className="card">
          <div className="card-h"><h3><Ic name="printer"/> Aperçu de l'en-tête des états</h3></div>
          <div className="card-b" style={{ background:'#f7f9fc' }}>
            <div className="rcp-head" style={{ margin:-4 }}>
              {form.logo
                ? <img className="rcp-logo" src={form.logo} alt=""/>
                : <Logo size={42}/>}
              <div className="rh-t">
                <b>{form.nomEtablissement || '—'}</b>
                <span>{form.sousTitre || '—'}</span>
                <span>{form.mention || '—'}</span>
                {contact && <span className="rh-contact">{contact}</span>}
              </div>
              <div className="rh-n"><span>Document</span><b>APERÇU</b></div>
            </div>
            <p className="mut" style={{ fontSize:11.3, marginTop:10 }}>
              Pied de page des états : <b>{form.piedEtat || '—'}</b>
            </p>
          </div>
        </div>

        {/* Champs */}
        <div className="card" style={{ gridColumn:'1 / -1' }}>
          <div className="card-h"><h3><Ic name="pencil"/> En-tête & pied de page</h3></div>
          <div className="card-b">
            <div className="frow">
              <F k="nomEtablissement" label="Nom de l'établissement *" ph="ex : COLLÈGE BONNEAU" half/>
              <F k="sousTitre" label="Sous-titre" ph="ex : Établissement d'enseignement secondaire catholique" half/>
            </div>
            <div className="frow">
              <F k="mention" label="Mention (service émetteur)" ph="ex : Intendance — Aurel School SIGES" half/>
              <F k="piedEtat" label="Pied de page des états" ph="ex : Document interne — Collège Bonneau" half/>
            </div>
            <div className="frow">
              <F k="adresse" label="Adresse" ph="ex : BP 5124, Yaoundé — Cameroun" half/>
              <F k="telephone" label="Téléphone" ph="ex : (+237) 6 99 00 11 22" half/>
            </div>
            <div className="frow">
              <F k="email" label="Adresse e-mail" ph="ex : intendance@etablissement.cm" half/>
              <div style={{ flex:1 }}/>
            </div>
            <p className="mut" style={{ fontSize:11.3, marginTop:4 }}>
              Les champs vides ne sont simplement pas affichés. Le nom de l'établissement est requis.
            </p>
          </div>
        </div>

        {/* v5.4 : personnalisation du bulletin */}
        <div className="card" style={{ gridColumn:'1 / -1' }}>
          <div className="card-h"><h3><Ic name="printer"/> Bulletin — récapitulatif annuel des notes</h3></div>
          <div className="card-b">
            <p className="mut" style={{ fontSize:11.3, marginBottom:10 }}>
              En-tête, titre, lieu d'édition et signature du bulletin annuel (bouton « Récapitulatif » dans Bulletins &amp; rapports, période « Année complète »).
              Les matières y sont groupées par groupe du plan, avec les notes par séquence, les totaux par groupe et le bilan disciplinaire.
            </p>
            <div className="frow">
              <div className="field" style={{ flex:1, minWidth:220 }}>
                <label>Titre du document</label>
                <input value={bul.titre} maxLength={80} placeholder="RÉCAPITULATIF ANNUEL DES NOTES" onChange={e => setB('titre', e.target.value)}/>
              </div>
              <div className="field" style={{ flex:'0 0 180px' }}>
                <label>Lieu d'édition (« Fait à …, le … »)</label>
                <input value={bul.lieu} maxLength={60} placeholder="ex : Ebolowa" onChange={e => setB('lieu', e.target.value)}/>
              </div>
              <div className="field" style={{ flex:'0 0 220px' }}>
                <label>Signature</label>
                <input value={bul.signature} maxLength={60} placeholder="ex : La Sœur Principale" onChange={e => setB('signature', e.target.value)}/>
              </div>
            </div>
            <div className="frow" style={{ marginTop:8 }}>
              <div className="field" style={{ flex:1, minWidth:240 }}>
                <label>Bloc gauche (en-tête)</label>
                <textarea className="ta" rows={4} value={bul.blocGauche} maxLength={400} onChange={e => setB('blocGauche', e.target.value)}/>
              </div>
              <div className="field" style={{ flex:1, minWidth:240 }}>
                <label>Bloc droit (en-tête)</label>
                <textarea className="ta" rows={4} value={bul.blocDroit} maxLength={400} onChange={e => setB('blocDroit', e.target.value)}/>
              </div>
            </div>
            <p className="mut" style={{ fontSize:11.3, marginTop:6 }}>Une ligne vide sépare chaque ligne des blocs (retour à la ligne conservé à l'impression).</p>

            <div className="clone-g" style={{ marginTop:14 }}>Sections affichées sur le récapitulatif annuel</div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:8 }}>
              {[['bilan', 'Bilan disciplinaire annuel'], ['synthese', 'Synthèse par groupe'], ['rang', 'Rang et moyenne de classe'], ['signatures', 'Zone de signature'], ['effectif', "Effectif de la classe"]].map(([k, label]) => (
                <label key={k} className="chk" style={{ display:'inline-flex', gap:7, cursor:'pointer' }}>
                  <input type="checkbox" checked={bul.sections[k] !== false} onChange={e => setBSec(k, e.target.checked)}/>
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="clone-g" style={{ marginTop:14 }}>QR code de sécurité</div>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'center', marginTop:8 }}>
              <label className="chk" style={{ display:'inline-flex', gap:7, cursor:'pointer' }}>
                <input type="checkbox" checked={bul.qrCode !== false} onChange={e => setB('qrCode', e.target.checked)}/>
                <span>Afficher un QR code de vérification sur les bulletins et récapitulatifs annuels</span>
              </label>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginTop:8 }}>
              <div className="field" style={{ flex:'0 0 240px' }}>
                <label>Code de sécurité de l'établissement</label>
                <input value={bul.codeSecurite || ''} readOnly placeholder="— aucun —" style={{ fontFamily:'monospace', letterSpacing:'.08em' }}/>
              </div>
              <button className="btn btn-ghost" style={{ marginTop:16 }} onClick={genCode}>
                <Ic name="refresh"/> {bul.codeSecurite ? 'Régénérer' : 'Générer'}
              </button>
            </div>
            <span className="hint" style={{ display:'block', marginTop:4 }}>
              Le QR code transporte les chiffres clés du bulletin (élève, période, moyenne, rang) et une signature calculée
              avec ce code. Vérification : page « Bulletins &amp; rapports » → « Vérifier un bulletin ». Sans code de sécurité,
              aucun QR code n'est imprimé.
            </span>
          </div>
        </div>

        {/* v5.5 : sanctions par plages d'absences non justifiées */}
        <div className="card" style={{ gridColumn:'1 / -1' }}>
          <div className="card-h"><h3><Ic name="gavel"/> Discipline — sanctions d'absences</h3></div>
          <div className="card-b">
            <p className="mut" style={{ fontSize:11.3, marginBottom:10 }}>
              Sanction appliquée automatiquement selon le nombre de <b>heures d'absence non justifiées</b> (bilans
              disciplinaires, absences par classe). Les élèves en dessous de la première plage ne sont pas sanctionnés.
            </p>
            <table className="tbl" style={{ maxWidth:640 }}>
              <thead><tr>
                <th style={{ width:120 }}>De (h)</th><th style={{ width:120 }}>À (h)</th><th>Sanction</th><th style={{ width:44 }}></th>
              </tr></thead>
              <tbody>
                {san.map((r, i) => (
                  <tr key={i}>
                    <td><input type="number" min="0" max="998" value={r.min} onChange={e => setSanRow(i, 'min', e.target.value)}/></td>
                    <td><input type="number" min="1" max="999" value={r.max >= 999 ? '' : r.max} placeholder="999" onChange={e => setSanRow(i, 'max', e.target.value === '' ? 999 : e.target.value)}/></td>
                    <td><input value={r.sanction} maxLength={80} onChange={e => setSanRow(i, 'sanction', e.target.value)}/></td>
                    <td className="acts">
                      {san.length > 1 && <button className="icon-btn danger" title="Retirer cette plage" onClick={() => setSan(l => l.filter((_, j) => j !== i))}><Ic name="trash"/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
              <button className="btn btn-ghost" onClick={() => setSan(l => l.concat([{ min:'', max:'', sanction:'' }]))}><Ic name="plus"/> Ajouter une plage</button>
              <button className="btn btn-pri" onClick={saveSanctions}><Ic name="check"/> Enregistrer les plages</button>
            </div>
            <span className="hint" style={{ display:'block', marginTop:6 }}>
              Plages sans chevauchement (ex. 3–5, 6–9, 10–14, 15 et plus). Laisser « À » vide ou 999 = sans limite haute.
            </span>
          </div>
        </div>

        {/* Sauvegarde & restauration */}
        <div className="card" style={{ gridColumn:'1 / -1' }}>
          <div className="card-h"><h3><Ic name="shield"/> Sauvegarde &amp; restauration</h3></div>
          <div className="card-b">
            <p style={{ fontSize:12.5, lineHeight:1.65, color:'var(--muted)' }}>
              Exportez la base complète au format <b>ZIP</b> (élèves, paiements, bourses, configuration, comptes,
              personnalisation) pour l'archiver ou la transférer sur un autre poste. L'import remplace
              <b> l'intégralité des données actuelles</b> par celles de l'archive.
            </p>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginTop:12 }}>
              <button className="btn btn-pri" onClick={exporterZip}>
                <Ic name="download"/> Exporter la base (ZIP)
              </button>
              <label className="btn btn-ghost" style={{ cursor:'pointer' }}>
                <Ic name="upload"/> Importer une base (ZIP ou JSON)
                <input type="file" accept=".zip,.json,application/zip,application/json" style={{ display:'none' }} onChange={importerZip}/>
              </label>
              <span className="mut" style={{ fontSize:11 }}>
                {user ? 'Dernier état : ' + db.eleves.length + ' élève(s) • ' + db.paiements.length + ' paiement(s)' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Données de test */}
        <div className="card" style={{ gridColumn:'1 / -1', borderColor:'#e8c9c9' }}>
          <div className="card-h"><h3 style={{ color:'var(--bad)' }}><Ic name="alert"/> Données de test</h3></div>
          <div className="card-b">
            <p style={{ fontSize:12.5, lineHeight:1.65, color:'var(--muted)' }}>
              Avant d'utiliser l'application en production, supprimez le jeu de démonstration :
              élèves (photos incluses), paiements et reçus, bourses, ainsi que le journal des opérations.
              La <b>configuration est conservée</b> — années scolaires, niveaux, classes, types de frais,
              grilles tarifaires, comptes utilisateurs et personnalisation des états.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'12px 0 14px' }}>
              <Badge cls="b-navy">{db.eleves.length} élève(s)</Badge>
              <Badge cls="b-info">{db.paiements.length} paiement(s)</Badge>
              <Badge cls="b-gold">{db.bourses.length} bourse(s)</Badge>
              <Badge cls="b-bad">journal complet</Badge>
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <button className="btn btn-danger" onClick={purgerTest} disabled={vides}>
                <Ic name="trash"/> Supprimer les données de test
              </button>
              <span className="mut" style={{ fontSize:11 }}>
                {vides ? 'Aucune donnée à supprimer — base déjà vide.' : 'Action irréversible — demandez une confirmation.'}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {onglet === 'theme' && (
        <div className="card">
          <div className="card-h"><h3><Ic name="wrench"/> Thème de couleurs de l'application</h3></div>
          <div className="card-b">
            <p className="mut" style={{ fontSize:11.5, marginBottom:12, lineHeight:1.6 }}>
              Définissez la couleur <b>primaire</b> (menus, boutons, titres) et la couleur d'<b>accent</b> (surbrillance, badges)
              de l'application. Les nuances intermédiaires sont calculées automatiquement. Le thème s'applique à toute
              l'interface dès l'enregistrement — les documents imprimés conservent leur présentation sobre.
            </p>
            <div className="clone-g">Palettes proposées</div>
            <div className="theme-presets">
              {PRESETS_THEME.map(p => (
                <button key={p.id} className={'theme-preset' + (theme.primaire.toLowerCase() === p.primaire && theme.accent.toLowerCase() === p.accent ? ' on' : '')}
                  onClick={() => choisirPreset(p)} title={p.primaire + ' / ' + p.accent}>
                  <span className="tp-ech"><i style={{ background:p.primaire }}/><i style={{ background:p.accent }}/></span>
                  <span className="tp-l">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="clone-g" style={{ marginTop:14 }}>Couleurs personnalisées</div>
            <div className="frow" style={{ alignItems:'flex-end' }}>
              <div className="field" style={{ width:170 }}>
                <label>Couleur primaire</label>
                <input aria-label="Couleur primaire" type="color" value={theme.primaire} onChange={e => setThemeCouleur('primaire', e.target.value)}/>
              </div>
              <div className="field" style={{ width:170 }}>
                <label>Couleur d'accent</label>
                <input aria-label="Couleur d'accent" type="color" value={theme.accent} onChange={e => setThemeCouleur('accent', e.target.value)}/>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn btn-ghost" onClick={resetTheme}><Ic name="refresh"/> Valeurs par défaut</button>
                <button className="btn btn-pri" onClick={saveTheme}><Ic name="check"/> Enregistrer le thème</button>
              </div>
            </div>
            <div className="theme-apercu" style={{ marginTop:16 }}>
              <div className="ta-sidebar" style={{ background:'var(--navy-900)' }}>
                <div className="ta-brand" style={{ color:'#fff' }}>Aurel School</div>
                <div className="ta-item" style={{ background:'var(--gold-600)' }}>Tableau de bord</div>
                <div className="ta-item" style={{ color:'rgba(255,255,255,.82)' }}>Élèves &amp; inscriptions</div>
                <div className="ta-item" style={{ color:'rgba(255,255,255,.82)' }}>Saisie des notes</div>
              </div>
              <div className="ta-corps">
                <div className="ta-btn" style={{ background:'var(--navy-800)' }}>Bouton principal</div>
                <div className="ta-btn" style={{ background:'var(--gold-600)' }}>Accent</div>
                <div className="ta-kpi" style={{ borderColor:'var(--navy-100)' }}><b style={{ color:'var(--navy-800)' }}>14,5</b> Moyenne</div>
              </div>
            </div>
            <p className="mut" style={{ fontSize:11, marginTop:10 }}>
              Aperçu mis à jour après enregistrement {themeEstDefaut ? '(thème actuel : celui par défaut)' : '(thème actuel : personnalisé)'}.
            </p>
          </div>
        </div>
      )}

      {onglet === 'sauvegarde' && (
        <div className="card">
          <div className="card-h"><h3><Ic name="shield"/> Sauvegarde automatique de la base</h3></div>
          <div className="card-b">
            {!serveur ? (
              <EmptyState icon="shield" title="Fonctionnalité du mode serveur"
                text="La sauvegarde automatique s'exécute sur le serveur (PHP + MySQL). Elle est inactive lorsque l'application fonctionne en mode local sur un poste unique. Déployez l'application avec son serveur PHP pour en bénéficier."/>
            ) : (
              <>
                <p className="mut" style={{ fontSize:11.5, marginBottom:12, lineHeight:1.6 }}>
                  Sauvegarde complète de la base (établissements, élèves, paiements, notes, comptes, réglages) vers le
                  répertoire de votre choix — <b>local ou réseau</b> (ex. \\SERVEUR\partage\sauvegardes ou /mnt/backup).
                  L'exécution est automatique à la fréquence choisie ; seul l'administrateur y accède.
                </p>
                {bkErr && <p style={{ color:'var(--bad)', fontSize:12, marginBottom:10 }}>{bkErr}</p>}
                {bk && (
                  <p className="mut" style={{ fontSize:11.5, marginBottom:12 }}>
                    État : <b style={{ color: bk.cfg.actif ? 'var(--ok)' : 'var(--bad)' }}>{bk.cfg.actif ? 'active' : 'inactive'}</b>
                    {' '}• dernière sauvegarde : <b>{bk.cfg.derniere ? new Date(bk.cfg.derniere * 1000).toLocaleString('fr-FR') : 'jamais'}</b>
                    {' '}• prochaine : <b>{bkProchaine()}</b>
                    {' '}• {bk.fichiers.length} fichier(s) conservé(s).
                  </p>
                )}
                <div className="frow">
                  <div className="field" style={{ flex:2, minWidth:260 }}>
                    <label>Répertoire des sauvegardes (local ou réseau)</label>
                    <input aria-label="Répertoire des sauvegardes" value={bkForm.dir} maxLength={200}
                      placeholder="ex : C:\sauvegardes-aurel ou \\SERVEUR\partage\aurel" onChange={e => bkSet('dir', e.target.value)}/>
                  </div>
                  <div className="field" style={{ flex:'0 0 190px' }}>
                    <label>Fréquence</label>
                    <select aria-label="Fréquence de sauvegarde" value={bkForm.freq} onChange={e => bkSet('freq', e.target.value)}>
                      {FREQUENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ flex:'0 0 130px' }}>
                    <label>Copies conservées</label>
                    <input aria-label="Copies conservées" type="number" min="1" max="100" value={bkForm.garder}
                      onChange={e => bkSet('garder', Math.max(1, Math.min(100, Number(e.target.value) || 1)))}/>
                  </div>
                </div>
                <label className="chk" style={{ display:'inline-flex', gap:7, cursor:'pointer', margin:'6px 0 12px' }}>
                  <input type="checkbox" checked={bkForm.actif} onChange={e => bkSet('actif', e.target.checked)}/>
                  <span>Activer la sauvegarde automatique (une première sauvegarde est faite à l'activation)</span>
                </label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button className="btn btn-ghost" disabled={!bkForm.dir.trim()}
                    onClick={async () => { const r = await backupTest(bkForm.dir.trim());
                      toast(r.ok ? r.msg : 'Test échoué : ' + r.msg, r.ok ? 'ok' : 'err'); }}>
                    <Ic name="check-circle"/> Tester le répertoire</button>
                  <button className="btn btn-ghost" disabled={!bkForm.actif || !bkForm.dir.trim()}
                    onClick={async () => { const r = await backupNow();
                      if (r.ok){ toast('Sauvegarde créée : ' + r.fichier + ' (' + Math.round(r.taille / 1024) + ' Ko).', 'ok'); bkCharge(); }
                      else toast('Sauvegarde impossible : ' + r.msg, 'err'); }}>
                    <Ic name="download"/> Sauvegarder maintenant</button>
                  <button className="btn btn-pri"
                    onClick={async () => { const r = await backupSettings(bkForm);
                      if (r.ok){ setBk({ cfg:r.cfg, fichiers:r.fichiers }); setBkForm({ actif:!!r.cfg.actif, dir:r.cfg.dir, freq:r.cfg.freq, garder:r.cfg.garder });
                        toast(r.cfg.actif ? 'Sauvegarde automatique enregistrée et activée.' : 'Sauvegarde automatique désactivée.', 'ok');
                        if (r.premiere && r.premiere.ok) toast('Première sauvegarde créée : ' + r.premiere.fichier, 'ok'); }
                      else toast('Enregistrement impossible : ' + r.msg, 'err'); }}>
                    <Ic name="check"/> Enregistrer</button>
                </div>
                {bk && bk.fichiers.length > 0 && (
                  <table className="tbl" style={{ marginTop:14, maxWidth:640 }}>
                    <thead><tr><th>Fichier</th><th style={{ width:110, textAlign:'center' }}>Taille</th><th style={{ width:150 }}>Date</th></tr></thead>
                    <tbody>
                      {bk.fichiers.map(f => (
                        <tr key={f.nom}><td style={{ fontFamily:'monospace', fontSize:11.5 }}>{f.nom}</td>
                          <td style={{ textAlign:'center' }}>{Math.max(1, Math.round(f.taille / 1024))} Ko</td>
                          <td>{f.date}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mut" style={{ fontSize:11, marginTop:10, lineHeight:1.6 }}>
                  Restauration : onglet « Établissement & états » → <b>Importer une base (ZIP ou JSON)</b> — sélectionnez
                  un fichier <code>aurel-sauvegarde-*.json</code> de ce répertoire. L'import remplace la base actuelle
                  (confirmation demandée).
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {onglet === 'modeles' && (
        <>
          <div className="card">
            <div className="card-h"><h3><Ic name="copy"/> Modèles de documents — concepteur intégré</h3></div>
            <div className="card-b">
              <p className="mut" style={{ fontSize:11.5, marginBottom:12, lineHeight:1.6 }}>
                Créez des modèles entièrement personnalisés pour les <b>bulletins</b> (séquence, trimestre, année),
                les <b>tableaux d'honneur</b>, les <b>certificats de scolarité</b>, les <b>badges</b> et les
                <b> cartes scolaires</b> : disposition libre des champs (position au millimètre), polices, tailles,
                alignements, couleurs, ajout / modification / suppression de champs, tableaux de notes configurables,
                import et export JSON. Le <b>modèle standard</b> reste disponible partout ; chaque modèle peut être
                défini par défaut pour son type de document.
              </p>
              <div className="frow" style={{ alignItems:'flex-end' }}>
                <div className="field" style={{ minWidth:210 }}>
                  <label>Type de document</label>
                  <Select value={mdType} onChange={setMdType}
                    options={TYPES_DOCS.map(t => ({ value:t.id, label:t.label }))}/>
                </div>
                <div className="field" style={{ flex:1, minWidth:240 }}>
                  <label>Nom du nouveau modèle</label>
                  <input aria-label="Nom du nouveau modèle" value={mdNom} maxLength={80} placeholder={NOMS_MODELES_DEFAUT[mdType] || 'Nom du modèle'}
                    onChange={e => setMdNom(e.target.value)}/>
                </div>
                <button className="btn btn-pri" onClick={creerModele}><Ic name="plus"/> Créer avec le concepteur</button>
                <button className="btn btn-ghost" onClick={importerModele}><Ic name="upload"/> Importer (JSON)…</button>
              </div>
              <div className="gd-note gd-astuce" style={{ marginTop:12, alignItems:'center' }}>
                <Ic name="info"/>
                <span style={{ flex:1 }}>Pour démarrer vite : ajoutez les <b>modèles prêts à l'emploi</b> (bulletin, tableau d'honneur,
                  certificat, carte et badge), avec logo, photo, QR code et signatures déjà placés. Vous pourrez ensuite les modifier.</span>
                <button className="btn btn-gold btn-sm" onClick={installerModeles}><Ic name="plus"/> Ajouter les modèles prêts à l'emploi</button>
              </div>
            </div>
          </div>
          <div className="card" style={{ marginTop:14 }}>
            <div className="card-h"><h3>Modèles enregistrés ({modeles.length})</h3></div>
            <div className="card-b" style={{ padding:0 }}>
              {!modeles.length ? (
                <div style={{ padding:22 }}><EmptyState icon="copy" title="Aucun modèle personnalisé"
                  text="Les documents utilisent le modèle standard, conforme au modèle officiel de l'établissement. Créez un modèle pour personnaliser la disposition, les polices et les champs."/></div>
              ) : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr>
                      <th>Nom</th><th style={{ width:170 }}>Document</th><th style={{ width:130 }}>Période</th>
                      <th style={{ width:64, textAlign:'center' }}>Blocs</th><th style={{ width:96 }}>Défaut</th><th style={{ width:250 }}></th>
                    </tr></thead>
                    <tbody>
                      {modeles.map(m => (
                        <tr key={m.id}>
                          <td><b>{m.nom}</b></td>
                          <td>{(typeDocOf(m.typeDoc) || {}).label || m.typeDoc}</td>
                          <td>{m.typeDoc === 'bulletin' || m.typeDoc === 'honneur'
                            ? ({ sequence:'Séquence', trimestre:'Trimestre', annee:'Année complète', tous:'Toutes' })[m.periode] || 'Toutes' : '—'}</td>
                          <td style={{ textAlign:'center' }}>{m.blocs.length}</td>
                          <td>{defauts[m.typeDoc] === m.id ? <Badge cls="b-gold">Par défaut</Badge> : <span className="mut">—</span>}</td>
                          <td className="acts">
                            <button className="btn btn-pri btn-sm" onClick={() => modifierModele(m)}><Ic name="pencil"/> Modifier</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => dupliquerModele(m)}><Ic name="copy"/> Dupliquer</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => exporterModele(m)}><Ic name="download"/> Exporter</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => definirDefaut(m, defauts[m.typeDoc] !== m.id)}>
                              {defauts[m.typeDoc] === m.id ? 'Retirer défaut' : 'Par défaut'}
                            </button>
                            <button className="icon-btn danger" title="Supprimer ce modèle" onClick={() => supprimerModele(m)}><Ic name="trash"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card-f">
              <Ic name="info"/> L'import accepte un JSON exporté depuis cette page (bouton « Exporter ») — le modèle importé
              s'ouvre dans le concepteur pour ajustement avant enregistrement.
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Fenêtre d'import d'un modèle (JSON collé) ---------- */
function ModalImportModele({ onImporte, onClose }){
  const { toast } = useApp();
  const [txt, setTxt] = useState('');
  const go = () => {
    try { const m = modeleDepuisJson(txt); toast('Modèle « ' + m.nom + ' » lu — ajustez-le puis enregistrez.', 'ok'); onImporte(m); }
    catch(e){ toast(String(e.message || e), 'err'); }
  };
  return (
    <Modal title="Importer un modèle de document" icon="upload" onClose={onClose}
      footer={<>
        <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>Le modèle s'ouvre ensuite dans le concepteur.</span>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-pri" disabled={!txt.trim()} onClick={go}><Ic name="upload"/> Importer</button>
      </>}>
      <p style={{ fontSize:12.5, color:'var(--muted)', marginBottom:10 }}>
        Collez ci-dessous le contenu du fichier JSON exporté depuis Aurel School SIGES (bouton « Exporter » d'un modèle).
      </p>
      <textarea className="ta" aria-label="JSON du modèle" rows={10} value={txt} style={{ fontFamily:'monospace', fontSize:11.5 }}
        placeholder='{ "application": "aurel-school-siges", "format": "modele-document", … }'
        onChange={e => setTxt(e.target.value)}/>
    </Modal>
  );
}
