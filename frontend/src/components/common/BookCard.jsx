import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

export default function BookCard({ book, onUnauthorized, onAddedToCart }) {
  const addItem = useCart((state) => state.addItem);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  const addToCart = async () => {
    if (!isAuthenticated) {
      if (onUnauthorized) {
        onUnauthorized('Vui lòng đăng nhập để thêm sách vào giỏ hàng.');
      }
      navigate('/login', {
        state: { from: location, message: 'Vui lòng đăng nhập để thêm sách vào giỏ hàng.' },
      });
      return;
    }

    try {
      await addItem(book, 1);
      if (onAddedToCart) {
        onAddedToCart(`Đã thêm ${book.title} vào giỏ hàng.`);
      }
    } catch (error) {
      if (onUnauthorized) {
        onUnauthorized(error?.response?.data?.detail || 'Không thể thêm sách này vào giỏ hàng.');
      }
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 bg-black/10 opacity-0 transition group-hover:opacity-100" />
      <img src={book.cover} alt={book.title} className="h-52 w-full object-cover" />
      <div className="space-y-2 p-4">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          {book.category}
        </span>
        <h3 className="line-clamp-2 text-lg font-semibold">{book.title}</h3>
        <p className="text-sm text-slate-500">Tác giả: {book.author}</p>
        <p className="text-xs text-slate-500">Người bán: {book.sellerDisplay}</p>
        <div className="flex items-center justify-between pt-2">
          <p className="font-bold text-brand-700">{formatCurrencyVND(book.price)}</p>
          <p className="text-sm text-amber-500">★ {Number(book.rating || 0).toFixed(1)} ({book.ratingCount || 0})</p>
        </div>
        <p className="text-xs text-slate-500">Đã mua: {book.purchaseCount || 0}</p>
        <div className="pt-3 flex gap-2">
          <Link to={`/books/${book.id}`} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium">
            Xem
          </Link>
          <button type="button" className="btn-primary flex-1 whitespace-nowrap" onClick={addToCart}>
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </article>
  );
}
