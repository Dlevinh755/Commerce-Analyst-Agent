import useCartStore from '../store/cartStore';

export default function useCart(selector) {
  return useCartStore(selector);
}
