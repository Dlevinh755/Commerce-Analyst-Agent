import api from './http';

export const payoutService = {
  create: (payload) => api.post('/payouts', payload),
  listMine: (params = {}) => api.get('/payouts/my', { params }),
  listForAdmin: (params = {}) => api.get('/payouts', { params }),
  approve: (payoutId, payload = {}) => api.post(`/payouts/${payoutId}/approve`, payload),
  reject: (payoutId, payload = {}) => api.post(`/payouts/${payoutId}/reject`, payload),
};
