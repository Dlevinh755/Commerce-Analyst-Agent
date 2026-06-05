export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const addPage = (value) => {
    if (pages[pages.length - 1] !== value) {
      pages.push(value);
    }
  };

  addPage(1);

  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    addPage('ellipsis-left');
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    addPage(page);
  }

  if (windowEnd < totalPages - 1) {
    addPage('ellipsis-right');
  }

  if (totalPages > 1) {
    addPage(totalPages);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="rounded-lg border-2 border-stone-300 px-3 py-2 text-sm font-bold text-ink transition hover:bg-stone-50 disabled:opacity-40"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Trước
      </button>

      {pages.map((page) => {
        if (String(page).startsWith('ellipsis')) {
          return (
            <span key={page} className="px-1 font-bold text-stone-500">
              ...
            </span>
          );
        }

        return (
          <button
            key={page}
            type="button"
            className={`min-w-[2.5rem] rounded-lg px-3 py-2 text-sm font-bold ${
              page === currentPage
                ? 'bg-brand-500 text-white shadow-sm'
                : 'border-2 border-stone-300 text-ink hover:bg-brand-50'
            }`}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        type="button"
        className="rounded-lg border-2 border-stone-300 px-3 py-2 text-sm font-bold text-ink transition hover:bg-stone-50 disabled:opacity-40"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Sau
      </button>
    </div>
  );
}
