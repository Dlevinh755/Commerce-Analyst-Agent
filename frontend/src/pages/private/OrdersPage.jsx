import { useEffect, useMemo, useState } from 'react';
import { orderService } from '../../services/orderService';
import { getErrorMessage } from '../../utils/errorMessage';
import Toast from '../../components/common/Toast';
import useAuth from '../../hooks/useAuth';
import { formatCurrencyVND } from '../../utils/currency';

const DATE_FILTERS = [
  { value: 'all', label: 'Khoảng thời gian' },
  { value: '7', label: '7 ngày gần đây' },
  { value: '30', label: '30 ngày gần đây' },
];

function formatCurrency(value) {
  return formatCurrencyVND(value);
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function formatOrderStatus(status) {
  const normalized = normalizeStatus(status);
  const labels = {
    pending: 'Cho xu ly',
    processing: 'Dang xu ly',
    ready_to_ship: 'San sang giao',
    shipped: 'Da gui',
    delivered: 'Da giao',
    completed: 'Hoan tat',
    cancelled: 'Da huy',
    canceled: 'Da huy',
  };
  return labels[normalized] || normalized || 'Khong xac dinh';
}

function getStatusBadgeClass(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'delivered' || normalized === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (normalized === 'shipped') {
    return 'bg-sky-100 text-sky-700';
  }
  if (normalized === 'pending' || normalized === 'processing' || normalized === 'ready_to_ship') {
    return 'bg-amber-100 text-amber-700';
  }
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function OrdersPage() {
  const user = useAuth((state) => state.user);
  const currentSellerId = Number(user?.user_id || 0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [reviewingOrderId, setReviewingOrderId] = useState(null);
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await orderService.listForSeller({ page: 1, page_size: 100 });
      setOrders(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải đơn hàng của người bán.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const onMarkShipped = async (orderId) => {
    setShippingOrderId(orderId);
    try {
      const { data } = await orderService.markShippedBySeller(orderId);
      setOrders((prev) =>
        prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item))
      );
      setToast(`Đơn hàng #${orderId} đã được đánh dấu đã gửi.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng.'));
    } finally {
      setShippingOrderId(null);
    }
  };

  const onApproveCancellation = async (orderId) => {
    setReviewingOrderId(orderId);
    try {
      const { data } = await orderService.approveCancellation(orderId);
      setOrders((prev) => prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item)));
      setToast(`Đã duyệt hủy đơn hàng #${orderId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể duyệt yêu cầu hủy đơn.'));
    } finally {
      setReviewingOrderId(null);
    }
  };

  const onRejectCancellation = async (orderId) => {
    setReviewingOrderId(orderId);
    try {
      const { data } = await orderService.rejectCancellation(orderId);
      setOrders((prev) => prev.map((item) => (item.order_id === orderId ? { ...item, ...data } : item)));
      setToast(`Đã từ chối hủy đơn hàng #${orderId}.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể từ chối yêu cầu hủy đơn.'));
    } finally {
      setReviewingOrderId(null);
    }
  };

  const ordersWithSellerData = useMemo(
    () =>
      orders.map((order) => {
        const mySellerOrder = Array.isArray(order.seller_orders)
          ? order.seller_orders.find((item) => Number(item?.seller_id) === currentSellerId)
          : null;
        const mySellerStatus = normalizeStatus(mySellerOrder?.status || order.status);
        const buyerId = order.buyer_id ? `#${order.buyer_id}` : null;
        const buyerName = order.buyer_name || null;
        const buyerLabel = buyerName || buyerId || '-';
        return {
          ...order,
          buyerLabel,
          mySellerOrder,
          mySellerStatus,
        };
      }),
    [orders, currentSellerId]
  );

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const rangeDays = Number(dateFilter);

    return ordersWithSellerData.filter((order) => {
      if (normalizedSearch) {
        const orderIdText = String(order.order_id || '').toLowerCase();
        const buyerText = String(order.buyerLabel || '').toLowerCase();
        if (!orderIdText.includes(normalizedSearch) && !buyerText.includes(normalizedSearch)) {
          return false;
        }
      }

      if (statusFilter) {
        const normalized = normalizeStatus(order.status);
        if (normalized !== statusFilter) {
          return false;
        }
      }

      if (rangeDays > 0) {
        const orderTime = new Date(order.order_date).getTime();
        if (Number.isFinite(orderTime)) {
          const diffDays = (now - orderTime) / (1000 * 60 * 60 * 24);
          if (diffDays > rangeDays) {
            return false;
          }
        }
      }

      return true;
    });
  }, [ordersWithSellerData, searchTerm, statusFilter, dateFilter]);

  const summaryCounts = useMemo(() => {
    const counts = { pending: 0, shipped: 0, delivered: 0 };
    ordersWithSellerData.forEach((order) => {
      const status = normalizeStatus(order.mySellerStatus || order.status);
      if (status === 'delivered' || status === 'completed') {
        counts.delivered += 1;
      } else if (status === 'shipped') {
        counts.shipped += 1;
      } else if (status) {
        counts.pending += 1;
      }
    });
    return counts;
  }, [ordersWithSellerData]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Đơn hàng người bán</h1>
          <p className="mt-1 text-slate-600">Đánh dấu đã gửi khi đơn hàng rời kho của bạn.</p>
        </div>
        <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={loadOrders}>
          Làm mới
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Đơn chờ xử lý</p>
            <p className="text-lg font-semibold text-slate-900">{summaryCounts.pending}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h13l3 4v6a1 1 0 0 1-1 1h-2" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Đơn đã gửi</p>
            <p className="text-lg font-semibold text-slate-900">{summaryCounts.shipped}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l4 4L19 6" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Đơn đã giao</p>
            <p className="text-lg font-semibold text-slate-900">{summaryCounts.delivered}</p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
              placeholder="Tìm mã đơn hoặc tên người mua"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 w-44 shrink-0 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Trạng thái đơn</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processing">Đang xử lý</option>
            <option value="shipped">Đã gửi</option>
            <option value="delivered">Đã giao</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="h-9 w-44 shrink-0 rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
          >
            {DATE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {error ? <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="card mt-3">Đang tải đơn hàng...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="card mt-3 text-slate-600">Không tìm thấy đơn hàng nào cho sách của bạn.</div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-3 text-left font-medium">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Mã đơn</th>
                  <th className="px-3 py-3 text-left font-medium">Người mua</th>
                  <th className="px-3 py-3 text-left font-medium">Ngày đặt</th>
                  <th className="px-3 py-3 text-left font-medium">Tổng tiền</th>
                  <th className="px-3 py-3 text-left font-medium">Trạng thái đơn</th>
                  <th className="px-3 py-3 text-left font-medium">Trạng thái mặt hàng</th>
                  <th className="px-3 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const status = normalizeStatus(order.status);
                  const cancellationStatus = normalizeStatus(order.cancellation_status || 'none');
                  const mySellerStatus = normalizeStatus(order.mySellerOrder?.status || order.status);
                  const canMarkShipped = mySellerStatus
                    ? ['pending', 'processing', 'ready_to_ship'].includes(mySellerStatus)
                    : status === 'pending' || status === 'processing';
                  const hasPendingCancellation = status === 'shipped' && cancellationStatus === 'pending';
                  const sellerItems = Array.isArray(order.items)
                    ? order.items.filter((item) => Number(item?.seller_id) === currentSellerId)
                    : [];
                  const pendingItemCount = sellerItems.filter((item) => {
                    const itemStatus = normalizeStatus(item?.status);
                    return !itemStatus || ['pending', 'processing', 'ready_to_ship'].includes(itemStatus);
                  }).length;
                  const showPendingCount = pendingItemCount > 0 && canMarkShipped;
                  return (
                    <tr key={order.order_id}>
                      <td className="px-3 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-3 font-medium">#{order.order_id}</td>
                      <td className="px-3 py-3">{order.buyerLabel}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(order.order_date)}</td>
                      <td className="px-3 py-3">{formatCurrency(order.total_amount)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                          {formatOrderStatus(order.status || 'pending')}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(mySellerStatus)}`}>
                          {formatOrderStatus(mySellerStatus || 'khong_xac_dinh')}{showPendingCount ? ` (${pendingItemCount})` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {hasPendingCancellation ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700"
                              onClick={() => onApproveCancellation(order.order_id)}
                              disabled={reviewingOrderId === order.order_id}
                            >
                              {reviewingOrderId === order.order_id ? 'Đang cập nhật...' : 'Duyệt hủy'}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                              onClick={() => onRejectCancellation(order.order_id)}
                              disabled={reviewingOrderId === order.order_id}
                            >
                              {reviewingOrderId === order.order_id ? 'Đang cập nhật...' : 'Từ chối'}
                            </button>
                          </div>
                        ) : canMarkShipped ? (
                          <button
                            type="button"
                            className="btn-primary px-3 py-1.5 text-xs"
                            onClick={() => onMarkShipped(order.order_id)}
                            disabled={shippingOrderId === order.order_id}
                          >
                            {shippingOrderId === order.order_id ? 'Đang cập nhật...' : 'Đánh dấu đã gửi'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
