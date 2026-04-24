/**
 * Skeleton placeholder shown while dashboard data loads.
 * Matches the visual size of MaterialCard to prevent layout shift.
 */
export default function SkeletonMaterialCard() {
  return (
    <div
      aria-hidden="true"
      className="
        bg-surface rounded-2xl p-5 shadow-card
        flex flex-col gap-3 animate-pulse
      "
    >
      <div className="h-4 bg-surface-2 rounded-lg w-3/4" />
      <div className="h-3 bg-surface-2 rounded-lg w-1/2" />
      <div className="h-3 bg-surface-2 rounded-lg w-2/3" />
      <div className="flex gap-2 mt-2">
        <div className="h-8 bg-surface-2 rounded-lg w-16" />
        <div className="h-8 bg-surface-2 rounded-lg w-14" />
      </div>
    </div>
  );
}