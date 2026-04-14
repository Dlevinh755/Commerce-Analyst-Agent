import api from './http';

export const authService = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload),
  refresh: (payload) => api.post('/auth/refresh', payload, { __skipAuthRefresh: true }),
  logout: (payload) => api.post('/auth/logout', payload, { __skipAuthRefresh: true }),
  me: () => api.get('/auth/me'),
  updateMyAccountNumber: (payload) => api.patch('/users/me/account-number', payload),
  listUsers: (params = {}) => api.get('/users', { params }),
  updateUser: (userId, payload) => api.patch(`/users/${userId}`, payload),
  hideUser: (userId) => api.delete(`/users/${userId}`),
};
