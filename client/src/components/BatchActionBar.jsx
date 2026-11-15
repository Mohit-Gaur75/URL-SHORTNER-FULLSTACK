export default function BatchActionBar({
  selectedCount,
  onClearSelection,
  onBulkArchive,
  onBulkUnarchive,
  onBulkEnable,
  onBulkDisable,
  onBulkDelete,
  onExportSelected,
  busy,
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: "sticky",
        bottom: "20px",
        zIndex: 50,
        background: "var(--surface)",
        border: "1px solid var(--primary)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
        borderRadius: "var(--radius-md)",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        flexWrap: "wrap",
        marginTop: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            background: "var(--primary)",
            color: "#fff",
            fontSize: "0.8rem",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "12px",
          }}
        >
          {selectedCount}
        </span>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {selectedCount === 1 ? "Link selected" : "Links selected"}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.75rem", padding: "2px 8px" }}
        >
          Deselect All
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {onBulkArchive && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onBulkArchive}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            📦 Archive
          </button>
        )}
        {onBulkUnarchive && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onBulkUnarchive}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            📂 Unarchive
          </button>
        )}
        {onBulkEnable && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onBulkEnable}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            🟢 Enable
          </button>
        )}
        {onBulkDisable && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onBulkDisable}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            ⏸️ Disable
          </button>
        )}
        {onExportSelected && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onExportSelected}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            ⬇️ Export CSV
          </button>
        )}
        {onBulkDelete && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={onBulkDelete}
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            🗑️ Delete Selected
          </button>
        )}
      </div>
    </div>
  );
}
