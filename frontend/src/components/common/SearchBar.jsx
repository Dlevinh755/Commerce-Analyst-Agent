export default function SearchBar({ value, onChange, onSubmit, placeholder = 'Tìm sách...' }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit(event);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 rounded-full bg-white p-1.5">
      <span className="pl-3 text-stone-500">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        className="w-full bg-transparent py-2 pr-2 font-medium text-ink placeholder:font-semibold placeholder:text-stone-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button type="submit" className="btn-primary whitespace-nowrap rounded-full px-5 py-2 text-sm">
        Tìm
      </button>
    </form>
  );
}
