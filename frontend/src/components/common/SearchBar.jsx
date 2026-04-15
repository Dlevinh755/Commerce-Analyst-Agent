export default function SearchBar({ value, onChange, onSubmit, placeholder = 'Tìm sách...' }) {
  return (
    <form onSubmit={onSubmit} className="flex w-full items-center gap-2 rounded-full bg-white p-1.5">
      <span className="pl-3 text-slate-400">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        className="w-full bg-transparent py-2 pr-2 text-slate-800 placeholder:text-slate-500 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="submit"
        className="whitespace-nowrap rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        Tìm
      </button>
    </form>
  );
}
