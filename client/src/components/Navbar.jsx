import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
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
            </div>

            <div className="nav-user">
              <Link to="/settings" className="user-badge" title={user.email} style={{ textDecoration: "none" }}>
                <div className="user-avatar">
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
          <div className="nav-links">
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
