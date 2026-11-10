import Modal from "./Modal";
import CopyButton from "./CopyButton";

export default function LinkDetailsModal({
  link,
  isOpen,
  onClose,
  onOpenQr,
  onOpenEdit,
  onToggleStatus,
  onOpenDelete,
}) {
  if (!link) return null;

  const origin = window.location.origin;
  const shortUrl = `${origin}/${link.shortCode}`;

  const isExpired = Boolean(link.isExpired);
  const statusLabel = isExpired
    ? "Expired"
    : link.status === "disabled"
    ? "Disabled"
    : "Active";

  const statusBadgeClass =
    statusLabel === "Active"
      ? "badge-active"
      : statusLabel === "Disabled"
      ? "badge-disabled"
      : "badge-expired";

  const formattedCreated = link.createdAt
    ? new Date(link.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const formattedExpiry = link.expiresAt
    ? new Date(link.expiresAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never expires";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Telemetry & Analytics">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Top summary card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "4px" }}>
              Shortened Endpoint
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <code style={{ fontSize: "1rem", color: "#38bdf8", fontWeight: 600 }}>
                {shortUrl}
              </code>
              <CopyButton text={shortUrl} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
            <button
              type="button"
              className="action-chip-btn"
              onClick={() => {
                onClose();
                onOpenQr(shortUrl);
              }}
              title="View QR Code"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              QR Code
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "14px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Clicks</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {link.clicks || 0}
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "14px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Alias Engine</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: link.isCustomAlias ? "#a855f7" : "#60a5fa", marginTop: "8px" }}>
              {link.isCustomAlias ? "Custom Vanity" : "Base62 Hash"}
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "14px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Cache Tier</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#34d399", marginTop: "8px" }}>
              Redis &lt; 2ms
            </div>
          </div>
        </div>

        {/* Destination Section */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>
            Destination Target
          </label>
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              wordBreak: "break-all",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <span>{link.originalUrl}</span>
            <a
              href={link.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ padding: "4px 8px", fontSize: "0.75rem", flexShrink: 0 }}
            >
              Open ↗
            </a>
          </div>
        </div>

        {/* Timestamps */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.85rem" }}>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>Created</span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{formattedCreated}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>Expiration</span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{formattedExpiry}</span>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "16px",
            marginTop: "8px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className="btn btn-danger"
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
            onClick={() => {
              onClose();
              onOpenDelete(link);
            }}
          >
            Delete Link
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
              onClick={() => {
                onToggleStatus(link);
                onClose();
              }}
            >
              {link.status === "disabled" ? "Enable Link" : "Disable Link"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "8px 16px", fontSize: "0.85rem" }}
              onClick={() => {
                onClose();
                onOpenEdit(link);
              }}
            >
              Edit Destination
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
