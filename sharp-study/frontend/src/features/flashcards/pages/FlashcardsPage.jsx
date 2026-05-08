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
import { sanitizePlainText } from '../../../shared/utils/sanitize';

const HINT_DELAY_MS = 45000;
const SYNC_DELAY_MS = 20000;
const progressKey = (setId) => `sharp-study-flashcards-progress:${setId}`;
const tutorialKey = 'sharp-study-flashcards-tutorial-seen';
const MotionButton = motion.button;
const MotionP = motion.p;
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

export default function FlashcardsPage() {
  const { id } = useParams();
  const { user, supabase } = useAuth();
  const navigate = useNavigate();

  const [set, setSet] = useState(null);
  const [cards, setCards] = useState([]);
  const [relatedStudyGuideId, setRelatedStudyGuideId] = useState('');
  const [relatedQuizId, setRelatedQuizId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLock, setActionLock] = useState(false);
  const [progress, setProgress] = useState(() => createInitialProgress());
  const [flipped, setFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [editModal, setEditModal] = useState(null);
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
      toast.error('Your browser blocked local progress saving.');
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
      console.warn('[FlashcardsProgress] Database sync failed; local progress is still saved.', error);
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
      setLoading(true);
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

      if (setData.document_id) {
        const [{ data: guideData }, { data: quizData }] = await Promise.all([
          supabase.from('study_guides').select('id').eq('document_id', setData.document_id).eq('is_archived', false).limit(1).maybeSingle(),
          supabase.from('quizzes').select('id').eq('document_id', setData.document_id).eq('is_archived', false).limit(1).maybeSingle(),
        ]);
        if (mounted) {
          setRelatedStudyGuideId(guideData?.id || '');
          setRelatedQuizId(quizData?.id || '');
        }
      }
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
      if (showTutorial || editModal || deleteTarget) return;
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
  }, [currentIndex, deleteTarget, editModal, flipCard, goToIndex, markCard, showTutorial, shuffleCards]);

  const saveCard = async () => {
    if (!editModal) return;
    const clean = {
      front: sanitizePlainText(editModal.front),
      back: sanitizePlainText(editModal.back),
    };
    if (!clean.front || !clean.back) {
      toast.error('Both the question and answer are required.');
      return;
    }

    setSaving(true);
    try {
      if (editModal.id) {
        const { data, error } = await supabase.from('flashcards').update(clean).eq('id', editModal.id).select().single();
        if (error) throw error;
        setCards((current) => current.map((card) => (card.id === editModal.id ? { ...card, ...data } : card)));
      } else {
        const { data, error } = await supabase.from('flashcards').insert({ ...clean, set_id: id }).select().single();
        if (error) throw error;
        setCards((current) => [...current, data]);
        updateProgress((current) => ({ ...current, order: [...current.order, data.id] }));
      }
      setEditModal(null);
      toast.success('Flashcard saved.');
    } catch (error) {
      toast.error(error.message || 'Failed to save flashcard.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('flashcards').delete().eq('id', deleteTarget.id);
      if (error) throw error;
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
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'Library', href: '/library?tab=flashcards' }, { label: set.title }]} />

        <section className="flashcards-shell mt-4 rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_20px_65px_rgba(15,23,42,0.1)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">Flashcards</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">{set.title}</h1>
              <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
                {orderedCards.length} cards in this set. Progress saves locally first, then syncs to your account.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-2 text-center sm:min-w-80">
              <Stat label="Known" value={knownCount} tone="success" />
              <Stat label="Learning" value={learningCount} tone="warning" />
              <Stat label="Progress" value={`${percent}%`} tone="accent" />
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Flashcard mastery progress">
            <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </section>

        {orderedCards.length === 0 ? (
          <section className="mt-6 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center">
            <Keyboard className="mx-auto text-[color:var(--color-accent)]" size={42} />
            <h2 className="mt-4 text-2xl font-black text-[color:var(--color-text)]">No flashcards yet</h2>
            <button onClick={() => setEditModal({ front: '', back: '' })} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]">
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
          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                  <Badge tone="warning" label="Still learning" value={learningCount} />
                  <Badge tone="success" label="Know" value={knownCount} />
                </div>
                <p className="text-sm font-bold text-[color:var(--color-text-muted)]">{currentIndex + 1} / {orderedCards.length}</p>
              </div>

              <MotionButton
                key={currentCard?.id}
                type="button"
                onClick={flipCard}
                className="flashcards-card relative flex min-h-[30rem] w-full flex-col overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5 text-left shadow-[0_18px_60px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)] sm:min-h-[34rem] sm:p-8"
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28 }}
                aria-label={flipped ? 'Answer side shown. Press space or click to return to the question.' : 'Question side shown. Press space or click to reveal the answer.'}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
                    {!flipped && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setHintVisible(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 transition hover:bg-[color:var(--color-surface)]"
                      >
                        <HelpCircle size={16} />
                        Hint
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      readVisibleSide();
                    }}
                    className="rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
                    aria-label={speaking ? 'Stop reading this card' : 'Read visible side aloud'}
                  >
                    {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </div>

                <div className="flex flex-1 items-center justify-center px-2 py-10">
                  <AnimatePresence mode="wait">
                    <MotionP
                      key={`${currentCard?.id}-${flipped ? 'back' : 'front'}`}
                      initial={{ opacity: 0, rotateX: -8, y: 10 }}
                      animate={{ opacity: 1, rotateX: 0, y: 0 }}
                      exit={{ opacity: 0, rotateX: 8, y: -10 }}
                      transition={{ duration: 0.22 }}
                      className={`max-w-4xl text-center font-bold leading-relaxed text-[color:var(--color-text)] ${flipped ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-4xl'}`}
                    >
                      {flipped ? currentCard.back : currentCard.front}
                    </MotionP>
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {!flipped && hintVisible ? (
                    <MotionDiv
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="mx-auto mb-4 max-w-lg rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-sm leading-6 text-[color:var(--color-text-muted)]"
                    >
                      {currentCard.hint || summarizeForHint(currentCard.back)}
                    </MotionDiv>
                  ) : null}
                </AnimatePresence>

                <div className="rounded-[1.25rem] bg-[color:var(--color-surface)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--color-text-muted)]">
                  <Keyboard className="mx-auto mb-1 inline-block" size={16} />
                  Press Space to flip. ArrowLeft means still learning, ArrowRight means know.
                </div>
              </MotionButton>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <IconButton label="Previous card" onClick={() => goToIndex(currentIndex - 1)} disabled={currentIndex === 0 || saving} icon={<ChevronLeft size={20} />} />
                <ActionButton label="Still learning" tone="warning" onClick={() => markCard('learning')} disabled={saving} icon={<X size={22} />} />
                <ActionButton label="Know" tone="success" onClick={() => markCard('known')} disabled={saving} icon={<Check size={22} />} />
                <IconButton label="Shuffle cards" onClick={shuffleCards} disabled={saving} icon={<Shuffle size={20} />} />
                <IconButton label="Restart flashcards" onClick={restart} disabled={saving} icon={<RotateCcw size={20} />} />
              </div>
            </div>

            <aside className="space-y-3 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
              <button onClick={() => setEditModal({ front: '', back: '' })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-bold text-[color:var(--color-accent-text)]">
                <Plus size={18} />
                Add card
              </button>
              <button onClick={() => setEditModal({ id: currentCard.id, front: currentCard.front, back: currentCard.back })} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-bold text-[color:var(--color-text)]">
                <BookOpen size={18} />
                Edit current
              </button>
              <button onClick={() => setDeleteTarget(currentCard)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 px-4 py-3 font-bold text-red-500">
                <Trash2 size={18} />
                Delete current
              </button>
              <button onClick={() => navigate('/library?tab=flashcards')} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-bold text-[color:var(--color-text-muted)]">
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
          <p>Manual cards use a question on the front and the answer on the back. Your review progress is saved locally if you refresh or close the tab.</p>
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

      <Modal isOpen={Boolean(editModal)} onClose={() => saving ? null : setEditModal(null)} title={editModal?.id ? 'Edit flashcard' : 'Add flashcard'} size="md">
        <div className="space-y-4">
          {saving ? (
            <LoadingPanel title="Saving flashcard" detail="Sanitizing the question and answer, then updating your set." />
          ) : null}
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--color-text)]">Question</span>
            <textarea value={editModal?.front || ''} onChange={(event) => setEditModal((current) => ({ ...current, front: event.target.value }))} rows={4} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]" disabled={saving} />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[color:var(--color-text)]">Answer</span>
            <textarea value={editModal?.back || ''} onChange={(event) => setEditModal((current) => ({ ...current, back: event.target.value }))} rows={4} className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]" disabled={saving} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setEditModal(null)} disabled={saving} className="rounded-2xl px-5 py-3 font-bold text-[color:var(--color-text-muted)] disabled:opacity-50">Cancel</button>
            <button onClick={saveCard} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] disabled:opacity-50">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Save card
            </button>
          </div>
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
    <div className="rounded-[1.1rem] bg-[color:var(--color-surface)] p-3">
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs font-bold text-[color:var(--color-text-muted)]">{label}</p>
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
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
      {icon}
    </button>
  );
}

function ActionButton({ label, icon, onClick, tone, disabled }) {
  const color = tone === 'success' ? '#10b981' : '#f97316';
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex h-12 min-w-20 items-center justify-center rounded-full border bg-[color:var(--color-surface)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: color, color }}>
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
