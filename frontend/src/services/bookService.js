import api from './http';

export const bookService = {
  list: (params = {}) => api.get('/products/books', { params }),
  detail: (bookId) => api.get(`/products/books/${bookId}`),
};
