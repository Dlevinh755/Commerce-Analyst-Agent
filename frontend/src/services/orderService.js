import api from './http';

export const orderService = {
  list: () => api.get('/orders/my'),
  detail: (orderId) => api.get(`/orders/${orderId}`),
  create: (payload) => api.post('/orders/checkout', payload),
};
