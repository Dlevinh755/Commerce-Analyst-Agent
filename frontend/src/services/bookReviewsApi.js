import api from './http';

export const bookReviewsApi = {
  listByBook: (bookId, params = {}) => api.get(`/reviews/books/${bookId}`, { params }),
  summaryByBook: (bookId) => api.get(`/reviews/books/${bookId}/summary`),
  listMyByOrder: (orderId) => api.get(`/reviews/orders/${orderId}/my`),
  upsert: (payload) => api.post('/reviews', payload),
};
