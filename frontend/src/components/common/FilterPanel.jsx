export default function FilterPanel({
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
}) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-semibold text-slate-700">Bộ lọc</h3>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Danh mục</label>
      <select
        className="input py-2 text-sm"
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="all">Tất cả danh mục</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sắp xếp theo</label>
      <select className="input py-2 text-sm" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
        <option value="newest">Mới nhất</option>
        <option value="oldest">Cũ nhất</option>
        <option value="price-asc">Giá: Thấp đến cao</option>
        <option value="price-desc">Giá: Cao đến thấp</option>
        <option value="purchase-desc">Đã mua: Nhiều đến ít</option>
        <option value="purchase-asc">Đã mua: Ít đến nhiều</option>
        <option value="rating-desc">Đánh giá cao</option>
      </select>
    </aside>
  );
}
