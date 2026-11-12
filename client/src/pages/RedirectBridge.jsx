import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function RedirectBridge() {
  const { code } = useParams();

  useEffect(() => {
    if (code) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      window.location.replace(`${apiUrl}/${encodeURIComponent(code)}`);
    }
  }, [code]);

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
