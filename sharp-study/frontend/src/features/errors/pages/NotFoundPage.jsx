import { Link } from 'react-router-dom';
import Button from '../../../shared/components/Button';

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--bg-color)]">
      <p className="text-8xl font-black text-[var(--card-border)] mb-4" aria-hidden="true">404</p>
      <h1 className="text-2xl font-bold text-[var(--text-color)] mb-2">Page Not Found</h1>
      <p className="text-[var(--muted)] mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </main>
  );
}