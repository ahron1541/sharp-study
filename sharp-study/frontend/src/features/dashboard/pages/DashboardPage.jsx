import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, CreditCard, Flame, HelpCircle, Sparkles, Trophy, Zap } from 'lucide-react';

import { useDashboard } from '../hooks/useDashboard';
import { useAuth as useAuthCore } from '../../auth/context/AuthContext';
import MaterialTypeIcon from '../../library/components/MaterialTypeIcon';
import { getMaterialRoute } from '../../library/utils/materials';

const SECTION_ORDER = [
  ['study_guides', 'study_guide', 'Study Guides', 'Study Guide'],
  ['flashcards', 'flashcards', 'Flashcards', 'Flashcards'],
  ['quizzes', 'quiz', 'Quizzes', 'Quiz'],
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { items = { study_guides: [], flashcards: [], quizzes: [] }, loading } = useDashboard({ limit: 3 });
  const { profile } = useAuthCore();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const firstName = profile?.first_name || 'Student';
  const streakPrefs = profile?.preferences?.streak || {};
  const streak = Number(streakPrefs.current || 0);
  const streakHistory = resolveStreakHistory(streakPrefs);
  const isFirstTime = items.study_guides.length === 0 && items.flashcards.length === 0 && items.quizzes.length === 0;

  const streakMeta = useMemo(() => {
    if (streak >= 14) {
      return {
        icon: Trophy,
        accent: 'text-amber-500',
        badge: 'bg-amber-500/10',
        message: 'You have built a strong study rhythm. Keep protecting it one day at a time.',
      };
    }
    if (streak >= 7) {
      return {
        icon: Zap,
        accent: 'text-orange-500',
        badge: 'bg-orange-500/10',
        message: 'A full week of consistency is real progress. Stay steady and keep showing up.',
      };
    }
    return {
      icon: Flame,
      accent: 'text-streak',
      badge: 'bg-streak/10',
      message: 'Every study day counts. A short focused session today keeps the streak alive.',
    };
  }, [streak]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-56 rounded-[2rem] bg-surface animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.9fr)]">
          <div className="h-44 rounded-[2rem] bg-surface animate-pulse" />
          <div className="h-44 rounded-[2rem] bg-surface animate-pulse" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-36 rounded-[2rem] bg-surface animate-pulse" />
          <div className="h-36 rounded-[2rem] bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-border bg-surface px-6 py-6 shadow-card sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Dashboard</p>
            <h1 className="mt-3 text-[clamp(2.2rem,4vw,4rem)] font-display font-black leading-none text-text">
              {isFirstTime ? `Welcome, ${firstName}.` : `Welcome back, ${firstName}.`}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
              {isFirstTime
                ? 'Start with a document or build your first study material manually.'
                : 'Pick up your next study session from the library without the extra clutter.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/library?tab=study_guide')}
              className="rounded-2xl bg-accent px-6 py-3 font-bold text-accent-text"
            >
              Start studying
            </button>
            <button
              type="button"
              onClick={() => navigate('/library?modal=create&type=study_guide')}
              className="rounded-2xl border border-border bg-surface-2 px-6 py-3 font-bold text-text"
            >
              Upload new
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Quick Access</p>
              <h2 className="mt-2 text-3xl font-black text-text">Jump back in fast.</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/library?tab=study_guide')}
              className="inline-flex items-center gap-1 text-sm font-bold text-accent"
            >
              See all
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <QuickAccessCard
              icon={CreditCard}
              label="Flashcard Arena"
              sub="Open your flashcards section directly."
              onClick={() => navigate('/library?tab=flashcards')}
            />
            <QuickAccessCard
              icon={HelpCircle}
              label="Quiz Challenge"
              sub="Go straight to quizzes in the library."
              onClick={() => navigate('/library?tab=quiz')}
            />
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Daily Streak</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-display font-black text-text">{streak}</span>
                <span className="pb-2 text-sm font-bold text-text-muted">days</span>
              </div>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${streakMeta.badge}`}>
              <streakMeta.icon className={streakMeta.accent} size={28} />
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-text-muted">{streakMeta.message}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex flex-1 gap-2">
              {buildWeeklyProgress(streakHistory).map((active, index) => (
                <div key={index} className={`h-2 flex-1 rounded-full ${active ? 'bg-streak' : 'bg-surface-2'}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCalendarOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-text"
            >
              <CalendarDays size={16} />
              Calendar
            </button>
          </div>

          {calendarOpen ? (
            <div className="mt-5 rounded-[1.5rem] border border-border bg-surface-2 p-4">
              <StreakCalendar history={streakHistory} />
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-8">
        {SECTION_ORDER.map(([collectionKey, routeType, label, singularLabel]) => {
          const sectionItems = items[collectionKey] || [];

          return (
            <section key={collectionKey} className="rounded-[2rem] border border-border bg-surface p-5 shadow-card sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-accent">
                    <MaterialTypeIcon type={routeType} size={20} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-text">{label}</h2>
                    <p className="text-sm text-text-muted">{sectionItems.length} shown here</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/library?tab=${routeType}`)}
                  className="inline-flex items-center gap-1 text-sm font-bold text-accent"
                >
                  See all
                  <ArrowRight size={14} />
                </button>
              </div>

              {sectionItems.length === 0 ? (
                <div className="mt-6 rounded-[1.8rem] border-2 border-dashed border-border px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
                    <MaterialTypeIcon type={routeType} size={28} className="text-text-muted" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-text">No {label.toLowerCase()} yet</h3>
                  <p className="mt-2 text-text-muted">Create one from the library and it will show up here.</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/library?modal=create&type=${routeType}`)}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 font-bold text-accent-text"
                  >
                    <Sparkles size={16} />
                    Add new
                  </button>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {sectionItems.map((item) => (
                    <article
                      key={item.id}
                      onClick={() => navigate(getMaterialRoute(routeType, item.id))}
                      className="cursor-pointer rounded-[1.8rem] border border-border bg-surface-2 p-5 transition-colors hover:bg-surface"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-accent">
                        <MaterialTypeIcon type={routeType} size={20} />
                      </span>
                      <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                        {singularLabel}
                      </p>
                      <h3 className="mt-2 min-h-14 text-lg font-bold text-text">{item.title}</h3>
                      <div className="mt-5 flex items-center justify-between">
                        <p className="text-xs font-semibold text-text-muted">
                          {new Date(item.created_at).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-text-muted">
                          Open
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function QuickAccessCard({ icon, label, sub, onClick }) {
  const QuickIcon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-[1.8rem] border border-border bg-surface-2 p-5 text-left transition-colors hover:bg-surface"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-accent">
        <QuickIcon size={26} />
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-text">{label}</h3>
        <p className="text-sm leading-6 text-text-muted">{sub}</p>
      </div>
    </button>
  );
}

function resolveStreakHistory(streakPrefs) {
  const history = Array.isArray(streakPrefs?.history) ? streakPrefs.history : [];
  if (history.length) return history;

  const current = Number(streakPrefs?.current || 0);
  const lastDate = streakPrefs?.last_date;
  if (!current || !lastDate) return [];

  const dates = [];
  const anchor = new Date(lastDate);
  for (let offset = current - 1; offset >= 0; offset -= 1) {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() - offset);
    dates.push(next.toISOString().slice(0, 10));
  }
  return dates;
}

function buildWeeklyProgress(history) {
  const set = new Set(history);
  const values = [];
  const today = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const next = new Date(today);
    next.setDate(today.getDate() - offset);
    values.push(set.has(next.toISOString().slice(0, 10)));
  }

  return values;
}

function StreakCalendar({ history }) {
  const hitDays = new Set(history);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold text-text">
          {today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
        </p>
        <p className="text-xs text-text-muted">Future dates stay dimmed.</p>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-text-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {Array.from({ length: totalCells }).map((_, index) => {
          const dayNumber = index - startOffset + 1;
          const inMonth = dayNumber >= 1 && dayNumber <= lastDay.getDate();
          const date = inMonth ? new Date(year, month, dayNumber) : null;
          const isoDate = date ? date.toISOString().slice(0, 10) : '';
          const isFuture = date ? date > today : false;
          const isActive = date ? hitDays.has(isoDate) : false;
          const isToday = date ? isoDate === today.toISOString().slice(0, 10) : false;

          return (
            <div
              key={index}
              className={`flex h-10 items-center justify-center rounded-xl border text-sm font-bold ${
                !inMonth
                  ? 'border-transparent bg-transparent text-transparent'
                  : isFuture
                    ? 'border-border bg-surface opacity-45 text-text-muted'
                    : isActive
                      ? 'border-accent bg-accent text-accent-text'
                      : isToday
                        ? 'border-text bg-surface text-text'
                        : 'border-border bg-surface text-text'
              }`}
            >
              {inMonth ? dayNumber : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
