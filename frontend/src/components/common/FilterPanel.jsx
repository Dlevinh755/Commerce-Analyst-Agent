export default function FilterPanel({
  categories,
  selectedCategory,
  onCategoryChange,
  minPurchased,
  onMinPurchasedChange,
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
        <option value="price-asc">Giá: Thấp đến cao</option>
        <option value="price-desc">Giá: Cao đến thấp</option>
        <option value="rating-desc">Đánh giá cao</option>
      </select>

      <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">Số lượng đã mua</label>
      <select className="input py-2 text-sm" value={minPurchased} onChange={(e) => onMinPurchasedChange(e.target.value)}>
        <option value="all">Tất cả</option>
        <option value="1">Từ 1 trở lên</option>
        <option value="10">Từ 10 trở lên</option>
        <option value="50">Từ 50 trở lên</option>
        <option value="100">Từ 100 trở lên</option>
      </select>
    </aside>
  );
}
