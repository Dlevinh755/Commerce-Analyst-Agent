import BookCard from './BookCard';

export default function BookGrid({ books, onUnauthorized, onAddedToCart }) {
  if (!books.length) {
    return (
      <div className="card text-center text-slate-500">
        Không tìm thấy sách. Hãy thử từ khóa hoặc bộ lọc khác.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onUnauthorized={onUnauthorized}
          onAddedToCart={onAddedToCart}
        />
      ))}
    </div>
  );
}
