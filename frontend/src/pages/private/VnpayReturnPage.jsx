import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import { getErrorMessage } from '../../utils/errorMessage';

const PENDING_VNPAY_CHECKOUT_KEY = 'pending-vnpay-checkout';

export default function VnpayReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clearCart = useCart((state) => state.clearCart);
  const processedRef = useRef(false);
  const [status, setStatus] = useState('Đang xử lý kết quả VNPay...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    async function finalizeVnpayOrder() {
      const responseCode = searchParams.get('vnp_ResponseCode');
      const transactionCode = searchParams.get('vnp_TransactionNo');
      const pendingRaw = sessionStorage.getItem(PENDING_VNPAY_CHECKOUT_KEY);

      if (responseCode !== '00') {
        sessionStorage.removeItem(PENDING_VNPAY_CHECKOUT_KEY);
        setError('Thanh toán VNPay không thành công. Chưa tạo đơn hàng nào.');
        return;
      }

      if (!pendingRaw) {
        setError('Không tìm thấy phiên thanh toán VNPay đang chờ.');
        return;
      }

      let pendingCheckout;
      try {
        pendingCheckout = JSON.parse(pendingRaw);
      } catch {
        sessionStorage.removeItem(PENDING_VNPAY_CHECKOUT_KEY);
        setError('Dữ liệu thanh toán VNPay không hợp lệ.');
        return;
      }

      try {
        const orderId = Number(pendingCheckout.createdOrderId);
        if (!Number.isInteger(orderId) || orderId <= 0) {
          throw new Error('Mã đơn hàng trong dữ liệu chờ thanh toán không hợp lệ.');
        }

        // Payment confirmation is handled server-side via VNPay IPN.
        setStatus('Thanh toán đã được xác nhận. Đang chuyển đến đơn hàng của bạn...');

        await clearCart();
        sessionStorage.removeItem(PENDING_VNPAY_CHECKOUT_KEY);
        navigate(
          `/orders/${orderId}?vnp_ResponseCode=${encodeURIComponent(responseCode)}&vnp_TransactionNo=${encodeURIComponent(transactionCode || '')}`,
          { replace: true }
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Không thể hoàn tất thanh toán VNPay.'));
      }
    }

    finalizeVnpayOrder();
  }, [clearCart, navigate, searchParams]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-semibold">Kết quả thanh toán VNPay</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-600">{status}</p>}
      <div className="flex gap-3">
        <Link to="/checkout" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Quay lại trang thanh toán
        </Link>
        <Link to="/cart" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Quay lại giỏ hàng
        </Link>
      </div>
    </section>
  );
}