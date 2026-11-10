import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: "center", maxWidth: 500 }}>
        <div
          style={{
            fontSize: "4.5rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, var(--primary), #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            marginBottom: "16px",
          }}
        >
          404
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
          Page Not Found
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "28px", lineHeight: 1.5 }}>
          The requested route doesn't exist or has moved. If you were attempting to access a shortened URL, please check the short code.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
          <Link to={user ? "/dashboard" : "/"} className="btn btn-primary">
            {user ? "Return to Dashboard" : "Return to Home"}
          </Link>
          {user && (
            <Link to="/links" className="btn btn-secondary">
              View My Links
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
