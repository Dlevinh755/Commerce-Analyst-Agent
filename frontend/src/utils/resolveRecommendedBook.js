import { normalizeBook } from './bookMapper';

function hasProductPayload(product) {
  return (
    product &&
    typeof product === 'object' &&
    (product.title || product.image_url || product.product_id || product.book_id)
  );
}

/**
 * Map one recommender hit to a UI book. Uses only `rec.product` from the API
 * (Databricks dim_books or product-service enrichment). Skips hits without
 * product data — the backend already backfills by score from extra Qdrant hits.
 */
export function resolveRecommendedBook(rec) {
  const product = rec?.product;
  if (!hasProductPayload(product)) return null;

  const bookId = rec?.book_id ?? product.book_id ?? product.product_id ?? product.id;
  if (!bookId) return null;

  return normalizeBook({
    ...product,
    id: product.book_id ?? product.product_id ?? bookId,
  });
}

/**
 * Resolve recommendations in score order until `topK` valid books are found.
 */
export function resolveRecommendedBooks(rawRecs, topK = 5) {
  const books = [];
  for (const rec of rawRecs) {
    if (books.length >= topK) break;
    const book = resolveRecommendedBook(rec);
    if (book?.id !== undefined) books.push(book);
  }
  return books;
}
