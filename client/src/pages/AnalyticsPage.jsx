import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listUrls, getUrlSummary, getUrlTimeseries, getUrlEvents } from "../api/urls";

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLinkId = searchParams.get("linkId");

  const [links, setLinks] = useState([]);
  const [activeLink, setActiveLink] = useState(null);
  const [loadingLinks, setLoadingLinks] = useState(true);

  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState("");

  // Load available links for the user
  useEffect(() => {
    let unmounted = false;
    listUrls({ limit: 50, sort: "clicks", order: "desc" })
      .then((data) => {
        if (unmounted) return;
        const items = data?.items || [];
        setLinks(items);
        if (items.length > 0) {
          const match = items.find((l) => l.id === selectedLinkId) || items[0];
          setActiveLink(match);
        }
      })
      .catch((err) => {
        if (!unmounted) setError(err.message || "Could not load links list");
      })
      .finally(() => {
        if (!unmounted) setLoadingLinks(false);
      });

    return () => {
      unmounted = true;
    };
  }, [selectedLinkId]);

  // Load analytics when activeLink changes
  useEffect(() => {
    if (!activeLink?.id) return;

    let unmounted = false;
    setLoadingMetrics(true);
    setError("");

    Promise.allSettled([
      getUrlSummary(activeLink.id),
      getUrlTimeseries(activeLink.id, { interval: "day" }),
      getUrlEvents(activeLink.id, { limit: 10 }),
    ]).then(([summaryRes, timeseriesRes, eventsRes]) => {
      if (unmounted) return;
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      } else {
        setError(summaryRes.reason?.message || "Failed to load summary");
      }

      if (timeseriesRes.status === "fulfilled") {
        setTimeseries(timeseriesRes.value);
      }

      if (eventsRes.status === "fulfilled") {
        setEvents(eventsRes.value?.items || []);
      }

      setLoadingMetrics(false);
    });

    return () => {
      unmounted = true;
    };
  }, [activeLink?.id]);

  const handleSelectLink = (linkId) => {
    const found = links.find((l) => l.id === linkId);
    if (found) {
      setActiveLink(found);
      setSearchParams({ linkId });
    }
  };

  const maxBucketClicks = timeseries?.points?.length
    ? Math.max(...timeseries.points.map((p) => p.clicks), 1)
    : 1;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div className="dashboard-title-group">
          <h1>Click-Stream Analytics &amp; Telemetry</h1>
          <p className="dashboard-subtitle">
            Asynchronous event ingestion powered by Redis queues and BullMQ background workers.
          </p>
        </div>

        {/* Link Switcher */}
        {links.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label htmlFor="link-selector" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Analyzing Link:
            </label>
            <select
              id="link-selector"
              className="select-styled"
              value={activeLink?.id || ""}
              onChange={(e) => handleSelectLink(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  /{link.shortCode} ({link.clicks || 0} clicks)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loadingLinks ? (
        <div className="skeleton" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "12px 0 8px" }}>
            No Links Created For Analytics
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 460, margin: "0 auto 20px" }}>
            Create your first shortened link to begin capturing real-time visitor telemetry, devices, referrers, and timeseries charts.
          </p>
          <Link to="/create" className="btn btn-primary btn-sm">
            Create Your First Link
          </Link>
        </div>
      ) : (
        <>
          {/* Active Link Banner */}
          {activeLink && (
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
                marginBottom: "24px",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                  Target Endpoint
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                  <code style={{ fontSize: "1rem", color: "#38bdf8", fontWeight: 600 }}>
                    {activeLink.shortUrl}
                  </code>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>&rarr;</span>
                  <a
                    href={activeLink.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      textDecoration: "none",
                      maxWidth: "350px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeLink.originalUrl}
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={activeLink.status === "active" ? "badge badge-active" : "badge badge-disabled"}>
                  {activeLink.status}
                </span>
                <Link to="/links" className="btn btn-secondary btn-sm">
                  View in Links Hub
                </Link>
              </div>
            </div>
          )}

          {/* Metric Stat Cards */}
          <div className="stats-grid" style={{ marginBottom: "24px" }}>
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Human Clicks</span>
                <span className="stat-value">{summary?.totals?.clicks ?? activeLink?.clicks ?? 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Bot Filtered</span>
                <span className="stat-value">{summary?.totals?.botClicks ?? 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Cache Latency</span>
                <span className="stat-value" style={{ fontSize: "1.15rem", color: "#34d399" }}>Sub-1ms</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="stat-info">
                <span className="stat-label">Lifetime Counter</span>
                <span className="stat-value">{summary?.totals?.allTimeClicks ?? activeLink?.clicks ?? 0}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: "20px" }}>
              <span>{error}</span>
            </div>
          )}

          {/* Timeseries Visual Timeline */}
          <div className="dashboard-card" style={{ marginBottom: "24px" }}>
            <div className="create-card-header" style={{ marginBottom: "16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Daily Click Activity (30-Day Window)</span>
            </div>

            {loadingMetrics ? (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                Aggregating timeseries buckets...
              </div>
            ) : timeseries?.points?.length > 0 ? (
              <div style={{ paddingTop: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "8px",
                    height: "160px",
                    borderBottom: "1px solid var(--border-subtle)",
                    paddingBottom: "8px",
                    overflowX: "auto",
                  }}
                >
                  {timeseries.points.map((pt, idx) => {
                    const heightPercent = Math.max((pt.clicks / maxBucketClicks) * 100, 6);
                    const formattedDate = new Date(pt.bucket).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: "1 1 36px",
                          minWidth: "32px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 600, marginBottom: "4px" }}>
                          {pt.clicks}
                        </span>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "32px",
                            height: `${heightPercent}%`,
                            background: "linear-gradient(180deg, var(--primary) 0%, #3b82f6 100%)",
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.3s ease",
                          }}
                          title={`${formattedDate}: ${pt.clicks} clicks`}
                        />
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "6px", whiteSpace: "nowrap" }}>
                          {formattedDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
                No click events recorded for this link yet. Clicks will populate here in real-time.
              </div>
            )}
          </div>

          {/* Telemetry Distributions: Devices, Browsers, Referrers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            {/* Top Devices */}
            <div className="dashboard-card">
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>
                Top Device Categories
              </h3>
              {summary?.devices?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {summary.devices.map((d, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span style={{ textTransform: "capitalize", color: "var(--text-secondary)" }}>{d.name || "Unknown"}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.clicks} clicks</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--surface)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (d.clicks / (summary.totals.clicks || 1)) * 100)}%`,
                            background: "#3b82f6",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No device breakdown available yet.</p>
              )}
            </div>

            {/* Top Browsers */}
            <div className="dashboard-card">
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>
                Top Browsers
              </h3>
              {summary?.browsers?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {summary.browsers.map((b, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{b.name || "Direct / Unknown"}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.clicks} clicks</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--surface)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (b.clicks / (summary.totals.clicks || 1)) * 100)}%`,
                            background: "#10b981",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No browser data recorded yet.</p>
              )}
            </div>

            {/* Top Referrers */}
            <div className="dashboard-card">
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>
                Top Referrers
              </h3>
              {summary?.referrers?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {summary.referrers.map((r, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                        <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>{r.name || "Direct (None)"}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.clicks} clicks</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--surface)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (r.clicks / (summary.totals.clicks || 1)) * 100)}%`,
                            background: "#a855f7",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No referrer data recorded yet.</p>
              )}
            </div>
          </div>

          {/* Recent Event Audit Stream Table */}
          <div className="dashboard-card">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px", color: "var(--text-primary)" }}>
              Recent Click Stream Audit Log
            </h3>
            {events.length > 0 ? (
              <div className="table-wrap">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th scope="col">Event Timestamp</th>
                      <th scope="col">Device</th>
                      <th scope="col">Browser</th>
                      <th scope="col">Operating System</th>
                      <th scope="col">Referrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((evt) => (
                      <tr key={evt.id}>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {new Date(evt.clickedAt).toLocaleString()}
                        </td>
                        <td>
                          <span style={{ textTransform: "capitalize", fontSize: "0.85rem" }}>
                            {evt.device || "Unknown"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>{evt.browser || "—"}</td>
                        <td style={{ fontSize: "0.85rem" }}>{evt.os || "—"}</td>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          {evt.referrer || "Direct"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                No events recorded yet. When users visit {activeLink?.shortUrl}, the BullMQ asynchronous worker records the click event stream here.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
