import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import FilterPanel from '../../components/common/FilterPanel';
import BookGrid from '../../components/common/BookGrid';
import Pagination from '../../components/common/Pagination';
import Toast from '../../components/common/Toast';
import useAuth from '../../hooks/useAuth';
import { bookService } from '../../services/bookService';
import { recommenderService } from '../../services/recommenderService';
import { sellerProductService } from '../../services/sellerProductService';
import { normalizeBook } from '../../utils/bookMapper';
import { resolveRecommendedBooks } from '../../utils/resolveRecommendedBook';

const ITEMS_PER_PAGE = 10;

export default function BookListPage() {
  const [searchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const user = useAuth((state) => state.user);
  const userRole = String(user?.role || '').toLowerCase();
  const shouldShowRecommendations = Boolean(
    user?.user_id && userRole !== 'seller' && userRole !== 'admin'
  );

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
      if (!shouldShowRecommendations) {
        setRecommended([]);
        setRecommendLoading(false);
        return;
      }

      const userId = user?.user_id;
      if (!userId) {
        setRecommended([]);
        setRecommendLoading(false);
        return;
      }

      setRecommendLoading(true);
      console.log(`[Recommender] Đang tải gợi ý cho user: ${user?.username} (user_id=${userId})...`);

      try {
        const { data } = await recommenderService.getByUserId(userId, 5);
        console.log('[Recommender] Raw response từ recommender-service:', data);

        const rawRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
        console.log(`[Recommender] Nhận được ${rawRecs.length} gợi ý thô:`, rawRecs);

        if (rawRecs.length === 0) {
          console.warn('[Recommender] User chưa có embedding hoặc chưa có lịch sử mua.');
          setRecommended([]);
          return;
        }

        const normalized = resolveRecommendedBooks(rawRecs, 5);
        console.log(
          `[Recommender] ✅ Chuẩn hóa xong ${normalized.length}/${rawRecs.length} sách gợi ý cho user "${user?.username}":`,
          normalized
        );

        setRecommended(normalized);
      } catch (err) {
        console.warn('[Recommender] ❌ Lỗi khi tải gợi ý:', err?.response?.data ?? err?.message ?? err);
        setRecommended([]);
      } finally {
        setRecommendLoading(false);
      }
    }

    fetchRecommended();
  }, [shouldShowRecommendations, user?.user_id]);

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
    <section className="page-shell space-y-6">
      <div className="relative overflow-hidden rounded-3xl border-2 border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50 to-amber-100 p-6 shadow-glow md:p-8">
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-6 bottom-0 h-48 w-48 rounded-full bg-amber-300/40 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div>
            <p className="mb-2 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 ring-2 ring-brand-100">
              Bộ sưu tập mới mỗi tuần
            </p>
            <h1 className="text-3xl font-extrabold text-ink md:text-4xl">Khám phá cuốn sách tiếp theo của bạn</h1>
            <p className="mt-2 max-w-2xl font-semibold text-stone-600">
              Duyệt nhiều đầu sách từ các dịch vụ khác nhau trong giao diện gọn gàng, dễ dùng.
            </p>
            <div className="mt-5 rounded-2xl border-2 border-white bg-white/90 p-2 shadow-sm lg:max-w-xl">
              <SearchBar
                value={searchText}
                onChange={setSearchText}
                onSubmit={onSearchSubmit}
                placeholder="Tìm theo tên sách, tác giả hoặc từ khóa"
              />
            </div>
          </div>
          <div className="w-full lg:-ml-2.5 lg:mt-2 lg:self-center lg:justify-self-start">
            <FilterPanel
              layout="vertical"
              categories={categoryOptions}
              selectedCategory={selectedCategory}
              onCategoryChange={onCategoryChange}
              sortBy={sortBy}
              onSortChange={onSortChange}
            />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{error}</div> : null}

      <div className="space-y-6">
        {shouldShowRecommendations && (recommendLoading || recommended.length > 0) ? (
          <div className="rounded-2xl border-2 border-orange-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h2 className="text-xl font-semibold text-ink">Gợi ý cho bạn</h2>
              </div>
            </div>
            {recommendLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-2xl border border-stone-200 bg-stone-100"
                  />
                ))}
              </div>
            ) : (
              <BookGrid
                books={recommended}
                onUnauthorized={setToast}
                onAddedToCart={setToast}
                compactActions
              />
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
                <div className="flex items-end justify-between gap-3">
                  <h4 className="text-lg font-semibold text-ink">Sách nổi bật</h4>
                  <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    {totalItems.toLocaleString('vi-VN')} kết quả
                  </span>
                </div>
                <BookGrid books={displayBooks} onUnauthorized={setToast} onAddedToCart={setToast} />
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}