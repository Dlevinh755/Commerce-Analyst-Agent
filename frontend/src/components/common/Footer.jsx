import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-stone-200 bg-white">
      <div className="container-page grid gap-6 py-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-2xl font-extrabold text-ink">Book Store</p>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-stone-600">
            Hiệu sách trực tuyến với kho sách phong phú, giao hàng nhanh và trải nghiệm mua sắm thân thiện.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Khám phá</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-stone-700">
            <li>
              <Link to="/books" className="hover:text-brand-700">
                Danh mục sách
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-brand-700">
                Tạo tài khoản
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-brand-700">
                Đăng nhập
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Hỗ trợ</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-stone-700">
            <li>Hotline: 1900 1234</li>
            <li>Email: support@bookstore.vn</li>
            <li>8:00 – 22:00, tất cả các ngày</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100 py-4 text-center text-xs font-semibold text-stone-500">
        © {new Date().getFullYear()} Book Store. Bảo lưu mọi quyền.
      </div>
    </footer>
  );
}
