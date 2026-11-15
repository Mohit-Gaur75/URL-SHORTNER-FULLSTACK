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
  const initialPasswordProtected = Boolean(link.isPasswordProtected);
  const initialMetaTitle = link.metaTitle || "";
  const initialMetaDescription = link.metaDescription || "";
  const initialMetaImage = link.metaImage || "";
  const initialTargetingRules = link.targetingRules || [];

  const [originalUrl, setOriginalUrl] = useState(link.originalUrl);
  const [expiry, setExpiry] = useState(initialExpiry);
  const [tags, setTags] = useState(initialTagsStr);
  const [maxClicks, setMaxClicks] = useState(initialMaxClicks);
  const [expiredRedirectUrl, setExpiredRedirectUrl] = useState(initialFallback);
  const [isArchived, setIsArchived] = useState(initialArchived);
  const [isPasswordProtected, setIsPasswordProtected] = useState(initialPasswordProtected);
  const [linkPassword, setLinkPassword] = useState("");
  const [metaTitle, setMetaTitle] = useState(initialMetaTitle);
  const [metaDescription, setMetaDescription] = useState(initialMetaDescription);
  const [metaImage, setMetaImage] = useState(initialMetaImage);
  const [showMeta, setShowMeta] = useState(Boolean(initialMetaTitle || initialMetaDescription || initialMetaImage));
  const [targetingRules, setTargetingRules] = useState(initialTargetingRules);
  const [showTargeting, setShowTargeting] = useState(Boolean(initialTargetingRules.length > 0));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAddRule = () => {
    setTargetingRules([...targetingRules, { type: "device", target: "ios", destination: "" }]);
  };

  const handleUpdateRule = (index, field, val) => {
    const updated = [...targetingRules];
    updated[index][field] = val;
    setTargetingRules(updated);
  };

  const handleRemoveRule = (index) => {
    setTargetingRules(targetingRules.filter((_, i) => i !== index));
  };

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
    if (isPasswordProtected !== initialPasswordProtected || (isPasswordProtected && linkPassword.trim())) {
      if (isPasswordProtected) {
        if (linkPassword.trim()) {
          changes.password = linkPassword.trim();
        }
      } else {
        changes.password = null;
      }
    }

    if (metaTitle.trim() !== initialMetaTitle) {
      changes.metaTitle = metaTitle.trim() || null;
    }
    if (metaDescription.trim() !== initialMetaDescription) {
      changes.metaDescription = metaDescription.trim() || null;
    }
    if (metaImage.trim() !== initialMetaImage) {
      changes.metaImage = metaImage.trim() || null;
    }

    const validRules = targetingRules.filter((r) => r.destination?.trim());
    if (JSON.stringify(validRules) !== JSON.stringify(initialTargetingRules)) {
      changes.targetingRules = validRules;
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

      <div className="form-group" style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={isPasswordProtected}
            onChange={(e) => setIsPasswordProtected(e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
          />
          <span>🔒 Password Protect Link</span>
        </label>
        {isPasswordProtected && (
          <div style={{ marginTop: "8px" }}>
            <input
              type="password"
              className="form-input"
              placeholder={initialPasswordProtected ? "Enter new passcode (or leave blank to keep existing)" : "Set passcode (min 3 chars)"}
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              minLength={3}
              maxLength={64}
            />
            <p className="form-helper">
              {initialPasswordProtected
                ? "Link is currently password-protected. Enter a new password to update it."
                : "Visitors will be required to enter this password to view destination."}
            </p>
          </div>
        )}
      </div>

      {/* Social Card / OpenGraph Meta */}
      <div className="form-group" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowMeta(!showMeta)}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>{showMeta ? "Hide Social Card Settings" : "Customize Social Card & OpenGraph"}</span>
        </button>

        {showMeta && (
          <div
            style={{
              marginTop: "10px",
              padding: "14px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="edit-meta-title">Social Card Title</label>
              <input
                id="edit-meta-title"
                type="text"
                className="form-input"
                placeholder="Title for social media embeds"
                value={metaTitle}
                maxLength={120}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-meta-desc">Social Card Description</label>
              <input
                id="edit-meta-desc"
                type="text"
                className="form-input"
                placeholder="Summary snippet for social posts"
                value={metaDescription}
                maxLength={300}
                onChange={(e) => setMetaDescription(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="edit-meta-img">Social Thumbnail URL</label>
              <input
                id="edit-meta-img"
                type="url"
                className="form-input"
                placeholder="https://example.com/thumbnail.png"
                value={metaImage}
                onChange={(e) => setMetaImage(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Device & Geo-Targeting Rules */}
      <div className="form-group" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowTargeting(!showTargeting)}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>{showTargeting ? "Hide Dynamic Targeting Rules" : "Dynamic Device & Geo-Targeting Rules"}</span>
          {targetingRules.length > 0 && (
            <span className="badge badge-active" style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
              {targetingRules.length} {targetingRules.length === 1 ? "rule" : "rules"}
            </span>
          )}
        </button>

        {showTargeting && (
          <div
            style={{
              marginTop: "12px",
              padding: "16px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 0, marginBottom: "12px" }}>
              Dynamically route visitors to tailored destinations based on their device OS or geographic country code.
            </p>

            {targetingRules.map((rule, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 120px 1fr 36px",
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <select
                  className="form-input"
                  value={rule.type}
                  onChange={(e) => handleUpdateRule(idx, "type", e.target.value)}
                  style={{ padding: "8px", fontSize: "0.85rem" }}
                >
                  <option value="device">Device</option>
                  <option value="country">Country</option>
                </select>

                {rule.type === "device" ? (
                  <select
                    className="form-input"
                    value={rule.target}
                    onChange={(e) => handleUpdateRule(idx, "target", e.target.value)}
                    style={{ padding: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                    <option value="mobile">Any Mobile</option>
                    <option value="desktop">Desktop</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. US, IN"
                    maxLength={4}
                    value={rule.target}
                    onChange={(e) => handleUpdateRule(idx, "target", e.target.value.toUpperCase())}
                    style={{ padding: "8px", fontSize: "0.85rem", textTransform: "uppercase" }}
                  />
                )}

                <input
                  type="url"
                  className="form-input"
                  placeholder="https://apps.apple.com/... or https://in.example.com"
                  value={rule.destination}
                  onChange={(e) => handleUpdateRule(idx, "destination", e.target.value)}
                  required
                  style={{ padding: "8px", fontSize: "0.85rem" }}
                />

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRemoveRule(idx)}
                  style={{ padding: "8px", color: "var(--danger)", border: "1px solid var(--border-subtle)" }}
                  title="Remove rule"
                >
                  &times;
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddRule}
              style={{ marginTop: "4px", fontSize: "0.8rem" }}
            >
              + Add Targeting Rule
            </button>
          </div>
        )}
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