import api from './http';

export const cartService = {
  getSummary: () => api.get('/cart'),
  addItem: (payload) => api.post('/cart', payload),
  updateItem: (cartId, payload) => api.patch(`/cart/${cartId}`, payload),
  removeItem: (cartId) => api.delete(`/cart/${cartId}`),
  clear: () => api.delete('/cart'),
};
