import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Award, CalendarDays, Crown, FileQuestion, Flame, Info, Layers3, Sparkles, Star, Trophy, Zap } from 'lucide-react';

import { useDashboard } from '../hooks/useDashboard';
import { useGamification } from '../hooks/useGamification';
import { useStreak } from '../hooks/useStreak';
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
  const { streak: streakStats, loading: streakLoading, error: streakError } = useStreak({ days: 35 });
  const { gamification, loading: gamificationLoading, error: gamificationError } = useGamification({ days: 35 });
  const { profile } = useAuthCore();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakNoticeOpen, setStreakNoticeOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const calendarRef = useRef(null);
  const streakNoticeRef = useRef(null);

  const firstName = profile?.first_name || 'Student';
  const streak = Number(streakStats.current || 0);
  const longestStreak = Number(streakStats.longest || 0);
  const streakHistory = useMemo(() => resolveStreakHistory(streakStats), [streakStats]);
  const streakRecords = useMemo(() => resolveStreakRecords(streakStats), [streakStats]);
  const weeklyProgress = useMemo(() => buildWeeklyProgress(streakHistory, now), [streakHistory, now]);
  const nextStreakMilestone = gamification.next_streak_milestone;
  const isFirstTime = items.study_guides.length === 0 && items.flashcards.length === 0 && items.quizzes.length === 0;

  const streakMeta = useMemo(() => getStreakMeta(streak), [streak]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!calendarOpen) return undefined;

    const handlePointerDown = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setCalendarOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setCalendarOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [calendarOpen]);

  useEffect(() => {
    if (!streakNoticeOpen) return undefined;

    const handlePointerDown = (event) => {
      if (streakNoticeRef.current && !streakNoticeRef.current.contains(event.target)) {
        setStreakNoticeOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setStreakNoticeOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [streakNoticeOpen]);

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

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.85fr)_minmax(18rem,0.9fr)]">
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
              icon={Layers3}
              label="Flashcard Arena"
              sub="Open your flashcards section directly."
              tone="flashcards"
              onClick={() => navigate('/library?tab=flashcards')}
            />
            <QuickAccessCard
              icon={FileQuestion}
              label="Quiz Challenge"
              sub="Go straight to quizzes in the library."
              tone="quiz"
              onClick={() => navigate('/library?tab=quiz')}
            />
          </div>
        </div>

        <GamificationCard
          gamification={gamification}
          loading={gamificationLoading}
          error={gamificationError}
        />

        <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Study Streak</p>
                <div className="relative" ref={streakNoticeRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStreakNoticeOpen((value) => !value);
                      setCalendarOpen(false);
                    }}
                    aria-label="How study streaks work"
                    aria-expanded={streakNoticeOpen}
                    aria-haspopup="dialog"
                    aria-controls="streak-notice-popover"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-text-muted transition-colors hover:text-text"
                  >
                    <Info size={14} aria-hidden="true" />
                  </button>

                  {streakNoticeOpen ? (
                    <div
                      id="streak-notice-popover"
                      role="dialog"
                      aria-label="Study streak notice"
                      className="absolute left-0 top-[calc(100%+0.65rem)] z-30 w-[min(20rem,calc(100vw-3rem))] rounded-[1.25rem] border border-border bg-surface p-4 text-left shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
                    >
                      <p className="text-sm font-black text-text">Keep your streak alive</p>
                      <p className="mt-2 text-sm leading-6 text-text-muted">
                        Complete at least one study action each day, like a flashcard review, quiz attempt, or study guide save. If you miss a full day, your current streak resets to 0, but your best streak stays saved.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-display font-black text-text">{streakLoading ? '...' : streak}</span>
                <span className="pb-2 text-sm font-bold text-text-muted">days</span>
              </div>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${streakMeta.badge}`}>
              <streakMeta.icon className={streakMeta.accent} size={28} />
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-text-muted">{streakMeta.message}</p>
          {longestStreak > 0 ? (
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
              Best streak: {longestStreak} days
            </p>
          ) : null}
          {nextStreakMilestone ? (
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
              Next: {nextStreakMilestone.label} in {formatDayCount(nextStreakMilestone.remaining)} (+{nextStreakMilestone.xp} XP)
            </p>
          ) : null}
          {streakError ? (
            <p className="mt-2 text-xs font-semibold text-text-muted">Streak sync is unavailable right now.</p>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex flex-1 gap-2">
              {weeklyProgress.map((active, index) => (
                <div key={index} className={`h-2 flex-1 rounded-full ${active ? 'bg-streak' : 'bg-surface-2'}`} />
              ))}
            </div>
            <div className="relative shrink-0" ref={calendarRef}>
              <button
                type="button"
                onClick={() => setCalendarOpen((value) => !value)}
                aria-expanded={calendarOpen}
                aria-haspopup="dialog"
                aria-controls="streak-calendar-popover"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-text"
              >
                <CalendarDays size={16} aria-hidden="true" />
                Calendar
              </button>

              {calendarOpen ? (
                <div
                  id="streak-calendar-popover"
                  role="dialog"
                  aria-label="Study streak calendar"
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[min(24rem,calc(100vw-3rem))] rounded-[1.5rem] border border-border bg-surface p-4 shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
                >
                  <StreakCalendar history={streakRecords} now={now} />
                </div>
              ) : null}
            </div>
          </div>
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
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => navigate(getMaterialRoute(routeType, item.id))}
                      aria-label={`Open ${item.title}`}
                      className="rounded-[1.8rem] border border-border bg-surface-2 p-5 text-left transition-colors hover:bg-surface"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-accent" aria-hidden="true">
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
                          <ArrowRight size={14} aria-hidden="true" />
                        </span>
                      </div>
                    </button>
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

function QuickAccessCard({ icon, label, sub, onClick, tone = 'default' }) {
  const QuickIcon = icon;
  const toneStyles = {
    flashcards: {
      shell: 'from-violet-500/18 to-fuchsia-500/8 text-violet-400 ring-violet-400/25',
      glow: 'bg-violet-400/30',
    },
    quiz: {
      shell: 'from-cyan-500/18 to-emerald-500/8 text-cyan-400 ring-cyan-400/25',
      glow: 'bg-cyan-400/30',
    },
    default: {
      shell: 'from-[color:var(--color-accent)]/18 to-[color:var(--color-accent)]/8 text-accent ring-[color:var(--color-accent)]/25',
      glow: 'bg-[color:var(--color-accent)]/30',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.8rem] border border-border bg-surface-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={label}
    >
      <span className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${toneStyles.shell} ring-1 transition-transform duration-200 group-hover:scale-105`} aria-hidden="true">
        <span className={`absolute -right-4 -top-4 h-10 w-10 rounded-full blur-xl ${toneStyles.glow}`} />
        <QuickIcon className="relative" size={27} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-text">{label}</h3>
        <p className="text-sm leading-6 text-text-muted">{sub}</p>
      </div>
    </button>
  );
}

