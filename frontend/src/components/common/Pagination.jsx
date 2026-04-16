export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  if (totalPages <= 4) {
    for (let i = 1; i <= totalPages; i += 1) {
      pages.push(i);
    }
  } else {
    pages.push(1, 2, 'ellipsis', totalPages - 1, totalPages);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Trước
      </button>

      {pages.map((page) => {
        if (page === 'ellipsis') {
          return (
            <span key="ellipsis" className="px-1 text-slate-500">
              ...
            </span>
          );
        }

        return (
          <button
            key={page}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              page === currentPage
                ? 'bg-brand-500 text-white'
                : 'border border-slate-300 text-slate-700'
            }`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        );
      })}

      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Sau
      </button>
    </div>
  );
}
