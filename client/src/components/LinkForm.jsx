import { useState } from "react";
import { createUrl } from "../api/urls";

export default function LinkForm() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); // stop the browser's full-page form submit
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await createUrl({
        originalUrl: originalUrl.trim(),
        customCode: customCode.trim(),
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="https://example.com/very/long/link"
        value={originalUrl}
        onChange={(e) => setOriginalUrl(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Custom short code (optional)"
        value={customCode}
        onChange={(e) => setCustomCode(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Shortening..." : "Shorten URL"}
      </button>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <p>Your short URL:</p>
          <a href={result.shortUrl} target="_blank" rel="noreferrer">
            {result.shortUrl}
          </a>
          <button type="button" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </form>
  );
}
