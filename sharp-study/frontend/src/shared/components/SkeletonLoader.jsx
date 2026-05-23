import { FullPageShellSkeleton } from './PageSkeletons';

/**
 * SkeletonLoader - A full-page skeleton loading screen with animated placeholders
 * that mimics the dashboard layout while user preferences are loading.
 */
export default function SkeletonLoader() {
  return <FullPageShellSkeleton pathname="/dashboard" />;
}
