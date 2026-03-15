import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import FilterPanel from '../../components/common/FilterPanel';
import BookGrid from '../../components/common/BookGrid';
import Pagination from '../../components/common/Pagination';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { normalizeBook } from '../../utils/bookMapper';

const ITEMS_PER_PAGE = 6;

export default function BookListPage() {
  const [searchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [searchText, setSearchText] = useState(searchFromUrl);
  const [submittedSearch, setSubmittedSearch] = useState(searchFromUrl);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchBooks() {
      setLoading(true);
      setError('');
      try {
        const { data } = await bookService.list();
        const raw = Array.isArray(data) ? data : data?.items || [];
        const normalized = raw.map(normalizeBook).filter((book) => book.id !== undefined);
        setBooks(normalized);
      } catch (err) {
        setError('Could not load books from API.');
        setBooks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(books.map((book) => book.category))].sort();
  }, [books]);

  const filteredAndSortedBooks = useMemo(() => {
    const keyword = submittedSearch.trim().toLowerCase();

    let result = books.filter((book) => {
      const matchesKeyword =
        !keyword ||
        book.title.toLowerCase().includes(keyword) ||
        book.author.toLowerCase().includes(keyword) ||
        book.description.toLowerCase().includes(keyword);
      const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
      return matchesKeyword && matchesCategory;
    });

    if (sortBy === 'price-asc') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating-desc') {
      result = [...result].sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [books, submittedSearch, selectedCategory, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedBooks.length / ITEMS_PER_PAGE));
  const pagedBooks = filteredAndSortedBooks.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const onSearchSubmit = (event) => {
    event.preventDefault();
    setSubmittedSearch(searchText);
    setPage(1);
  };

  const onCategoryChange = (category) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const onSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-6 text-white">
        <h1 className="text-3xl font-bold">Discover your next great read</h1>
        <p className="mt-2 text-brand-100">
          Browse titles from multiple services with a clean storefront experience.
        </p>
        <div className="mt-5 max-w-2xl rounded-xl bg-white/10 p-2 backdrop-blur-sm">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={onSearchSubmit}
            placeholder="Search by title, author, or keyword"
          />
        </div>
      </div>

      {error ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <FilterPanel
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
        />

        <div>
          {loading ? (
            <div className="card text-slate-600">Loading books...</div>
          ) : (
            <>
              {filteredAndSortedBooks.length === 0 ? (
                <div className="card text-slate-600">No books available.</div>
              ) : (
                <>
                  <BookGrid books={pagedBooks} onUnauthorized={setToast} onAddedToCart={setToast} />
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}