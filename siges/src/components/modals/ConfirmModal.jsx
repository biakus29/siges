import React from 'react';
import { Modal } from '../UI.jsx';
import { Ic } from '../Icons.jsx';

/* v5.6 : rendu riche SANS innerHTML — seules les balises <b> et <br>
   des messages sont interprétées ; tout autre contenu (noms, libellés
   importés…) reste du texte inerte : aucune injection HTML possible. */
export function richText(txt){
  const out = [];
  let bold = false, k = 0;
  String(txt == null ? '' : txt).split(/(<\/?b>|<br\s*\/?>)/i).forEach(part => {
    if (/^<b>$/i.test(part)){ bold = true; return; }
    if (/^<\/b>$/i.test(part)){ bold = false; return; }
    if (/^<br\s*\/?>$/i.test(part)){ out.push(<br key={k++}/>); return; }
    if (part !== '') out.push(bold ? <b key={k++}>{part}</b> : part);
  });
  return out;
}

export default function ConfirmModal({ title, msg, okLabel='Confirmer', danger, onEnd }){
  return (
    <Modal slim title={title} icon={danger ? 'alert' : 'info'} onClose={() => onEnd(false)}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEnd(false)}>Annuler</button>
          <button className={'btn ' + (danger ? 'btn-danger' : 'btn-pri')} onClick={() => onEnd(true)}>
            <Ic name="check"/> {okLabel}
          </button>
        </>
      }>
      <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{richText(msg)}</p>
    </Modal>
  );
}
