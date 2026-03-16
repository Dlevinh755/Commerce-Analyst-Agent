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
  const [status, setStatus] = useState('Processing VNPay result...');
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
        setError('VNPay payment was not successful. No order was created.');
        return;
      }

      if (!pendingRaw) {
        setError('No pending VNPay checkout was found.');
        return;
      }

      let pendingCheckout;
      try {
        pendingCheckout = JSON.parse(pendingRaw);
      } catch {
        sessionStorage.removeItem(PENDING_VNPAY_CHECKOUT_KEY);
        setError('VNPay checkout data is invalid.');
        return;
      }

      try {
        const orderId = Number(pendingCheckout.createdOrderId);
        if (!Number.isInteger(orderId) || orderId <= 0) {
          throw new Error('Invalid order id in pending checkout data.');
        }

        // Payment confirmation is handled server-side via VNPay IPN.
        setStatus('Payment confirmed. Redirecting to your order...');

        await clearCart();
        sessionStorage.removeItem(PENDING_VNPAY_CHECKOUT_KEY);
        navigate(
          `/orders/${orderId}?vnp_ResponseCode=${encodeURIComponent(responseCode)}&vnp_TransactionNo=${encodeURIComponent(transactionCode || '')}`,
          { replace: true }
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Could not finalize VNPay checkout.'));
      }
    }

    finalizeVnpayOrder();
  }, [clearCart, navigate, searchParams]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-semibold">VNPay Checkout</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-slate-600">{status}</p>}
      <div className="flex gap-3">
        <Link to="/checkout" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Back to checkout
        </Link>
        <Link to="/cart" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Back to cart
        </Link>
      </div>
    </section>
  );
}