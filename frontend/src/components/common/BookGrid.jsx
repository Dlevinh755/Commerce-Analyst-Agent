import BookCard from './BookCard';

const COLUMN_CLASS = {
  default: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
  compact: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
};

export default function BookGrid({
  books,
  onUnauthorized,
  onAddedToCart,
  columns = 'default',
  className = '',
  compactActions = false,
}) {
  if (!books.length) {
    return (
      <div className="card text-center text-muted">
        Không tìm thấy sách. Hãy thử từ khóa hoặc bộ lọc khác.
      </div>
    );
  }

  return (
    <div
      className={`grid items-stretch gap-3 sm:gap-4 ${COLUMN_CLASS[columns] || COLUMN_CLASS.default} ${className}`}
    >
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onUnauthorized={onUnauthorized}
          onAddedToCart={onAddedToCart}
          compactActions={compactActions}
        />
      ))}
    </div>
  );
}
