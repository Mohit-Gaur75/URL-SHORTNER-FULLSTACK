import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, changePassword, logoutEverywhere, deleteAccount, fetchAuditLogs } from "../api/auth";
import Modal from "../components/Modal";

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

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Delete Account Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadAuditLogs = (page = 1) => {
    setLoadingAudit(true);
    fetchAuditLogs({ page, limit: 8 })
      .then((data) => {
        setAuditLogs(data?.items || []);
        setAuditPage(data?.page || 1);
        setAuditTotalPages(data?.totalPages || 1);
      })
      .catch((err) => {
        console.warn("Failed to load audit logs:", err.message);
      })
      .finally(() => {
        setLoadingAudit(false);
      });
  };

  useEffect(() => {
    loadAuditLogs(1);
  }, []);

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
      loadAuditLogs(1);
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

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError("Password is required to confirm account deletion");
      return;
    }
    setDeletingAccount(true);
    setDeleteError("");
    try {
      await deleteAccount({ password: deletePassword });
      showSuccess("Account permanently deleted. Thank you for using our service.");
      logout();
      window.location.href = "/register";
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account. Please verify your password.");
      setDeletingAccount(false);
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
            Manage your session security policies, profile preferences, audit activity logs, and account lifecycle.
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
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
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
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
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

      {/* Security Audit Activity Log Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Security Audit Activity Log</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Immutable audit records of critical authentication events, IP addresses, and timestamps.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadAuditLogs(auditPage)}
            disabled={loadingAudit}
          >
            {loadingAudit ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingAudit && auditLogs.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--text-muted)", textAlign: "center" }}>
            Loading audit trail...
          </div>
        ) : auditLogs.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th scope="col">Event / Action</th>
                    <th scope="col">IP Address</th>
                    <th scope="col">Timestamp</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-mono)",
                            padding: "2px 6px",
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#60a5fa",
                            borderRadius: "var(--radius-sm)",
                            fontWeight: 600,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                        {log.ip || "—"}
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {log.details && Object.keys(log.details).length > 0
                          ? JSON.stringify(log.details)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {auditTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={auditPage <= 1 || loadingAudit}
                  onClick={() => loadAuditLogs(auditPage - 1)}
                >
                  &larr; Prev
                </button>
                <span style={{ fontSize: "0.85rem", alignSelf: "center", color: "var(--text-secondary)" }}>
                  Page {auditPage} of {auditTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={auditPage >= auditTotalPages || loadingAudit}
                  onClick={() => loadAuditLogs(auditPage + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "8px 0" }}>
            No security audit events recorded yet.
          </p>
        )}
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

      {/* Session Management Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>
          Session Management
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

      {/* Danger Zone: GDPR Account Deletion */}
      <div className="dashboard-card" style={{ border: "1px solid rgba(239, 68, 68, 0.35)", background: "rgba(239, 68, 68, 0.03)" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--danger)", marginBottom: "8px" }}>
          Danger Zone &mdash; Right to Be Forgotten
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Permanently delete your user account, revoke all session credentials, purge cached tokens in Redis, and soft-delete all vanity links. This action cannot be undone.
        </p>

        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            setDeletePassword("");
            setDeleteError("");
            setShowDeleteModal(true);
          }}
        >
          Delete My Account Permanently
        </button>
      </div>

      {/* Account Deletion Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => !deletingAccount && setShowDeleteModal(false)}
        title="Permanently Delete Account?"
      >
        <form onSubmit={handleDeleteAccountSubmit}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "16px" }}>
            This will permanently remove your account, revoke all tokens across every device, and deactivate all shortened links you own.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="delete-account-pw">
              Enter your current password to confirm:
            </label>
            <input
              id="delete-account-pw"
              type="password"
              className="form-input"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your current password"
              required
              disabled={deletingAccount}
              autoFocus
            />
          </div>

          {deleteError && (
            <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
              <span>{deleteError}</span>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deletingAccount}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={deletingAccount || !deletePassword}
            >
              {deletingAccount ? "Deleting Account..." : "Confirm Delete Account"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}