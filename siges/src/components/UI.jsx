import React, { useEffect, useRef, useState } from 'react';
import LogoImg from '../assets/logo.png';
import { Ic } from './Icons.jsx';
import { fmt, parseMoney, initials, downloadCSV, toCSV , parseCsvText, waLink } from '../core/utils.js';
import { useApp } from '../context/AppContext.jsx';

/* ---------- Logo ---------- */
/* Logo officiel de l'application (blason — image fournie par l'établissement) */
export function Logo({ size=40 }){
  return <img src={LogoImg} alt="Logo" width={size} height={size}
    style={{ flex:'none', objectFit:'contain', borderRadius:Math.max(3, Math.round(size/10)) }}/>;
}

/* ---------- Badges, barres, avatars ---------- */
export function Badge({ children, cls='' }){
  return <span className={'badge ' + cls}>{children}</span>;
}
export function Bar({ pct, cls='' }){
  const p = Math.max(0, Math.min(100, pct));
  return <div className="bar"><i className={cls} style={{ width:p.toFixed(1) + '%' }}/></div>;
}
export function Avatar({ name, sm, style, photo }){
  if (photo) return <img className={'ava photo' + (sm ? ' sm' : '')} style={style} src={photo} alt={name || ''}/>;
  return <span className={'ava' + (sm ? ' sm' : '')} style={style}>{initials(name)}</span>;
}
export function StatChip({ row }){
  if (!row.applicable) return <span className="stat-chip sc-na">non applicable</span>;
  if (row.solde === 0) return <span className="stat-chip sc-ok"><Ic name="check"/> payé</span>;
  if (row.paye > 0) return <span className="stat-chip sc-part">partiel</span>;
  return <span className="stat-chip sc-no">à payer</span>;
}
export function EmptyState({ icon, title, text, children }){
  return (
    <div className="empty">
      <Ic name={icon} className="ic-xl"/>
      <b>{title}</b>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Kpi({ icon, val, label, sub, color, bg }){
  return (
    <div className="kpi" style={{ '--kc':color, '--kbg':bg }}>
      <div className="kico"><Ic name={icon}/></div>
      <div style={{ minWidth:0 }}>
        <div className="kv">{val}</div>
        <div className="kl">{label}</div>
        {sub ? <div className="ks">{sub}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Sélecteur de recherche ---------- */
export function Search({ value, onChange, placeholder, style }){
  return (
    <div className="srch" style={style}>
      <Ic name="search"/>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}
export function Select({ value, onChange, options, style }){
  return (
    <select className="flt" style={style} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ---------- Champ montant ---------- */
export function MoneyInput({ value, onChange, placeholder, id, required, style }){
  const digits = String(value==null?'':value).replace(/[^\d]/g,'').slice(0,9);
  return (
    <div className="mny" style={style}>
      <input id={id} className="money" inputMode="numeric" value={digits} required={required}
        placeholder={placeholder}
        onFocus={e => e.target.select()}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g,'').slice(0,9))}/>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pager({ page, total, per, onPage }){
  const pages = Math.max(1, Math.ceil(total/per));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <span>{fmt(total)} ligne(s) — page {page+1} / {pages}</span>
      <div className="pbtns">
        <button className="btn btn-ghost btn-sm" disabled={page<=0} onClick={()=>onPage(page-1)}><Ic name="chev-l"/> Préc.</button>
        <button className="btn btn-ghost btn-sm" disabled={page>=pages-1} onClick={()=>onPage(page+1)}>Suiv. <Ic name="chev-r"/></button>
      </div>
    </div>
  );
}
export function usePage(list, per){
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(list.length/per));
  const safe = Math.min(page, pages-1);
  return [safe, p => setPage(Math.max(0, p)), list.slice(safe*per, (safe+1)*per)];
}

/* ---------- Fenêtre modale ---------- */
export function Modal({ title, icon='info', wide, slim, onClose, children, footer, staticBackdrop }){
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !staticBackdrop) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, staticBackdrop]);
  return (
    <div className="mback" onMouseDown={e => { if (e.target === e.currentTarget && !staticBackdrop) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '') + (slim ? ' slim' : '')}>
        <div className="m-h">
          <h3><Ic name={icon}/> {title}</h3>
          <button className="m-x" onClick={onClose} title="Fermer"><Ic name="x"/></button>
        </div>
        <div className="m-b">{children}</div>
        {footer ? <div className="m-f">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Notifications ---------- */
export function ToastHost({ toasts }){
  return (
    <div id="toast-root">
      {toasts.map(t => {
        const icon = t.type === 'err' ? 'x-circle' : (t.type === 'info' ? 'info' : 'check-circle');
        return (
          <div key={t.id} className={'toast t-' + t.type}>
            <Ic name={icon}/>
            <div style={{ minWidth:0 }}>
              <b>{t.title}</b>
              <span>{t.msg}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Bouton d'export CSV (modale : téléchargement + copie + aperçu) ---------- */
export function CsvBtn({ filename, header, rows, label='Exporter CSV' }){
  const { openModal } = useApp();
  return (
    <button className="btn btn-ghost btn-sm" title="Exporter les données affichées au format CSV"
      onClick={() => openModal(<CsvExportModal filename={filename} header={header} rows={rows}/>)}>
      <Ic name="download"/> {label}
    </button>
  );
}
/* v5.7 : import d'un fichier CSV (séparateur ; , ou tabulation, guillemets).
   onRows(header, rows) retourne { ok, msg } pour le compte-rendu. */
export function ImportBtn({ label='Importer (CSV)', onRows, icon='upload' }){
  const { toast } = useApp();
  const ref = React.createRef();
  const go = () => ref.current && ref.current.click();
  const pick = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024){ toast('Fichier trop lourd (2 Mo maximum).', 'err'); return; }
    const rd = new FileReader();
    rd.onerror = () => toast('Lecture du fichier impossible.', 'err');
    rd.onload = () => {
      try {
        const { header, rows } = parseCsvText(String(rd.result));
        if (!rows.length){ toast('Aucune ligne de données trouvée dans le fichier.', 'err'); return; }
        const r = onRows(header, rows) || {};
        toast((r.ok ? r.ok : 0) + ' ligne(s) importée(s)' + (r.ko ? ' — ' + r.ko + ' ignorée(s)' : '') + '.', r.ko ? 'info' : 'ok');
      } catch(err){ toast('Import impossible : ' + (err.message || err), 'err'); }
    };
    rd.readAsText(f, 'utf-8');
  };
  return (
    <>
      <input ref={ref} type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display:'none' }} onChange={pick}/>
      <button className="btn btn-ghost btn-sm" title="Importer des données depuis un fichier CSV" onClick={go}>
        <Ic name={icon}/> {label}
      </button>
    </>
  );
}

/* v5.7 : envoi d'un message WhatsApp au contact enregistré (bulletins,
   bilans financiers). waLink normalise le numéro (Cameroun). */
export function WaBtn({ tel, msg, label='WhatsApp', title='Envoyer au parent par WhatsApp', small=true }){
  const { toast } = useApp();
  const go = () => {
    const url = waLink(tel, msg);
    if (!url){ toast('Aucun numéro de téléphone valide enregistré pour le tuteur de cet élève.', 'err'); return; }
    try {
      const w2 = window.open(url, '_blank', 'noopener');
      if (!w2) toast('Autorisez les fenêtres surgissantes pour ouvrir WhatsApp.', 'info');
    } catch(e){ toast('Ouverture de WhatsApp impossible sur ce navigateur.', 'err'); }
  };
  return <button className={'btn btn-ghost' + (small ? ' btn-sm' : '')} style={{ color:'#1d8a4b', fontWeight:700 }} title={title} onClick={go}>
    <Ic name="wa"/> {label}
  </button>;
}

export function CsvExportModal({ filename, header, rows, onClose }){
  const { closeModal, toast } = useApp();
  const close = onClose || closeModal;
  const csv = toCSV(header, rows);
  const dl = () => {
    if (downloadCSV(filename, csv)) toast('Fichier « ' + filename + ' » généré (' + fmt(rows.length) + ' ligne(s)).', 'ok');
    else toast('Téléchargement indisponible — utilisez le bouton Copier.', 'err');
  };
  const copy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(csv); }
      else {
        const ta = document.getElementById('csv-preview');
        ta.select(); document.execCommand('copy');
      }
      toast('Contenu CSV copié (' + fmt(rows.length) + ' ligne(s)) — collez-le dans un tableur.', 'ok');
    } catch(e){ toast('Copie impossible — sélectionnez le contenu manuellement.', 'err'); }
  };
  return (
    <Modal icon="download" title={'Export CSV — ' + filename} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>{fmt(rows.length)} ligne(s) • séparateur « ; » • UTF-8 (Excel)</span>
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-ghost" onClick={copy}><Ic name="copy"/> Copier</button>
          <button className="btn btn-pri" onClick={dl}><Ic name="download"/> Télécharger</button>
        </>
      }>
      <p className="mut" style={{ fontSize:12, marginBottom:10, lineHeight:1.6 }}>
        Si le téléchargement est bloqué (aperçu sécurisé), utilisez <b>Copier</b> puis collez dans Excel / Google Sheets.
      </p>
      <textarea id="csv-preview" className="csv-prev" readOnly value={csv} spellCheck={false}
        onFocus={e => e.target.select()}/>
    </Modal>
  );
}

/* ---------- Logo de marque : logo importé si défini, sinon icône par défaut ---------- */
export function BrandLogo({ size=40 }){
  const { db } = useApp();
  const st = (db && db.settings) || {};
  if (st.logo) return (
    <img src={st.logo} alt={st.nomEtablissement || 'Logo'}
      style={{ height:size, width:'auto', maxWidth:Math.round(size*3.4), objectFit:'contain', borderRadius:6 }}/>
  );
  return <Logo size={size}/>;
}
