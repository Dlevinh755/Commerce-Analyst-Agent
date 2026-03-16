import useAuthStore from '../store/authStore';

const identity = (state) => state;

export default function useAuth(selector) {
  return useAuthStore(selector ?? identity);
}
