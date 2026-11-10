import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLinks } from "../hooks/useLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { deleteUrl, updateUrl } from "../api/urls";
import { useToast } from "../context/ToastContext";
import { downloadCsv } from "../utils/exportCsv";
import LinksTable from "../components/LinksTable";
import Pagination from "../components/Pagination";
import EditLinkDialog from "../components/EditLinkDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import QrCodeModal from "../components/QrCodeModal";
import LinkDetailsModal from "../components/LinkDetailsModal";

const PAGE_SIZE = 10;

const STATUS_TABS = [
  ["all", "All Links"],
  ["active", "Active"],
  ["disabled", "Disabled"],
  ["expired", "Expired"],
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first", sort: "createdAt", order: "desc" },
  { id: "oldest", label: "Oldest first", sort: "createdAt", order: "asc" },
  { id: "clicks", label: "Most clicks", sort: "clicks", order: "desc" },
  { id: "recent", label: "Recently clicked", sort: "lastClickedAt", order: "desc" },
  { id: "updated", label: "Recently edited", sort: "updatedAt", order: "desc" },
];

function readQuery(searchParams) {
  const sortId = searchParams.get("sort");
  const status = searchParams.get("status");
  return {
    page: Math.max(1, parseInt(searchParams.get("page"), 10) || 1),
    sortId: SORT_OPTIONS.some((o) => o.id === sortId) ? sortId : "newest",
    status: STATUS_TABS.some(([value]) => value === status) ? status : "all",
    search: (searchParams.get("q") ?? "").slice(0, 100),
  };
}

