import { useState } from "react";
import Modal from "./Modal";

function ConfirmBody({ message, confirmLabel, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message); // stay open and say what went wrong
      setBusy(false);
    }
  };

  return (
    <>
      <p>{message}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="danger" onClick={confirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </>
  );
}

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <ConfirmBody message={message} confirmLabel={confirmLabel} onConfirm={onConfirm} onCancel={onCancel} />
    </Modal>
  );
}
