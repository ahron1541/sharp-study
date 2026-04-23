import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ProtectedRoute from '../shared/components/ProtectedRoute';
import Spinner from '../shared/components/Spinner';
import SessionTimeout from '../shared/components/SessionTimeout';

// Lazy-loaded pages (performance — loads only when needed)
const LandingPage    = lazy(() => import('../features/landing/pages/LandingPage'));
const LoginPage      = lazy(() => import('../features/auth/pages/LoginPage'));
const RegisterPage   = lazy(() => import('../features/auth/pages/RegisterPage'));
const DashboardPage  = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const StudyGuidePage = lazy(() => import('../features/study-guide/pages/StudyGuidePage'));
const FlashcardsPage = lazy(() => import('../features/flashcards/pages/FlashcardsPage'));
const QuizPage       = lazy(() => import('../features/quiz/pages/QuizPage'));
const AdminPage      = lazy(() => import('../features/admin/pages/AdminPage'));
const NotFoundPage   = lazy(() => import('../features/errors/pages/NotFoundPage'));

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
          <Route path="/"          element={<LandingPage />} />
          <Route path="/login"     element={<LoginPage />} />
          <Route path="/register"  element={<RegisterPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/study-guide/:id" element={
            <ProtectedRoute><StudyGuidePage /></ProtectedRoute>
          } />
          <Route path="/flashcards/:id" element={
            <ProtectedRoute><FlashcardsPage /></ProtectedRoute>
          } />
          <Route path="/quiz/:id" element={
            <ProtectedRoute><QuizPage /></ProtectedRoute>
          } />

          {/* Admin only */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}