export default function LinksPage() {
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readQuery(searchParams), [searchParams]);

  const updateQuery = useCallback(
    (patch) => {
      const typingOnly = Object.keys(patch).length === 1 && "search" in patch;
      setSearchParams(
        (previous) => {
          const merged = { ...readQuery(previous), ...patch };
          if (!("page" in patch)) merged.page = 1;
          const next = new URLSearchParams();
          if (merged.page > 1) next.set("page", String(merged.page));
          if (merged.sortId !== "newest") next.set("sort", merged.sortId);
          if (merged.status !== "all") next.set("status", merged.status);
          if (merged.search) next.set("q", merged.search);
          return next;
        },
        { replace: typingOnly }
      );
    },
    [setSearchParams]
  );

  const [searchText, setSearchText] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  const pushedSearch = useRef(query.search);

  useEffect(() => {
    if (debouncedSearch !== pushedSearch.current) {
      pushedSearch.current = debouncedSearch;
      updateQuery({ search: debouncedSearch });
    }
  }, [debouncedSearch, updateQuery]);

  useEffect(() => {
    if (query.search !== pushedSearch.current) {
      pushedSearch.current = query.search;
      setSearchText(query.search);
    }
  }, [query.search]);

  const apiParams = useMemo(() => {
    const sort = SORT_OPTIONS.find((o) => o.id === query.sortId);
    return {
      page: query.page,
      limit: PAGE_SIZE,
      sort: sort.sort,
      order: sort.order,
      status: query.status,
      search: query.search || undefined,
    };
  }, [query]);

  const { data, loading, error, reload } = useLinks(apiParams);

  useEffect(() => {
    if (data && data.items.length === 0 && data.pagination.page > 1) {
      updateQuery({ page: Math.max(1, data.pagination.totalPages) });
    }
  }, [data, updateQuery]);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [qrModalUrl, setQrModalUrl] = useState(null);
  const [detailsLink, setDetailsLink] = useState(null);

  const toggle = async (link) => {
    setBusyId(link.id);
    setActionError("");
    const newStatus = link.status === "disabled" ? "active" : "disabled";
    try {
      await updateUrl(link.id, { status: newStatus });
      showSuccess(newStatus === "active" ? "Link activated!" : "Link disabled");
      reload();
    } catch (err) {
      const msg = err.message || "Failed to update link status";
      setActionError(msg);
      showError(msg);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (changes) => {
    try {
      await updateUrl(editing.id, changes);
      showSuccess("Link destination updated successfully!");
      setEditing(null);
      reload();
    } catch (err) {
      showError(err.message || "Failed to save link updates");
      throw err;
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteUrl(deleting.id);
      showSuccess("Link deleted. Code now returns HTTP 410 Gone.");
      setDeleting(null);
      reload();
    } catch (err) {
      showError(err.message || "Failed to delete link");
    }
  };

  const clearFilters = () => {
    pushedSearch.current = "";
    setSearchText("");
    updateQuery({ search: "", status: "all" });
  };

  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) {
      showError("No links to export");
      return;
    }
    const headers = [
      "Short Code",
      "Short URL",
      "Destination URL",
      "Clicks",
      "Status",
      "Is Custom Alias",
      "Created At",
      "Expires At",
    ];
    const rows = data.items.map((l) => [
      l.shortCode,
      l.shortUrl,
      l.originalUrl,
      l.clicks,
      l.status,
      l.isCustomAlias ? "Yes" : "No",
      l.createdAt ? new Date(l.createdAt).toISOString() : "—",
      l.expiresAt ? new Date(l.expiresAt).toISOString() : "Never",
    ]);
    downloadCsv(`shortlink-links-page-${query.page}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showSuccess("Links exported to CSV!");
  };

  const filtering = query.status !== "all" || query.search !== "";
  const pagination = data?.pagination;
  const first = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = pagination ? first + data.items.length - 1 : 0;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div className="dashboard-title-group">
          <h1>Links Management Hub</h1>
          <p className="dashboard-subtitle">
            Search, filter, update, and manage your shortened URLs and vanity redirects.
          </p>
        </div>

        <Link to="/create" className="btn btn-primary" style={{ gap: "8px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Link
        </Link>
      </div>

      <section className="dashboard-card" aria-label="Links collection">
        {/* Toolbar */}
        <div className="dashboard-toolbar">
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search by custom slug or destination URL…"
              aria-label="Search your links"
              value={searchText}
              maxLength={100}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="toolbar-controls" style={{ display: "flex", gap: "8px" }}>
            <select
              className="select-styled"
              aria-label="Sort links"
              value={query.sortId}
              onChange={(e) => updateQuery({ sortId: e.target.value })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              title="Download CSV report of current links"
              style={{ gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs" role="group" aria-label="Filter by status">
          {STATUS_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={query.status === value ? "filter-tab active" : "filter-tab"}
              aria-pressed={query.status === value}
              onClick={() => updateQuery({ status: value })}
            >
              {label}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
            <span style={{ flex: 1 }}>{actionError}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionError("")}>
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        {!data && loading ? (
          <div className="skeleton" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : !data && error ? (
          <div className="dashboard-state" role="alert">
            <h2 className="state-title">Couldn't Load Your Links</h2>
            <p className="state-desc">{error.message}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={reload}>
              Try Again
            </button>
          </div>
        ) : data && pagination.total === 0 && !filtering ? (
          <div className="dashboard-state">
            <div className="state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h2 className="state-title">No Links Created Yet</h2>
            <p className="state-desc">Get started by creating your first shortened destination URL.</p>
            <Link to="/create" className="btn btn-primary btn-sm" style={{ marginTop: "12px" }}>
              Go to Link Studio
            </Link>
          </div>
        ) : data && pagination.total === 0 ? (
          <div className="dashboard-state">
            <h2 className="state-title">No Links Found</h2>
            <p className="state-desc">No short URLs matched &ldquo;{query.search}&rdquo; and active filter.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        ) : data ? (
          <>
            <LinksTable
              links={data.items}
              busyId={busyId}
              dimmed={loading}
              onToggle={toggle}
              onEdit={setEditing}
              onDelete={setDeleting}
              onOpenQr={setQrModalUrl}
              onOpenDetails={setDetailsLink}
            />
            <div className="table-footer">
              <p aria-live="polite">
                Showing <strong>{first.toLocaleString()}</strong>&ndash;<strong>{last.toLocaleString()}</strong> of{" "}
                <strong>{pagination.total.toLocaleString()}</strong> {pagination.total === 1 ? "link" : "links"}
              </p>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                disabled={loading}
                onChange={(page) => updateQuery({ page })}
              />
            </div>
          </>
        ) : null}
      </section>

      {/* Dialogs */}
      <EditLinkDialog
        link={editing}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this link?"
        message={
          deleting
            ? `Are you sure you want to delete ${deleting.shortUrl}? The link will immediately return HTTP 410 Gone and its custom code will remain permanently reserved.`
            : ""
        }
        confirmLabel="Yes, Delete Link"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <QrCodeModal
        isOpen={Boolean(qrModalUrl)}
        onClose={() => setQrModalUrl(null)}
        shortUrl={qrModalUrl}
      />

      <LinkDetailsModal
        link={detailsLink}
        isOpen={Boolean(detailsLink)}
        onClose={() => setDetailsLink(null)}
        onOpenQr={(url) => setQrModalUrl(url)}
        onOpenEdit={(link) => setEditing(link)}
        onToggleStatus={(link) => toggle(link)}
        onOpenDelete={(link) => setDeleting(link)}
      />
    </div>
  );
}
