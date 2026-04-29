import './SkeletonLoader.css';

/**
 * SkeletonLoader - A full-page skeleton loading screen with animated placeholders
 * that mimics the dashboard layout while user preferences are loading.
 */
export default function SkeletonLoader() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading dashboard">
      {/* Top Bar Skeleton */}
      <div className="skeleton-topbar">
        <div className="skeleton-avatar" />
        <div className="skeleton-text skeleton-text-md" />
      </div>

      <div className="skeleton-content">
        {/* Welcome Banner Skeleton */}
        <div className="skeleton-banner">
          <div className="skeleton-text skeleton-text-lg" />
          <div className="skeleton-text skeleton-text-sm" />
        </div>

        {/* Stats Bar Skeleton */}
        <div className="skeleton-stats">
          <div className="skeleton-stat-card">
            <div className="skeleton-icon" />
            <div className="skeleton-text skeleton-text-xl" />
            <div className="skeleton-text skeleton-text-xs" />
          </div>
          <div className="skeleton-stat-card">
            <div className="skeleton-icon" />
            <div className="skeleton-text skeleton-text-xl" />
            <div className="skeleton-text skeleton-text-xs" />
          </div>
          <div className="skeleton-stat-card">
            <div className="skeleton-icon" />
            <div className="skeleton-text skeleton-text-xl" />
            <div className="skeleton-text skeleton-text-xs" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="skeleton-main-grid">
          {/* Left: Material Cards */}
          <div className="skeleton-section">
            <div className="skeleton-section-header">
              <div className="skeleton-icon" />
              <div className="skeleton-text skeleton-text-md" />
            </div>
            <div className="skeleton-cards-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-card-header">
                    <div className="skeleton-icon-small" />
                    <div className="skeleton-text skeleton-text-xs" />
                  </div>
                  <div className="skeleton-text skeleton-text-md" />
                  <div className="skeleton-text skeleton-text-sm" />
                  <div className="skeleton-card-actions">
                    <div className="skeleton-button" />
                    <div className="skeleton-button-small" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Widgets */}
          <div className="skeleton-sidebar">
            {/* Streak Widget */}
            <div className="skeleton-widget">
              <div className="skeleton-text skeleton-text-sm" />
              <div className="skeleton-streak-number">
                <div className="skeleton-icon" />
                <div className="skeleton-text skeleton-text-2xl" />
              </div>
              <div className="skeleton-weekly-dots">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="skeleton-dot" />
                ))}
              </div>
              <div className="skeleton-progress-bar" />
            </div>

            {/* Daily Goals Widget */}
            <div className="skeleton-widget">
              <div className="skeleton-text skeleton-text-sm" />
              <div className="skeleton-goals-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-goal-item">
                    <div className="skeleton-checkbox" />
                    <div className="skeleton-text skeleton-text-sm flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}