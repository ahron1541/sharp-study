import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

export default function DiscussionQuestions({ questions = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const safeQuestions = useMemo(() => questions.filter(Boolean), [questions]);

  if (!safeQuestions.length) return null;

  const question = safeQuestions[currentIndex];

  const prev = () => {
    setShowAnswer(false);
    setCurrentIndex((index) => (index - 1 + safeQuestions.length) % safeQuestions.length);
  };

  const next = () => {
    setShowAnswer(false);
    setCurrentIndex((index) => (index + 1) % safeQuestions.length);
  };

  return (
    <section className="mt-10 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 border-b border-[color:var(--color-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">Study support</p>
          <h2 className="mt-2 text-2xl font-black text-[color:var(--color-text)]">Discussion questions</h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
          <span>{currentIndex + 1} of {safeQuestions.length}</span>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <p className="text-xl font-medium leading-relaxed text-[color:var(--color-text)]">
          {question.question}
        </p>
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text-muted)]">
          <span>Difficulty:</span>
          <span className="rounded-full bg-[color:var(--color-surface-2)] px-3 py-1 text-[color:var(--color-text)]">
            {question.difficulty || 'Medium'}
          </span>
        </div>

        <div className="rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5">
          <button
            type="button"
            onClick={() => setShowAnswer((value) => !value)}
            className="mx-auto mb-4 flex items-center gap-2 rounded-full bg-[color:var(--color-surface)] px-4 py-2 text-sm font-bold text-[color:var(--color-text)] shadow-sm transition hover:-translate-y-0.5"
          >
            {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
            {showAnswer ? 'Hide answer' : 'Show example answer'}
          </button>

          {showAnswer && (
            <p className="leading-7 text-[color:var(--color-text)]">
              {question.answer}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)]"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-bold text-[color:var(--color-accent-text)] transition hover:opacity-90"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
