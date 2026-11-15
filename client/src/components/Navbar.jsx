import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true })
    );
  };

  const getInitials = (name, email) => {
    if (name && name.trim()) return name.trim().charAt(0).toUpperCase();
    if (email && email.trim()) return email.trim().charAt(0).toUpperCase();
    return "U";
  };

  return (
    <header className="navbar-wrapper">
      <nav className="navbar" aria-label="Main Navigation">
        <Link to={user ? "/dashboard" : "/"} className="nav-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <span>ShortLink<span style={{ color: "var(--primary)" }}>.io</span></span>
        </Link>

        {/* Global Quick Search / Command Palette shortcut */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="command-palette-trigger"
          title="Open Command Palette (Ctrl+K or Cmd+K)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 12px",
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-full)",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>🔍 Search or jump to...</span>
          <kbd
            style={{
              padding: "1px 5px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-muted)",
              borderRadius: "4px",
              fontSize: "0.7rem",
              fontFamily: "var(--font-mono)",
            }}
          >
            ⌘K
          </kbd>
        </button>

        {user ? (
          <div className="nav-links">
            <div className="nav-menu-items">
              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/links"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                My Links
              </NavLink>
              <NavLink
                to="/create"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Create
              </NavLink>
              <NavLink
                to="/analytics"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Analytics
              </NavLink>
              <NavLink
                to="/system-status"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Status
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                Settings
              </NavLink>
              {user?.role === "ADMIN" && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  Admin
                  <span
                    style={{
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      background: "rgba(168, 85, 247, 0.25)",
                      color: "#c084fc",
                      borderRadius: "4px",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                    }}
                  >
                    PRO
                  </span>
                </NavLink>
              )}
            </div>

            <div className="nav-user" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>

              <Link to="/settings" className="user-badge" title={user.email} style={{ textDecoration: "none" }}>
                <div
                  className="user-avatar"
                  style={user?.role === "ADMIN" ? { background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", color: "#fff" } : undefined}
                >
                  {getInitials(user.name, user.email)}
                </div>
                <span>{user.name || user.email}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              className="btn btn-secondary btn-sm"
              style={{
                padding: "6px 10px",
                borderRadius: "var(--radius-full)",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <Link to="/login" className="nav-link">
              Log in
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
