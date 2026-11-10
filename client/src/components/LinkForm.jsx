import { useState } from "react";
import { createUrl } from "../api/urls";

export default function LinkForm({ onCreated }) {
  const [originalUrl, setOriginalUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await createUrl({
        originalUrl: originalUrl.trim(),
        customCode: customCode.trim() || undefined,
      });
      setResult(data);
      if (onCreated) {
        setOriginalUrl("");
        setCustomCode("");
        onCreated(data);
      }
    } catch (err) {
      setError(err.message || "Failed to create short URL");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  return (
    <div className="shortener-widget">
      <form onSubmit={handleSubmit} noValidate={false}>
        <div className="shortener-main-row">
          <input
            type="url"
            className="form-input shortener-main-input"
            placeholder="Paste your long destination URL (e.g. https://github.com/...)"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
            autoComplete="url"
            spellCheck="false"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !originalUrl.trim()}
          >
            {loading ? (
              <span>Shortening...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>Shorten</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          className="shortener-options-toggle"
          onClick={() => setShowOptions(!showOptions)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showOptions ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 150ms ease",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>{showOptions ? "Hide options" : "Custom alias (optional)"}</span>
        </button>

        {showOptions && (
          <div className="shortener-options-drawer">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="custom-slug">
                Custom Alias / Slug
              </label>
              <input
                id="custom-slug"
                type="text"
                className="form-input"
                placeholder="e.g. spring-sale-2026"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
              />
              <p className="form-helper">Letters, numbers, underscores and hyphens (3-30 chars).</p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert-error" role="alert" style={{ marginTop: "16px" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="shortener-result-card">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Shortened Link Ready
              </span>
              <a
                href={result.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="shortener-result-link"
              >
                {result.shortUrl}
              </a>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={copied ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
              style={{ minWidth: "100px" }}
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
