export default function FilterPanel({
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  layout = 'vertical',
}) {
  const isHorizontal = layout === 'horizontal';
  const wrapperClass = isHorizontal
    ? 'flex flex-col gap-4 rounded-2xl border-2 border-orange-100 bg-white/90 p-4 shadow-sm md:flex-row md:items-end'
    : 'h-fit rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm';
  const labelClass = isHorizontal
    ? 'mb-1 block text-xs font-bold uppercase tracking-wide text-stone-600'
    : 'mb-1 block text-xs font-bold uppercase tracking-wide text-stone-600';
  const fieldClass = isHorizontal ? 'w-full md:w-56' : '';

  return (
    <aside className={wrapperClass}>
      <div className={isHorizontal ? 'flex flex-1 flex-col gap-3 md:flex-row md:items-end' : 'space-y-3'}>
        <div className={fieldClass}>
          <h3 className={isHorizontal ? 'mb-1 text-sm font-bold text-ink' : 'mb-3 text-base font-bold text-ink'}>
            Bộ lọc
          </h3>
          <label className={labelClass}>Danh mục</label>
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
        </div>

        <div className={fieldClass}>
          <label className={`${labelClass} ${isHorizontal ? '' : 'mt-1'}`}>Sắp xếp theo</label>
          <select
            className="input py-2 text-sm"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="price-asc">Giá: Thấp đến cao</option>
            <option value="price-desc">Giá: Cao đến thấp</option>
            <option value="purchase-desc">Đã mua: Nhiều đến ít</option>
            <option value="purchase-asc">Đã mua: Ít đến nhiều</option>
            <option value="rating-desc">Đánh giá cao</option>
          </select>
        </div>
      </div>
    </aside>
  );
}
