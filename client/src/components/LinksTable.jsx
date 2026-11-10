import CopyButton from "./CopyButton";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const displayStatus = (link) =>
  link.status === "disabled"
    ? "disabled"
    : link.isExpired
    ? "expired"
    : "active";

export default function LinksTable({
  links,
  busyId,
  dimmed,
  onToggle,
  onEdit,
  onDelete,
}) {
  return (
    <div className="table-wrap" aria-busy={dimmed}>
      <table className={dimmed ? "modern-table dimmed" : "modern-table"}>
        <caption className="sr-only">Your short links</caption>
        <thead>
          <tr>
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

            return (
              <tr key={link.id}>
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
                    <CopyButton text={link.shortUrl} />
                  </div>
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
                </td>

                <td>
                  <span className={`badge badge-${status}`}>{status}</span>
                  {link.expiresAt && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                      }}
                    >
                      {status === "expired" ? "Expired " : "Expires "}
                      {dateFormat.format(new Date(link.expiresAt))}
                    </div>
                  )}
                </td>

                <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  {dateFormat.format(new Date(link.createdAt))}
                </td>

                <td>
                  <div className="table-actions">
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