function GamificationCard({ gamification, loading, error }) {
  const progress = gamification?.level_progress || {};
  const recentEvents = (gamification?.recent_events || []).filter((event) => Number(event.xp_delta || 0) > 0).slice(0, 3);
  const badges = (gamification?.badges || []).slice(0, 3);
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  const [xpNoticeOpen, setXpNoticeOpen] = useState(false);
  const xpNoticeRef = useRef(null);

  useEffect(() => {
    if (!xpNoticeOpen) return undefined;

    const handlePointerDown = (event) => {
      if (xpNoticeRef.current && !xpNoticeRef.current.contains(event.target)) {
        setXpNoticeOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setXpNoticeOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [xpNoticeOpen]);

  return (
    <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Progress Level</p>
            <div className="relative" ref={xpNoticeRef}>
              <button
                type="button"
                onClick={() => setXpNoticeOpen((value) => !value)}
                aria-label="How XP works"
                aria-expanded={xpNoticeOpen}
                aria-haspopup="dialog"
                aria-controls="xp-notice-popover"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-text-muted transition-colors hover:text-text"
              >
                <Info size={14} aria-hidden="true" />
              </button>

              {xpNoticeOpen ? (
                <div
                  id="xp-notice-popover"
                  role="dialog"
                  aria-label="XP reward notice"
                  className="absolute left-0 top-[calc(100%+0.65rem)] z-30 w-[min(22rem,calc(100vw-3rem))] rounded-[1.25rem] border border-border bg-surface p-4 text-left shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
                >
                  <p className="text-sm font-black text-text">How to earn XP</p>
                  <div className="mt-2 space-y-2 text-sm leading-6 text-text-muted">
                    <p>Earn XP by doing real study actions, not by logging in.</p>
                    <p>First study action each day gives +10 XP. Your first flashcard review and first quiz attempt each give +15 XP.</p>
                    <p>A perfect quiz gives +50 XP. Streak milestones also give bonus XP and badges.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-display font-black text-text">{loading ? '...' : gamification.level}</span>
            <span className="pb-2 text-sm font-bold text-text-muted">level</span>
          </div>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-xp/10 text-xp">
          <Star size={28} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
          <span>{gamification.xp_total} XP</span>
          <span>{progress.xp_needed || 0} XP to level {progress.next_level || 2}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-xp transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-xs font-semibold text-text-muted">Rewards sync is unavailable right now.</p>
      ) : null}

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">Recent Rewards</p>
          <div className="mt-2 space-y-2">
            {recentEvents.length ? recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-text">{event.label}</span>
                <span className="shrink-0 font-black text-xp">+{event.xp_delta} XP</span>
              </div>
            )) : (
              <p className="text-sm leading-6 text-text-muted">Study today to earn your first reward.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">Badges</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {badges.length ? badges.map((badge) => (
              <span key={badge.badge_key} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-bold text-text">
                {badge.label}
              </span>
            )) : (
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-bold text-text-muted">
                No badges yet
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStreakMeta(streak) {
  if (streak >= 100) {
    return {
      icon: Star,
      accent: 'text-yellow-300',
      badge: 'bg-yellow-300/10',
      message: 'Century Scholar energy. Keep the rhythm steady with one focused action today.',
    };
  }
  if (streak >= 50) {
    return {
      icon: Crown,
      accent: 'text-yellow-400',
      badge: 'bg-yellow-400/10',
      message: 'That is a serious study rhythm. Protect it with one small win today.',
    };
  }
  if (streak >= 20) {
    return {
      icon: Trophy,
      accent: 'text-amber-500',
      badge: 'bg-amber-500/10',
      message: 'Momentum is doing its quiet work now. Keep showing up.',
    };
  }
  if (streak >= 10) {
    return {
      icon: Award,
      accent: 'text-orange-500',
      badge: 'bg-orange-500/10',
      message: 'Focus Flame unlocked. A short session today keeps it alive.',
    };
  }
  if (streak >= 7) {
    return {
      icon: Zap,
      accent: 'text-orange-500',
      badge: 'bg-orange-500/10',
      message: 'A full week of real study activity is progress worth keeping warm.',
    };
  }
  if (streak >= 3) {
    return {
      icon: Sparkles,
      accent: 'text-streak',
      badge: 'bg-streak/10',
      message: 'First Spark is building. Keep it going with one focused action today.',
    };
  }
  if (streak === 0) {
    return {
      icon: Flame,
      accent: 'text-text-muted',
      badge: 'bg-surface-2',
      message: 'Complete one flashcard review, quiz attempt, or study guide save today to start your streak.',
    };
  }
  return {
    icon: Flame,
    accent: 'text-streak',
    badge: 'bg-streak/10',
    message: 'Every active study day counts. A short focused action today keeps the streak alive.',
  };
}

function formatDayCount(value) {
  const days = Number(value || 0);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function resolveStreakHistory(streakPrefs) {
  const history = Array.isArray(streakPrefs?.history) ? streakPrefs.history : [];
  if (history.length) {
    return [...new Set(
      history
        .map((value) => normalizeDateKey(typeof value === 'string' ? value : value?.date))
        .filter(Boolean)
    )];
  }

  const current = Number(streakPrefs?.current || 0);
  const lastDate = streakPrefs?.last_activity_date || streakPrefs?.last_date;
  if (!current || !lastDate) return [];

  const dates = [];
  const anchor = parseDateLike(lastDate);
  if (!anchor) return [];

  for (let offset = current - 1; offset >= 0; offset -= 1) {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() - offset);
    dates.push(formatLocalDateKey(next));
  }
  return dates;
}

function resolveStreakRecords(streakPrefs) {
  const history = Array.isArray(streakPrefs?.history) ? streakPrefs.history : [];
  if (history.length) {
    return history
      .map((entry) => {
        const date = normalizeDateKey(typeof entry === 'string' ? entry : entry?.date);
        if (!date) return null;
        return {
          date,
          activity_count: Number(entry?.activity_count || 1),
          activity_counts: entry?.activity_counts && typeof entry.activity_counts === 'object'
            ? entry.activity_counts
            : {},
        };
      })
      .filter(Boolean);
  }

  return resolveStreakHistory(streakPrefs).map((date) => ({
    date,
    activity_count: 1,
    activity_counts: {},
  }));
}

function buildWeeklyProgress(history, now = new Date()) {
  const set = new Set(history);
  const values = [];
  const today = startOfDay(now);
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);

  for (let offset = 0; offset < 7; offset += 1) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + offset);
    values.push(set.has(formatLocalDateKey(next)));
  }

  return values;
}

function StreakCalendar({ history, now }) {
  const recordsByDate = new Map((history || []).map((entry) => [entry.date, entry]));
  const hitDays = new Set(recordsByDate.keys());
  const today = startOfDay(now);
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
        <p className="text-xs text-text-muted">Active days are highlighted.</p>
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
          const isoDate = date ? formatLocalDateKey(date) : '';
          const isFuture = date ? startOfDay(date).getTime() > today.getTime() : false;
          const isActive = date ? hitDays.has(isoDate) : false;
          const isToday = date ? isoDate === formatLocalDateKey(today) : false;

          return (
            <div
              key={index}
              className={`flex h-12 items-center justify-center rounded-xl border text-sm font-bold ${
                !inMonth
                  ? 'border-transparent bg-transparent text-transparent'
                  : isFuture
                    ? 'border-border bg-surface opacity-45 text-text-muted'
                    : isActive
                      ? 'border-streak bg-streak text-white'
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

function parseDateLike(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function normalizeDateKey(value) {
  const parsed = parseDateLike(value);
  return parsed ? formatLocalDateKey(parsed) : '';
}

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
