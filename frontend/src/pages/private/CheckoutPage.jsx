import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../../hooks/useCart';
import useAuth from '../../hooks/useAuth';
import useOrderStore from '../../store/orderStore';
import { paymentService } from '../../services/paymentService';
import { vnpayService } from '../../services/vnpayService';

const CHECKOUT_LOG_PREFIX = '[CheckoutPage]';
const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.debug(CHECKOUT_LOG_PREFIX, ...args);
  }
};

export default function CheckoutPage() {
  const items = useCart((state) => state.items);
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

  useEffect(() => {
    devLog('mount:fetchCart');
    fetchCart();
  }, [fetchCart]);

  const submitCheckout = async (event) => {
    event.preventDefault();
    setLocalError('');
    clearError();

    devLog('submit:start', {
      itemCount: items.length,
      totalAmount,
      paymentMethod,
      shippingAddressLength: shippingAddress.trim().length,
      userId: user?.user_id,
    });

    if (!items.length) {
      setLocalError('Your cart is empty.');
      return;
    }
    if (!shippingAddress.trim()) {
      setLocalError('Shipping address is required.');
      return;
    }

    if (shippingAddress.trim().length < 5) {
      setLocalError('Shipping address must be at least 5 characters.');
      return;
    }

    try {
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
        throw new Error('Could not determine order id after checkout.');
      }

      const total = Number(order.pricing?.total ?? order.total_amount ?? totalAmount ?? 0);

      await paymentService.create({
        order_id: numericOrderId,
        payment_method: paymentMethod,
      });
      devLog('submit:payment-created', { orderId: numericOrderId, paymentMethod });

      if (paymentMethod === 'VNPAY') {
        const returnUrl = `${window.location.origin}/orders/${orderId}`;
        const { data } = await vnpayService.createPaymentUrl({
          order_id: String(orderId),
          amount: Math.max(1, Math.round(total * 25000)),
          order_desc: `Thanh toan don hang #${orderId}`,
          return_url: returnUrl,
          language: 'vn',
        });

        const paymentUrl = data?.payment_url;
        if (!paymentUrl) {
          throw new Error('Could not create VNPay payment URL.');
        }

        devLog('submit:vnpay-redirect', { orderId, hasPaymentUrl: Boolean(paymentUrl) });
        await clearCart();
        window.location.href = paymentUrl;
        return;
      }

      devLog('submit:cod-complete', { orderId });
      await clearCart();
      navigate(`/orders/${orderId}`);
    } catch (error) {
      console.error(CHECKOUT_LOG_PREFIX, 'submit:error', error?.response?.status, error?.response?.data || error?.message);
      setLocalError(error?.response?.data?.detail || error?.message || 'Checkout failed.');
    }
  };

  if (!items.length) {
    return (
      <section className="card text-center">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="mt-3 text-slate-600">Your cart is empty.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/books')}>
          Browse books
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      <form onSubmit={submitCheckout} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Shipping Address</label>
            <textarea
              className="input min-h-28"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Street, city, country"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Payment Method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="COD">Cash on Delivery</option>
              <option value="VNPAY">VNPay</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Order Notes (Optional)</label>
            <textarea
              className="input min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for delivery"
            />
          </div>

          {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
          {storeError ? <p className="text-sm text-red-600">{storeError}</p> : null}
        </div>

        <aside className="card h-fit">
          <h2 className="text-lg font-semibold">Order Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <p className="line-clamp-1">{item.title} x{item.quantity}</p>
                <p>${((item.price || 0) * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm text-slate-600">
              <span>Shipping</span>
              <span>{totalAmount >= 50 ? 'Free' : '$4.99'}</span>
            </div>
          </div>

          <button type="submit" className="btn-primary mt-4 w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : paymentMethod === 'VNPAY' ? 'Pay with VNPay' : 'Place Order'}
          </button>
        </aside>
      </form>
    </section>
  );
}
