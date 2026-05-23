import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

export default function BuyerDashboardPage() {
  const user = useAuth((state) => state.user);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Bảng điều khiển người mua</h1>
        <p className="mt-1 text-slate-600">Quản lý hành trình mua sắm của bạn tại một nơi.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/profile">
          <h2 className="text-lg font-semibold">Tài khoản & Số dư</h2>
          <p className="mt-2 text-sm text-slate-600">Số tài khoản: {user?.account_number || '-'}</p>
          <p className="mt-1 text-sm text-slate-600">Số dư: {formatCurrencyVND(user?.balance)}</p>
        </Link>

        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/books">
          <h2 className="text-lg font-semibold">Khám phá sách</h2>
          <p className="mt-2 text-sm text-slate-600">Tìm các đầu sách mới và bán chạy.</p>
        </Link>

        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/cart">
          <h2 className="text-lg font-semibold">Giỏ hàng của tôi</h2>
          <p className="mt-2 text-sm text-slate-600">Kiểm tra sản phẩm trước khi thanh toán.</p>
        </Link>

        <Link className="card transition hover:-translate-y-0.5 hover:shadow-md" to="/orders">
          <h2 className="text-lg font-semibold">Đơn hàng của tôi</h2>
          <p className="mt-2 text-sm text-slate-600">Theo dõi và xem lại lịch sử đơn hàng.</p>
        </Link>
      </div>
    </section>
  );
}
