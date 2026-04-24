import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ProtectedRoute from '../shared/components/ProtectedRoute';
import Spinner from '../shared/components/Spinner';
import SessionTimeout from '../shared/components/SessionTimeout';
import AppShell from '../features/dashboard/components/AppShell';

// Lazy-loaded pages (performance — loads only when needed)
const LandingPage = lazy(() => import('../features/landing/pages/LandingPage'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const StudyGuidePage = lazy(() => import('../features/study-guide/pages/StudyGuidePage'));
const FlashcardsPage = lazy(() => import('../features/flashcards/pages/FlashcardsPage'));
const QuizPage = lazy(() => import('../features/quiz/pages/QuizPage'));
const AdminPage = lazy(() => import('../features/admin/pages/AdminPage'));
const NotFoundPage = lazy(() => import('../features/errors/pages/NotFoundPage'));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage'));

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)]">
    <Spinner size="lg" label="Loading page..." />
  </div>
);

export default function AppRouter() {
  return (
    <BrowserRouter>
      <SessionTimeout />
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected Routes wrapped in AppShell Layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/library" element={<DashboardPage />} /> {/* replace later */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/study-guide/:id" element={<StudyGuidePage />} />
            <Route path="/flashcards/:id" element={<FlashcardsPage />} />
            <Route path="/quiz/:id" element={<QuizPage />} />
            
            {/* Admin only (Requires standard protection + admin flag) */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly>
                  <AdminPage />
                </ProtectedRoute>
              } 
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}