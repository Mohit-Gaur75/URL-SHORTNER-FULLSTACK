// 1 … 4 5 [6] 7 8 … 20: always the first and last page, and the neighbours of the current one.
function pagesToShow(page, totalPages) {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
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
      <button type="button" className="ghost" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        ← Previous
      </button>

      {pagesToShow(page, totalPages).map((item) =>
        typeof item === "string" ? (
          <span key={item} className="gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={item === page ? "page current" : "page ghost"}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Page ${item}`}
            disabled={disabled}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button type="button" className="ghost" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
