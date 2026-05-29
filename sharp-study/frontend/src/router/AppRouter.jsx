import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ProtectedRoute from '../shared/components/ProtectedRoute';
import SessionTimeout from '../shared/components/SessionTimeout';
import { FullPageShellSkeleton } from '../shared/components/PageSkeletons';
import AppShell from '../features/dashboard/components/AppShell';
import AdminShell from '../features/admin/components/AdminShell';
import { useAuth } from '../features/auth/context/AuthContext';

// Lazy-loaded pages (performance — loads only when needed)
const LandingPage = lazy(() => import('../features/landing/pages/LandingPage'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordPage'));
const PrivacyPolicyPage = lazy(() => import('../features/legal/pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('../features/legal/pages/TermsOfServicePage'));
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const LibraryPage = lazy(() => import('../features/library/pages/LibraryPage'));
const ArchivePage = lazy(() => import('../features/archive/pages/ArchivePage'));
const NotificationsPage = lazy(() => import('../features/notifications/pages/NotificationsPage'));
const StudyGuidePage = lazy(() => import('../features/study-guide/pages/StudyGuidePage'));
const StudyGuideCreatePage = lazy(() => import('../features/study-guide/pages/StudyGuideCreatePage'));
const FlashcardsCreatePage = lazy(() => import('../features/flashcards/pages/FlashcardsCreatePage'));
const FlashcardsPage = lazy(() => import('../features/flashcards/pages/FlashcardsPage'));
const QuizPage = lazy(() => import('../features/quiz/pages/QuizPage'));
const QuizBuilderPage = lazy(() => import('../features/quiz/pages/QuizBuilderPage'));
const AdminPage = lazy(() => import('../features/admin/pages/AdminPage'));
const AdminReportDetailPage = lazy(() => import('../features/admin/pages/AdminReportDetailPage'));
const NotFoundPage = lazy(() => import('../features/errors/pages/NotFoundPage'));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage'));

const FullPageFallback = ({ pathname = '/dashboard' }) => <FullPageShellSkeleton pathname={pathname} />;

function SuspenseFallback() {
  const location = useLocation();
  return <FullPageFallback pathname={location.pathname} />;
}

function RoleLandingRedirect() {
  const { profile } = useAuth();

  if (!profile) {
    return <FullPageFallback />;
  }

  return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <SessionTimeout />
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />

          <Route
            path="/home"
            element={(
              <ProtectedRoute>
                <RoleLandingRedirect />
              </ProtectedRoute>
            )}
          />

          {/* Protected Routes wrapped in AppShell Layout */}
          <Route
            element={
              <ProtectedRoute studentOnly>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/study-guide/new" element={<StudyGuideCreatePage />} />
            <Route path="/study-guide/:id" element={<StudyGuidePage />} />
            <Route path="/flashcards/new" element={<FlashcardsCreatePage />} />
            <Route path="/flashcards/:id/edit" element={<FlashcardsCreatePage />} />
            <Route path="/flashcards/:id" element={<FlashcardsPage />} />
            <Route path="/quiz/new" element={<QuizBuilderPage />} />
            <Route path="/quiz/:id/edit" element={<QuizBuilderPage />} />
            <Route path="/quiz/:id" element={<QuizPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute adminOnly>
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/reports/:id" element={<AdminReportDetailPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
