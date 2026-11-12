import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminOverview } from "../api/admin";
import { useToast } from "../context/ToastContext";

export default function AdminPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchOverview = useCallback(async () => {
    if (user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getAdminOverview();
      setOverview(data);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err.message || "Failed to load admin platform overview";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.role, showError]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Non-admin guard view
  if (user && user.role !== "ADMIN") {
    return (
      <div className="dashboard-container" style={{ padding: "40px 0" }}>
        <div
          className="dashboard-card"
          style={{
            maxWidth: "600px",
            margin: "40px auto",
            textAlign: "center",
            padding: "48px 32px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "8px" }}>
            Restricted Access
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              marginBottom: "24px",
            }}
          >
            This portal is restricted to users with the{" "}
            <strong style={{ color: "var(--text-primary)" }}>ADMIN</strong> role. Your
            current account (<code style={{ color: "#60a5fa" }}>{user.email}</code>)
            holds the role <strong style={{ color: "var(--warning)" }}>{user.role || "USER"}</strong>.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <Link to="/dashboard" className="btn btn-primary">
              Return to Dashboard
            </Link>
            <Link to="/settings" className="btn btn-secondary">
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totals = overview?.totals || { users: 0, links: 0, clicks: 0 };
  const avgClicks =
    totals.links > 0 ? (totals.clicks / totals.links).toFixed(1) : "0.0";

  return (
    <div className="dashboard-container">
      {/* Page Header */}
      <div
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div className="dashboard-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1>Enterprise Admin Console</h1>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                background: "rgba(168, 85, 247, 0.2)",
                color: "#c084fc",
                border: "1px solid rgba(168, 85, 247, 0.4)",
                borderRadius: "9999px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              RBAC Authorized
            </span>
          </div>
          <p className="dashboard-subtitle">
            System-wide platform observability, cross-tenant volume aggregates, and top link performance.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {lastUpdated && (
            <span style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchOverview();
              showSuccess("Admin metrics refreshed");
            }}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Metrics"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: "24px" }}>
          <span>{error}</span>
        </div>
      )}

      {/* Platform Aggregates Grid */}
      <section className="stats-grid" aria-label="Platform Wide Statistics">
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Platform Users</span>
            <span className="stat-value">{totals.users.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Shortened Links</span>
            <span className="stat-value">{totals.links.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Clicks Streamed</span>
            <span className="stat-value">{totals.clicks.toLocaleString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg Clicks / Link</span>
            <span className="stat-value">{avgClicks}</span>
          </div>
        </div>
      </section>

      {/* Main Dual Grid: Top Links Leaderboard & Recent Users */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        
        {/* Top Performing Links Leaderboard */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#c084fc" }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Top Performing Links (Platform-Wide)
            </h2>
            <Link to="/links" style={{ fontSize: "0.85rem", color: "var(--primary)", textDecoration: "none" }}>
              View All &rarr;
            </Link>
          </div>

          {loading && !overview ? (
            <div className="skeleton" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton-row" style={{ height: "42px", marginBottom: "8px" }} />
              ))}
            </div>
          ) : overview?.topLinks?.length > 0 ? (
            <div className="table-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Code</th>
                    <th>Destination</th>
                    <th style={{ textAlign: "right" }}>Clicks</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topLinks.map((link, idx) => (
                    <tr key={link.id}>
                      <td style={{ fontWeight: 700, color: idx === 0 ? "#fbbf24" : "var(--text-muted)" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#60a5fa" }}>
                          /{link.shortCode}
                        </span>
                      </td>
                      <td>
                        <div
                          className="destination-cell"
                          style={{ maxWidth: "200px" }}
                          title={link.originalUrl}
                        >
                          <a href={link.originalUrl} target="_blank" rel="noreferrer">
                            {link.originalUrl}
                          </a>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="clicks-badge">
                          {link.clicks.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`status-badge ${link.status === "active" ? "active" : "disabled"}`}
                          style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                        >
                          {link.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-state" style={{ padding: "32px 16px" }}>
              <p className="state-desc">No links created on the platform yet.</p>
            </div>
          )}
        </div>

        {/* Recent Registered Users */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#38bdf8" }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Recently Registered Users
            </h2>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Latest 5 Accounts
            </span>
          </div>

          {loading && !overview ? (
            <div className="skeleton" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton-row" style={{ height: "42px", marginBottom: "8px" }} />
              ))}
            </div>
          ) : overview?.recentUsers?.length > 0 ? (
            <div className="table-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th style={{ textAlign: "center" }}>Role</th>
                    <th style={{ textAlign: "right" }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: u.role === "ADMIN" ? "rgba(168, 85, 247, 0.25)" : "var(--primary-subtle)",
                              color: u.role === "ADMIN" ? "#c084fc" : "var(--primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                            }}
                          >
                            {(u.name || u.email || "U")[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {u.name || "Anonymous"}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                        {u.email}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            background:
                              u.role === "ADMIN"
                                ? "rgba(168, 85, 247, 0.2)"
                                : "rgba(59, 130, 246, 0.15)",
                            color: u.role === "ADMIN" ? "#c084fc" : "#60a5fa",
                            border:
                              u.role === "ADMIN"
                                ? "1px solid rgba(168, 85, 247, 0.35)"
                                : "1px solid rgba(59, 130, 246, 0.25)",
                          }}
                        >
                          {u.role || "USER"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "0.825rem" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-state" style={{ padding: "32px 16px" }}>
              <p className="state-desc">No registered users found.</p>
            </div>
          )}
        </div>
      </div>

      {/* System Infrastructure Controls Banner */}
      <div
        className="dashboard-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          border: "1px solid var(--border-subtle)",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-primary)" }}>
            Infrastructure Engine Specifications
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Redis Cache TTL: 1 hr &bull; BullMQ Batch Analytics Workers: Active &bull; Auth: Rotating JWT Families + Session Versioning
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/system-status" className="btn btn-secondary btn-sm">
            Live System Probes
          </Link>
          <Link to="/analytics" className="btn btn-primary btn-sm">
            Event Stream Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
