import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

const FALLBACK_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="%23fef3e2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2378716c" font-family="Arial" font-size="28">Khong co anh</text></svg>';

const actionBtnClass =
  'flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold leading-none transition';

export default function BookCard({ book, onUnauthorized, onAddedToCart, compactActions = false }) {
  const addItem = useCart((state) => state.addItem);
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();
  const detailPath = `/books/${book.id}`;

  const addToCart = async (event) => {
    event.preventDefault();
    event.stopPropagation();
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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-stone-200/90 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg">
      <Link to={detailPath} className="relative block aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100">
        <img
          src={book.cover || FALLBACK_COVER}
          alt={book.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = FALLBACK_COVER;
          }}
        />
        <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm">
          {book.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link to={detailPath} className="line-clamp-2 min-h-[2.75rem] text-[15px] font-bold leading-snug text-ink hover:text-brand-700">
          {book.title}
        </Link>
        <p className="line-clamp-1 text-xs font-semibold text-stone-600">Tác giả: {book.author}</p>

        <div className="mt-auto space-y-2 pt-1">
          <div className="flex items-end justify-between gap-2">
            <p className="text-lg font-extrabold leading-none text-brand-700">{formatCurrencyVND(book.price)}</p>
            <p className="shrink-0 text-xs font-bold text-amber-600">
              ★ {Number(book.rating || 0).toFixed(1)}
            </p>
          </div>

          <div className={`grid grid-cols-2 gap-2 ${compactActions ? '' : ''}`}>
            <Link
              to={detailPath}
              className={`${actionBtnClass} border-2 border-stone-300 bg-white text-ink hover:bg-stone-50 ${
                compactActions ? 'text-xs' : ''
              }`}
            >
              Xem
            </Link>
            <button
              type="button"
              className={`${actionBtnClass} bg-brand-500 text-white hover:bg-brand-600 ${compactActions ? 'text-xs' : ''}`}
              onClick={addToCart}
            >
              Thêm giỏ
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
