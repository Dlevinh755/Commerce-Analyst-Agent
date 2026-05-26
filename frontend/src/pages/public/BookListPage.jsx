import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import FilterPanel from '../../components/common/FilterPanel';
import BookCard from '../../components/common/BookCard';
import BookGrid from '../../components/common/BookGrid';
import Pagination from '../../components/common/Pagination';
import Toast from '../../components/common/Toast';
import useAuth from '../../hooks/useAuth';
import { bookService } from '../../services/bookService';
import { recommenderService } from '../../services/recommenderService';
import { sellerProductService } from '../../services/sellerProductService';
import { normalizeBook } from '../../utils/bookMapper';

const ITEMS_PER_PAGE = 6;

export default function BookListPage() {
  const [searchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const user = useAuth((state) => state.user);
  const username = user?.username || '';

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [recommended, setRecommended] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(false);

  const [searchText, setSearchText] = useState(searchFromUrl);
  const [appliedSearch, setAppliedSearch] = useState(searchFromUrl);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  const sortByParamMap = {
    newest: 'newest',
    oldest: 'oldest',
    'price-asc': 'price_asc',
    'price-desc': 'price_desc',
    'purchase-desc': 'purchase_desc',
    'purchase-asc': 'purchase_asc',
    'rating-desc': 'rating_desc',
  };

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data } = await sellerProductService.listCategories();
        setCategories(Array.isArray(data) ? data : []);
      } catch {
        setCategories([]);
      }
    }

    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchRecommended() {
      try {
        if (!username) {
          setRecommended([]);
          setRecommendLoading(false);
          return;
        }

        setRecommendLoading(true);

        const payload = {
          username,
          clicked_product_title: '',
          clicked_seller_username: null,
          clicked_category: null,
          top_n: 5,
        };
        const { data } = await recommenderService.recommendByCF(payload);
        const rawItems = Array.isArray(data?.recommendations) ? data.recommendations : [];
        const baseItems = rawItems.slice(0, 5).map((entry) => {
          if (Array.isArray(entry)) {
            const [bookId] = entry;
            return { product_id: bookId ?? null };
          }

          if (typeof entry === 'number') {
            return { product_id: entry };
          }

          return { product_id: entry?.product_id ?? entry?.book_id ?? entry?.id ?? null };
        });

        const detailResponses = await Promise.all(
          baseItems.map((entry) =>
            entry.product_id
              ? bookService
                  .detail(entry.product_id)
                  .then((response) => response.data)
                  .catch(() => null)
              : Promise.resolve(null)
          )
        );

        const normalized = detailResponses
          .filter(Boolean)
          .map(normalizeBook)
          .filter((book) => book.id !== undefined);

        setRecommended(normalized.slice(0, 5));
      } catch {
        setRecommended([]);
      } finally {
        setRecommendLoading(false);
      }
    }

    fetchRecommended();
  }, [username]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((category) => [category.name, category.category_id]));
  }, [categories]);

  const selectedCategoryId = useMemo(() => {
    if (selectedCategory === 'all') {
      return null;
    }
    return categoryMap.get(selectedCategory) ?? null;
  }, [categoryMap, selectedCategory]);

  const categoryOptions = useMemo(() => {
    return categories.map((category) => category.name).sort();
  }, [categories]);

  useEffect(() => {
    async function fetchBooks() {
      setLoading(true);
      setError('');
      try {
        const params = {
          page,
          page_size: ITEMS_PER_PAGE,
        };

        if (appliedSearch.trim()) {
          params.q = appliedSearch.trim();
        }

        if (selectedCategoryId !== null) {
          params.category_id = selectedCategoryId;
        }

        params.sort_by = sortByParamMap[sortBy] || 'newest';

        const { data } = await bookService.list(params);
        const raw = Array.isArray(data) ? data : data?.items || [];
        const normalized = raw.map(normalizeBook).filter((book) => book.id !== undefined);
        setBooks(normalized);
        setTotalItems(Number(data?.total ?? normalized.length));
      } catch (err) {
        setError('Không thể tải danh sách sách từ API.');
        setBooks([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, [appliedSearch, page, selectedCategoryId, sortBy]);

  useEffect(() => {
    setSearchText(searchFromUrl);
    setAppliedSearch(searchFromUrl);
    setPage(1);
  }, [searchFromUrl]);

  const displayBooks = books;

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  const onSearchSubmit = () => {
    setAppliedSearch(searchText.trim());
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
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,_rgba(16,38,68,0.88),_rgba(16,38,68,0.75)),radial-gradient(circle_at_10%_20%,_#1f8ca8,_transparent_40%),radial-gradient(circle_at_90%_20%,_#c7a86a,_transparent_30%),linear-gradient(140deg,_#0d3b66,_#1f4a72_45%,_#254f7b)] p-6 text-white shadow-md md:p-8">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-3xl font-bold md:text-4xl">Khám phá cuốn sách tiếp theo của bạn</h1>
          <p className="mt-2 text-slate-100">
          Duyệt nhiều đầu sách từ các dịch vụ khác nhau trong giao diện gọn gàng, dễ dùng.
          </p>
          <div className="mt-5 max-w-2xl rounded-2xl border border-slate-200/80 bg-slate-100/90 p-2 shadow-sm backdrop-blur-sm">
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              onSubmit={onSearchSubmit}
              placeholder="Tìm theo tên sách, tác giả hoặc từ khóa"
            />
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
      </div>

      {error ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <FilterPanel
          categories={categoryOptions}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
        />

        <div>
          {username ? (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">Gợi ý cho bạn</h2>
              </div>
              {recommendLoading ? (
                <div className="text-sm text-slate-600">Đang tải gợi ý...</div>
              ) : recommended.length === 0 ? (
                <div className="text-sm text-slate-600">Hiện chưa có gợi ý phù hợp.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recommended.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onUnauthorized={setToast}
                      onAddedToCart={setToast}
                      compactActions
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {loading ? (
            <div className="card text-slate-600">Đang tải sách...</div>
          ) : (
            <>
              {displayBooks.length === 0 ? (
                <div className="card text-slate-600">Không có sách phù hợp.</div>
              ) : (
                <>
                  <h4 className="mb-3 text-lg font-semibold text-slate-800">Sách nổi bật</h4>
                  <BookGrid books={displayBooks} onUnauthorized={setToast} onAddedToCart={setToast} />
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