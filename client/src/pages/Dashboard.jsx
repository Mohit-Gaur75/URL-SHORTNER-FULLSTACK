import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUrls } from "../api/urls";

export default function Dashboard() {
  const { user } = useAuth();
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetchUrls()
      .then((items) => {
        if (active) setUrls(items);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container dashboard">
      <h1>Your links</h1>
      <p>Welcome, {user.name}.</p>

      {loading && <p className="dashboard-message">Loading your links...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && urls.length === 0 && (
        <p className="dashboard-message">
          No links yet. Create one while signed in and it will appear here.
        </p>
      )}

      {!loading && !error && urls.length > 0 && (
        <div className="url-list">
          {urls.map((url) => (
            <article className="url-item" key={url.id}>
              <div className="url-details">
                <a href={url.shortUrl} target="_blank" rel="noreferrer">
                  {url.shortUrl}
                </a>
                <a
                  className="original-url"
                  href={url.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {url.originalUrl}
                </a>
              </div>
              <div className="url-meta">
                <span>{url.clicks} clicks</span>
                <time dateTime={url.createdAt}>
                  {new Date(url.createdAt).toLocaleDateString()}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}