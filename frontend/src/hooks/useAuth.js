import useAuthStore from '../store/authStore';

const identity = (state) => state;
let hasWarnedInvalidHookRuntime = false;

export default function useAuth(selector) {
  const pick = selector ?? identity;

  try {
    return useAuthStore(pick);
  } catch (error) {
    // During transient HMR/runtime cache issues React hook dispatcher can become null.
    if (
      error instanceof TypeError &&
      String(error.message || '').includes("Cannot read properties of null (reading 'useRef')")
    ) {
      if (!hasWarnedInvalidHookRuntime) {
        hasWarnedInvalidHookRuntime = true;
        console.warn('[useAuth] Falling back to store snapshot because React hook runtime is temporarily unavailable.');
      }
      return pick(useAuthStore.getState());
    }
    throw error;
  }
}
