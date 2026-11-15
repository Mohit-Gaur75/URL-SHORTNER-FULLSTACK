import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { createUrl, bulkCreateUrls } from "../api/urls";
import { useToast } from "../context/ToastContext";
import { downloadCsv } from "../utils/exportCsv";
import QrCodeModal from "../components/QrCodeModal";

const EXPIRATION_PRESETS = [
  { label: "Never (Lifetime)", hours: null },
  { label: "24 Hours", hours: 24 },
  { label: "7 Days", hours: 7 * 24 },
  { label: "30 Days", hours: 30 * 24 },
  { label: "Custom Date", hours: "custom" },
];

export default function CreateLinkPage() {
  const [activeTab, setActiveTab] = useState("single"); // "single" | "batch"

  // Single URL Mode state
  const [destinationUrl, setDestinationUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [expiredRedirectUrl, setExpiredRedirectUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(EXPIRATION_PRESETS[0]);
  const [customExpiry, setCustomExpiry] = useState("");
  const [showUtm, setShowUtm] = useState(false);
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState(null);

  // Batch Mode state
  const [batchRawText, setBatchRawText] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");

  const { showSuccess, showError } = useToast();

  const UTM_PRESETS = [
    { label: "Google Ads", source: "google", medium: "cpc", campaign: "promo" },
    { label: "Twitter / X Post", source: "twitter", medium: "social", campaign: "organic" },
    { label: "Email Newsletter", source: "newsletter", medium: "email", campaign: "weekly" },
    { label: "Product Hunt", source: "producthunt", medium: "referral", campaign: "launch" },
  ];

  const applyUtmPreset = (p) => {
    setUtmSource(p.source);
    setUtmMedium(p.medium);
    setUtmCampaign(p.campaign);
    setShowUtm(true);
    showSuccess(`Applied "${p.label}" UTM campaign template`);
  };

  const handleCsvFileUpload = (file) => {
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const urls = [];
      for (const line of lines) {
        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const candidate = parts.find((p) => p.startsWith("http://") || p.startsWith("https://"));
        if (candidate) urls.push(candidate);
      }
      if (urls.length > 0) {
        setBatchRawText(urls.join("\n"));
        showSuccess(`Imported ${urls.length} URLs from ${file.name}`);
      } else {
        showError("No valid http/https URLs found in CSV file");
      }
    };
    reader.readAsText(file);
  };

  // Compute final single destination with UTM params
  const fullTargetUrl = useMemo(() => {
    if (!destinationUrl.trim()) return "";
    try {
      const u = new URL(destinationUrl.trim());
      if (utmSource.trim()) u.searchParams.set("utm_source", utmSource.trim());
      if (utmMedium.trim()) u.searchParams.set("utm_medium", utmMedium.trim());
      if (utmCampaign.trim()) u.searchParams.set("utm_campaign", utmCampaign.trim());
      return u.toString();
    } catch {
      return destinationUrl.trim();
    }
  }, [destinationUrl, utmSource, utmMedium, utmCampaign]);

  // Compute batch URLs list
  const parsedBatchUrls = useMemo(() => {
    if (!batchRawText.trim()) return [];
    return batchRawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && (line.startsWith("http://") || line.startsWith("https://")));
  }, [batchRawText]);

  const computeExpiresAt = () => {
    if (selectedPreset.hours === "custom") {
      return customExpiry ? new Date(customExpiry).toISOString() : null;
    }
    if (typeof selectedPreset.hours === "number") {
      const d = new Date();
      d.setHours(d.getHours() + selectedPreset.hours);
      return d.toISOString();
    }
    return null;
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const expiresAt = computeExpiresAt();
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const res = await createUrl({
        originalUrl: fullTargetUrl,
        customCode: customSlug.trim() || undefined,
        expiresAt,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        maxClicks: maxClicks ? Number(maxClicks) : undefined,
        expiredRedirectUrl: expiredRedirectUrl.trim() || undefined,
      });

      setResult(res);
      if (res.duplicateWarning) {
        showSuccess(
          `Short link generated! (Notice: ${res.duplicateWarning.message} - /${res.duplicateWarning.shortCode})`
        );
      } else {
        showSuccess("Branded short link generated successfully!");
      }
    } catch (err) {
      const msg = err.message || "Failed to create short URL";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (parsedBatchUrls.length === 0) {
      showError("Please provide at least one valid http/https URL");
      return;
    }
    if (parsedBatchUrls.length > 50) {
      showError("Maximum 50 URLs can be shortened in a single batch");
      return;
    }

    setError("");
    setBatchResult(null);
    setLoading(true);

    try {
      const expiresAt = computeExpiresAt();
      const payload = parsedBatchUrls.map((originalUrl) => ({
        originalUrl,
        expiresAt,
      }));

      const res = await bulkCreateUrls(payload);
      setBatchResult(res);
      showSuccess(`Batch complete: ${res.successful} of ${res.total} links shortened!`);
    } catch (err) {
      const msg = err.message || "Failed to process batch shortening";
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySingle = async () => {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      showSuccess("Short link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Could not copy link");
    }
  };

  const handleCopyAllBatch = async () => {
    if (!batchResult?.items) return;
    const urls = batchResult.items
      .filter((i) => i.success)
      .map((i) => i.shortUrl)
      .join("\n");
    try {
      await navigator.clipboard.writeText(urls);
      showSuccess(`Copied ${batchResult.successful} short links to clipboard!`);
    } catch {
      showError("Could not copy batch links");
    }
  };

  const handleExportBatchCsv = () => {
    if (!batchResult?.items) return;
    const headers = ["Original Destination URL", "Short Code", "Short URL", "Status", "Error"];
    const rows = batchResult.items.map((i) => [
      i.originalUrl,
      i.shortCode || "—",
      i.shortUrl || "—",
      i.success ? "Success" : "Failed",
      i.error || "—",
    ]);
    downloadCsv(`shortlink-batch-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    showSuccess("Batch results exported to CSV");
  };

  const handleReset = () => {
    setDestinationUrl("");
    setCustomSlug("");
    setSelectedPreset(EXPIRATION_PRESETS[0]);
    setCustomExpiry("");
    setUtmSource("");
    setUtmMedium("");
    setUtmCampaign("");
    setResult(null);
    setBatchResult(null);
    setBatchRawText("");
    setError("");
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 900 }}>
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>Link Creation Studio</h1>
          <p className="dashboard-subtitle">
            Generate vanity URLs, build attribution campaigns, or process bulk URL batches in parallel.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="filter-tabs" role="group" aria-label="Creation Mode" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={activeTab === "single" ? "filter-tab active" : "filter-tab"}
            onClick={() => {
              setActiveTab("single");
              setError("");
            }}
          >
            Single Link Studio
          </button>
          <button
            type="button"
            className={activeTab === "batch" ? "filter-tab active" : "filter-tab"}
            onClick={() => {
              setActiveTab("batch");
              setError("");
            }}
          >
            Batch Shortener (Bulk)
          </button>
        </div>
      </div>

      {/* SINGLE URL RESULT SCREEN */}
      {activeTab === "single" && result && (
        <div
          className="dashboard-card"
          style={{
            textAlign: "center",
            padding: "40px 32px",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            background: "linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0.95) 100%)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
            Your Short Link is Live!
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", maxWidth: 520, margin: "0 auto 24px" }}>
            Traffic to this link is protected with sub-1ms Redis cache lookups and asynchronous analytics tracking.
          </p>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              maxWidth: "100%",
              marginBottom: "28px",
            }}
          >
            <a
              href={result.shortUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "1.15rem",
                color: "#38bdf8",
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "var(--font-mono)",
                wordBreak: "break-all",
              }}
            >
              {result.shortUrl}
            </a>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "32px" }}>
            <button
              type="button"
              className={copied ? "btn btn-secondary" : "btn btn-primary"}
              onClick={handleCopySingle}
              style={{ gap: "8px", minWidth: 120 }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQrModalUrl(result.shortUrl)}
              style={{ gap: "8px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>QR Code</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ gap: "8px" }}
            >
              <span>+ Create Another</span>
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
            <Link to="/links" className="btn btn-ghost" style={{ fontSize: "0.875rem" }}>
              View in My Links Hub &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* SINGLE URL INPUT FORM */}
      {activeTab === "single" && !result && (
        <form onSubmit={handleSingleSubmit} className="dashboard-card" style={{ padding: "32px" }}>
          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: "24px" }}>
              <span>{error}</span>
            </div>
          )}

          {/* Destination URL */}
          <div className="form-group">
            <label className="form-label" htmlFor="destination-url">
              Destination URL <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="destination-url"
              type="url"
              className="form-input"
              placeholder="https://example.com/products/summer-sale?id=123"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              required
              autoFocus
            />
            <p className="form-helper">The original target web page to redirect visitors to.</p>
          </div>

          {/* Custom Vanity Alias */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-slug">
              Vanity Custom Slug (Optional)
            </label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span
                style={{
                  padding: "12px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-muted)",
                  borderRight: "none",
                  borderTopLeftRadius: "var(--radius-md)",
                  borderBottomLeftRadius: "var(--radius-md)",
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {window.location.host}/
              </span>
              <input
                id="custom-slug"
                type="text"
                className="form-input"
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                placeholder="my-campaign-alias"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              />
            </div>
            <p className="form-helper">
              3 to 30 characters (letters, numbers, hyphens, and underscores). Leave blank for auto-generated Base62 hash.
            </p>
          </div>

          {/* Tags & Categories */}
          <div className="form-group">
            <label className="form-label" htmlFor="link-tags">
              Tags &amp; Categories (Optional)
            </label>
            <input
              id="link-tags"
              type="text"
              className="form-input"
              placeholder="e.g. marketing, launch, newsletter"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="form-helper">Separate multiple tags with commas to group and filter your links in the hub.</p>
          </div>

          {/* Advanced Limits: Max Clicks & Fallback Destination */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="max-clicks">
                Max Clicks (Burn-after-N-visits)
              </label>
              <input
                id="max-clicks"
                type="number"
                min="1"
                className="form-input"
                placeholder="e.g. 50 (Unlimited if empty)"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
              />
              <p className="form-helper">Link automatically expires when this click quota is reached.</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fallback-url">
                Expired Fallback URL (Optional)
              </label>
              <input
                id="fallback-url"
                type="url"
                className="form-input"
                placeholder="https://example.com/campaign-ended"
                value={expiredRedirectUrl}
                onChange={(e) => setExpiredRedirectUrl(e.target.value)}
              />
              <p className="form-helper">Redirect visitors here after link expires instead of a 410 error.</p>
            </div>
          </div>

          {/* Expiration Settings */}
          <div className="form-group">
            <label className="form-label">Link Lifecycle &amp; Expiration</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
              {EXPIRATION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={selectedPreset.label === preset.label ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  onClick={() => setSelectedPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {selectedPreset.hours === "custom" && (
              <input
                type="datetime-local"
                className="form-input"
                style={{ maxWidth: 300 }}
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                required
              />
            )}
            <p className="form-helper">
              When expired, this short link will automatically return HTTP 410 Gone while keeping the custom code reserved.
            </p>
          </div>

          {/* UTM Campaign Parameters Builder */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "20px", marginTop: "24px" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowUtm(!showUtm)}
              style={{ gap: "6px", color: "var(--text-secondary)", marginBottom: "16px" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transform: showUtm ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>{showUtm ? "Hide Campaign UTM Builder" : "Add Marketing UTM Parameters (Optional)"}</span>
            </button>

            {showUtm && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "20px",
                  marginBottom: "20px",
                }}
              >
                {/* Reusable UTM Campaign Presets */}
                <div style={{ marginBottom: "16px" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                    Quick Campaign Presets:
                  </span>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {UTM_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                        onClick={() => applyUtmPreset(p)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>
                      UTM Source
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. google, twitter, newsletter"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>
                      UTM Medium
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. cpc, social, email"
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>
                      UTM Campaign
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. spring_promo_2026"
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                    />
                  </div>
                </div>

                {fullTargetUrl && (
                  <div style={{ marginTop: "16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Assembled Target URL:</span>
                    <div style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all", marginTop: "4px", color: "#60a5fa" }}>
                      {fullTargetUrl}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            <Link to="/links" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !destinationUrl.trim()}
              style={{ minWidth: 160 }}
            >
              {loading ? "Generating..." : "Generate Short Link"}
            </button>
          </div>
        </form>
      )}

      {/* BATCH BULK SHORTENER SCREEN */}
      {activeTab === "batch" && (
        <div className="dashboard-card" style={{ padding: "32px" }}>
          {error && (
            <div className="alert-error" role="alert" style={{ marginBottom: "24px" }}>
              <span>{error}</span>
            </div>
          )}

          {batchResult ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  paddingBottom: "20px",
                  borderBottom: "1px solid var(--border-subtle)",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
                    Batch Generation Completed
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    Successfully created <strong>{batchResult.successful}</strong> of <strong>{batchResult.total}</strong> links.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyAllBatch}>
                    Copy All Links
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportBatchCsv}>
                    Download CSV
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
                    New Batch
                  </button>
                </div>
              </div>

              {/* Batch Results Table */}
              <div className="table-wrap">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th scope="col">Destination URL</th>
                      <th scope="col">Short Link</th>
                      <th scope="col">Status</th>
                      <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.originalUrl}
                        </td>
                        <td>
                          {item.success ? (
                            <code style={{ color: "#38bdf8", fontWeight: 600 }}>{item.shortUrl}</code>
                          ) : (
                            <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{item.error}</span>
                          )}
                        </td>
                        <td>
                          <span className={item.success ? "badge badge-active" : "badge badge-expired"}>
                            {item.success ? "Success" : "Failed"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {item.success && (
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                type="button"
                                className="action-chip-btn"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.shortUrl);
                                  showSuccess("Copied: " + item.shortUrl);
                                }}
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                className="action-chip-btn"
                                onClick={() => setQrModalUrl(item.shortUrl)}
                              >
                                QR
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBatchSubmit}>
              {/* Drag-and-drop CSV file importer */}
              <div
                style={{
                  border: "2px dashed var(--border-muted)",
                  borderRadius: "var(--radius-md)",
                  padding: "20px",
                  textAlign: "center",
                  background: "var(--bg-surface-raised)",
                  marginBottom: "20px",
                  cursor: "pointer",
                  transition: "border-color 150ms ease",
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleCsvFileUpload(file);
                }}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📁</div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  {csvFileName ? `Loaded: ${csvFileName}` : "Drag and drop a .CSV file here"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "4px" }}>
                  Or click to upload spreadsheet with destination URLs
                </div>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", marginTop: "12px", cursor: "pointer" }}
                >
                  Browse CSV File
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvFileUpload(file);
                    }}
                  />
                </label>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="batch-urls">
                  Destination URLs (One per line, up to 50 URLs)
                </label>
                <textarea
                  id="batch-urls"
                  rows={8}
                  className="form-input"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", lineHeight: 1.5 }}
                  placeholder={`https://github.com/project-a\nhttps://example.com/promo-2\nhttps://news.ycombinator.com`}
                  value={batchRawText}
                  onChange={(e) => setBatchRawText(e.target.value)}
                  required
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span>Paste raw URLs or links extracted from a spreadsheet.</span>
                  <span style={{ color: parsedBatchUrls.length > 0 ? "#60a5fa" : "var(--text-muted)", fontWeight: 600 }}>
                    {parsedBatchUrls.length} valid URL{parsedBatchUrls.length === 1 ? "" : "s"} detected
                  </span>
                </div>
              </div>

              {/* Shared Expiration Settings for Batch */}
              <div className="form-group" style={{ marginTop: "20px" }}>
                <label className="form-label">Shared Expiration Policy for Batch</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {EXPIRATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={selectedPreset.label === preset.label ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                      onClick={() => setSelectedPreset(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || parsedBatchUrls.length === 0}
                  style={{ minWidth: 180 }}
                >
                  {loading ? "Processing Batch..." : `Batch Shorten (${parsedBatchUrls.length} URLs)`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* QR Modal */}
      <QrCodeModal
        isOpen={Boolean(qrModalUrl)}
        onClose={() => setQrModalUrl(null)}
        shortUrl={qrModalUrl}
      />
    </div>
  );
}
