import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";

export default function QrCodeModal({ isOpen, open, onClose, shortUrl, title = "QR Code" }) {
  const isModalOpen = Boolean(isOpen ?? open);
  const [dataUrl, setDataUrl] = useState("");
  const [svgString, setSvgString] = useState("");
  const [generating, setGenerating] = useState(false);
  const [darkColor, setDarkColor] = useState("#0f172a");
  const [lightColor, setLightColor] = useState("#ffffff");
  const { showSuccess, showError } = useToast();

  const COLOR_PALETTES = [
    { name: "Slate", dark: "#0f172a", light: "#ffffff" },
    { name: "Indigo", dark: "#312e81", light: "#eef2ff" },
    { name: "Emerald", dark: "#064e3b", light: "#ecfdf5" },
    { name: "Crimson", dark: "#881337", light: "#fff1f2" },
    { name: "Amber", dark: "#78350f", light: "#fffbeb" },
  ];

  useEffect(() => {
    if (!isModalOpen || !shortUrl) return;

    let unmounted = false;
    setGenerating(true);

    Promise.all([
      QRCode.toDataURL(shortUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: "H",
      }),
      QRCode.toString(shortUrl, {
        type: "svg",
        margin: 2,
        color: {
          dark: darkColor,
          light: lightColor,
        },
        errorCorrectionLevel: "H",
      }),
    ])
      .then(([pngUrl, svgMarkup]) => {
        if (unmounted) return;
        setDataUrl(pngUrl);
        setSvgString(svgMarkup);
      })
      .catch((err) => {
        console.error("QR generation error:", err);
        showError("Failed to generate QR code");
      })
      .finally(() => {
        if (!unmounted) setGenerating(false);
      });

    return () => {
      unmounted = true;
    };
  }, [isModalOpen, shortUrl, darkColor, lightColor, showError]);

  const getSlug = () => shortUrl.split("/").pop() || "shortlink";

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qrcode-${getSlug()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showSuccess("QR Code downloaded as PNG");
    } catch {
      showError("Could not download PNG QR Code");
    }
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qrcode-${getSlug()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess("Vector QR Code downloaded as SVG");
    } catch {
      showError("Could not download SVG QR Code");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      showSuccess("Short link copied to clipboard");
    } catch {
      showError("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ShortLink",
          text: `Check out this link: ${shortUrl}`,
          url: shortUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          showError("Could not share link");
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Modal open={isModalOpen} onClose={onClose} title={title}>
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Scan to visit the shortened destination on mobile devices or download high-res files for marketing collateral.
        </p>

        {/* High-contrast QR card container */}
        <div
          className="qr-preview-box"
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            marginBottom: "16px",
          }}
        >
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code for ${shortUrl}`}
              style={{ width: "220px", height: "220px", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
              }}
            >
              {generating ? "Generating QR Code..." : "Ready"}
            </div>
          )}
        </div>

        {/* Color Palette Customizer */}
        <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Brand Color Presets
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            {COLOR_PALETTES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setDarkColor(p.dark);
                  setLightColor(p.light);
                }}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  borderRadius: "var(--radius-full)",
                  background: darkColor === p.dark ? "var(--primary-subtle)" : "var(--bg-surface-raised)",
                  border: darkColor === p.dark ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                  color: darkColor === p.dark ? "var(--primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: p.dark,
                    display: "inline-block",
                  }}
                />
                {p.name}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <span>Foreground:</span>
              <input
                type="color"
                value={darkColor}
                onChange={(e) => setDarkColor(e.target.value)}
                style={{ width: "24px", height: "24px", border: "none", borderRadius: "4px", cursor: "pointer", background: "transparent" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <span>Background:</span>
              <input
                type="color"
                value={lightColor}
                onChange={(e) => setLightColor(e.target.value)}
                style={{ width: "24px", height: "24px", border: "none", borderRadius: "4px", cursor: "pointer", background: "transparent" }}
              />
            </label>
          </div>
        </div>

        {/* Endpoint address pill */}
        <div style={{ marginBottom: "20px" }}>
          <code
            style={{
              fontSize: "0.9rem",
              background: "var(--bg-app)",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-muted)",
              color: "#60a5fa",
              fontFamily: "var(--font-mono)",
              display: "inline-block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {shortUrl}
          </code>
        </div>

        {/* Action button row */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadPng}
            disabled={!dataUrl}
            style={{ gap: "6px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PNG
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadSvg}
            disabled={!svgString}
            style={{ gap: "6px" }}
            title="Download scalable vector SVG for print and high-res media"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            SVG (Vector)
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyLink}
            style={{ gap: "6px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Link
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleShare}
            style={{ gap: "6px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>
      </div>
    </Modal>
  );
}
