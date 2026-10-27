import React from 'react';
import { Modal, } from '../UI.jsx';
import { Ic } from '../Icons.jsx';
import Receipt from '../Receipt.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { printZone } from '../../core/print.js';

export default function ReceiptModal({ p, onClose }){
  const { db, toast, closeModal, users } = useApp();
  const close = onClose || closeModal;
  const doPrint = () => {
    if (!printZone()) toast('Impression impossible dans cet environnement.', 'err');
  };
  return (
    <Modal wide icon="receipt" title={'Reçu ' + p.numero} onClose={close}
      footer={
        <>
          <span className="left" style={{ fontSize:11, color:'var(--faint)' }}>
            <Ic name="info"/> Vérifiez les informations avant de remettre le reçu.
          </span>
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button className="btn btn-pri" onClick={doPrint}><Ic name="printer"/> Imprimer</button>
        </>
      }>
      <Receipt db={db} p={p} users={users}/>
    </Modal>
  );
}
