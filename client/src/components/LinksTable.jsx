import CopyButton from "./CopyButton";

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

// An expired link keeps status "active" on the server; for people it is "expired".
const displayStatus = (link) => (link.status === "disabled" ? "disabled" : link.isExpired ? "expired" : "active");

export default function LinksTable({ links, busyId, dimmed, onToggle, onEdit, onDelete }) {
  return (
    <div className="table-wrap" aria-busy={dimmed}>
      <table className={dimmed ? "dimmed" : undefined}>
        <caption className="sr-only">Your short links</caption>
        <thead>
          <tr>
            <th scope="col">Short link</th>
            <th scope="col">Destination</th>
            <th scope="col" className="num">Clicks</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const status = displayStatus(link);
            const busy = busyId === link.id;
            return (
              <tr key={link.id}>
                <td>
                  <a href={link.shortUrl} target="_blank" rel="noreferrer" className="short">{link.shortUrl}</a>
                  <CopyButton text={link.shortUrl} />
                </td>
                <td className="destination" title={link.originalUrl}>{link.originalUrl}</td>
                <td className="num">{link.clicks.toLocaleString()}</td>
                <td>
                  <span className={`badge ${status}`}>{status}</span>
                  {link.expiresAt && <div className="muted small">{status === "expired" ? "Expired" : "Expires"} {dateFormat.format(new Date(link.expiresAt))}</div>}
                </td>
                <td>{dateFormat.format(new Date(link.createdAt))}</td>
                <td className="actions">
                  <button type="button" className="ghost" disabled={busy} onClick={() => onToggle(link)}
                    aria-label={`${link.status === "disabled" ? "Enable" : "Disable"} ${link.shortCode}`}>
                    {link.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                  <button type="button" className="ghost" disabled={busy} onClick={() => onEdit(link)} aria-label={`Edit ${link.shortCode}`}>Edit</button>
                  <button type="button" className="ghost danger-text" disabled={busy} onClick={() => onDelete(link)} aria-label={`Delete ${link.shortCode}`}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
