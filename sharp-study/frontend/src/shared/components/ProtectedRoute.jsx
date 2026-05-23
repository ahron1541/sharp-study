import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import Spinner from './Spinner';
import { FullPageShellSkeleton } from './PageSkeletons';

export default function ProtectedRoute({ children, adminOnly = false, studentOnly = false }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    if (!adminOnly) {
      return <FullPageShellSkeleton pathname={location.pathname || '/dashboard'} />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size="lg" label="Checking your access..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.is_blocked) {
    localStorage.removeItem('sharp-study-token');
    localStorage.removeItem('sharp-study-role');
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Spinner size="lg" label="Verifying administrator access..." />
      </div>
    );
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (studentOnly && profile?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
