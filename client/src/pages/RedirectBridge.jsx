import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function RedirectBridge() {
  const { code } = useParams();
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    if (!code) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    // Detect if this link has 410 Gone / 404 Not Found
    fetch(`${apiUrl}/${encodeURIComponent(code)}`, {
      method: "GET",
      redirect: "manual", // Prevent browser from hiding redirect errors
    })
      .then(async (res) => {
        // Standard 302 Found redirect
        if (res.status === 302 || res.type === "opaqueredirect") {
          window.location.replace(`${apiUrl}/${encodeURIComponent(code)}`);
          return;
        }

        if (!res.ok) {
          try {
            const data = await res.json();
            setErrorInfo({
              status: res.status,
              code: data?.error?.code || (res.status === 410 ? "LINK_EXPIRED" : "URL_NOT_FOUND"),
              message: data?.error?.message || (res.status === 410 ? "This link has expired" : "Link not found"),
            });
          } catch {
            setErrorInfo({
              status: res.status,
              code: res.status === 410 ? "LINK_EXPIRED" : "URL_NOT_FOUND",
              message: res.status === 410 ? "This link has expired" : "Link not found",
            });
          }
          return;
        }

        // If 200 OK or followed
        window.location.replace(`${apiUrl}/${encodeURIComponent(code)}`);
      })
      .catch(() => {
        // Fallback directly to server redirect
        window.location.replace(`${apiUrl}/${encodeURIComponent(code)}`);
      });
  }, [code]);

  if (errorInfo) {
    const isExpired = errorInfo.status === 410 || errorInfo.code === "LINK_EXPIRED";
    const isDeleted = errorInfo.code === "LINK_DELETED";

    return (
      <div className="auth-container" style={{ padding: "80px 20px" }}>
        <div
          className="auth-card"
          style={{
            maxWidth: "540px",
            textAlign: "center",
            padding: "48px 32px",
            border: isExpired
              ? "1px solid rgba(245, 158, 11, 0.4)"
              : "1px solid var(--border-muted)",
            background: "var(--bg-surface)",
            boxShadow: "var(--shadow-lg)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: isExpired ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: isExpired ? "#f59e0b" : "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              fontSize: "1.8rem",
            }}
          >
            {isExpired ? "⏳" : isDeleted ? "🗑️" : "⚠️"}
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: isExpired ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: isExpired ? "#fbbf24" : "#f87171",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            HTTP {errorInfo.status} &bull; {errorInfo.code}
          </span>

          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            {isExpired
              ? "This Short Link Has Expired"
              : isDeleted
              ? "This Link Has Been Deleted"
              : "Short Link Not Found"}
          </h1>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              marginBottom: "24px",
            }}
          >
            {isExpired
              ? "The creator set an expiration window or maximum click quota on this link that has now passed."
              : "The short link you are trying to visit does not exist, was disabled, or was removed by its owner."}
          </p>

          <div
            style={{
              padding: "16px",
              background: "var(--bg-surface-raised)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "28px",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
              Requested Code
            </div>
            <code
              style={{
                fontSize: "1rem",
                color: "#60a5fa",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
            >
              /{code}
            </code>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <Link
              to="/"
              className="btn btn-primary"
              style={{ width: "100%", maxWidth: "320px", justifyContent: "center" }}
            >
              Create Your Own Branded Short Link &rarr;
            </Link>
            <Link to="/" className="btn btn-ghost btn-sm">
              Visit ShortLink.io Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ textAlign: "center", padding: "100px 20px" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--primary-subtle)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px auto",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </div>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
        Redirecting...
      </h2>
      <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "0.95rem" }}>
        Resolving short code <code style={{ color: "#60a5fa" }}>/{code}</code> via cache-aside engine...
      </p>
    </div>
  );
}
