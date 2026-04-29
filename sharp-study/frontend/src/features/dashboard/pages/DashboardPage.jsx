import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, CreditCard, HelpCircle, Upload, Flame,
  Target, Star, Zap, TrendingUp, Plus, Search,
  Archive, Trash2, Eye, ChevronRight, Award, Clock,
} from 'lucide-react';
import { useAuth }      from '../../auth/context/AuthContext';
import { useNavigate }  from 'react-router-dom';
import UploadModal      from '../../upload/components/UploadModal';
import Modal            from '../../../shared/components/Modal';
import toast            from 'react-hot-toast';
import { getWeeklyHistory, recordStudySession } from '../hooks/useStreak';

/* ─────────── constants ─────────── */
const TABLE_MAP  = { study_guides: 'study_guides', flashcards: 'flashcard_sets', quizzes: 'quizzes' };
const ROUTES_MAP = { study_guides: 'study-guide',  flashcards: 'flashcards',      quizzes: 'quiz' };
const SECTION_META = {
  study_guides: { icon: BookOpen,   label: 'Study Guides',   color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  flashcards:   { icon: CreditCard, label: 'Flashcard Sets', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  quizzes:      { icon: HelpCircle, label: 'Quizzes',        color: 'text-emerald-500',bg: 'bg-emerald-500/10' },
};
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ─────────── sub-components ─────────── */

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--color-surface-2)' }} />
        <div className="h-3 rounded-full w-20" style={{ background: 'var(--color-surface-2)' }} />
      </div>
      <div className="h-4 rounded-full w-4/5 mb-2" style={{ background: 'var(--color-surface-2)' }} />
      <div className="h-3 rounded-full w-1/2 mb-5" style={{ background: 'var(--color-surface-2)' }} />
      <div className="flex gap-2">
        <div className="h-8 rounded-lg w-16" style={{ background: 'var(--color-surface-2)' }} />
        <div className="h-8 rounded-lg w-14" style={{ background: 'var(--color-surface-2)' }} />
      </div>
    </div>
  );
}

