import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, changePassword, logoutEverywhere } from "../api/auth";

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { showSuccess, showError } = useToast();

  // Profile Form state
  const [name, setName] = useState(user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Logout everywhere state
  const [revoking, setRevoking] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showError("Name cannot be empty");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await updateProfile({ name: name.trim() });
      updateUser(res.user);
      showSuccess("Profile name updated successfully!");
    } catch (err) {
      showError(err.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      showSuccess("Password changed successfully! Other sessions invalidated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showError(err.message || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!window.confirm("Are you sure you want to log out of all devices? You will be returned to the login screen.")) {
      return;
    }
    setRevoking(true);
    try {
      await logoutEverywhere();
      showSuccess("All active sessions revoked.");
      logout();
      window.location.href = "/login";
    } catch (err) {
      showError(err.message || "Failed to revoke sessions");
      setRevoking(false);
    }
  };

  const handleCopyApiSnippet = () => {
    const snippet = `curl -X POST http://localhost:5000/api/urls \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\
  -d '{"originalUrl": "https://github.com", "customCode": "my-gh"}'`;
    navigator.clipboard.writeText(snippet);
    showSuccess("API example copied to clipboard!");
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 880 }}>
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>Account &amp; Security Settings</h1>
          <p className="dashboard-subtitle">
            Manage your session security policies, profile preferences, and API integrations.
          </p>
        </div>
      </div>

      {/* User Identity Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "20px" }}>
          Authenticated Profile
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "white",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
            }}
          >
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {user?.name || "Anonymous User"}
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              {user?.email}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <span className="badge badge-active" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
                Role: {user?.role || "USER"}
              </span>
              <span className="badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)", fontSize: "0.75rem" }}>
                ID: {user?.id || user?._id || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Update Profile Form */}
        <form onSubmit={handleUpdateProfile} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "20px" }}>
          <div className="form-group" style={{ maxWidth: 400, marginBottom: "16px" }}>
            <label className="form-label" htmlFor="profile-name">
              Display Name
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                id="profile-name"
                type="text"
                className="form-input"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={profileSaving || name === user?.name}
                style={{ flexShrink: 0 }}
              >
                {profileSaving ? "Saving..." : "Save Name"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>
          Security &amp; Password
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Changing your password automatically increments your security token version, ending sessions on all other browsers.
        </p>

        <form onSubmit={handleChangePassword} style={{ maxWidth: 440 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="current-pw">
              Current Password
            </label>
            <div className="input-password-wrapper">
              <input
                id="current-pw"
                type={showCurrent ? "text" : "password"}
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-pw">
              New Password (min 8 chars)
            </label>
            <div className="input-password-wrapper">
              <input
                id="new-pw"
                type={showNew ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-pw">
              Confirm New Password
            </label>
            <input
              id="confirm-pw"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={passwordSaving || !currentPassword || !newPassword}
          >
            {passwordSaving ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Security Engine Overview */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "16px" }}>
          Active Security &amp; Isolation Architecture
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", display: "block", fontSize: "0.9rem" }}>
              JWT Access Tokens
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Short-lived 15-minute access token lifespan in memory, preventing persistent credential leaks.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", display: "block", fontSize: "0.9rem" }}>
              HttpOnly Refresh Cookies
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Single-use rotating refresh tokens delivered via secure `SameSite=Strict` cookies, immune to XSS.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", display: "block", fontSize: "0.9rem" }}>
              Rate Limiting &amp; HPP
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Per-IP and per-account sliding-window request throttling with HTTP parameter pollution defense.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "14px" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", display: "block", fontSize: "0.9rem" }}>
              NoSQL Injection Defense
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Payload key sanitization strips operator injections (`$gt`, `$where`) and prototype pollution vectors.
            </p>
          </div>
        </div>
      </div>

      {/* Developer API Reference */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Developer API Integration</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Programmatically create and manage links using standard HTTP REST requests.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyApiSnippet}>
            Copy cURL
          </button>
        </div>

        <div
          style={{
            background: "rgba(10, 15, 30, 0.95)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            fontSize: "0.85rem",
            color: "#93c5fd",
            fontFamily: "var(--font-mono)",
            overflowX: "auto",
            lineHeight: 1.5,
          }}
        >
          <div><span style={{ color: "#f472b6" }}>curl</span> -X POST http://localhost:5000/api/urls \</div>
          <div style={{ paddingLeft: "16px" }}>-H <span style={{ color: "#34d399" }}>"Content-Type: application/json"</span> \</div>
          <div style={{ paddingLeft: "16px" }}>-H <span style={{ color: "#34d399" }}>"Authorization: Bearer &lt;YOUR_ACCESS_TOKEN&gt;"</span> \</div>
          <div style={{ paddingLeft: "16px" }}>-d <span style={{ color: "#facc15" }}>'&#123;"originalUrl": "https://github.com", "customCode": "my-gh"&#125;'</span></div>
        </div>
      </div>

      {/* Session Management & Danger Zone */}
      <div className="dashboard-card" style={{ border: "1px solid rgba(239, 68, 68, 0.3)" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--danger)", marginBottom: "8px" }}>
          Session Management &amp; Termination
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Terminate active browser sessions or invalidate all device refresh tokens across your account.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLogoutEverywhere}
            disabled={revoking}
          >
            {revoking ? "Revoking..." : "Log Out of All Devices"}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
          >
            Sign Out (This Device)
          </button>
        </div>
      </div>
    </div>
  );
}
