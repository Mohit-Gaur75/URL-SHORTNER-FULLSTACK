import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [announcement, setAnnouncement] = useState("");
  const nextIdRef = useRef(1);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = nextIdRef.current++;
    const newToast = { id, message, type, createdAt: Date.now() };

    setAnnouncement(`${type.toUpperCase()}: ${message}`);
    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 on screen

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const showSuccess = useCallback((msg, duration) => addToast(msg, "success", duration), [addToast]);
  const showError = useCallback((msg, duration) => addToast(msg, "error", duration || 5000), [addToast]);
  const showInfo = useCallback((msg, duration) => addToast(msg, "info", duration), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showInfo }}>
      {children}

      {/* Screen-reader announcement container */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </div>

      {/* Visual Toast Viewport */}
      {toasts.length > 0 && (
        <aside
          role="region"
          aria-label="Notifications"
          className="toast-viewport"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            pointerEvents: "none",
            maxWidth: "calc(100vw - 3rem)",
            width: "380px",
          }}
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast-item toast-${toast.type}`}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.85rem 1rem",
                borderRadius: "var(--radius-md, 10px)",
                background: "rgba(17, 24, 39, 0.94)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border:
                  toast.type === "success"
                    ? "1px solid rgba(16, 185, 129, 0.35)"
                    : toast.type === "error"
                    ? "1px solid rgba(239, 68, 68, 0.35)"
                    : "1px solid rgba(59, 130, 246, 0.35)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(37, 99, 235, 0.1)",
                color: "var(--text-primary, #f9fafb)",
                fontSize: "0.875rem",
                lineHeight: 1.4,
                animation: "toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background:
                    toast.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : toast.type === "error"
                      ? "rgba(239, 68, 68, 0.15)"
                      : "rgba(59, 130, 246, 0.15)",
                  color:
                    toast.type === "success"
                      ? "#34d399"
                      : toast.type === "error"
                      ? "#f87171"
                      : "#60a5fa",
                }}
              >
                {toast.type === "success" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {toast.type === "error" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {toast.type === "info" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </span>

              <span style={{ flex: 1, wordBreak: "break-word" }}>{toast.message}</span>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #9ca3af)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.7,
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </aside>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};
