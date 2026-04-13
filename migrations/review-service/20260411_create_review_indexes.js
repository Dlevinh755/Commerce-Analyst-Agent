// MongoDB migration note: review-service creates the same indexes on startup via ensure_indexes().
// Kept here for migration audit trail.

db = db.getSiblingDB('review_db');
db.reviews.createIndex(
  { buyer_id: 1, order_id: 1, book_id: 1 },
  { unique: true, name: 'uq_buyer_order_book_review' }
);
db.reviews.createIndex({ book_id: 1, created_at: -1 }, { name: 'idx_book_created_at' });
db.reviews.createIndex({ order_id: 1, buyer_id: 1 }, { name: 'idx_order_buyer' });
