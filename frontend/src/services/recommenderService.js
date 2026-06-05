import api from './http';

async function getWithRouteFallback(paths, config) {
  let lastError;

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];

    try {
      return await api.get(path, config);
    } catch (error) {
      lastError = error;

      const isLastPath = index === paths.length - 1;
      const status = error?.response?.status;
      if (isLastPath || status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
}

export const recommenderService = {
  /**
   * Get top-K personalised book recommendations for a logged-in user by their numeric user_id.
   * Returns: { user_id, recommendations: [{ book_id, score, product?: {...} }] }
   */
  getByUserId: (userId, topK = 5) =>
    getWithRouteFallback(
      [`/recommendations/${userId}`, `/recommend/${userId}`],
      { params: { top_k: topK } }
    ),
};
