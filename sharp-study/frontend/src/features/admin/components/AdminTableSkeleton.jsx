export default function AdminTableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid gap-3 rounded-[1.4rem] border border-border bg-surface-2 p-4 md:grid-cols-[1.2fr_1.1fr_0.7fr_0.7fr_0.8fr]">
          <div className="h-5 animate-pulse rounded bg-surface" />
          <div className="h-5 animate-pulse rounded bg-surface" />
          <div className="h-5 animate-pulse rounded bg-surface" />
          <div className="h-5 animate-pulse rounded bg-surface" />
          <div className="h-5 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
