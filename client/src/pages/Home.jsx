import LinkForm from "../components/LinkForm";

export default function Home() {
  return (
    <div className="hero-section">
      <div className="hero-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>High-Throughput Redis Cache &bull; BullMQ Batch Analytics</span>
      </div>

      <h1 className="hero-title">
        Shorten Links. <br />
        <span className="hero-gradient-text">Expand Your Audience.</span>
      </h1>

      <p className="hero-subtitle">
        Transform long URLs into fast, secure, branded short links. Powered by a
        sub-millisecond distributed Redis cache and asynchronous click stream tracking.
      </p>

      <div className="shortener-card">
        <LinkForm />
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h2 className="feature-title">Sub-ms Redirects</h2>
          <p className="feature-desc">
            Redis Cache-Aside engine with stampede mutex locks delivers lightning-fast 302 redirects with zero cache degradation.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h2 className="feature-title">Real-Time Analytics</h2>
          <p className="feature-desc">
            BullMQ workers asynchronously buffer and flush click metrics in batches, keeping redirect latency decoupled from writes.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="feature-title">Enterprise Security</h2>
          <p className="feature-desc">
            Protected by Helmet headers, NoSQL injection sanitizers, rotating JWT refresh token families, and per-IP rate limits.
          </p>
        </div>
      </div>
    </div>
  );
}
