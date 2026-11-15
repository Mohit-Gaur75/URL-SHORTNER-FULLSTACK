import { useState, useEffect } from "react";
import Modal from "./Modal";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditForm({ link, onSave, onCancel }) {
  const initialExpiry = toLocalInput(link.expiresAt);
  const initialTagsStr = (link.tags || []).join(", ");
  const initialMaxClicks = link.maxClicks != null ? String(link.maxClicks) : "";
  const initialFallback = link.expiredRedirectUrl || "";
  const initialArchived = Boolean(link.isArchived);

  const [originalUrl, setOriginalUrl] = useState(link.originalUrl);
  const [expiry, setExpiry] = useState(initialExpiry);
  const [tags, setTags] = useState(initialTagsStr);
  const [maxClicks, setMaxClicks] = useState(initialMaxClicks);
  const [expiredRedirectUrl, setExpiredRedirectUrl] = useState(initialFallback);
  const [isArchived, setIsArchived] = useState(initialArchived);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    const changes = {};
    if (originalUrl.trim() !== link.originalUrl) {
      changes.originalUrl = originalUrl.trim();
    }
    if (expiry !== initialExpiry) {
      changes.expiresAt = expiry ? new Date(expiry).toISOString() : null;
    }
    if (tags !== initialTagsStr) {
      changes.tags = tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }
    if (maxClicks !== initialMaxClicks) {
      changes.maxClicks = maxClicks.trim() ? parseInt(maxClicks, 10) : null;
    }
    if (expiredRedirectUrl.trim() !== initialFallback) {
      changes.expiredRedirectUrl = expiredRedirectUrl.trim() || null;
    }
    if (isArchived !== initialArchived) {
      changes.isArchived = isArchived;
    }

    if (Object.keys(changes).length === 0) return onCancel();

    setSaving(true);
    setError("");
    try {
      await onSave(changes);
    } catch (err) {
      setError(err.message || "Failed to save link updates");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "18px" }}>
        Short slug <strong style={{ color: "var(--primary)" }}>{link.shortCode}</strong> remains immutable. You can update its destination URL, tags, quotas, fallback redirect, and expiration.
      </p>

      <div className="form-group">
        <label className="form-label" htmlFor="edit-url">
          Destination URL
        </label>
        <input
          id="edit-url"
          type="url"
          className="form-input"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="edit-tags">
          Tags (comma-separated)
        </label>
        <input
          id="edit-tags"
          type="text"
          className="form-input"
          placeholder="e.g. marketing, summer-promo, campaign"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <p className="form-helper">Organize links for quick filtering and grouping.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="form-group">
          <label className="form-label" htmlFor="edit-max-clicks">
            Click Limit / Quota
          </label>
          <input
            id="edit-max-clicks"
            type="number"
            min="1"
            className="form-input"
            placeholder="Unlimited"
            value={maxClicks}
            onChange={(e) => setMaxClicks(e.target.value)}
          />
          <p className="form-helper">Deactivates or redirects after reaching quota.</p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-fallback-url">
            Expired Fallback URL
          </label>
          <input
            id="edit-fallback-url"
            type="url"
            className="form-input"
            placeholder="https://..."
            value={expiredRedirectUrl}
            onChange={(e) => setExpiredRedirectUrl(e.target.value)}
          />
          <p className="form-helper">Redirect here if expired/max clicks reached.</p>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="edit-expiry">
          Link Expiration
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            id="edit-expiry"
            type="datetime-local"
            className="form-input"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setExpiry("")}
            disabled={!expiry}
            style={{ whiteSpace: "nowrap" }}
          >
            Clear Expiry
          </button>
        </div>
        <p className="form-helper">
          {link.isExpired
            ? "This link has expired. Set a future date to re-activate it."
            : "Leave empty for permanent links that never expire."}
        </p>
      </div>

      <div className="form-group" style={{ marginBottom: "20px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)" }}>
          <input
            type="checkbox"
            checked={isArchived}
            onChange={(e) => setIsArchived(e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
          />
          <span>Archive this link (hides from default list view)</span>
        </label>
      </div>

      {error && (
        <div className="alert-error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

export default function EditLinkDialog({ link, onSave, onCancel }) {
  return (
    <Modal open={Boolean(link)} title="Edit Short Link" onClose={onCancel}>
      {link && <EditForm link={link} onSave={onSave} onCancel={onCancel} />}
    </Modal>
  );
}