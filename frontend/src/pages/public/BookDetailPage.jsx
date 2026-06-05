import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { bookReviewsApi } from '../../services/bookReviewsApi';
import { normalizeBook } from '../../utils/bookMapper';
import { formatCurrencyVND } from '../../utils/currency';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=800&q=80';

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCart((state) => state.addItem);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);

  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ avg_rating: 0, rating_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchDetail() {
      if (!id) {
        setBook(null);
        setError('Mã sách không hợp lệ.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const { data: bookData } = await bookService.detail(id);
        if (cancelled) return;

        const normalized = normalizeBook(bookData);
        if (!normalized?.id) {
          setBook(null);
          setError('Không tìm thấy sách.');
          return;
        }

        setBook(normalized);

        const [summaryResult, reviewsResult] = await Promise.allSettled([
          bookReviewsApi.summaryByBook(id),
          bookReviewsApi.listByBook(id, { page: 1, page_size: 20 }),
        ]);

        if (cancelled) return;

        if (summaryResult.status === 'fulfilled') {
          setReviewSummary({
            avg_rating: Number(summaryResult.value?.data?.avg_rating ?? 0),
            rating_count: Number(summaryResult.value?.data?.rating_count ?? 0),
          });
        } else {
          setReviewSummary({
            avg_rating: Number(normalized.rating || 0),
            rating_count: Number(normalized.ratingCount || 0),
          });
        }

        if (reviewsResult.status === 'fulfilled') {
          const items = reviewsResult.value?.data?.items;
          setReviews(Array.isArray(items) ? items : []);
        } else {
          setReviews([]);
        }
      } catch {
        if (!cancelled) {
          setBook(null);
          setError('Không tìm thấy sách hoặc không thể tải dữ liệu.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onAddToCart = async () => {
    if (!book) return;

    if (!isAuthenticated) {
      setToast('Vui lòng đăng nhập trước khi thêm vào giỏ hàng.');
      navigate('/login', {
        state: { from: location, message: 'Vui lòng đăng nhập trước khi thêm vào giỏ hàng.' },
      });
      return;
    }

    try {
      await addItem(book, 1);
      setToast('Đã thêm vào giỏ hàng thành công.');
    } catch (err) {
      setToast(err?.response?.data?.detail || 'Không thể thêm sách này vào giỏ hàng.');
    }
  };

  if (loading) {
    return (
      <section className="grid gap-6 md:grid-cols-2">
        <div className="aspect-[3/4] animate-pulse rounded-2xl bg-stone-200" />
        <div className="card space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
          <div className="h-24 animate-pulse rounded bg-stone-100" />
        </div>
      </section>
    );
  }

  if (!book) {
    return (
      <section className="card text-center">
        <p className="font-semibold text-stone-600">{error || 'Không tìm thấy sách.'}</p>
        <Link to="/books" className="btn-primary mt-4 inline-flex">
          Quay lại danh sách
        </Link>
      </section>
    );
  }

  const coverSrc = book.cover || FALLBACK_COVER;
  const avgRating = Number(reviewSummary.avg_rating || book.rating || 0).toFixed(1);
  const ratingCount = reviewSummary.rating_count || book.ratingCount || 0;

  return (
    <>
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-600">
        <Link to="/" className="hover:text-brand-700">
          Trang chủ
        </Link>
        <span>/</span>
        <Link to="/books" className="hover:text-brand-700">
          Sách
        </Link>
        <span>/</span>
        <span className="line-clamp-1 text-ink">{book.title}</span>
      </nav>

      <section className="overflow-hidden rounded-3xl border-2 border-stone-200 bg-white shadow-md">
        <div className="grid gap-0 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-white p-5 lg:p-8">
            <div className="overflow-hidden rounded-2xl border-2 border-white shadow-lg">
              <img
                src={coverSrc}
                alt={book.title}
                className="aspect-[3/4] w-full object-cover"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = FALLBACK_COVER;
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5 lg:p-8">
            <span className="inline-flex w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              {book.category}
            </span>
            <h1 className="text-3xl font-extrabold leading-tight text-ink lg:text-4xl">{book.title}</h1>
            <p className="font-semibold text-stone-600">Tác giả: {book.author}</p>
            <p className="text-sm leading-relaxed text-stone-700">{book.description}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Giá bán', value: formatCurrencyVND(book.price), accent: true },
                { label: 'Tồn kho', value: String(book.stock) },
                { label: 'Đánh giá', value: `★ ${avgRating} (${ratingCount})` },
                { label: 'Đã mua', value: String(book.purchaseCount || 0) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border-2 border-stone-100 bg-surface-warm/60 px-4 py-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{item.label}</p>
                  <p
                    className={`mt-1 text-lg font-extrabold ${
                      item.accent ? 'text-brand-700' : 'text-ink'
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-stone-600">
              Người bán: <span className="text-ink">{book.sellerDisplay}</span>
            </p>

            <div className="mt-auto grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn-primary h-12 text-base" onClick={onAddToCart}>
                Thêm vào giỏ
              </button>
              <Link
                to="/books"
                className="flex h-12 items-center justify-center rounded-lg border-2 border-stone-300 text-center font-bold text-ink transition hover:bg-stone-50"
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 card">
        <h2 className="text-xl font-bold text-ink">Đánh giá từ khách hàng</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-stone-500">Chưa có đánh giá cho sách này.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {reviews.map((review) => (
              <article key={review.review_id} className="rounded-xl border-2 border-stone-100 bg-surface-cream/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-amber-600">{'★'.repeat(Number(review.rating || 0))}</p>
                  <p className="text-xs font-semibold text-stone-500">Đơn #{review.order_id}</p>
                </div>
                <p className="mt-2 text-sm font-medium text-stone-700">
                  {review.comment || 'Không có nhận xét.'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
