export default function FilterPanel({ categories, selectedCategory, onCategoryChange, sortBy, onSortChange }) {
  return (
    <aside className="card h-fit">
      <h3 className="mb-3 text-lg font-semibold">Filters</h3>

      <label className="mb-2 block text-sm font-medium text-slate-600">Category</label>
      <select
        className="input"
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <label className="mb-2 mt-4 block text-sm font-medium text-slate-600">Sort by</label>
      <select className="input" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="rating-desc">Top Rated</option>
      </select>
    </aside>
  );
}
