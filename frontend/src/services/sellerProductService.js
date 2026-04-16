import api from './http';

export const sellerProductService = {
  listCategories: () => api.get('/products/categories'),
  listMine: () => api.get('/products/books/me/list'),
  listForAdmin: (params = {}) => api.get('/products/books/admin/list', { params }),
  detail: (bookId) => api.get(`/products/books/${bookId}`),
  create: (payload) => api.post('/products/books', payload),
  update: (bookId, payload) => api.patch(`/products/books/${bookId}`, payload),
  updateAsAdmin: (bookId, payload) => api.patch(`/products/books/admin/${bookId}`, payload),
  setVisibility: (bookId, isHidden) =>
    api.patch(`/products/books/${bookId}/visibility`, { is_hidden: Boolean(isHidden) }),
  hardDelete: (bookId) => api.delete(`/products/books/${bookId}/hard-delete`),
  remove: (bookId) => api.delete(`/products/books/${bookId}`),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/products/books/upload-image', formData);
  },
};
