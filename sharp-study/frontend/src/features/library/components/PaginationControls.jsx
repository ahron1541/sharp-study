export default function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, start + 2);
  const windowStart = Math.max(1, end - 2);

  for (let current = windowStart; current <= end; current += 1) {
    pages.push(current);
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-text disabled:cursor-not-allowed disabled:opacity-40"
      >
        Prev
      </button>

      {windowStart > 1 ? (
        <>
          <PageButton pageNumber={1} active={page === 1} onChange={onChange} />
          {windowStart > 2 ? <span className="px-1 text-text-muted">…</span> : null}
        </>
      ) : null}

      {pages.map((pageNumber) => (
        <PageButton key={pageNumber} pageNumber={pageNumber} active={page === pageNumber} onChange={onChange} />
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? <span className="px-1 text-text-muted">…</span> : null}
          <PageButton pageNumber={totalPages} active={page === totalPages} onChange={onChange} />
        </>
      ) : null}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-text disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}

function PageButton({ pageNumber, active, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(pageNumber)}
      aria-current={active ? 'page' : undefined}
      className={`min-w-10 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
        active
          ? 'border-accent bg-accent text-accent-text'
          : 'border-border text-text hover:bg-surface-2'
      }`}
    >
      {pageNumber}
    </button>
  );
}
