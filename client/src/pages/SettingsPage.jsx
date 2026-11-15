import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, changePassword, logoutEverywhere, deleteAccount, fetchAuditLogs } from "../api/auth";
import { listApiKeys, createApiKey, revokeApiKey } from "../api/apiKeys";
import { listWebhooks, createWebhook, updateWebhook, deleteWebhook, testWebhook } from "../api/webhooks";
import Modal from "../components/Modal";
import CopyButton from "../components/CopyButton";

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

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyExpiry, setKeyExpiry] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKeyResult, setCreatedKeyResult] = useState(null);
  const [revokingKeyId, setRevokingKeyId] = useState(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [webhookEvents, setWebhookEvents] = useState(["link.clicked", "link.quota_reached", "link.expired"]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState(null);
  const [testingWebhookId, setTestingWebhookId] = useState(null);
  const [deletingWebhookId, setDeletingWebhookId] = useState(null);

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

  const loadApiKeys = () => {
    setLoadingKeys(true);
    listApiKeys()
      .then((items) => setApiKeys(items || []))
      .catch((err) => console.warn("Failed to load API keys:", err.message))
      .finally(() => setLoadingKeys(false));
  };

  const loadWebhooks = () => {
    setLoadingWebhooks(true);
    listWebhooks()
      .then((items) => setWebhooks(items || []))
      .catch((err) => console.warn("Failed to load webhooks:", err.message))
      .finally(() => setLoadingWebhooks(false));
  };

  useEffect(() => {
    loadAuditLogs(1);
    loadApiKeys();
    loadWebhooks();
  }, []);

  const handleToggleEvent = (ev) => {
    if (webhookEvents.includes(ev)) {
      if (webhookEvents.length === 1) {
        showError("At least one event must be selected");
        return;
      }
      setWebhookEvents(webhookEvents.filter((e) => e !== ev));
    } else {
      setWebhookEvents([...webhookEvents, ev]);
    }
  };

  const handleCreateWebhookSubmit = async (e) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setCreatingWebhook(true);
    try {
      const res = await createWebhook({
        url: webhookUrl.trim(),
        description: webhookDesc.trim() || undefined,
        events: webhookEvents,
      });
      setCreatedWebhookSecret(res);
      showSuccess("Webhook created successfully!");
      setShowWebhookModal(false);
      setWebhookUrl("");
      setWebhookDesc("");
      loadWebhooks();
    } catch (err) {
      showError(err.message || "Failed to create webhook");
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id, url) => {
    if (!window.confirm(`Delete webhook for ${url}?`)) return;
    setDeletingWebhookId(id);
    try {
      await deleteWebhook(id);
      showSuccess("Webhook deleted successfully");
      loadWebhooks();
    } catch (err) {
      showError(err.message || "Failed to delete webhook");
    } finally {
      setDeletingWebhookId(null);
    }
  };

  const handleTestWebhook = async (id) => {
    setTestingWebhookId(id);
    try {
      const res = await testWebhook(id);
      if (res.delivery?.success) {
        showSuccess(`Test ping successful! HTTP ${res.delivery.statusCode} in ${res.delivery.latencyMs}ms`);
      } else {
        showError(`Test ping failed: ${res.delivery?.error || `HTTP ${res.delivery?.statusCode || "No Response"}`}`);
      }
      loadWebhooks();
    } catch (err) {
      showError(err.message || "Failed to dispatch test ping");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleToggleWebhookStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await updateWebhook(id, { status: nextStatus });
      showSuccess(`Webhook ${nextStatus === "active" ? "activated" : "disabled"}`);
      loadWebhooks();
    } catch (err) {
      showError(err.message || "Failed to update webhook status");
    }
  };

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

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await createApiKey({
        name: keyName.trim(),
        expiresAt: keyExpiry ? new Date(keyExpiry).toISOString() : null,
      });
      setCreatedKeyResult(res);
      setKeyName("");
      setKeyExpiry("");
      loadApiKeys();
      loadAuditLogs(1);
      showSuccess("API key generated successfully!");
    } catch (err) {
      showError(err.message || "Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id, name) => {
    if (!window.confirm(`Are you sure you want to revoke "${name}"? Any external automations or scripts using this token will immediately fail.`)) {
      return;
    }
    setRevokingKeyId(id);
    try {
      await revokeApiKey(id);
      showSuccess(`API key "${name}" revoked.`);
      loadApiKeys();
      loadAuditLogs(1);
    } catch (err) {
      showError(err.message || "Failed to revoke API key");
    } finally {
      setRevokingKeyId(null);
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
  -H "Authorization: Bearer sk_live_<YOUR_API_KEY>" \\
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
            Manage your session security policies, API access tokens, audit activity logs, and account lifecycle.
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

      {/* Personal Access Tokens / API Keys Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Personal Access Tokens (API Keys)</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Persistent secret tokens for authenticating scripts, CLI tools, GitHub Actions, and Zapier without session expiration.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCreatedKeyResult(null);
              setKeyName("");
              setKeyExpiry("");
              setShowKeyModal(true);
            }}
          >
            + Generate New Token
          </button>
        </div>

        {loadingKeys && apiKeys.length === 0 ? (
          <div style={{ padding: "16px 0", color: "var(--text-muted)", textAlign: "center" }}>
            Loading API keys...
          </div>
        ) : apiKeys.length > 0 ? (
          <div className="table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Token Prefix</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last Used</th>
                  <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{key.name}</td>
                    <td>
                      <code style={{ fontSize: "0.85rem", color: "#38bdf8", background: "var(--bg-surface-raised)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>
                        {key.keyPrefix}
                      </code>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: key.lastUsedAt ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never used"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={revokingKeyId === key.id}
                        onClick={() => handleRevokeKey(key.id, key.name)}
                        style={{ padding: "3px 10px", fontSize: "0.75rem" }}
                      >
                        {revokingKeyId === key.id ? "Revoking..." : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "8px 0" }}>
            No personal access tokens generated yet. Click &ldquo;+ Generate New Token&rdquo; to create an API key.
          </p>
        )}
      </div>

      {/* Outbound Webhooks Card */}
      <div className="dashboard-card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Outbound Event Webhooks</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Receive real-time HTTP POST notifications signed with HMAC-SHA256 when links are clicked, reach quota limits, or expire.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setWebhookUrl("");
              setWebhookDesc("");
              setWebhookEvents(["link.clicked", "link.quota_reached", "link.expired"]);
              setShowWebhookModal(true);
            }}
          >
            + Add Webhook Endpoint
          </button>
        </div>

        {loadingWebhooks && webhooks.length === 0 ? (
          <div style={{ padding: "16px 0", color: "var(--text-muted)", textAlign: "center" }}>
            Loading webhooks...
          </div>
        ) : webhooks.length > 0 ? (
          <div className="table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th scope="col">Endpoint URL</th>
                  <th scope="col">Subscribed Events</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Delivery</th>
                  <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-all" }}>
                        {wh.url}
                      </div>
                      {wh.description && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          {wh.description}
                        </div>
                      )}
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Secret: <code>{wh.secret || "hook_sec_••••"}</code>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {wh.events?.map((ev) => (
                          <span
                            key={ev}
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              background: "var(--bg-surface-raised)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-secondary)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleWebhookStatus(wh.id, wh.status)}
                        className={`badge ${wh.status === "active" ? "badge-active" : "badge-disabled"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        title="Click to toggle active/disabled status"
                      >
                        {wh.status === "active" ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td>
                      {wh.lastDeliveredAt ? (
                        <div>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: wh.lastStatusCode >= 200 && wh.lastStatusCode < 300 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {wh.lastStatusCode ? `HTTP ${wh.lastStatusCode}` : "Failed"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                            {new Date(wh.lastDeliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {wh.lastError && (
                            <span style={{ fontSize: "0.7rem", color: "#ef4444", display: "block" }} title={wh.lastError}>
                              ⚠️ {wh.lastError.slice(0, 30)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Never fired</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={testingWebhookId === wh.id}
                        onClick={() => handleTestWebhook(wh.id)}
                        style={{ padding: "3px 8px", fontSize: "0.75rem", marginRight: "6px" }}
                        title="Send mock ping payload"
                      >
                        {testingWebhookId === wh.id ? "Pinging..." : "Test Ping ⚡"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deletingWebhookId === wh.id}
                        onClick={() => handleDeleteWebhook(wh.id, wh.url)}
                        style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "8px 0" }}>
            No webhooks configured yet. Register a URL to get notified on clicks, quota exhaustion, and expiry.
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
          <div style={{ paddingLeft: "16px" }}>-H <span style={{ color: "#34d399" }}>"Authorization: Bearer sk_live_&lt;YOUR_API_KEY&gt;"</span> \</div>
          <div style={{ paddingLeft: "16px" }}>-d <span style={{ color: "#facc15" }}>'&#123;"originalUrl": "https://github.com", "customCode": "my-gh"&#125;'</span></div>
        </div>
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

      {/* Generate API Key Modal */}
      <Modal
        open={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title={createdKeyResult ? "API Key Generated" : "Generate Personal Access Token"}
      >
        {createdKeyResult ? (
          <div>
            <div className="alert-success" style={{ marginBottom: "16px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontWeight: 600, color: "#10b981", marginBottom: "4px" }}>
                Make sure to copy your API key now!
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                For security reasons, this token cannot be viewed again. If you lose it, you will need to revoke it and generate a new one.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Secret API Key</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  value={createdKeyResult.rawKey}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#38bdf8" }}
                />
                <CopyButton text={createdKeyResult.rawKey} />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowKeyModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateApiKey}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Give your token a descriptive name so you can identify its purpose later.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="api-key-name">
                Token Name
              </label>
              <input
                id="api-key-name"
                type="text"
                className="form-input"
                placeholder="e.g. CI/CD Deployment, Zapier, Local CLI"
                value={keyName}
                maxLength={60}
                onChange={(e) => setKeyName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="api-key-exp">
                Expiration (Optional)
              </label>
              <input
                id="api-key-exp"
                type="datetime-local"
                className="form-input"
                value={keyExpiry}
                onChange={(e) => setKeyExpiry(e.target.value)}
              />
              <p className="form-helper">Leave blank for a non-expiring permanent token.</p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKeyModal(false)}
                disabled={creatingKey}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingKey || !keyName.trim()}
              >
                {creatingKey ? "Generating..." : "Generate Token"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Webhook Modal */}
      <Modal
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        title="Add Outbound Webhook Endpoint"
      >
        <form onSubmit={handleCreateWebhookSubmit}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px" }}>
            Specify the destination URL that will receive signed HTTP POST JSON payloads when events occur.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="webhook-url">
              Endpoint Target URL
            </label>
            <input
              id="webhook-url"
              type="url"
              className="form-input"
              placeholder="https://api.yourdomain.com/webhooks/shortlinks"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="webhook-desc">
              Description (Optional)
            </label>
            <input
              id="webhook-desc"
              type="text"
              className="form-input"
              placeholder="e.g. Analytics Data Ingest, Slack Alert"
              value={webhookDesc}
              maxLength={100}
              onChange={(e) => setWebhookDesc(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: "8px" }}>
              Subscribed Events
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { id: "link.clicked", label: "link.clicked", desc: "Dispatched whenever a visitor is redirected" },
                { id: "link.quota_reached", label: "link.quota_reached", desc: "Dispatched when click quota cap is reached" },
                { id: "link.expired", label: "link.expired", desc: "Dispatched when an expired link is requested" },
              ].map((ev) => (
                <label
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 12px",
                    background: "var(--bg-surface-raised)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(ev.id)}
                    onChange={() => handleToggleEvent(ev.id)}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <code style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600 }}>{ev.label}</code>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{ev.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowWebhookModal(false)}
              disabled={creatingWebhook}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingWebhook || !webhookUrl.trim() || webhookEvents.length === 0}
            >
              {creatingWebhook ? "Saving..." : "Save Webhook"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Webhook Secret Created Modal */}
      <Modal
        open={Boolean(createdWebhookSecret)}
        onClose={() => setCreatedWebhookSecret(null)}
        title="Webhook Created Successfully"
      >
        <div>
          <div className="alert-success" style={{ marginBottom: "16px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontWeight: 600, color: "#10b981", marginBottom: "4px" }}>
              Save Your Webhook Signing Secret!
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Every outgoing HTTP payload includes an HMAC-SHA256 signature in the <code>x-shortener-signature</code> header. Use this secret to verify request authenticity.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Signing Secret</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                readOnly
                className="form-input"
                value={createdWebhookSecret?.secret || ""}
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#38bdf8" }}
              />
              <CopyButton text={createdWebhookSecret?.secret || ""} />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreatedWebhookSecret(null)}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

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
