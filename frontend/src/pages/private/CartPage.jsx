import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import useCart from '../../hooks/useCart';

export default function CartPage() {
  const items = useCart((state) => state.items);
  const isLoading = useCart((state) => state.isLoading);
  const error = useCart((state) => state.error);
  const fetchCart = useCart((state) => state.fetchCart);
  const removeItem = useCart((state) => state.removeItem);
  const updateQuantity = useCart((state) => state.updateQuantity);
  const clearCart = useCart((state) => state.clearCart);
  const totalAmount = useCart((state) => state.totalAmount());

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const onClearCart = async () => {
    await clearCart();
  };

  const onRemoveItem = async (bookId) => {
    await removeItem(bookId);
  };

  const onUpdateQuantity = async (bookId, quantity) => {
    await updateQuantity(bookId, quantity);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My Cart</h1>
        {items.length ? (
          <button type="button" className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600" onClick={onClearCart}>
            Clear cart
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {isLoading ? <div className="card text-center text-slate-600">Loading cart...</div> : null}

      {!isLoading && items.length === 0 ? (
        <div className="card text-center">
          <p className="text-slate-600">Your cart is empty.</p>
          <Link to="/books" className="btn-primary mt-4 inline-block">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-slate-500">Unit price: ${item.price}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                >
                  -
                </button>
                <span className="min-w-8 text-center">{item.quantity}</span>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                >
                  +
                </button>
                <button type="button" className="ml-2 text-sm text-red-600" onClick={() => onRemoveItem(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Estimated total</p>
              <p className="text-xl font-semibold">${totalAmount.toFixed(2)}</p>
            </div>
            <Link to="/checkout" className="btn-primary text-center">
              Checkout
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
