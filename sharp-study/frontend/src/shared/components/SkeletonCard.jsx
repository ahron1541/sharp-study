export default function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 animate-pulse"
    >
      <div className="h-4 bg-[var(--card-border)] rounded w-3/4 mb-3" />
      <div className="h-3 bg-[var(--card-border)] rounded w-1/2 mb-2" />
      <div className="h-3 bg-[var(--card-border)] rounded w-2/3 mb-4" />
      <div className="flex gap-2">
        <div className="h-8 bg-[var(--card-border)] rounded w-20" />
        <div className="h-8 bg-[var(--card-border)] rounded w-16" />
      </div>
    </div>
  );
}