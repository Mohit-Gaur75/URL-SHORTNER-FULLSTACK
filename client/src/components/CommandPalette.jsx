import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const items = useMemo(() => {
    const all = [
      {
        id: "create",
        title: "Create Short Link",
        category: "Actions",
        icon: "⚡",
        action: () => navigate("/create"),
      },
      {
        id: "links",
        title: "All Links & Management",
        category: "Navigation",
        icon: "🔗",
        action: () => navigate("/links"),
      },
      {
        id: "analytics",
        title: "Analytics & Telemetry",
        category: "Navigation",
        icon: "📊",
        action: () => navigate("/analytics"),
      },
      {
        id: "dashboard",
        title: "Command Center Dashboard",
        category: "Navigation",
        icon: "🧭",
        action: () => navigate("/dashboard"),
      },
      {
        id: "status",
        title: "System Health & Engine Status",
        category: "Navigation",
        icon: "🟢",
        action: () => navigate("/system-status"),
      },
      {
        id: "theme",
        title: `Switch Theme (Current: ${theme.toUpperCase()})`,
        category: "Preferences",
        icon: theme === "dark" ? "☀️" : "🌙",
        action: () => toggleTheme(),
      },
      {
        id: "settings",
        title: "Account & Security Settings",
        category: "Settings",
        icon: "⚙️",
        action: () => navigate("/settings"),
      },
    ];

    if (user?.role === "ADMIN") {
      all.push({
        id: "admin",
        title: "Administrator Control Panel",
        category: "Administration",
        icon: "🛡️",
        action: () => navigate("/admin"),
      });
    }

    if (!query.trim()) return all;
    const lower = query.toLowerCase();
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower)
    );
  }, [query, navigate, theme, toggleTheme, user?.role]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item) => {
    if (!item) return;
    setIsOpen(false);
    setQuery("");
    item.action();
  };

  const handleKeyDownNav = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) handleSelect(items[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => setIsOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="command-palette-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-muted)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>🔍</span>
          <input
            autoFocus
            type="text"
            placeholder="Type a command or jump to page... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownNav}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "1.05rem",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd
            style={{
              padding: "3px 7px",
              background: "var(--bg-surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "8px 0" }}>
          {items.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.95rem",
              }}
            >
              No commands or pages found matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    cursor: "pointer",
                    background: isSelected ? "var(--primary-subtle)" : "transparent",
                    borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                    transition: "background var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                    <span
                      style={{
                        color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: isSelected ? 600 : 500,
                        fontSize: "0.95rem",
                      }}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: "10px 20px",
            background: "var(--bg-surface-raised)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ display: "flex", gap: "14px" }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div>Shortlink Studio v2.0</div>
        </div>
      </div>
    </div>
  );
}
