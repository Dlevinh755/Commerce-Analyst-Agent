import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { paymentService } from '../../services/paymentService';
import { vnpayService } from '../../services/vnpayService';
import { formatCurrencyVND } from '../../utils/currency';

const CHECKOUT_LOG_PREFIX = '[CheckoutPage]';
const PENDING_VNPAY_CHECKOUT_KEY = 'pending-vnpay-checkout';
const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(CHECKOUT_LOG_PREFIX, ...args);
  }
};

export default function CheckoutPage() {
  const itemsRaw = useCart((state) => state.items);
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  const fetchCart = useCart((state) => state.fetchCart);
  const totalAmount = useCart((state) => state.totalAmount());
  const clearCart = useCart((state) => state.clearCart);
  const user = useAuth((state) => state.user);
  const createOrderFromCart = useOrderStore((state) => state.createOrderFromCart);
  const isLoading = useOrderStore((state) => state.isLoading);
  const storeError = useOrderStore((state) => state.error);
  const clearError = useOrderStore((state) => state.clearError);
  const navigate = useNavigate();

  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockedRef = useRef(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    devLog('mount:fetchCart');
    fetchCart();
  }, [fetchCart]);

  const submitCheckout = async (event) => {
    event.preventDefault();

    if (submitLockedRef.current) {
      devLog('submit:blocked-duplicate');
      return;
    }

    setLocalError('');
    clearError();
    redirectingRef.current = false;

    devLog('submit:start', {
      itemCount: items.length,
      totalAmount,
      paymentMethod,
      shippingAddressLength: shippingAddress.trim().length,
      userId: user?.user_id,
    });

    if (!items.length) {
      setLocalError('Giỏ hàng của bạn đang trống.');
      return;
    }
    if (!shippingAddress.trim()) {
      setLocalError('Vui lòng nhập địa chỉ giao hàng.');
      return;
    }

    if (shippingAddress.trim().length < 5) {
      setLocalError('Địa chỉ giao hàng phải có ít nhất 5 ký tự.');
      return;
    }

    submitLockedRef.current = true;
    setIsSubmitting(true);

    try {
      if (paymentMethod === 'VNPAY') {
        // Pre-create the order so the server-side IPN can confirm payment directly
        const order = await createOrderFromCart({
          user,
          cartItems: items,
          shippingAddress: shippingAddress.trim(),
          paymentMethod: 'VNPAY',
          notes: notes.trim(),
        });

        const orderId = order.order_id ?? order.id;
        const numericOrderId = Number(orderId);
        devLog('submit:vnpay-order-created', { orderId, numericOrderId });
        if (!orderId || Number.isNaN(numericOrderId) || !Number.isInteger(numericOrderId)) {
          throw new Error('Không xác định được mã đơn trước khi chuyển sang VNPay.');
        }

        const total = Number(order.pricing?.total ?? order.total_amount ?? totalAmount ?? 0);

        sessionStorage.setItem(
          PENDING_VNPAY_CHECKOUT_KEY,
          JSON.stringify({
            createdOrderId: numericOrderId,
            shippingAddress: shippingAddress.trim(),
            notes: notes.trim(),
            requestedAt: new Date().toISOString(),
          })
        );

        const { data } = await vnpayService.createPaymentUrl({
          order_id: String(numericOrderId),
          amount: Math.max(1, Math.round((total || totalAmount) )),
          order_desc: `Thanh toan don hang ${numericOrderId}`,
          return_url: `${window.location.origin}/checkout/vnpay-return`,
          language: 'vn',
        });

        const paymentUrl = data?.payment_url;
        if (!paymentUrl) {
          throw new Error('Không thể tạo URL thanh toán VNPay.');
        }

        devLog('submit:vnpay-redirect', { orderId: numericOrderId, hasPaymentUrl: Boolean(paymentUrl) });
        redirectingRef.current = true;
        window.location.href = paymentUrl;
        return;
      }

      const order = await createOrderFromCart({
        user,
        cartItems: items,
        shippingAddress: shippingAddress.trim(),
        paymentMethod,
        notes: notes.trim(),
      });

      const orderId = order.order_id ?? order.id;
      const numericOrderId = Number(orderId);
      devLog('submit:order-created', { orderId, numericOrderId });
      if (!orderId || Number.isNaN(numericOrderId) || !Number.isInteger(numericOrderId)) {
        throw new Error('Không xác định được mã đơn hàng sau khi thanh toán.');
      }

      const total = Number(order.pricing?.total ?? order.total_amount ?? totalAmount ?? 0);

      await paymentService.create({
        order_id: numericOrderId,
        payment_method: 'COD',
      });
      devLog('submit:payment-created', { orderId: numericOrderId, paymentMethod });

      devLog('submit:cod-complete', { orderId });
      await clearCart();
      navigate(`/orders/${orderId}`);
    } catch (error) {
      console.error(CHECKOUT_LOG_PREFIX, 'submit:error', error?.response?.status, error?.response?.data || error?.message);
      setLocalError(error?.response?.data?.detail || error?.message || 'Thanh toán thất bại.');
    } finally {
      if (!redirectingRef.current) {
        submitLockedRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  if (!items.length) {
    return (
      <section className="card text-center">
        <h1 className="text-2xl font-semibold">Thanh toán</h1>
        <p className="mt-3 text-slate-600">Giỏ hàng của bạn đang trống.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/books')}>
          Xem sách
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Thanh toán</h1>

      <form onSubmit={submitCheckout} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Địa chỉ giao hàng</label>
            <textarea
              className="input min-h-28"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Phương thức thanh toán</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="COD">Thanh toán khi nhận hàng</option>
              <option value="VNPAY">VNPay</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Ghi chú đơn hàng (tùy chọn)</label>
            <textarea
              className="input min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú cho người giao hàng"
            />
          </div>

          {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
          {storeError ? <p className="text-sm text-red-600">{storeError}</p> : null}
        </div>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Tóm tắt đơn hàng</h2>
          <div className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <p className="line-clamp-1">{item.title} x{item.quantity}</p>
                <p>{formatCurrencyVND((item.price || 0) * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tạm tính</span>
              <span>{formatCurrencyVND(totalAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm text-slate-600">
              <span>Vận chuyển</span>
              <span>{totalAmount >= 50 ? 'Miễn phí' : formatCurrencyVND(4.99)}</span>
            </div>
          </div>

          <button type="submit" className="btn-primary mt-4 w-full" disabled={isLoading || isSubmitting}>
            {isLoading || isSubmitting ? 'Đang xử lý...' : paymentMethod === 'VNPAY' ? 'Thanh toán với VNPay' : 'Đặt hàng'}
          </button>
        </aside>
      </form>
    </section>
  );
}
