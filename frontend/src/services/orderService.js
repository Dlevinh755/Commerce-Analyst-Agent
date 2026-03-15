import api from './http';

export const orderService = {
  list: () => api.get('/orders/my'),
  listForSeller: (params = {}) => api.get('/orders/seller/my', { params }),
  detail: (orderId) => api.get(`/orders/${orderId}`),
  create: (payload) => api.post('/orders/checkout', payload),
  cancel: (orderId, payload = {}) => api.post(`/orders/${orderId}/cancel`, payload),
  approveCancellation: (orderId) => api.post(`/orders/${orderId}/cancel/approve`),
  rejectCancellation: (orderId, payload = {}) => api.post(`/orders/${orderId}/cancel/reject`, payload),
  confirmReceived: (orderId) => api.post(`/orders/${orderId}/confirm-received`),
  markShippedBySeller: (orderId) => api.post(`/orders/${orderId}/mark-shipped`),
  listForAdmin: (params = {}) => api.get('/orders', { params }),
  updateStatus: (orderId, status) => api.patch(`/orders/${orderId}/status`, { status }),
};
