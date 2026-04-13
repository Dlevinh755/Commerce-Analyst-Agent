import useAuthStore from '../store/authStore';

export default function useAuth(selector) {
  return useAuthStore(selector);
}
