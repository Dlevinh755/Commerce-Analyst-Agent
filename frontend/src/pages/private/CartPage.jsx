import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import useCart from '../../hooks/useCart';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=300&q=80';

export default function CartPage() {
  const itemsRaw = useCart((state) => state.items);
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];
  const isLoading = useCart((state) => state.isLoading);
  const error = useCart((state) => state.error);
  const fetchCart = useCart((state) => state.fetchCart);
  const removeItem = useCart((state) => state.removeItem);
  const updateQuantity = useCart((state) => state.updateQuantity);
  const clearCart = useCart((state) => state.clearCart);
  const totalAmountFn = useCart((state) => state.totalAmount);
  const totalItemsFn = useCart((state) => state.totalItems);
  const totalAmount = totalAmountFn ? totalAmountFn() : 0;
  const totalItems = totalItemsFn ? totalItemsFn() : 0;

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const onClearCart = async () => {
    await clearCart();
  };

  const onRemoveItem = async (item) => {
    await removeItem({ cartId: item.cartId, bookId: item.id });
  };

  const onUpdateQuantity = async (item, quantity) => {
    await updateQuantity({ cartId: item.cartId, bookId: item.id }, quantity);
  };

  return (
    <section className="space-y-5">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">My Cart</h1>
              <p className="text-sm text-slate-500">{totalItems} items</p>
            </div>
            {items.length ? (
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={onClearCart}
              >
                Clear cart
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:h-32 sm:w-24">
                        {item.cover ? (
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = FALLBACK_COVER;
                            }}
                          />
                        ) : (
                          <img src={FALLBACK_COVER} alt={item.title} className="h-full w-full object-cover" />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-2xl font-medium leading-tight text-slate-900">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600">by {item.author}</p>
                        </div>

                        <div className="mt-1 flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-2 py-1">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-slate-300 text-base text-slate-600 transition hover:bg-slate-100"
                            onClick={() => onUpdateQuantity(item, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center text-sm text-slate-700">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-slate-300 text-base text-slate-600 transition hover:bg-slate-100"
                            onClick={() => onUpdateQuantity(item, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>

                        <span className="px-1 text-2xl font-semibold text-slate-900">${item.price.toFixed(2)} each</span>
                      </div>
                    </div>

                    <div className="flex w-full flex-col items-stretch gap-2 text-sm sm:w-48 sm:flex-shrink-0">
                      <Link
                        to={`/books?search=${encodeURIComponent(item.title)}`}
                        className="w-full rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-center text-xs font-medium leading-tight text-amber-800 hover:bg-amber-200"
                      >
                        Recommended similar products
                      </Link>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200"
                        onClick={() => onRemoveItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-3xl font-medium text-slate-900">Order summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>Subtotal ({totalItems} items)</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>Estimated Shipping</span>
                <span>$5.00</span>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-slate-900">Estimated Total</span>
                  <span className="text-2xl font-bold text-slate-900">${(totalAmount + 5).toFixed(2)}</span>
                </div>
              </div>
              <Link
                to="/checkout"
                className="mt-4 block rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 px-4 py-3 text-center font-medium text-white shadow-sm transition hover:brightness-105"
              >
                Checkout
              </Link>
              <Link to="/books" className="mt-3 block text-center text-sm font-medium text-brand-700 hover:text-brand-500">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
