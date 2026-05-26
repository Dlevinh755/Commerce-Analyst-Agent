import api from './http';

export const recommenderService = {
  recommendByCF: (payload) => api.post('/recommendations/cf', payload),
  recommendRaw: (payload) => api.post('/recommendations/raw', payload),
};
