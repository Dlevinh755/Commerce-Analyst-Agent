const STACK = [
  { color: 'bg-rose-400', rotate: '-rotate-6', z: 'z-10', offset: 'translate-x-0' },
  { color: 'bg-amber-400', rotate: 'rotate-3', z: 'z-20', offset: 'translate-x-8' },
  { color: 'bg-teal-400', rotate: '-rotate-2', z: 'z-30', offset: 'translate-x-16' },
  { color: 'bg-violet-400', rotate: 'rotate-6', z: 'z-40', offset: 'translate-x-24' },
  { color: 'bg-orange-500', rotate: '-rotate-3', z: 'z-50', offset: 'translate-x-32' },
];

export default function HeroBookStack({ className = '' }) {
  return (
    <div
      className={`relative mx-auto flex h-64 w-full max-w-md items-end justify-center sm:h-72 ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-200/50 via-orange-100/30 to-transparent blur-2xl" />
      {STACK.map((book, index) => (
        <div
          key={index}
          className={`absolute bottom-4 h-44 w-28 rounded-lg border-2 border-white/60 shadow-lg sm:h-52 sm:w-32 ${book.color} ${book.rotate} ${book.z} ${book.offset}`}
        >
          <div className="h-full w-3 rounded-l-md bg-black/10" />
          <div className="absolute left-4 right-3 top-6 space-y-2">
            <div className="h-2 rounded bg-white/40" />
            <div className="h-2 w-4/5 rounded bg-white/30" />
            <div className="h-2 w-3/5 rounded bg-white/25" />
          </div>
        </div>
      ))}
    </div>
  );
}
