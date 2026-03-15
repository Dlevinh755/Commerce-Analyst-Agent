export function normalizeBook(raw = {}) {
  const categoryName =
    typeof raw.category === 'string'
      ? raw.category
      : raw.category?.name ?? raw.category_name ?? 'General';

  const sellerId = Number(raw.seller_id ?? raw.sellerId ?? raw.seller?.id ?? 0);
  const sellerUsername =
    raw.seller_username ?? raw.sellerUsername ?? raw.seller?.username ?? raw.seller?.name ?? null;

  return {
    id: raw.id ?? raw.book_id ?? raw.bookId,
    title: raw.title ?? raw.name ?? 'Untitled Book',
    author: raw.author ?? raw.author_name ?? 'Unknown Author',
    category: categoryName,
    description: raw.description ?? 'No description available.',
    cover:
      raw.cover ??
      raw.image ??
      raw.thumbnail ??
      'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=800&q=80',
    price: Number(raw.price ?? raw.unit_price ?? 0),
    stock: Number(raw.stock ?? raw.quantity ?? 0),
    rating: Number(raw.rating ?? 4.2),
    sellerId,
    sellerUsername,
    sellerDisplay: sellerUsername || (sellerId ? `Seller #${sellerId}` : 'Unknown seller'),
  };
}
