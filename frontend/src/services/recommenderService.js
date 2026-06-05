import api from './http';

export const recommenderService = {
  /**
   * Get top-K personalised book recommendations for a logged-in user by their numeric user_id.
   * Returns: { user_id, recommendations: [{ book_id, score, product?: {...} }] }
   */
  getByUserId: (userId, topK = 5) =>
    api.get(`/recommendations/${userId}`, { params: { top_k: topK } }),
};
