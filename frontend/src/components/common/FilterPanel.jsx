export default function FilterPanel({ categories, selectedCategory, onCategoryChange, sortBy, onSortChange }) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold text-slate-700">Filters</h3>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
      <select
        className="input py-2 text-sm"
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

      <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort by</label>
      <select className="input py-2 text-sm" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="rating-desc">Top Rated</option>
      </select>
    </aside>
  );
}
