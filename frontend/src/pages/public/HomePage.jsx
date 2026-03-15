import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import BookGrid from '../../components/common/BookGrid';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { normalizeBook } from '../../utils/bookMapper';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [featured, setFeatured] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data } = await bookService.list({ limit: 3 });
        const raw = Array.isArray(data) ? data : data?.items || [];
        const normalized = raw.map(normalizeBook).filter((book) => book.id !== undefined);
        setFeatured(normalized.slice(0, 3));
      } catch {
        setFeatured([]);
      }
    }

    fetchFeatured();
  }, []);

  const onSearchSubmit = (event) => {
    event.preventDefault();
    navigate(`/books?search=${encodeURIComponent(searchText)}`);
  };

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-[radial-gradient(circle_at_top_left,_#1d6fdc,_#0f2f5f)] p-8 text-white md:p-12">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          One Bookstore, many microservices, seamless shopping.
        </h1>
        <p className="mt-4 max-w-2xl text-brand-100">
          Discover books, manage cart, checkout, and orders in one modern storefront UI.
        </p>

        <div className="mt-6 max-w-xl rounded-xl bg-white/10 p-2 backdrop-blur-sm">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={onSearchSubmit}
            placeholder="Search books, authors, topics"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/books" className="btn-primary bg-white text-brand-700 hover:bg-slate-100">
            Browse Books
          </Link>
          <Link to="/register" className="rounded-lg border border-white/40 px-4 py-2 text-white hover:bg-white/10">
            Create Account
          </Link>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Featured Books</h2>
          <Link to="/books" className="text-sm font-medium text-brand-700">
            View all
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="card text-slate-600">No featured books available.</div>
        ) : (
          <BookGrid books={featured} onUnauthorized={setToast} onAddedToCart={setToast} />
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
