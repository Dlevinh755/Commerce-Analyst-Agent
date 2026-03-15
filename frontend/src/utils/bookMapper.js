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

export function getFallbackBooks() {
  return [
    {
      id: 1,
      title: 'Clean Architecture',
      author: 'Robert C. Martin',
      category: 'Software',
      description: 'Guide to building maintainable software systems.',
      price: 39,
      stock: 20,
      rating: 4.8,
      cover:
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 2,
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      category: 'Data',
      description: 'Patterns and principles for reliable data systems.',
      price: 49,
      stock: 14,
      rating: 4.9,
      cover:
        'https://images.unsplash.com/photo-1455885666463-9db9984de82a?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 3,
      title: 'Refactoring',
      author: 'Martin Fowler',
      category: 'Software',
      description: 'Improve code design without changing behavior.',
      price: 35,
      stock: 18,
      rating: 4.7,
      cover:
        'https://images.unsplash.com/photo-1524578271613-d550eacf6090?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 4,
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt',
      category: 'Career',
      description: 'Timeless lessons for practical software craftsmanship.',
      price: 29,
      stock: 25,
      rating: 4.8,
      cover:
        'https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=900&q=80',
    },
  ];
}
