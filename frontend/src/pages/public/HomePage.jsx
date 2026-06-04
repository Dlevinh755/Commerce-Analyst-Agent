import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import BookGrid from '../../components/common/BookGrid';
import RecommendedBooks from '../../components/common/RecommendedBooks';
import Toast from '../../components/common/Toast';
import { bookService } from '../../services/bookService';
import { normalizeBook } from '../../utils/bookMapper';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [featured, setFeatured] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const { data } = await bookService.list({ limit: 4 });
        const raw = Array.isArray(data) ? data : data?.items || [];
        const normalized = raw.map(normalizeBook).filter((book) => book.id !== undefined);
        setFeatured(normalized.slice(0, 4));
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
    <section className="space-y-8">
      <div className="rounded-2xl bg-[radial-gradient(circle_at_15%_20%,_#3d9fc2_0,_#3f6ea8_45%,_#7b4ab8_100%)] p-7 text-white shadow-lg md:p-10">
        <h1 className="mx-auto max-w-2xl text-center text-4xl font-bold leading-tight md:text-6xl">
          Một hiệu sách, nhiều microservices, mua sắm liền mạch.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-100 md:text-base">
          Khám phá sách, quản lý giỏ hàng, thanh toán và trả tiền trực tuyến trong một giao diện hiện đại.
        </p>

        <div className="mx-auto mt-6 max-w-2xl rounded-full bg-white/20 p-2 backdrop-blur-sm">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={onSearchSubmit}
            placeholder="Tìm sách, tác giả và chủ đề"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/books"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-700 transition hover:bg-slate-100"
          >
            Xem sách
          </Link>
          <Link to="/register" className="rounded-full border border-white/50 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
            Tạo tài khoản
          </Link>
        </div>
      </div>

      {/* Personalised recommendations — visible only for logged-in buyers */}
      <RecommendedBooks onUnauthorized={setToast} onAddedToCart={setToast} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-semibold text-slate-800">Sách nổi bật</h2>
          <Link to="/books" className="text-sm font-medium text-brand-700 hover:text-brand-500">
            Xem tất cả
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="card text-slate-600">Hiện chưa có sách nổi bật.</div>
        ) : (
          <BookGrid books={featured} onUnauthorized={setToast} onAddedToCart={setToast} />
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
