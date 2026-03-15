import api from './http';

export const authService = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
  updateMyAccountNumber: (payload) => api.patch('/users/me/account-number', payload),
  listUsers: (params = {}) => api.get('/users', { params }),
  updateUser: (userId, payload) => api.patch(`/users/${userId}`, payload),
  hideUser: (userId) => api.delete(`/users/${userId}`),
};
