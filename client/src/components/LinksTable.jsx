import CopyButton from "./CopyButton";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const displayStatus = (link) =>
  link.status === "deleted"
    ? "deleted"
    : link.isArchived
    ? "archived"
    : link.status === "disabled"
    ? "disabled"
    : link.isExpired
    ? "expired"
    : "active";

function renderExpiration(link, status) {
  if (!link.expiresAt) {
    return <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>Lifetime</span>;
  }
  const expiryTime = new Date(link.expiresAt).getTime();
  const diffMs = expiryTime - Date.now();

  if (diffMs <= 0 || status === "expired") {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
        Expired {dateFormat.format(new Date(link.expiresAt))}
      </div>
    );
  }

  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  if (hoursLeft < 24) {
    return (
      <div style={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: 600, marginTop: "4px" }}>
        ⏳ {hoursLeft}h left
      </div>
    );
  }

  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return (
    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
      Expires in {daysLeft}d
    </div>
  );
}

function renderHealthIndicator(link) {
  const status = link.healthStatus || "unknown";
  if (status === "healthy") {
    return (
      <span
        title={`Destination reachable (HTTP ${link.healthStatusCode || 200}, ${link.healthLatencyMs || 0}ms)`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.7rem",
          color: "#10b981",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
        {link.healthLatencyMs != null ? `${link.healthLatencyMs}ms` : "ok"}
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span
        title={`High Latency / Warning: ${link.healthError || "Slow response"}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.7rem",
          color: "#f59e0b",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
        {link.healthLatencyMs ? `${link.healthLatencyMs}ms` : "slow"}
      </span>
    );
  }
  if (status === "broken") {
    return (
      <span
        title={`Destination Broken: ${link.healthError || "Unreachable"}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "0.7rem",
          color: "#ef4444",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
        broken
      </span>
    );
  }
  return null;
}

export default function LinksTable({
  links,
  busyId,
  dimmed,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onOpenQr,
  onOpenDetails,
  onSelectTag,
}) {
  const allSelected = links.length > 0 && selectedIds.length === links.length;

  return (
    <div className="table-wrap" aria-busy={dimmed}>
      <table className={dimmed ? "modern-table dimmed" : "modern-table"}>
        <caption className="sr-only">Your short links</caption>
        <thead>
          <tr>
            {onToggleSelect && (
              <th scope="col" style={{ width: "36px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  aria-label="Select all links on this page"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  style={{ cursor: "pointer", width: "15px", height: "15px", accentColor: "var(--primary)" }}
                />
              </th>
            )}
            <th scope="col">Short Link</th>
            <th scope="col">Destination</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Clicks
            </th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const status = displayStatus(link);
            const busy = busyId === link.id;
            const isSelected = selectedIds.includes(link.id);

            return (
              <tr key={link.id} style={isSelected ? { background: "rgba(59, 130, 246, 0.07)" } : undefined}>
                {onToggleSelect && (
                  <td style={{ width: "36px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label={`Select link ${link.shortCode}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(link.id)}
                      style={{ cursor: "pointer", width: "15px", height: "15px", accentColor: "var(--primary)" }}
                    />
                  </td>
                )}
                <td>
                  <div className="short-link-cell">
                    <a
                      href={link.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="short-url-text"
                      title="Open short link in new tab"
                    >
                      {link.shortUrl}
                    </a>
                    {link.isPasswordProtected && (
                      <span title="Password Protected" style={{ fontSize: "0.85rem", cursor: "help" }}>
                        🔒
                      </span>
                    )}
                    <CopyButton text={link.shortUrl} />
                  </div>
                  {link.tags && link.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                      {link.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onSelectTag?.(t)}
                          title={`Filter by #${t}`}
                          style={{
                            fontSize: "0.7rem",
                            padding: "1px 6px",
                            background: "var(--bg-surface-raised)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-secondary)",
                            fontFamily: "var(--font-mono)",
                            cursor: onSelectTag ? "pointer" : "default",
                          }}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                </td>

                <td className="destination-cell" title={link.originalUrl}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {link.originalUrl}
                    </a>
                    {renderHealthIndicator(link)}
                  </div>
                </td>

                <td style={{ textAlign: "right" }}>
                  <div className="clicks-badge" style={{ justifyContent: "flex-end" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span>{link.clicks.toLocaleString()}</span>
                  </div>
                  {link.maxClicks && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
                      Quota: {link.clicks}/{link.maxClicks}
                    </span>
                  )}
                </td>

                <td>
                  <span className={`badge badge-${status}`}>{status}</span>
                  {renderExpiration(link, status)}
                </td>

                <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  {dateFormat.format(new Date(link.createdAt))}
                </td>

                <td>
                  <div className="table-actions">
                    {onOpenDetails && (
                      <button
                        type="button"
                        className="btn-icon"
                        disabled={busy}
                        onClick={() => onOpenDetails(link)}
                        title="View analytics & telemetry"
                        aria-label={`Analytics for ${link.shortCode}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>Telemetry</span>
                      </button>
                    )}

                    {onOpenQr && (
                      <button
                        type="button"
                        className="btn-icon"
                        disabled={busy}
                        onClick={() => onOpenQr(link.shortUrl)}
                        title="Generate QR code"
                        aria-label={`QR for ${link.shortCode}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        <span>QR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-icon"
                      disabled={busy}
                      onClick={() => onToggle(link)}
                      title={link.status === "disabled" ? "Enable link" : "Disable link"}
                      aria-label={`${link.status === "disabled" ? "Enable" : "Disable"} ${link.shortCode}`}
                    >
                      {link.status === "disabled" ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          <span>Enable</span>
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                          <span>Disable</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn-icon"
                      disabled={busy}
                      onClick={() => onEdit(link)}
                      title="Edit destination or expiration"
                      aria-label={`Edit ${link.shortCode}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>

                    {onArchive && (
                      <button
                        type="button"
                        className="btn-icon"
                        disabled={busy}
                        onClick={() => onArchive(link)}
                        title={link.isArchived ? "Unarchive link" : "Archive link"}
                        aria-label={`${link.isArchived ? "Unarchive" : "Archive"} ${link.shortCode}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="5" rx="1" />
                          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                          <path d="M10 12h4" />
                        </svg>
                        <span>{link.isArchived ? "Unarchive" : "Archive"}</span>
                      </button>
                    )}

                    {onRestore && link.status === "deleted" && (
                      <button
                        type="button"
                        className="btn-icon"
                        disabled={busy}
                        onClick={() => onRestore(link)}
                        title="Restore deleted link"
                        aria-label={`Restore ${link.shortCode}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        <span>Restore</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-icon danger"
                      disabled={busy}
                      onClick={() => onDelete(link)}
                      title="Delete link"
                      aria-label={`Delete ${link.shortCode}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
