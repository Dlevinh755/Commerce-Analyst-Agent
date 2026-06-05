import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import BookGrid from '../../components/common/BookGrid';
import HeroBookStack from '../../components/common/HeroBookStack';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { normalizeBook } from '../../utils/bookMapper';

const HERO_STATS = [
  { label: 'Đầu sách', value: '2.000+' },
  { label: 'Tác giả', value: '800+' },
  { label: 'Đơn hàng', value: '15.000+' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [featured, setFeatured] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data } = await bookService.list({ limit: 8 });
        const raw = Array.isArray(data) ? data : data?.items || [];
        const normalized = raw.map(normalizeBook).filter((book) => book.id !== undefined);
        setFeatured(normalized.slice(0, 8));
      } catch {
        setFeatured([]);
      }
    }

    fetchFeatured();
  }, []);

  const onSearchSubmit = () => {
    navigate(`/books?search=${encodeURIComponent(searchText)}`);
  };

  return (
    <section className="page-shell space-y-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-orange-100/80 bg-gradient-to-br from-orange-50 via-amber-50 to-amber-100 p-6 shadow-glow md:p-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
        <div className="relative z-10 space-y-5">
          <p className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 ring-2 ring-brand-100">
            Hiệu sách trực tuyến
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-ink md:text-5xl lg:text-[3.25rem]">
            Khám phá sách hay, mua sắm liền mạch
          </h1>
          <p className="max-w-xl text-base font-semibold text-stone-600">
            Tìm kiếm, giỏ hàng, thanh toán và theo dõi đơn — tất cả trong một giao diện ấm áp, dễ đọc.
          </p>

          <div className="flex flex-wrap gap-3">
            {HERO_STATS.map((stat) => (
              <div
                key={stat.label}
                className="min-w-[7rem] rounded-xl border-2 border-white bg-white/95 px-4 py-3 shadow-sm"
              >
                <p className="text-xl font-extrabold text-brand-600">{stat.value}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-stone-600">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="max-w-xl rounded-2xl border-2 border-white bg-white/90 p-2 shadow-sm">
            <SearchBar
              value={searchText}
              onChange={setSearchText}
              onSubmit={onSearchSubmit}
              placeholder="Tìm sách, tác giả và chủ đề"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/books" className="btn-primary rounded-full px-6 py-2.5 text-sm shadow-md">
              Xem sách ngay
            </Link>
            <Link
              to="/register"
              className="rounded-full border-2 border-brand-300 bg-white px-6 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
            >
              Tạo tài khoản
            </Link>
          </div>
        </div>

        <HeroBookStack className="mt-6 lg:mt-0" />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-ink">Sách nổi bật</h2>
          <Link to="/books" className="text-sm font-bold text-brand-700 hover:text-brand-500">
            Xem tất cả
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="card text-muted">Hiện chưa có sách nổi bật.</div>
        ) : (
          <BookGrid books={featured} onUnauthorized={setToast} onAddedToCart={setToast} />
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
