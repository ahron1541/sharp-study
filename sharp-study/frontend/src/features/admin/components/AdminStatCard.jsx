export default function AdminStatCard({ label, value, hint, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'bg-surface-2 text-text',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-rose-500/10 text-rose-600',
  };

  return (
    <article className="rounded-[1.8rem] border border-border bg-surface p-5 shadow-card">
      <div className={`inline-flex rounded-2xl px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${toneClasses[tone] || toneClasses.neutral}`}>
        {label}
      </div>
      <p className="mt-4 text-4xl font-display font-black text-text">{value}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{hint}</p>
    </article>
  );
}
