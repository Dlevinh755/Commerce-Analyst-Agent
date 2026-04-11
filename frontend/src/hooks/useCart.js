import useCartStore from '../store/cartStore';

const identity = (state) => state;
let hasWarnedInvalidHookRuntime = false;

export default function useCart(selector) {
  const pick = selector ?? identity;

  try {
    return useCartStore(pick);
  } catch (error) {
    // During transient HMR/runtime cache issues React hook dispatcher can become null.
    if (
      error instanceof TypeError &&
      String(error.message || '').includes("Cannot read properties of null (reading 'useRef')")
    ) {
      if (!hasWarnedInvalidHookRuntime) {
        hasWarnedInvalidHookRuntime = true;
        console.warn('[useCart] Falling back to store snapshot because React hook runtime is temporarily unavailable.');
      }
      return pick(useCartStore.getState());
    }
    throw error;
  }
}
