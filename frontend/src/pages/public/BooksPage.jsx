import { Link } from 'react-router-dom';
import { formatCurrencyVND } from '../../utils/currency';

const demoBooks = [
  { id: 1, title: 'Microservices Patterns', price: 32 },
  { id: 2, title: 'Domain-Driven Design', price: 45 },
];

export default function BooksPage() {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Sách</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {demoBooks.map((book) => (
          <article key={book.id} className="card">
            <h2 className="text-lg font-semibold">{book.title}</h2>
            <p className="mt-1 text-slate-600">{formatCurrencyVND(book.price)}</p>
            <Link to={`/books/${book.id}`} className="mt-4 inline-block text-brand-700">
              Xem chi tiết
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
