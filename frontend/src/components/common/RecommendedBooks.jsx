import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { recommenderService } from '../../services/recommenderService';
import BookGrid from './BookGrid';
import { resolveRecommendedBooks } from '../../utils/resolveRecommendedBook';

const TOP_K = 5;

/**
 * RecommendedBooks — shows personalised top-5 book recommendations.
 *
 * Only renders when the user is authenticated and results exist.
 * Silently hides itself when the recommender service is unavailable or
 * returns no results.
 *
 * Flow: user_id → gateway → recommender-service (Qdrant top-K + Databricks dim_books).
 * UI renders `rec.product` only (no per-book product-service calls).
 */
export default function RecommendedBooks({ onUnauthorized, onAddedToCart }) {
  const isAuthenticated = useAuth((state) => state.isAuthenticated);
  const user = useAuth((state) => state.user);
  const userId = user?.user_id;

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setBooks([]);
      setFetched(true);
      return;
    }

    let cancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      console.log(
        `[Recommender] Đang tải gợi ý cho user: ${user?.username} (user_id=${userId})...`
      );

      try {
        const { data } = await recommenderService.getByUserId(userId, TOP_K);
        console.log('[Recommender] Raw response:', data);

        if (cancelled) return;

        const rawRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
        console.log(`[Recommender] Nhận được ${rawRecs.length} gợi ý:`, rawRecs);

        if (rawRecs.length === 0) {
          console.warn('[Recommender] User chưa có embedding hoặc chưa có lịch sử mua.');
          setBooks([]);
          return;
        }

        if (cancelled) return;

        const normalized = resolveRecommendedBooks(rawRecs, TOP_K);
        console.log(
          `[Recommender] ✅ ${normalized.length} sách gợi ý cho user "${user?.username}":`,
          normalized
        );

        setBooks(normalized);
      } catch (err) {
        console.warn(
          '[Recommender] ❌ Lỗi khi tải gợi ý:',
          err?.response?.data ?? err?.message ?? err
        );
        if (!cancelled) setBooks([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFetched(true);
        }
      }
    }

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  // Hide when not authenticated or no results after fetch completes
  if (!isAuthenticated || (fetched && !loading && books.length === 0)) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✨</span>
          <h2 className="text-3xl font-semibold text-slate-800">Gợi ý cho bạn</h2>
        </div>
        <Link to="/books" className="text-sm font-medium text-brand-700 hover:text-brand-500">
          Xem thêm
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: TOP_K }).map((_, i) => (
            <div
              key={i}
              className="h-[540px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <BookGrid books={books} onUnauthorized={onUnauthorized} onAddedToCart={onAddedToCart} />
      )}
    </div>
  );
}