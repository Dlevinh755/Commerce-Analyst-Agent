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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Cart</h1>
          <p className="text-sm text-slate-500">{totalItems} items</p>
        </div>
        {items.length ? (
          <button
            type="button"
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={onClearCart}
          >
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
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-32">
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

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.title}</p>
                        <p className="text-sm text-slate-500">by {item.author}</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 px-2 py-1">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-slate-300 text-sm"
                            onClick={() => onUpdateQuantity(item, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-slate-300 text-sm"
                            onClick={() => onUpdateQuantity(item, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="px-1 text-sm font-medium text-slate-700">${item.price.toFixed(2)} each</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 text-sm sm:mt-[10px] sm:w-52 sm:flex-shrink-0">
                    <Link
                      to={`/books?search=${encodeURIComponent(item.title)}`}
                      className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-center text-sm font-medium text-amber-800 hover:bg-amber-200"
                    >
                      Goi y san pham tuong tu
                    </Link>
                    <button
                      type="button"
                      className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
                      onClick={() => onRemoveItem(item)}
                    >
                      Xoa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>Items</span>
              <span>{totalItems}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
              <span>Estimated total</span>
              <span className="text-base font-semibold text-slate-900">${totalAmount.toFixed(2)}</span>
            </div>
            <Link to="/checkout" className="btn-primary mt-4 block text-center">
              Checkout
            </Link>
            <Link to="/books" className="mt-3 block text-center text-sm text-brand-700">
              Continue shopping
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
