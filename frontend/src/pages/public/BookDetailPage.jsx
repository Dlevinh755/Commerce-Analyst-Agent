import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { bookReviewsApi } from '../../services/bookReviewsApi';
import { normalizeBook } from '../../utils/bookMapper';

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
        setError('Book not found or API unavailable.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  const onAddToCart = async () => {
    if (!isAuthenticated) {
      setToast('Please login before adding items to cart.');
      navigate('/login', {
        state: { from: location, message: 'Please login before adding items to cart.' },
      });
      return;
    }

    try {
      await addItem(book, 1);
      setToast('Added to cart successfully.');
    } catch (error) {
      setToast(error?.response?.data?.detail || 'Could not add this book to your cart.');
    }
  };

  if (loading) {
    return <section className="card">Loading book details...</section>;
  }

  if (!book) {
    return <section className="card text-slate-600">{error || 'Book not found.'}</section>;
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
          <p className="mt-1 text-slate-500">by {book.author}</p>
          <p className="mt-4 text-slate-700">{book.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              <span className="font-medium">Price:</span> ${book.price}
            </p>
            <p>
              <span className="font-medium">Stock:</span> {book.stock}
            </p>
            <p>
              <span className="font-medium">Rating:</span> {Number(reviewSummary.avg_rating || book.rating || 0).toFixed(1)} ({reviewSummary.rating_count || book.ratingCount || 0})
            </p>
            <p>
              <span className="font-medium">Purchased:</span> {book.purchaseCount || 0}
            </p>
            <p className="col-span-2">
              <span className="font-medium">Seller:</span> {book.sellerDisplay}
            </p>
          </div>

          <button type="button" className="btn-primary mt-6 w-full" onClick={onAddToCart}>
            Add to Cart
          </button>
        </div>
      </section>
      <section className="card">
        <h2 className="text-lg font-semibold">Customer reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No reviews yet for this product.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((review) => (
              <article key={review.review_id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-600">{'★'.repeat(Number(review.rating || 0))}</p>
                  <p className="text-xs text-slate-500">Order #{review.order_id}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">{review.comment || 'No comment provided.'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
