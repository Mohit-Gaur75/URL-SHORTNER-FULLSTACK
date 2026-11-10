import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";

export default function QrCodeModal({ isOpen, onClose, shortUrl, title = "QR Code" }) {
  const [dataUrl, setDataUrl] = useState("");
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (!isOpen || !shortUrl) return;

    QRCode.toDataURL(shortUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        setDataUrl(url);
      })
      .catch((err) => {
        console.error("QR generation error:", err);
      });
  }, [isOpen, shortUrl]);

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      const slug = shortUrl.split("/").pop() || "shortlink";
      a.download = `qrcode-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showSuccess("QR Code downloaded as PNG");
    } catch {
      showError("Could not download QR Code");
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
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Scan to visit the shortened destination on mobile devices or download for print materials.
        </p>

        <div className="qr-preview-box">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code for ${shortUrl}`}
              style={{ width: "220px", height: "220px", display: "block" }}
            />
          ) : (
            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
              Generating...
            </div>
          )}
        </div>

        <div style={{ marginTop: "8px", marginBottom: "20px" }}>
          <code
            style={{
              fontSize: "0.85rem",
              background: "var(--surface)",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              color: "#38bdf8",
              fontFamily: "var(--font-mono)",
            }}
          >
            {shortUrl}
          </code>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadPng}
            style={{ gap: "6px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PNG
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
