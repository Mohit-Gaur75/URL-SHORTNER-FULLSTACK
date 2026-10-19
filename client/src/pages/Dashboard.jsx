import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteUrl, updateUrl } from "../api/urls";
import { useLinks } from "../hooks/useLinks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import LinkForm from "../components/LinkForm";
import LinksTable from "../components/LinksTable";
import Pagination from "../components/Pagination";
import EditLinkDialog from "../components/EditLinkDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import "./dashboard.css";

const PAGE_SIZE = 10;

const STATUS_TABS = [
  ["all", "All"],
  ["active", "Active"],
  ["disabled", "Disabled"],
  ["expired", "Expired"],
];

// One dropdown for what the API takes as two parameters (sort field + direction).
const SORT_OPTIONS = [
  { id: "newest", label: "Newest first", sort: "createdAt", order: "desc" },
  { id: "oldest", label: "Oldest first", sort: "createdAt", order: "asc" },
  { id: "clicks", label: "Most clicks", sort: "clicks", order: "desc" },
  { id: "recent", label: "Recently clicked", sort: "lastClickedAt", order: "desc" },
  { id: "updated", label: "Recently edited", sort: "updatedAt", order: "desc" },
];

// The URL is the single source of truth for what the page shows:
//   /dashboard?q=promo&status=active&sort=clicks&page=2
// So reload, the back button, and sharing the address all just work.
// Anything missing or invalid in the address falls back to a default.
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
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readQuery(searchParams), [searchParams]);

  // Change part of the query. Anything except paging goes back to page 1,
  // because page 5 of the OLD results means nothing for the new ones.
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
        { replace: typingOnly } // typing shouldn't add a history entry per pause
      );
    },
    [setSearchParams]
  );

  // ---- search box: instant typing, delayed request ----------------------------
  const [searchText, setSearchText] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  const pushedSearch = useRef(query.search); // the last value WE put into the address

  useEffect(() => {
    if (debouncedSearch !== pushedSearch.current) {
      pushedSearch.current = debouncedSearch;
      updateQuery({ search: debouncedSearch });
    }
  }, [debouncedSearch, updateQuery]);

  useEffect(() => {
    // The address changed by itself (back/forward button): show it in the box.
    // Our own changes are skipped, or this would overwrite what the user is still typing.
    if (query.search !== pushedSearch.current) {
      pushedSearch.current = query.search;
      setSearchText(query.search);
    }
  }, [query.search]);

  // ---- the list (server state) ---------------------------------------------------
  const apiParams = useMemo(() => {
    const sort = SORT_OPTIONS.find((o) => o.id === query.sortId);
    return { page: query.page, limit: PAGE_SIZE, sort: sort.sort, order: sort.order, status: query.status, search: query.search || undefined };
  }, [query]);
  const { data, loading, error, reload } = useLinks(apiParams);

  // Deleted the last link on the last page? That page no longer exists: step back.
  useEffect(() => {
    if (data && data.items.length === 0 && data.pagination.page > 1) {
      updateQuery({ page: Math.max(1, data.pagination.totalPages) });
    }
  }, [data, updateQuery]);

  // ---- actions on links ------------------------------------------------------------
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const toggle = async (link) => {
    setBusyId(link.id);
    setActionError("");
    try {
      await updateUrl(link.id, { status: link.status === "disabled" ? "active" : "disabled" });
      reload(); // the server is the truth: fetch it again instead of guessing
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (changes) => {
    await updateUrl(editing.id, changes); // errors are shown inside the dialog
    setEditing(null);
    reload();
  };

  const confirmDelete = async () => {
    await deleteUrl(deleting.id);
    setDeleting(null);
    reload();
  };

  const clearFilters = () => {
    pushedSearch.current = "";
    setSearchText("");
    updateQuery({ search: "", status: "all" });
  };

  // ---- what to show -------------------------------------------------------------------
  const filtering = query.status !== "all" || query.search !== "";
  const pagination = data?.pagination;
  const first = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = pagination ? first + data.items.length - 1 : 0;

  let content;
  if (!data && loading) {
    content = (
      <div className="skeleton" aria-busy="true" aria-label="Loading your links">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton-row" />)}
      </div>
    );
  } else if (!data && error) {
    content = (
      <div className="state" role="alert">
        <p className="error">Couldn’t load your links: {error.message}</p>
        {error.requestId && <p className="muted small">Reference: {error.requestId}</p>}
        <button type="button" onClick={reload}>Try again</button>
      </div>
    );
  } else if (data && pagination.total === 0 && !filtering) {
    content = (
      <div className="state">
        <h2>No links yet</h2>
        <p>Paste a long URL in the box above to create your first short link.</p>
      </div>
    );
  } else if (data && pagination.total === 0) {
    content = (
      <div className="state">
        <h2>No links match</h2>
        <p>Nothing matches your current search and filter.</p>
        <button type="button" onClick={clearFilters}>Clear filters</button>
      </div>
    );
  } else if (data) {
    content = (
      <>
        <LinksTable links={data.items} busyId={busyId} dimmed={loading} onToggle={toggle} onEdit={setEditing} onDelete={setDeleting} />
        <div className="table-footer">
          <p className="muted" aria-live="polite">
            Showing {first.toLocaleString()}–{last.toLocaleString()} of {pagination.total.toLocaleString()} {pagination.total === 1 ? "link" : "links"}
          </p>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} disabled={loading} onChange={(page) => updateQuery({ page })} />
        </div>
      </>
    );
  }

  return (
    <div className="container wide dashboard">
      <h1>Your links</h1>
      <p className="muted">Welcome back, {user.name}.</p>

      <section className="create-card" aria-label="Create a link">
        <LinkForm onCreated={() => { updateQuery({ page: 1 }); reload(); }} />
      </section>

      <section aria-label="Your links">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search by code or destination…"
            aria-label="Search your links"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select aria-label="Sort links" value={query.sortId} onChange={(e) => updateQuery({ sortId: e.target.value })}>
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>

        <div className="tabs" role="group" aria-label="Filter by status">
          {STATUS_TABS.map(([value, label]) => (
            <button key={value} type="button" className={query.status === value ? "tab active" : "tab"}
              aria-pressed={query.status === value} onClick={() => updateQuery({ status: value })}>
              {label}
            </button>
          ))}
        </div>

        {actionError && (
          <p className="error banner" role="alert">
            {actionError} <button type="button" className="ghost" onClick={() => setActionError("")}>Dismiss</button>
          </p>
        )}
        {error && data && (
          <p className="error banner" role="alert">
            Couldn’t refresh: {error.message} <button type="button" className="ghost" onClick={reload}>Try again</button>
          </p>
        )}

        {content}
      </section>

      <EditLinkDialog link={editing} onSave={saveEdit} onCancel={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this link?"
        message={deleting ? `${deleting.shortUrl} will stop working immediately, and its address can never be reused.` : ""}
        confirmLabel="Delete link"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
