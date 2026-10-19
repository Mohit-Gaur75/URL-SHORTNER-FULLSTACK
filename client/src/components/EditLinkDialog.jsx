import { useState } from "react";
import Modal from "./Modal";

// <input type="datetime-local"> wants "2026-11-30T14:30" in the user's own time zone.
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditForm({ link, onSave, onCancel }) {
  const initialExpiry = toLocalInput(link.expiresAt);
  const [originalUrl, setOriginalUrl] = useState(link.originalUrl);
  const [expiry, setExpiry] = useState(initialExpiry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    // Send ONLY what changed. An already-expired link keeps its old expiry untouched
    // unless the user edits it (sending a past date would be rejected).
    const changes = {};
    if (originalUrl.trim() !== link.originalUrl) changes.originalUrl = originalUrl.trim();
    if (expiry !== initialExpiry) changes.expiresAt = expiry ? new Date(expiry).toISOString() : null;
    if (Object.keys(changes).length === 0) return onCancel();

    setSaving(true);
    setError("");
    try {
      await onSave(changes);
    } catch (err) {
      setError(err.message); // e.g. "Only http and https URLs are allowed": shown inside the dialog
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p className="muted">
        Short link <strong>{link.shortCode}</strong> keeps working: only its destination and expiry can change.
      </p>

      <label htmlFor="edit-url">Destination</label>
      <input id="edit-url" type="text" value={originalUrl} onChange={(e) => setOriginalUrl(e.target.value)} required />

      <label htmlFor="edit-expiry">Expires</label>
      <div className="inline">
        <input id="edit-expiry" type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        <button type="button" className="ghost" onClick={() => setExpiry("")} disabled={!expiry}>Never</button>
      </div>
      <p className="muted small">
        {link.isExpired ? "This link has expired. Choose a new date to bring it back." : "Leave empty for a link that never expires."}
      </p>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}

export default function EditLinkDialog({ link, onSave, onCancel }) {
  return (
    <Modal open={Boolean(link)} title="Edit link" onClose={onCancel}>
      {link && <EditForm link={link} onSave={onSave} onCancel={onCancel} />}
    </Modal>
  );
}