function MaterialCard({ item, type, onOpen, onArchive, onDelete }) {
  const meta = SECTION_META[type];
  const Icon = meta.icon;
  const date = new Date(item.created_at).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  });

  return (
    <article
      className="rounded-2xl p-5 border transition-all duration-200 group cursor-pointer
                 hover:-translate-y-0.5"
      style={{
        background:  'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center`}>
          <Icon size={14} className={meta.color} aria-hidden="true" />
        </div>
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>{date}</span>
      </div>

      {/* Title */}
      <h3
        className="text-sm font-semibold mb-4 line-clamp-2"
        style={{ color: 'var(--color-text)' }}
      >
        {item.title}
      </h3>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={() => onOpen(item.id, type)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                     text-white transition-colors"
          style={{ background: 'var(--color-accent)' }}
          aria-label={`Open ${item.title}`}
        >
          <Eye size={12} aria-hidden="true" />
          Open
        </button>
        <button
          onClick={() => onArchive(item.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                     border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          aria-label={`Archive ${item.title}`}
        >
          <Archive size={12} aria-hidden="true" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                     border transition-colors"
          style={{ borderColor: 'var(--color-border)', color: '#EF4444' }}
          aria-label={`Delete ${item.title}`}
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function EmptyState({ type, onUpload }) {
  const meta = SECTION_META[type];
  const Icon = meta.icon;
  return (
    <div
      className="rounded-2xl p-10 flex flex-col items-center text-center border border-dashed"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className={`w-12 h-12 rounded-2xl ${meta.bg} flex items-center justify-center mb-4`}
        aria-hidden="true"
      >
        <Icon size={22} className={meta.color} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
        No {meta.label.toLowerCase()} yet
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Upload a file and let AI generate them for you.
      </p>
      <button
        onClick={onUpload}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                   text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent)' }}
      >
        <Plus size={14} aria-hidden="true" />
        Upload a File
      </button>
    </div>
  );
}

/* Streak widget */
function StreakWidget({ streak, xp, level }) {
  const current = streak?.current ?? 0;
  const longest = streak?.longest ?? 0;
  const weekly  = getWeeklyHistory(streak?.last_date, current);
  const xpToNext = 100 - ((xp ?? 0) % 100);
  const xpProgress = ((xp ?? 0) % 100);

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1"
             style={{ color: 'var(--color-text-muted)' }}>
            Study Streak
          </p>
          <div className="flex items-center gap-2">
            <Flame
              size={28}
              className="streak-pulse"
              style={{ color: current > 0 ? 'var(--color-streak)' : 'var(--color-text-muted)' }}
              aria-hidden="true"
            />
            <span
              className="text-4xl font-black"
              style={{
                color: current > 0 ? 'var(--color-streak)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {current}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>days</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Best</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{longest}</p>
        </div>
      </div>

      {/* Weekly dots */}
      <div className="flex justify-between mb-4" aria-label="Weekly streak history">
        {weekly.map((done, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{
                background: done ? 'var(--color-streak)' : 'var(--color-surface-2)',
              }}
              aria-label={`${DAY_LABELS[i]}: ${done ? 'studied' : 'missed'}`}
            >
              {done && <Flame size={12} color="#fff" aria-hidden="true" />}
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {DAY_LABELS[i]}
            </span>
          </div>
        ))}
      </div>

      {/* XP bar */}
      <div
        className="rounded-xl p-3 flex items-center gap-3"
        style={{ background: 'var(--color-xp-bg)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-xp)', color: '#fff' }}
        >
          <Zap size={16} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--color-xp)', fontWeight: 700 }}>
              Level {level ?? 1}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {xpToNext} XP to next level
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--color-goal-track)' }}
            role="progressbar"
            aria-valuenow={xpProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${xpProgress}%`,
                background: 'var(--color-xp)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Daily goals widget */
function DailyGoalsWidget({ goals, studyGuideCount, flashcardCount, quizCount }) {
  const items = [
    {
      label:   'Open a study guide',
      icon:    BookOpen,
      done:    studyGuideCount > 0,
      color:   '#3B82F6',
    },
    {
      label:   'Review flashcards',
      icon:    CreditCard,
      done:    flashcardCount > 0,
      color:   '#8B5CF6',
    },
    {
      label:   'Complete a quiz',
      icon:    HelpCircle,
      done:    quizCount > 0,
      color:   '#10B981',
    },
    {
      label:   goals?.completed_today ? 'Daily goal met' : 'Study today',
      icon:    Target,
      done:    goals?.completed_today ?? false,
      color:   'var(--color-streak)',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Daily Goals
        </p>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--color-goal-done)',
            color: '#fff',
            opacity: doneCount === 0 ? 0.4 : 1,
          }}
        >
          {doneCount}/{items.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map(({ label, icon: Icon, done, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                         transition-all duration-300"
              style={{
                background: done ? color : 'var(--color-surface-2)',
                opacity: done ? 1 : 0.5,
              }}
            >
              <Icon size={14} color={done ? '#fff' : 'var(--color-text-muted)'} aria-hidden="true" />
            </div>
            <span
              className="text-sm flex-1 transition-all duration-300"
              style={{
                color:          done ? 'var(--color-text)' : 'var(--color-text-muted)',
                textDecoration: done ? 'line-through' : 'none',
                opacity:        done ? 0.7 : 1,
              }}
            >
              {label}
            </span>
            {done && (
              <Star
                size={14}
                style={{ color: '#F59E0B' }}
                aria-hidden="true"
                fill="currentColor"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Stats bar */
function StatsBar({ counts }) {
  const stats = [
    { label: 'Study Guides',   value: counts.study_guides ?? 0, icon: BookOpen,   color: '#3B82F6' },
    { label: 'Flashcard Sets', value: counts.flashcards   ?? 0, icon: CreditCard, color: '#8B5CF6' },
    { label: 'Quizzes',        value: counts.quizzes      ?? 0, icon: HelpCircle, color: '#10B981' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="rounded-2xl p-4 border flex flex-col gap-1"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <Icon size={16} style={{ color }} aria-hidden="true" />
          <p
            className="text-2xl font-black tabular-nums"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            {value}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

/* Section with cards */
function MaterialSection({ type, loading, items, onUpload, onOpen, onArchive, onDelete }) {
  const meta = SECTION_META[type];
  const Icon = meta.icon;

  return (
    <section aria-labelledby={`section-${type}`} className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={meta.color} aria-hidden="true" />
        <h2
          id={`section-${type}`}
          className="text-sm font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {meta.label}
        </h2>
        {!loading && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            ({items.length})
          </span>
        )}
        <button
          className="ml-auto flex items-center gap-1 text-xs font-semibold
                     transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-accent)' }}
          aria-label={`View all ${meta.label}`}
        >
          View all
          <ChevronRight size={12} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          aria-busy="true"
          aria-label="Loading materials"
        >
          {[0, 1, 2].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState type={type} onUpload={onUpload} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <MaterialCard
              key={item.id}
              item={item}
              type={type}
              onOpen={onOpen}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─────────── main page ─────────── */

export default function DashboardPage() {
  const { supabase, profile } = useAuth();
  const navigate = useNavigate();
  const hasRecordedSession = useRef(false);

  const [items,        setItems]        = useState({ study_guides: [], flashcards: [], quizzes: [] });
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [prefs,        setPrefs]        = useState(() => {
    try { return JSON.parse(localStorage.getItem('sharp-study-prefs') ?? '{}'); } catch { return {}; }
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [gRes, cRes, qRes] = await Promise.all([
      supabase.from('study_guides')  .select('*').eq('is_archived', false).order('created_at', { ascending: false }).limit(9),
      supabase.from('flashcard_sets').select('*').eq('is_archived', false).order('created_at', { ascending: false }).limit(9),
      supabase.from('quizzes')       .select('*').eq('is_archived', false).order('created_at', { ascending: false }).limit(9),
    ]);
    setItems({
      study_guides: gRes.data ?? [],
      flashcards:   cRes.data ?? [],
      quizzes:      qRes.data ?? [],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Record a study session on first dashboard load each day
  useEffect(() => {
    if (!profile || hasRecordedSession.current) return;
    hasRecordedSession.current = true;

    const currentPrefs = {
      ...prefs,
      streak:      profile.preferences?.streak      ?? { current: 0, longest: 0, last_date: null },
      daily_goals: profile.preferences?.daily_goals ?? { target_minutes: 30, completed_today: false },
      xp:          profile.preferences?.xp          ?? 0,
      level:       profile.preferences?.level       ?? 1,
    };

    recordStudySession(currentPrefs).then((updated) => {
      setPrefs(updated);
      localStorage.setItem('sharp-study-prefs', JSON.stringify(updated));
    });
  }, [profile]);

  const handleOpen = (id, type) => {
    navigate(`/${ROUTES_MAP[type]}/${id}`);
  };

  const handleArchive = async (id) => {
    const type = Object.keys(TABLE_MAP).find((k) =>
      items[k].some((i) => i.id === id)
    );
    if (!type) return;
    await supabase.from(TABLE_MAP[type]).update({ is_archived: true }).eq('id', id);
    toast.success('Archived.');
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const type = Object.keys(TABLE_MAP).find((k) =>
      items[k].some((i) => i.id === deleteTarget.id)
    );
    if (!type) return;
    await supabase.from(TABLE_MAP[type]).delete().eq('id', deleteTarget.id);
    toast.success('Deleted permanently.');
    setDeleteTarget(null);
    fetchAll();
  };

  const firstName = profile?.first_name ?? profile?.full_name?.split(' ')[0] ?? 'there';
  const streak    = prefs.streak      ?? profile?.preferences?.streak      ?? { current: 0, longest: 0, last_date: null };
  const goals     = prefs.daily_goals ?? profile?.preferences?.daily_goals ?? {};
  const xp        = prefs.xp    ?? profile?.preferences?.xp    ?? 0;
  const level     = prefs.level ?? profile?.preferences?.level ?? 1;

  return (
    <>
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">

        {/* Welcome banner */}
        <div
          className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{
            background: 'var(--gradient-accent)',
            color: '#fff',
          }}
        >
          {/* Background texture */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium mb-1">
                {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
              </h1>
              {streak.current > 0 && (
                <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                  <Flame size={14} aria-hidden="true" />
                  {streak.current}-day streak — keep it going!
                </p>
              )}
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                         bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20
                         transition-colors text-white flex-shrink-0"
              aria-label="Upload a file to generate study materials"
            >
              <Upload size={16} aria-hidden="true" />
              Upload &amp; Generate
            </button>
          </div>
        </div>

        {/* Main grid: content left, widgets right */}
        <div className="flex flex-col xl:flex-row gap-5">

          {/* Left: stats + materials */}
          <div className="flex-1 min-w-0">
            {/* Stats bar */}
            <StatsBar counts={{
              study_guides: items.study_guides.length,
              flashcards:   items.flashcards.length,
              quizzes:      items.quizzes.length,
            }} />

            {/* Search */}
            <div className="relative mb-5">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search your study materials..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search study materials"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm
                           focus:outline-none focus:ring-2 transition-colors"
                style={{
                  background:  'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color:       'var(--color-text)',
                  '--tw-ring-color': 'var(--color-accent)',
                }}
              />
            </div>

            {/* Material sections */}
            {Object.keys(TABLE_MAP).map((type) => (
              <MaterialSection
                key={type}
                type={type}
                loading={loading}
                items={search
                  ? items[type].filter((i) =>
                      i.title.toLowerCase().includes(search.toLowerCase())
                    )
                  : items[type]}
                onUpload={() => setUploadOpen(true)}
                onOpen={handleOpen}
                onArchive={handleArchive}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>

          {/* Right: gamification widgets */}
          <aside className="xl:w-72 flex-shrink-0 flex flex-col gap-4">
            <StreakWidget streak={streak} xp={xp} level={level} />
            <DailyGoalsWidget
              goals={goals}
              studyGuideCount={items.study_guides.length}
              flashcardCount={items.flashcards.length}
              quizCount={items.quizzes.length}
            />

            {/* Adaptive quiz tip */}
            <div
              className="rounded-2xl p-5 border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Adaptive Learning
                </p>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text)' }}>
                Quizzes get harder as you improve. Keep answering to unlock tougher questions.
              </p>
              <div className="flex items-center gap-2">
                <Award size={14} style={{ color: '#F59E0B' }} aria-hidden="true" />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Level {level} learner
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Upload modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { setUploadOpen(false); fetchAll(); }}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Permanently?"
        size="sm"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
          Are you sure you want to permanently delete{' '}
          <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500
                       hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}