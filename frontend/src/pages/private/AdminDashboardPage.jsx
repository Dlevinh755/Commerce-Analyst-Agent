import { Link } from 'react-router-dom';
import AdminSectionNav from '../../components/admin/AdminSectionNav';
import AnalyticsChatPanel from '../../components/admin/AnalyticsChatPanel';

export default function AdminDashboardPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Bảng điều khiển quản trị</h1>
        <p className="mt-1 text-slate-600">
          Sử dụng các khu vực riêng để quản lý người mua, người bán, sản phẩm và đơn hàng.
        </p>
      </div>

      <AdminSectionNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/buyers" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Người mua</h2>
          <p className="mt-2 text-sm text-slate-600">Xem tài khoản người mua, số tài khoản, số dư và trạng thái.</p>
        </Link>

        <Link to="/admin/sellers" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Người bán</h2>
          <p className="mt-2 text-sm text-slate-600">Xem số dư và số tài khoản người bán, kích hoạt hoặc ẩn tài khoản.</p>
        </Link>

        <Link to="/admin/products" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Sản phẩm</h2>
          <p className="mt-2 text-sm text-slate-600">Quản lý hiển thị sản phẩm, trạng thái hoạt động và ẩn mềm.</p>
        </Link>

        <Link to="/admin/orders" className="card transition hover:-translate-y-0.5 hover:shadow-md">
          <h2 className="text-lg font-semibold">Đơn hàng</h2>
          <p className="mt-2 text-sm text-slate-600">Cập nhật trạng thái đơn hàng và theo dõi luồng thanh toán.</p>
        </Link>
      </div>

      <AnalyticsChatPanel />
    </section>
  );
}
