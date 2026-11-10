import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deleteUrl, updateUrl } from "../api/urls";
import { useLinks } from "../hooks/useLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import LinkForm from "../components/LinkForm";
import LinksTable from "../components/LinksTable";
import Pagination from "../components/Pagination";
import EditLinkDialog from "../components/EditLinkDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import QrCodeModal from "../components/QrCodeModal";
import LinkDetailsModal from "../components/LinkDetailsModal";
import "./dashboard.css";

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

export default function Dashboard() {
  const { user } = useAuth();
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
      await updateUrl(link.id, {
        status: newStatus,
      });
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

  const filtering = query.status !== "all" || query.search !== "";
  const pagination = data?.pagination;
  const first = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = pagination ? first + data.items.length - 1 : 0;

  // Compute stat metrics
  const totalCount = pagination?.total ?? 0;
  const pageClicks = data?.items?.reduce((sum, item) => sum + (item.clicks || 0), 0) ?? 0;
  const activeCount = data?.items?.filter((i) => i.status === "active" && !i.isExpired).length ?? 0;

  let content;
  if (!data && loading) {
    content = (
      <div className="skeleton" aria-busy="true" aria-label="Loading your links">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  } else if (!data && error) {
    content = (
      <div className="dashboard-state" role="alert">
        <div className="state-icon" style={{ color: "var(--danger)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="state-title">Couldn't Load Your Links</h2>
        <p className="state-desc">{error.message}</p>
        {error.requestId && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
            Request Reference: <code>{error.requestId}</code>
          </p>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={reload}>
          Try Again
        </button>
      </div>
    );
  } else if (data && pagination.total === 0 && !filtering) {
    content = (
      <div className="dashboard-state">
        <div className="state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <h2 className="state-title">No Links Created Yet</h2>
        <p className="state-desc">
          Shorten your first destination URL using the generator above to start capturing click analytics.
        </p>
      </div>
    );
  } else if (data && pagination.total === 0) {
    content = (
      <div className="dashboard-state">
        <div className="state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <h2 className="state-title">No Links Found</h2>
        <p className="state-desc">
          No short URLs matched your current query &ldquo;{query.search}&rdquo; and filter.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>
    );
  } else if (data) {
    content = (
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
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>Command Center</h1>
          <p className="dashboard-subtitle">
            Welcome back, <strong>{user?.name || user?.email}</strong>. Monitor link performance and generate branded redirects.
          </p>
        </div>
      </div>

      {/* Metric KPI Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Links</span>
            <span className="stat-value">{totalCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Page Clicks</span>
            <span className="stat-value">{pageClicks.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Active on Page</span>
            <span className="stat-value">{activeCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Cache Engine</span>
            <span className="stat-value" style={{ fontSize: "1.15rem", color: "#c084fc" }}>Sub-1ms Redis</span>
          </div>
        </div>
      </div>

      {/* Quick Shortener Section */}
      <section className="dashboard-create-card" aria-label="Create a short link">
        <div className="create-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Quick Link Creator</span>
        </div>
        <LinkForm
          onCreated={() => {
            updateQuery({ page: 1 });
            reload();
          }}
        />
      </section>

      {/* Links Management Card */}
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

          <div className="toolbar-controls">
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
          </div>
        </div>

        {/* Filter Pills */}
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ flex: 1 }}>{actionError}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setActionError("")}
            >
              Dismiss
            </button>
          </div>
        )}

        {error && data && (
          <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ flex: 1 }}>Couldn't refresh links: {error.message}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={reload}
            >
              Retry
            </button>
          </div>
        )}

        {/* Links Data Table */}
        {content}
      </section>

      {/* Edit Dialog */}
      <EditLinkDialog
        link={editing}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
      />

      {/* Confirm Deletion Dialog */}
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

      {/* QR Code Modal */}
      <QrCodeModal
        isOpen={Boolean(qrModalUrl)}
        onClose={() => setQrModalUrl(null)}
        shortUrl={qrModalUrl}
      />

      {/* Telemetry & Analytics Modal */}
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
