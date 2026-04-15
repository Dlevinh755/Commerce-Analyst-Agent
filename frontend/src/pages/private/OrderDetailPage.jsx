import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { orderService } from '../../services/orderService';
import { vnpayService } from '../../services/vnpayService';
import { bookReviewsApi } from '../../services/bookReviewsApi';
import Toast from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatCurrencyVND } from '../../utils/currency';

function formatOrderStatus(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipped: 'Đã gửi',
    delivered: 'Đã giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    partially_delivered: 'Giao một phần',
  };
  return labels[normalized] || normalized || 'Không xác định';
}

function formatPaymentStatus(status) {
  const normalized = String(status || '').toLowerCase();
  const labels = {
    pending: 'Đang chờ',
    completed: 'Thành công',
    paid: 'Thành công',
    failed: 'Thất bại',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
  };
  return labels[normalized] || normalized || 'Đang chờ';
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fetchOrderById = useOrderStore((state) => state.fetchOrderById);
  const isLoading = useOrderStore((state) => state.isLoading);
  const fetchProfile = useAuth((state) => state.fetchProfile);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [submittingReviewBookId, setSubmittingReviewBookId] = useState(null);
  const [reviewsByBookId, setReviewsByBookId] = useState({});
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [toast, setToast] = useState('');

  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const vnpTransactionNo = searchParams.get('vnp_TransactionNo');
  const vnpPaymentNotice =
    vnpResponseCode === '00'
      ? 'Thanh toán VNPay thành công.'
      : vnpResponseCode
        ? 'Thanh toán VNPay chưa thành công. Vui lòng thử lại.'
        : '';

  useEffect(() => {
    async function loadDetail() {
      setError('');
      const data = await fetchOrderById(id);
      if (!data) {
        setError('Không tìm thấy đơn hàng.');
        return;
      }
      setOrder(data);

      try {
        const { data: myReviews } = await bookReviewsApi.listMyByOrder(data.id || data.order_id);
        const reviewMap = (Array.isArray(myReviews) ? myReviews : []).reduce((acc, review) => {
          acc[Number(review.book_id)] = review;
          return acc;
        }, {});
        setReviewsByBookId(reviewMap);

        const drafts = {};
        for (const item of data.items || []) {
          const key = Number(item.book_id);
          const existing = reviewMap[key];
          drafts[key] = {
            rating: Number(existing?.rating || 5),
            comment: existing?.comment || '',
          };
        }
        setReviewDrafts(drafts);
      } catch {
        setReviewsByBookId({});
      }
    }

    loadDetail();
  }, [id, fetchOrderById]);

  const onConfirmReceived = async () => {
    setConfirming(true);
    try {
      await orderService.confirmReceived(id);
      const updated = await fetchOrderById(id);
      if (updated) {
        setOrder(updated);
      }
      setToast(`Đơn hàng #${id} đã được đánh dấu là đã giao.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể xác nhận đơn hàng này.'));
    } finally {
      setConfirming(false);
    }
  };

  const onCancelOrder = async () => {
    setCancelling(true);
    try {
      const { data } = await orderService.cancel(id);
      const updated = await fetchOrderById(id);
      if (updated) {
        setOrder(updated);
      }
      await fetchProfile().catch(() => null);
      setToast(data?.message || `Đơn hàng #${id} đã được cập nhật.`);
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể cập nhật đơn hàng này.'));
    } finally {
      setCancelling(false);
    }
  };

  const canRetryVnpay = (() => {
    if (!order) return false;
    const orderStatus = String(order.status || '').toLowerCase();
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const paymentMethod = String(order.payment_method || '').toLowerCase();
    const isPendingUnpaid = orderStatus === 'pending' && paymentStatus !== 'completed';
    return isPendingUnpaid && (paymentMethod === '' || paymentMethod === 'vnpay');
  })();

  const onRetryVnpay = async () => {
    setRetrying(true);
    try {
      const orderId = Number(order?.id || order?.order_id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        throw new Error('Mã đơn hàng không hợp lệ để thanh toán lại VNPay.');
      }

      const total = Number(order?.pricing?.total ?? order?.total ?? 0);
      const amountVnd = Math.max(1, Math.round(total * 25000));

      const { data } = await vnpayService.createPaymentUrl({
        order_id: String(orderId),
        amount: amountVnd,
        order_desc: `Thanh toan don hang ${orderId}`,
        return_url: `${window.location.origin}/checkout/vnpay-return`,
        language: 'vn',
      });

      const paymentUrl = data?.payment_url;
      if (!paymentUrl) {
        throw new Error('Không thể tạo URL thanh toán VNPay.');
      }

      window.location.href = paymentUrl;
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể bắt đầu thanh toán VNPay lại.'));
      setRetrying(false);
    }
  };

  const isOrderDelivered = ['delivered', 'partially_delivered'].includes(String(order?.status || '').toLowerCase());

  const onReviewDraftChange = (bookId, field, value) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [bookId]: {
        ...(prev[bookId] || { rating: 5, comment: '' }),
        [field]: value,
      },
    }));
  };

  const onSubmitReview = async (bookId) => {
    if (!order) return;
    const draft = reviewDrafts[bookId] || { rating: 5, comment: '' };
    setSubmittingReviewBookId(bookId);
    try {
      const payload = {
        order_id: Number(order.id || order.order_id),
        book_id: Number(bookId),
        rating: Number(draft.rating || 5),
        comment: String(draft.comment || '').trim() || null,
      };
      const { data } = await bookReviewsApi.upsert(payload);
      setReviewsByBookId((prev) => ({ ...prev, [bookId]: data }));
      setToast('Lưu đánh giá thành công.');
    } catch (err) {
      setToast(getErrorMessage(err, 'Không thể lưu đánh giá.'));
    } finally {
      setSubmittingReviewBookId(null);
    }
  };

  if (isLoading && !order) {
    return <section className="card">Đang tải chi tiết đơn hàng...</section>;
  }

  if (error) {
    return (
      <section className="card">
        <p className="text-red-600">{error}</p>
        <Link to="/orders" className="mt-3 inline-block text-brand-700">
          Quay lại danh sách đơn hàng
        </Link>
      </section>
    );
  }

  if (!order) {
    return <section className="card text-slate-600">Không có dữ liệu đơn hàng.</section>;
  }

  return (
    <section className="space-y-4">
      {vnpPaymentNotice ? (
        <div className={`rounded-lg p-3 text-sm ${vnpResponseCode === '00' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {vnpPaymentNotice}
          {vnpTransactionNo ? ` Mã giao dịch: ${vnpTransactionNo}.` : ''}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Đơn hàng #{order.id}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">{formatOrderStatus(order.status)}</span>
          {String(order.status).toLowerCase() === 'shipped' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onConfirmReceived}
              disabled={confirming}
            >
              {confirming ? 'Đang xác nhận...' : 'Xác nhận đã nhận'}
            </button>
          ) : null}
          {['pending', 'processing', 'shipped'].includes(String(order.status).toLowerCase()) ? (
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-3 py-1 text-sm font-medium text-rose-700"
              onClick={onCancelOrder}
              disabled={cancelling || String(order.cancellation_status || 'none').toLowerCase() === 'pending'}
            >
              {cancelling ? 'Đang gửi...' : String(order.status).toLowerCase() === 'shipped' ? 'Yêu cầu hủy' : 'Hủy đơn'}
            </button>
          ) : null}
          {canRetryVnpay ? (
            <button
              type="button"
              className="rounded-lg border border-brand-300 px-3 py-1 text-sm font-medium text-brand-700"
              onClick={onRetryVnpay}
              disabled={retrying}
            >
              {retrying ? 'Đang chuyển trang...' : 'Thanh toán lại'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold">Sản phẩm</h2>
          <div className="mt-3 space-y-3">
            {(order.items || []).map((item) => {
              const bookId = Number(item.book_id || item.id);
              const existingReview = reviewsByBookId[bookId];
              const draft = reviewDrafts[bookId] || { rating: 5, comment: '' };
              const itemStatus = String(item.status || '').toLowerCase();
              const canReviewItem = isOrderDelivered && (!itemStatus || itemStatus === 'delivered' || itemStatus === 'returned');

              return (
                <div key={item.id} className="border-b border-slate-100 pb-3 last:border-none last:pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-slate-500">{formatCurrencyVND(item.price)} x {item.quantity}</p>
                    </div>
                    <p className="font-medium">{formatCurrencyVND(item.line_total || item.price * item.quantity)}</p>
                  </div>

                  {canReviewItem ? (
                    <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-600">Đánh giá sản phẩm này</p>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600" htmlFor={`rating-${bookId}`}>Số sao</label>
                        <select
                          id={`rating-${bookId}`}
                          className="rounded border px-2 py-1 text-sm"
                          value={draft.rating}
                          onChange={(event) => onReviewDraftChange(bookId, 'rating', Number(event.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <option key={star} value={star}>{star} sao</option>
                          ))}
                        </select>
                        {existingReview ? <span className="text-xs text-emerald-700">Đã cập nhật đánh giá</span> : null}
                      </div>
                      <textarea
                        className="rounded border px-2 py-1 text-sm"
                        rows={2}
                        placeholder="Chia sẻ trải nghiệm của bạn"
                        value={draft.comment}
                        onChange={(event) => onReviewDraftChange(bookId, 'comment', event.target.value)}
                      />
                      <div>
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs"
                          onClick={() => onSubmitReview(bookId)}
                          disabled={submittingReviewBookId === bookId}
                        >
                          {submittingReviewBookId === bookId ? 'Đang lưu...' : existingReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card h-fit space-y-3">
          <h2 className="text-lg font-semibold">Tóm tắt</h2>
          <p className="text-sm text-slate-600">Đặt lúc: {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</p>
          {order.delivered_at ? (
            <p className="text-sm font-medium text-emerald-600">Đã nhận: {new Date(order.delivered_at).toLocaleString()}</p>
          ) : null}
          <p className="text-sm text-slate-600">Phương thức thanh toán: {order.payment_method || '-'}</p>
          <p className="text-sm text-slate-600">Trạng thái thanh toán: {formatPaymentStatus(order.payment_status || 'pending')}</p>
          {String(order.cancellation_status || 'none').toLowerCase() !== 'none' ? (
            <p className="text-sm text-slate-600">
              Trạng thái hủy: {order.cancellation_status}
              {order.cancellation_requested_at ? ` • yêu cầu lúc ${new Date(order.cancellation_requested_at).toLocaleString()}` : ''}
            </p>
          ) : null}
          {order.cancellation_reason ? (
            <p className="text-sm text-slate-600">Lý do hủy: {order.cancellation_reason}</p>
          ) : null}
          <p className="text-sm text-slate-600">Địa chỉ giao hàng: {order.shipping_address || '-'}</p>
          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-600">Tạm tính: {formatCurrencyVND(order.pricing?.subtotal || 0)}</p>
            <p className="text-sm text-slate-600">Phí vận chuyển: {formatCurrencyVND(order.pricing?.shipping_fee || 0)}</p>
            <p className="mt-1 text-lg font-semibold text-brand-700">Tổng cộng: {formatCurrencyVND(order.pricing?.total || order.total || 0)}</p>
          </div>
          {order.notes ? <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-600">Ghi chú: {order.notes}</p> : null}
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </section>
  );
}
