export default function Spinner({ size = 'md', label = 'Loading...' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center">
      <div className={`${sizes[size]} border-4 border-[var(--card-border)]
                      border-t-[var(--accent)] rounded-full animate-spin`} />
      <span className="sr-only">{label}</span>
    </div>
  );
}