import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';

export default function BookCard({ book, onUnauthorized, onAddedToCart }) {
  const addItem = useCart((state) => state.addItem);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  const addToCart = async () => {
    if (!isAuthenticated) {
      if (onUnauthorized) {
        onUnauthorized('Please login to add this book to your cart.');
      }
      navigate('/login', {
        state: { from: location, message: 'Please login to add this book to your cart.' },
      });
      return;
    }

    try {
      await addItem(book, 1);
      if (onAddedToCart) {
        onAddedToCart(`${book.title} added to cart.`);
      }
    } catch (error) {
      if (onUnauthorized) {
        onUnauthorized(error?.response?.data?.detail || 'Could not add this book to your cart.');
      }
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <img src={book.cover} alt={book.title} className="h-52 w-full object-cover" />
      <div className="space-y-2 p-4">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          {book.category}
        </span>
        <h3 className="line-clamp-2 text-lg font-semibold">{book.title}</h3>
        <p className="text-sm text-slate-500">by {book.author}</p>
        <p className="text-xs text-slate-500">Sold by {book.sellerDisplay}</p>
        <div className="flex items-center justify-between pt-2">
          <p className="font-bold text-brand-700">${book.price}</p>
          <p className="text-sm text-amber-500">★ {book.rating.toFixed(1)}</p>
        </div>
        <div className="pt-3 flex gap-2">
          <Link to={`/books/${book.id}`} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium">
            View
          </Link>
          <button type="button" className="btn-primary flex-1" onClick={addToCart}>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
