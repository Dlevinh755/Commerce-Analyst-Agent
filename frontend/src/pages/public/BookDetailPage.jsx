import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { normalizeBook } from '../../utils/bookMapper';

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCart((state) => state.addItem);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError('');
      try {
        const { data } = await bookService.detail(id);
        setBook(normalizeBook(data));
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
              <span className="font-medium">Rating:</span> {book.rating.toFixed(1)}
            </p>
            <p>
              <span className="font-medium">Seller:</span> {book.sellerDisplay}
            </p>
          </div>

          <button type="button" className="btn-primary mt-6 w-full" onClick={onAddToCart}>
            Add to Cart
          </button>
        </div>
      </section>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
