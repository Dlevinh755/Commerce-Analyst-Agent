import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

const FALLBACK_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="%23e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="Arial" font-size="28">Khong co anh</text></svg>';

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
    <article className="group relative flex h-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 bg-black/10 opacity-0 transition group-hover:opacity-100" />
      <div className="h-52 w-full overflow-hidden bg-slate-100">
        <img
          src={book.cover || FALLBACK_COVER}
          alt={book.title}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_COVER;
          }}
        />
      </div>
      <div className="flex flex-1 flex-col space-y-2 p-4">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          {book.category}
        </span>
        <h3 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold">{book.title}</h3>
        <p className="line-clamp-1 min-h-[1.5rem] text-sm text-slate-500">Tác giả: {book.author}</p>
        <p className="line-clamp-1 min-h-[1.25rem] text-xs text-slate-500">Người bán: {book.sellerDisplay}</p>
        <div className="flex items-center justify-between pt-2">
          <p className="font-bold text-brand-700">{formatCurrencyVND(book.price)}</p>
          <p className="text-sm text-amber-500">★ {Number(book.rating || 0).toFixed(1)} ({book.ratingCount || 0})</p>
        </div>
        <p className="text-xs text-slate-500">Đã mua: {book.purchaseCount || 0}</p>
        <div className="mt-auto flex gap-2 pt-3">
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
