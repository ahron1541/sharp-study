import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  HelpCircle,
  Keyboard,
  Library,
  Loader2,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { apiRequest } from '../../../config/api';
import { sanitizePlainText } from '../../../shared/utils/sanitize';

const HINT_DELAY_MS = 45000;
const SYNC_DELAY_MS = 20000;
const progressKey = (setId) => `sharp-study-flashcards-progress:${setId}`;
const contentCacheKey = (setId) => `sharp-study-flashcards-content:${setId}`;
const tutorialKey = 'sharp-study-flashcards-tutorial-seen';
const MotionDiv = motion.div;

function createInitialProgress(cards = []) {
  return {
    currentIndex: 0,
    order: cards.map((card) => card.id),
    statuses: {},
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

function clampIndex(index, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function summarizeForHint(text = '') {
  const words = sanitizePlainText(text).split(/\s+/).filter(Boolean);
  if (words.length <= 3) return 'Think about the key term or person connected to this question.';
  return `It starts with: ${words.slice(0, Math.min(4, words.length)).join(' ')}...`;
}

function normalizeStoredProgress(rawProgress, cards = []) {
  const validIds = new Set(cards.map((card) => card.id));
  const fallback = createInitialProgress(cards);
  if (!rawProgress) return fallback;

  const order = Array.isArray(rawProgress.order)
    ? rawProgress.order
    : Array.isArray(rawProgress.order_json)
      ? rawProgress.order_json
      : [];
  const statuses = rawProgress.statuses && typeof rawProgress.statuses === 'object'
    ? rawProgress.statuses
    : rawProgress.statuses_json && typeof rawProgress.statuses_json === 'object'
      ? rawProgress.statuses_json
      : {};

  return {
    ...fallback,
    currentIndex: clampIndex(Number(rawProgress.currentIndex ?? rawProgress.current_index ?? 0), cards.length),
    order: order.filter((cardId) => validIds.has(cardId)),
    statuses: Object.fromEntries(
      Object.entries(statuses).filter(([cardId, status]) => validIds.has(cardId) && ['known', 'learning'].includes(status))
    ),
    history: Array.isArray(rawProgress.history) ? rawProgress.history.filter((item) => validIds.has(item.cardId)) : [],
    updatedAt: rawProgress.updatedAt || rawProgress.updated_at || fallback.updatedAt,
  };
}

function countStatuses(statuses = {}) {
  const values = Object.values(statuses);
  return {
    known: values.filter((status) => status === 'known').length,
    learning: values.filter((status) => status === 'learning').length,
  };
}

function isNewerProgress(candidate, current) {
  const candidateTime = new Date(candidate?.updatedAt || candidate?.updated_at || 0).getTime();
  const currentTime = new Date(current?.updatedAt || current?.updated_at || 0).getTime();
  return Number.isFinite(candidateTime) && candidateTime > currentTime;
}

function readFlashcardsContentCache(setId) {
  try {
    const raw = localStorage.getItem(contentCacheKey(setId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.set?.id || !Array.isArray(parsed?.cards)) return null;
    return {
      set: parsed.set,
      cards: parsed.cards.map((card) => ({
        ...card,
        front: sanitizePlainText(card.front),
        back: sanitizePlainText(card.back),
        hint: sanitizePlainText(card.hint || ''),
      })),
      relatedStudyGuideId: sanitizePlainText(parsed.relatedStudyGuideId || ''),
      relatedQuizId: sanitizePlainText(parsed.relatedQuizId || ''),
      cachedAt: parsed.cachedAt || null,
    };
  } catch {
    localStorage.removeItem(contentCacheKey(setId));
    return null;
  }
}

function writeFlashcardsContentCache(setId, payload) {
  try {
    localStorage.setItem(contentCacheKey(setId), JSON.stringify({
      ...payload,
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[FlashcardsCache] Failed to write local content cache.', error);
  }
}

export default function FlashcardsPage() {
  const { id } = useParams();
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const cachedContent = useMemo(() => readFlashcardsContentCache(id), [id]);

  const [set, setSet] = useState(() => cachedContent?.set || null);
  const [cards, setCards] = useState(() => cachedContent?.cards || []);
  const [relatedStudyGuideId, setRelatedStudyGuideId] = useState(() => cachedContent?.relatedStudyGuideId || '');
  const [relatedQuizId, setRelatedQuizId] = useState(() => cachedContent?.relatedQuizId || '');
  const [loading, setLoading] = useState(() => !cachedContent);
  const [saving, setSaving] = useState(false);
  const [actionLock, setActionLock] = useState(false);
  const [progress, setProgress] = useState(() => createInitialProgress());
  const [flipped, setFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [speaking, setSpeaking] = useState(false);

  const syncTimerRef = useRef(null);
  const utteranceRef = useRef(null);
  const progressRowIdRef = useRef('');
  const cardStartedAtRef = useRef(0);
  const pendingProgressRef = useRef(null);

  const orderedCards = useMemo(() => {
    const byId = new Map(cards.map((card) => [card.id, card]));
    const ordered = progress.order.map((cardId) => byId.get(cardId)).filter(Boolean);
    const missing = cards.filter((card) => !progress.order.includes(card.id));
    return [...ordered, ...missing];
  }, [cards, progress.order]);

  const currentIndex = clampIndex(progress.currentIndex, orderedCards.length);
  const currentCard = orderedCards[currentIndex] || null;
  const knownCount = Object.values(progress.statuses).filter((status) => status === 'known').length;
  const learningCount = Object.values(progress.statuses).filter((status) => status === 'learning').length;
  const reviewedCount = knownCount + learningCount;
  const completed = orderedCards.length > 0 && reviewedCount >= orderedCards.length;
  const percent = orderedCards.length ? Math.round((knownCount / orderedCards.length) * 100) : 0;

  const saveProgressLocally = useCallback((nextProgress) => {
    try {
      localStorage.setItem(progressKey(id), JSON.stringify({ ...nextProgress, updatedAt: new Date().toISOString() }));
    } catch {
      toast.error('This device blocked progress recovery.');
    }
  }, [id]);

  const syncProgressToDatabase = useCallback(async (nextProgress) => {
    if (!user?.id || !id) return;

    const counts = countStatuses(nextProgress.statuses);
    const payload = {
      user_id: user.id,
      set_id: id,
      current_index: clampIndex(nextProgress.currentIndex, nextProgress.order.length || cards.length),
      order_json: Array.isArray(nextProgress.order) ? nextProgress.order : [],
      statuses_json: nextProgress.statuses || {},
      known_count: counts.known,
      learning_count: counts.learning,
      updated_at: new Date().toISOString(),
    };

    try {
      if (progressRowIdRef.current) {
        const { error } = await supabase
          .from('flashcard_progress')
          .update(payload)
          .eq('id', progressRowIdRef.current)
          .eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from('flashcard_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('set_id', id)
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.id) {
        progressRowIdRef.current = existing.id;
        const { error } = await supabase
          .from('flashcard_progress')
          .update(payload)
          .eq('id', existing.id)
          .eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('flashcard_progress')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;
      progressRowIdRef.current = inserted.id;
    } catch (error) {
      console.warn('[FlashcardsProgress] Progress update failed; review can still continue.', error);
    }
  }, [cards.length, id, supabase, user]);

  const scheduleProgressSync = useCallback((nextProgress) => {
    saveProgressLocally(nextProgress);
    pendingProgressRef.current = nextProgress;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      pendingProgressRef.current = null;
      syncProgressToDatabase(nextProgress);
    }, SYNC_DELAY_MS);
  }, [saveProgressLocally, syncProgressToDatabase]);

  const updateProgress = useCallback((updater) => {
    setProgress((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      scheduleProgressSync(next);
      return next;
    });
  }, [scheduleProgressSync]);

  const stopReading = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const readVisibleSide = useCallback(() => {
    if (!currentCard) return;
    if (!window.speechSynthesis) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }
    if (speaking) {
      stopReading();
      return;
    }

    const text = flipped
      ? `Answer. ${currentCard.back}`
      : `Question. ${currentCard.front}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [currentCard, flipped, speaking, stopReading]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const cached = readFlashcardsContentCache(id);
      if (cached) {
        setSet(cached.set);
        setCards(cached.cards);
        setRelatedStudyGuideId(cached.relatedStudyGuideId || '');
        setRelatedQuizId(cached.relatedQuizId || '');
        setLoading(false);
      } else {
        setLoading(true);
      }

      const [{ data: setData, error: setError }, { data: cardData, error: cardsError }] = await Promise.all([
        supabase.from('flashcard_sets').select('*').eq('id', id).single(),
        supabase.from('flashcards').select('*').eq('set_id', id).order('created_at'),
      ]);

      if (!mounted) return;
      if (setError || cardsError || !setData) {
        setSet(null);
        setCards([]);
        setLoading(false);
        return;
      }

      const nextCards = (cardData || []).map((card) => ({
        ...card,
        front: sanitizePlainText(card.front),
        back: sanitizePlainText(card.back),
        hint: sanitizePlainText(card.hint || ''),
      }));
      let nextProgress = createInitialProgress(nextCards);

      try {
        const cached = JSON.parse(localStorage.getItem(progressKey(id)) || 'null');
        nextProgress = normalizeStoredProgress(cached, nextCards);
      } catch {
        nextProgress = createInitialProgress(nextCards);
      }

      if (user?.id) {
        const { data: remoteProgress } = await supabase
          .from('flashcard_progress')
          .select('id, current_index, order_json, statuses_json, known_count, learning_count, updated_at')
          .eq('user_id', user.id)
          .eq('set_id', id)
          .limit(1)
          .maybeSingle();

        if (remoteProgress?.id) {
          progressRowIdRef.current = remoteProgress.id;
          const normalizedRemote = normalizeStoredProgress(remoteProgress, nextCards);
          if (isNewerProgress(normalizedRemote, nextProgress)) {
            nextProgress = normalizedRemote;
            saveProgressLocally(nextProgress);
          }
        }
      }

      setSet(setData);
      setCards(nextCards);
      setProgress(nextProgress);
      setShowTutorial(!localStorage.getItem(tutorialKey));
      setLoading(false);

      let nextRelatedStudyGuideId = '';
      let nextRelatedQuizId = '';
      if (setData.document_id) {
        const [{ data: guideData }, { data: quizData }] = await Promise.all([
          supabase.from('study_guides').select('id').eq('document_id', setData.document_id).eq('is_archived', false).limit(1).maybeSingle(),
          supabase.from('quizzes').select('id').eq('document_id', setData.document_id).eq('is_archived', false).limit(1).maybeSingle(),
        ]);
        nextRelatedStudyGuideId = guideData?.id || '';
        nextRelatedQuizId = quizData?.id || '';
        if (mounted) {
          setRelatedStudyGuideId(nextRelatedStudyGuideId);
          setRelatedQuizId(nextRelatedQuizId);
        }
      }

      writeFlashcardsContentCache(id, {
        set: setData,
        cards: nextCards,
        relatedStudyGuideId: nextRelatedStudyGuideId,
        relatedQuizId: nextRelatedQuizId,
      });
    };

    load();
    return () => {
      mounted = false;
      stopReading();
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      if (pendingProgressRef.current) {
        syncProgressToDatabase(pendingProgressRef.current);
      }
    };
  }, [id, saveProgressLocally, supabase, stopReading, syncProgressToDatabase, user?.id]);

  useEffect(() => {
    cardStartedAtRef.current = Date.now();
  }, [currentCard?.id]);

  useEffect(() => {
    if (!set?.id) return;
    writeFlashcardsContentCache(id, {
      set,
      cards,
      relatedStudyGuideId,
      relatedQuizId,
    });
  }, [cards, id, relatedQuizId, relatedStudyGuideId, set]);

  useEffect(() => {
    if (!currentCard || flipped || completed) return undefined;
    const timer = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [completed, currentCard, flipped]);

  const withLock = useCallback((callback) => {
    if (actionLock || saving) return;
    setActionLock(true);
    callback();
    window.setTimeout(() => setActionLock(false), 220);
  }, [actionLock, saving]);

  const flipCard = useCallback(() => {
    withLock(() => {
      stopReading();
      setFlipped((value) => !value);
      setHintVisible(false);
    });
  }, [stopReading, withLock]);

  const goToIndex = useCallback((nextIndex) => {
    withLock(() => {
      stopReading();
      setFlipped(false);
      setHintVisible(false);
      updateProgress((current) => ({ ...current, currentIndex: clampIndex(nextIndex, orderedCards.length) }));
    });
  }, [orderedCards.length, stopReading, updateProgress, withLock]);

  const markCard = useCallback((status) => {
    if (!currentCard) return;
    withLock(() => {
      stopReading();
      const responseMs = Math.max(0, Date.now() - cardStartedAtRef.current);
      updateProgress((current) => {
        const nextIndex = clampIndex(current.currentIndex + 1, orderedCards.length);
        return {
          ...current,
          currentIndex: reviewedCount + 1 >= orderedCards.length ? current.currentIndex : nextIndex,
          statuses: { ...current.statuses, [currentCard.id]: status },
          history: [...current.history, { cardId: currentCard.id, index: current.currentIndex, status }].slice(-100),
        };
      });
      if (user?.id) {
        supabase.from('flashcard_attempts').insert({
          user_id: user.id,
          set_id: id,
          card_id: currentCard.id,
          result: status,
          response_ms: responseMs,
        }).then(({ error }) => {
          if (error) console.warn('[FlashcardsProgress] Attempt sync failed.', error);
        });
      }
      setFlipped(false);
      setHintVisible(false);
    });
  }, [currentCard, id, orderedCards.length, reviewedCount, stopReading, supabase, updateProgress, user, withLock]);

  const goBackToLastQuestion = useCallback(() => {
    const previous = progress.history[progress.history.length - 1];
    if (!previous) return;
    withLock(() => {
      updateProgress((current) => {
        const nextStatuses = { ...current.statuses };
        delete nextStatuses[previous.cardId];
        return {
          ...current,
          currentIndex: clampIndex(previous.index, orderedCards.length),
          statuses: nextStatuses,
          history: current.history.slice(0, -1),
        };
      });
      setFlipped(false);
      setHintVisible(false);
    });
  }, [orderedCards.length, progress.history, updateProgress, withLock]);

  const shuffleCards = useCallback(() => {
    withLock(() => {
      const shuffled = [...orderedCards.map((card) => card.id)];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      updateProgress((current) => ({ ...current, currentIndex: 0, order: shuffled }));
      setFlipped(false);
      setHintVisible(false);
    });
  }, [orderedCards, updateProgress, withLock]);

  const restart = useCallback(() => {
    const nextProgress = createInitialProgress(cards);
    setProgress(nextProgress);
    saveProgressLocally(nextProgress);
    syncProgressToDatabase(nextProgress);
    setFlipped(false);
    setHintVisible(false);
  }, [cards, saveProgressLocally, syncProgressToDatabase]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (showTutorial || deleteTarget) return;
      if (event.key === ' ') {
        event.preventDefault();
        flipCard();
      }
      if (event.key === 'ArrowLeft') markCard('learning');
      if (event.key === 'ArrowRight') markCard('known');
      if (event.key.toLowerCase() === 'p') goToIndex(currentIndex - 1);
      if (event.key.toLowerCase() === 's') shuffleCards();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, deleteTarget, flipCard, goToIndex, markCard, showTutorial, shuffleCards]);

  const deleteCard = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      await apiRequest(`/api/flashcards/${id}/cards/${deleteTarget.id}`, { method: 'DELETE' });
      setCards((current) => current.filter((card) => card.id !== deleteTarget.id));
      updateProgress((current) => {
        const statuses = { ...current.statuses };
        delete statuses[deleteTarget.id];
        return {
          ...current,
          currentIndex: clampIndex(current.currentIndex, orderedCards.length - 1),
          order: current.order.filter((cardId) => cardId !== deleteTarget.id),
          statuses,
          history: current.history.filter((entry) => entry.cardId !== deleteTarget.id),
        };
      });
      setDeleteTarget(null);
      toast.success('Flashcard deleted.');
    } catch (error) {
      toast.error(error.message || 'Failed to delete flashcard.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FlashcardsSkeleton />;

  if (!set) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-4 text-center">
        <HelpCircle className="text-[color:var(--color-text-muted)]" size={42} />
        <h1 className="mt-4 text-2xl font-black text-[color:var(--color-text)]">Flashcard set not found</h1>
        <button onClick={() => navigate('/library?tab=flashcards')} className="mt-5 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]">
          Back to library
        </button>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-5 lg:px-6">
        <Breadcrumb items={[{ label: 'Library', href: '/library?tab=flashcards' }, { label: set.title }]} />

        <section className="flashcards-shell mt-3 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-[0_14px_44px_rgba(15,23,42,0.08)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Flashcards</p>
              <h1 className="mt-1 truncate text-2xl font-black leading-tight text-[color:var(--color-text)] sm:text-3xl">{set.title}</h1>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)] sm:text-sm">
                {orderedCards.length} cards in this set. Your progress is protected while you review.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1.5 text-center sm:min-w-72">
              <Stat label="Known" value={knownCount} tone="success" />
              <Stat label="Learning" value={learningCount} tone="warning" />
              <Stat label="Progress" value={`${percent}%`} tone="accent" />
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Flashcard mastery progress">
            <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </section>

        {orderedCards.length === 0 ? (
          <section className="mt-6 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center">
            <Keyboard className="mx-auto text-[color:var(--color-accent)]" size={42} />
            <h2 className="mt-4 text-2xl font-black text-[color:var(--color-text)]">No flashcards yet</h2>
            <button onClick={() => navigate(`/flashcards/${id}/edit`)} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]">
              <Plus size={18} />
              Add flashcard
            </button>
          </section>
        ) : completed ? (
          <CompletionView
            knownCount={knownCount}
            learningCount={learningCount}
            total={orderedCards.length}
            percent={percent}
            onBack={goBackToLastQuestion}
            onRestart={restart}
            onLibrary={() => navigate('/library?tab=flashcards')}
            onStudyGuide={() => relatedStudyGuideId ? navigate(`/study-guide/${relatedStudyGuideId}`) : navigate('/library?tab=study_guide')}
            onQuiz={() => relatedQuizId ? navigate(`/quiz/${relatedQuizId}`) : navigate('/library?tab=quiz')}
          />
        ) : (
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                  <Badge tone="warning" label="Still learning" value={learningCount} />
                  <Badge tone="success" label="Know" value={knownCount} />
                </div>
                <p className="text-sm font-bold text-[color:var(--color-text-muted)]">{currentIndex + 1} / {orderedCards.length}</p>
              </div>

              <MotionDiv
                key={currentCard?.id}
                role="button"
                tabIndex={0}
                onClick={flipCard}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    flipCard();
                  }
                }}
                className="flashcards-card relative h-[min(58vh,30rem)] min-h-[22rem] w-full cursor-pointer rounded-[1.5rem] text-left outline-none sm:h-[min(60vh,31rem)]"
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28 }}
                aria-label={flipped ? 'Answer side shown. Press space or click to return to the question.' : 'Question side shown. Press space or click to reveal the answer.'}
                style={{ perspective: '1400px' }}
              >
                <div
                  className="flashcards-card-inner relative h-full w-full rounded-[1.5rem] transition-transform duration-500 ease-out"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  <div
                    className="absolute inset-0 flex flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 shadow-[0_14px_44px_rgba(15,23,42,0.1)] ring-0 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)] sm:p-5"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setHintVisible(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition hover:bg-[color:var(--color-surface)]"
                      >
                        <HelpCircle size={16} />
                        Hint
                      </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          readVisibleSide();
                        }}
                        className="rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
                        aria-label={speaking ? 'Stop reading this question' : 'Read question aloud'}
                      >
                        {speaking && !flipped ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    </div>

                    <div className="flex flex-1 items-center justify-center px-2 py-6">
                      <p className="max-w-4xl text-center text-xl font-bold leading-relaxed text-[color:var(--color-text)] sm:text-2xl lg:text-3xl">
                        {currentCard.front}
                      </p>
                    </div>

                    <AnimatePresence>
                      {hintVisible ? (
                        <MotionDiv
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 12 }}
                          className="mx-auto mb-3 max-w-lg rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm leading-6 text-[color:var(--color-text-muted)]"
                        >
                          {currentCard.hint || summarizeForHint(currentCard.back)}
                        </MotionDiv>
                      ) : null}
                    </AnimatePresence>

                    <div className="rounded-[1rem] bg-[color:var(--color-surface)] px-3 py-2 text-center text-xs font-semibold text-[color:var(--color-text-muted)] sm:text-sm">
                      <Keyboard className="mx-auto mb-0.5 inline-block" size={15} />
                      Front. Press Space or click to flip.
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 flex flex-col overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 shadow-[0_14px_44px_rgba(15,23,42,0.1)] sm:p-5"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[color:var(--color-surface)] px-3 py-1.5 text-sm font-black text-[color:var(--color-text-muted)]">
                        Back
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          readVisibleSide();
                        }}
                        className="rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
                        aria-label={speaking ? 'Stop reading this answer' : 'Read answer aloud'}
                      >
                        {speaking && flipped ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    </div>

                    <div className="flex flex-1 items-center justify-center px-2 py-6">
                      <p className="max-w-4xl text-center text-xl font-bold leading-relaxed text-[color:var(--color-text)] sm:text-2xl lg:text-3xl">
                        {currentCard.back}
                      </p>
                    </div>

                    <div className="rounded-[1rem] bg-[color:var(--color-surface)] px-3 py-2 text-center text-xs font-semibold text-[color:var(--color-text-muted)] sm:text-sm">
                      <Keyboard className="mx-auto mb-0.5 inline-block" size={15} />
                      Back. Press ArrowLeft for still learning or ArrowRight for know.
                    </div>
                  </div>
                </div>
              </MotionDiv>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <IconButton label="Previous card" onClick={() => goToIndex(currentIndex - 1)} disabled={currentIndex === 0 || saving} icon={<ChevronLeft size={20} />} />
                <ActionButton label="Still learning" tone="warning" onClick={() => markCard('learning')} disabled={saving} icon={<X size={22} />} />
                <ActionButton label="Know" tone="success" onClick={() => markCard('known')} disabled={saving} icon={<Check size={22} />} />
                <IconButton label="Shuffle cards" onClick={shuffleCards} disabled={saving} icon={<Shuffle size={20} />} />
                <IconButton label="Restart flashcards" onClick={restart} disabled={saving} icon={<RotateCcw size={20} />} />
              </div>
            </div>

            <aside className="space-y-2 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <button onClick={() => navigate(`/flashcards/${id}/edit`)} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-3 py-2.5 text-sm font-bold text-[color:var(--color-accent-text)] disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={18} />
                Add card
              </button>
              <button onClick={() => navigate(`/flashcards/${id}/edit`)} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-bold text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50">
                <BookOpen size={18} />
                Edit current
              </button>
              <button onClick={() => setDeleteTarget(currentCard)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2.5 text-sm font-bold text-red-500">
                <Trash2 size={18} />
                Delete current
              </button>
              <button onClick={() => navigate('/library?tab=flashcards')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-bold text-[color:var(--color-text-muted)]">
                <Library size={18} />
                Library
              </button>
            </aside>
          </section>
        )}
      </main>

      <Modal
        isOpen={showTutorial}
        onClose={() => {
          localStorage.setItem(tutorialKey, '1');
          setShowTutorial(false);
        }}
        title="Flashcards tutorial"
        size="lg"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <p>The front side always shows the question. Flip the card to reveal the answer, then mark it as known or still learning.</p>
          <p>Use Space to flip, ArrowRight for know, ArrowLeft for still learning, P for previous, and S to shuffle.</p>
          <p>Manual cards use a question on the front and the answer on the back. Your review progress can recover if you refresh or close the tab.</p>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(tutorialKey, '1');
              setShowTutorial(false);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]"
          >
            <Sparkles size={18} />
            Start reviewing
          </button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => saving ? null : setDeleteTarget(null)} title="Delete flashcard?" size="sm">
        <div className="space-y-4">
          {saving ? <LoadingPanel title="Deleting flashcard" detail="Removing the card and recalculating your saved progress." /> : null}
          <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">This permanently removes the current question and answer from the set.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} disabled={saving} className="rounded-2xl px-5 py-3 font-bold text-[color:var(--color-text-muted)] disabled:opacity-50">Cancel</button>
            <button onClick={deleteCard} disabled={saving} className="rounded-2xl bg-red-500 px-5 py-3 font-bold text-white disabled:opacity-50">Delete</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === 'success' ? '#10b981' : tone === 'warning' ? '#f97316' : 'var(--color-accent)';
  return (
    <div className="rounded-[0.9rem] bg-[color:var(--color-surface)] p-2">
      <p className="text-lg font-black leading-tight" style={{ color }}>{value}</p>
      <p className="text-[0.68rem] font-bold leading-tight text-[color:var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function Badge({ label, value, tone }) {
  const color = tone === 'success' ? '#10b981' : '#f97316';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: color, color }}>
      <span>{value}</span>
      <span>{label}</span>
    </span>
  );
}

function IconButton({ label, icon, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
      {icon}
    </button>
  );
}

function ActionButton({ label, icon, onClick, tone, disabled }) {
  const color = tone === 'success' ? '#10b981' : '#f97316';
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex h-10 min-w-16 items-center justify-center rounded-full border bg-[color:var(--color-surface)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: color, color }}>
      {icon}
    </button>
  );
}

function CompletionView({ knownCount, learningCount, total, percent, onBack, onRestart, onLibrary, onStudyGuide, onQuiz }) {
  return (
    <section className="mt-6 overflow-hidden rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_20px_65px_rgba(15,23,42,0.12)] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div>
          <Check className="text-emerald-500" size={52} />
          <h2 className="mt-4 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">You sorted every card.</h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--color-text-muted)]">Known cards can stay out of the way for now. Still learning cards are your best next review target.</p>

          <div className="mt-6 space-y-3">
            <ProgressRow label="Know" value={knownCount} total={total} color="#10b981" />
            <ProgressRow label="Still learning" value={learningCount} total={total} color="#f97316" />
            <ProgressRow label="Mastery" value={percent} total={100} color="var(--color-accent)" suffix="%" />
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={onQuiz} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-4 font-black text-[color:var(--color-accent-text)]">
            <HelpCircle size={20} />
            Go for quiz
          </button>
          <button onClick={onStudyGuide} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-4 font-black text-[color:var(--color-text)]">
            <BookOpen size={20} />
            Review study guide
          </button>
          <button onClick={onRestart} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-4 font-black text-[color:var(--color-text)]">
            <RotateCcw size={20} />
            Restart flashcards
          </button>
          <button onClick={onBack} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-4 font-black text-[color:var(--color-text-muted)]">
            <ArrowLeft size={20} />
            Back to last question
          </button>
          <button onClick={onLibrary} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-4 font-black text-[color:var(--color-text-muted)]">
            <Library size={20} />
            Back to library
          </button>
        </div>
      </div>
    </section>
  );
}

function ProgressRow({ label, value, total, color, suffix = '' }) {
  const width = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="rounded-[1.25rem] bg-[color:var(--color-surface-2)] p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-bold text-[color:var(--color-text)]">
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function LoadingPanel({ title, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-[color:var(--color-accent)]" size={18} />
        <div>
          <p className="font-bold text-[color:var(--color-text)]">{title}</p>
          <p className="text-sm text-[color:var(--color-text-muted)]">{detail}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[color:var(--color-accent)]" />
      </div>
    </div>
  );
}

function FlashcardsSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-4 w-52 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
      <section className="mt-4 rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="h-5 w-32 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded-2xl bg-[color:var(--color-surface-2)]" />
        <div className="mt-5 h-3 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
      </section>
      <section className="mt-6 min-h-[34rem] rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-6">
        <div className="h-5 w-32 animate-pulse rounded-full bg-[color:var(--color-surface)]" />
        <div className="mx-auto mt-40 h-10 w-2/3 animate-pulse rounded-2xl bg-[color:var(--color-surface)]" />
        <div className="mx-auto mt-6 h-4 w-1/3 animate-pulse rounded-full bg-[color:var(--color-surface)]" />
      </section>
    </main>
  );
}
