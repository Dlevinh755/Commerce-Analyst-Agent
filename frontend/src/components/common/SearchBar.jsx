export default function SearchBar({ value, onChange, onSubmit, placeholder = 'Search books...' }) {
  return (
    <form onSubmit={onSubmit} className="flex w-full items-center gap-2">
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="submit"
        className="btn-primary whitespace-nowrap transition hover:bg-brand-600 hover:shadow-md"
      >
        Search
      </button>
    </form>
  );
}
