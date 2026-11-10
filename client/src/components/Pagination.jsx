function pagesToShow(page, totalPages) {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const withGaps = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withGaps.push("gap-" + p);
    withGaps.push(p);
  });
  return withGaps;
}

export default function Pagination({ page, totalPages, onChange, disabled }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        &larr; Prev
      </button>

      {pagesToShow(page, totalPages).map((item) =>
        typeof item === "string" ? (
          <span
            key={item}
            className="gap"
            aria-hidden="true"
            style={{ padding: "0 4px", color: "var(--text-muted)" }}
          >
            &hellip;
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={item === page ? "page-btn current" : "page-btn"}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Page ${item}`}
            disabled={disabled}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next &rarr;
      </button>
    </nav>
  );
}
