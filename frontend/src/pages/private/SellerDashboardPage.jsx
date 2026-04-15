import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

export default function SellerDashboardPage() {
  const user = useAuth((state) => state.user);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Bảng điều khiển người bán</h1>
        <p className="mt-1 text-slate-600">Quản lý danh mục sản phẩm và sẵn sàng cho người mua.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/profile" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Tài khoản & Số dư</h2>
          <p className="mt-2 text-sm text-slate-600">Số tài khoản: {user?.account_number || '-'}</p>
          <p className="mt-1 text-sm text-slate-600">Số dư: {formatCurrencyVND(user?.balance)}</p>
        </Link>

        <Link to="/seller/products" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Quản lý sản phẩm</h2>
          <p className="mt-2 text-sm text-slate-600">
            Xem danh sách sản phẩm, chỉnh sửa và ẩn sản phẩm không còn phù hợp.
          </p>
        </Link>

        <Link to="/seller/orders" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Vận chuyển đơn hàng</h2>
          <p className="mt-2 text-sm text-slate-600">
            Xem đơn hàng chứa sách của bạn và đánh dấu đã gửi khi sẵn sàng.
          </p>
        </Link>

        <Link to="/seller/products/new" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Tạo sản phẩm mới</h2>
          <p className="mt-2 text-sm text-slate-600">
            Thêm sách mới với tên, giá, tồn kho và thông tin bổ sung.
          </p>
        </Link>
      </div>
    </section>
  );
}
