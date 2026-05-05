import { BookOpen, CreditCard, HelpCircle } from 'lucide-react';

export default function MaterialTypeIcon({ type, size = 20, className = '' }) {
  if (type === 'flashcards') return <CreditCard size={size} className={className} aria-hidden="true" />;
  if (type === 'quiz') return <HelpCircle size={size} className={className} aria-hidden="true" />;
  return <BookOpen size={size} className={className} aria-hidden="true" />;
}
