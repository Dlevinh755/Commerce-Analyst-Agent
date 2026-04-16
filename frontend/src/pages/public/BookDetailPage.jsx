import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { bookReviewsApi } from '../../services/bookReviewsApi';
import { normalizeBook } from '../../utils/bookMapper';
import { formatCurrencyVND } from '../../utils/currency';

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
    async function fetchDetail() {
      setLoading(true);
      setError('');
      try {
        const [{ data: bookData }, { data: summaryData }, { data: reviewData }] = await Promise.all([
          bookService.detail(id),
          bookReviewsApi.summaryByBook(id),
          bookReviewsApi.listByBook(id, { page: 1, page_size: 20 }),
        ]);
        setBook(normalizeBook(bookData));
        setReviewSummary({
          avg_rating: Number(summaryData?.avg_rating ?? 0),
          rating_count: Number(summaryData?.rating_count ?? 0),
        });
        setReviews(Array.isArray(reviewData?.items) ? reviewData.items : []);
      } catch {
        setBook(null);
        setError('Không tìm thấy sách hoặc API chưa sẵn sàng.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  const onAddToCart = async () => {
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
    } catch (error) {
      setToast(error?.response?.data?.detail || 'Không thể thêm sách này vào giỏ hàng.');
    }
  };

  if (loading) {
    return <section className="card">Đang tải chi tiết sách...</section>;
  }

  if (!book) {
    return <section className="card text-slate-600">{error || 'Không tìm thấy sách.'}</section>;
  }

  return (
    <>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img src={book.cover} alt={book.title} className="h-full min-h-[300px] w-full object-cover" />
        </div>

        <div className="card">
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {book.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold">{book.title}</h1>
          <p className="mt-1 text-slate-500">Tác giả: {book.author}</p>
          <p className="mt-4 text-slate-700">{book.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              <span className="font-medium">Giá:</span> {formatCurrencyVND(book.price)}
            </p>
            <p>
              <span className="font-medium">Kho:</span> {book.stock}
            </p>
            <p>
              <span className="font-medium">Đánh giá:</span> {Number(reviewSummary.avg_rating || book.rating || 0).toFixed(1)} ({reviewSummary.rating_count || book.ratingCount || 0})
            </p>
            <p>
              <span className="font-medium">Đã mua:</span> {book.purchaseCount || 0}
            </p>
            <p className="col-span-2">
              <span className="font-medium">Người bán:</span> {book.sellerDisplay}
            </p>
          </div>

          <button type="button" className="btn-primary mt-6 w-full" onClick={onAddToCart}>
            Thêm vào giỏ
          </button>
        </div>
      </section>
      <section className="card">
        <h2 className="text-lg font-semibold">Đánh giá khách hàng</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sản phẩm này chưa có đánh giá.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((review) => (
              <article key={review.review_id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-600">{'★'.repeat(Number(review.rating || 0))}</p>
                  <p className="text-xs text-slate-500">Đơn hàng #{review.order_id}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">{review.comment || 'Không có nhận xét.'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
