import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  HelpCircle,
  History,
  Keyboard,
  Library,
  Loader2,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
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
import StudyNotice from '../../../shared/components/StudyNotice';

const HINT_DELAY_MS = 45000;
const SYNC_DELAY_MS = 20000;
const ATTEMPT_PAGE_SIZE = 5;
const progressKey = (setId) => `sharp-study-flashcards-progress:${setId}`;
const contentCacheKey = (setId) => `sharp-study-flashcards-content:${setId}`;
const difficultyKey = (setId) => `sharp-study-flashcards-difficulty:${setId}`;
const tutorialKey = 'sharp-study-flashcards-tutorial-seen';
const MotionDiv = motion.div;
const FLASHCARD_DIFFICULTIES = [
  { value: 'easy', label: 'Easy', helper: 'Hints stay open', description: 'Best for warming up or reading a new lesson for the first time.', color: '#22c55e', icon: Sparkles, hintsLocked: false },
  { value: 'normal', label: 'Normal', helper: 'Balanced review', description: 'Good for regular practice with standard hint support.', color: '#8b3dff', icon: ShieldCheck, hintsLocked: false },
  { value: 'hard', label: 'Hard', helper: 'Hints locked', description: 'Stricter recall practice. Hints are locked while you answer.', color: '#f97316', icon: Flame, hintsLocked: true },
  { value: 'expert', label: 'Expert', helper: 'Strict recall', description: 'Use this when you are ready to test memory without help.', color: '#facc15', icon: Star, hintsLocked: true },
];

function getFlashcardDifficulty(value = 'normal') {
  return FLASHCARD_DIFFICULTIES.find((item) => item.value === value) || FLASHCARD_DIFFICULTIES[1];
}

function readFlashcardDifficulty(setId, fallback = 'normal') {
  try {
    const stored = localStorage.getItem(difficultyKey(setId));
    return getFlashcardDifficulty(stored || fallback).value;
  } catch {
    return getFlashcardDifficulty(fallback).value;
  }
}

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

function normalizeAttemptLogItem(attempt) {
  return {
    id: sanitizePlainText(attempt?.id || `local-${Date.now()}`),
    card_id: sanitizePlainText(attempt?.card_id || ''),
    card_front: sanitizePlainText(attempt?.card_front || 'Flashcard'),
    result: attempt?.result === 'learning' ? 'learning' : 'known',
    response_ms: Number.isFinite(Number(attempt?.response_ms)) ? Number(attempt.response_ms) : null,
    difficulty: getFlashcardDifficulty(attempt?.difficulty).value,
    created_at: attempt?.created_at || new Date().toISOString(),
  };
}

function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatResponseTime(ms) {
  if (!Number.isFinite(Number(ms))) return 'No timer';
  const seconds = Math.max(0, Math.round(Number(ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export default function FlashcardsPage() {
  const { id } = useParams();
  const { user } = useAuth();
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
  const [difficulty, setDifficulty] = useState(() => readFlashcardDifficulty(id));
  const [reviewStarted, setReviewStarted] = useState(false);
  const [previewExitConfirm, setPreviewExitConfirm] = useState(false);
  const [attemptLog, setAttemptLog] = useState([]);
  const [attemptPage, setAttemptPage] = useState(1);
  const [attemptPagination, setAttemptPagination] = useState({
    page: 1,
    page_size: ATTEMPT_PAGE_SIZE,
    total: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  });
  const [attemptLogLoading, setAttemptLogLoading] = useState(false);

  const syncTimerRef = useRef(null);
  const utteranceRef = useRef(null);
  const progressRowIdRef = useRef('');
  const cardStartedAtRef = useRef(0);
  const pendingProgressRef = useRef(null);

  const difficultyMeta = useMemo(() => getFlashcardDifficulty(difficulty), [difficulty]);
  const difficultyCounts = useMemo(() => (
    FLASHCARD_DIFFICULTIES.reduce((acc, option) => {
      acc[option.value] = cards.filter((card) => getFlashcardDifficulty(card.difficulty).value === option.value).length;
      return acc;
    }, {})
  ), [cards]);
  const activeCards = useMemo(
    () => cards.filter((card) => getFlashcardDifficulty(card.difficulty).value === difficultyMeta.value),
    [cards, difficultyMeta.value]
  );

  const orderedCards = useMemo(() => {
    const byId = new Map(activeCards.map((card) => [card.id, card]));
    const ordered = progress.order.map((cardId) => byId.get(cardId)).filter(Boolean);
    const missing = activeCards.filter((card) => !progress.order.includes(card.id));
    return [...ordered, ...missing];
  }, [activeCards, progress.order]);

  const currentIndex = clampIndex(progress.currentIndex, orderedCards.length);
  const currentCard = orderedCards[currentIndex] || null;
  const activeCardIds = useMemo(() => new Set(activeCards.map((card) => card.id)), [activeCards]);
  const activeStatuses = useMemo(
    () => Object.entries(progress.statuses).filter(([cardId]) => activeCardIds.has(cardId)),
    [activeCardIds, progress.statuses]
  );
  const knownCount = activeStatuses.filter(([, status]) => status === 'known').length;
  const learningCount = activeStatuses.filter(([, status]) => status === 'learning').length;
  const reviewedCount = knownCount + learningCount;
  const completed = orderedCards.length > 0 && reviewedCount >= orderedCards.length;
  const percent = orderedCards.length ? Math.round((knownCount / orderedCards.length) * 100) : 0;
  const hintsLocked = difficultyMeta.hintsLocked;

  useEffect(() => {
    try {
      localStorage.setItem(difficultyKey(id), difficultyMeta.value);
    } catch {
      // Difficulty is a local preference; review can continue without saving it.
    }
  }, [difficultyMeta.value, id]);

  const saveProgressLocally = useCallback((nextProgress) => {
    try {
      localStorage.setItem(progressKey(id), JSON.stringify({ ...nextProgress, updatedAt: new Date().toISOString() }));
    } catch {
      toast.error('This device blocked progress recovery.');
    }
  }, [id]);

  const syncProgressToDatabase = useCallback(async (nextProgress) => {
    if (!user?.id || !id) return;

    const payload = {
      current_index: Number(nextProgress.currentIndex) || 0,
      order_json: Array.isArray(nextProgress.order) ? nextProgress.order : [],
      statuses_json: nextProgress.statuses || {},
    };

    try {
      const response = await apiRequest(`/api/flashcards/${id}/progress`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (response?.progress?.id) progressRowIdRef.current = response.progress.id;
    } catch (error) {
      console.warn('[FlashcardsProgress] Progress update failed; review can still continue.', error);
    }
  }, [id, user]);

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

  const loadAttemptLog = useCallback(async (page = 1) => {
    if (!user?.id || !id) {
      setAttemptLog([]);
      setAttemptPagination({
        page: 1,
        page_size: ATTEMPT_PAGE_SIZE,
        total: 0,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      });
      return;
    }

    setAttemptLogLoading(true);
    try {
      const response = await apiRequest(`/api/flashcards/${id}/attempts?page=${page}&limit=${ATTEMPT_PAGE_SIZE}`);
      setAttemptLog((response.attempts || []).map(normalizeAttemptLogItem));
      setAttemptPagination({
        page: Number(response.pagination?.page || page),
        page_size: Number(response.pagination?.page_size || ATTEMPT_PAGE_SIZE),
        total: Number(response.pagination?.total || 0),
        total_pages: Math.max(1, Number(response.pagination?.total_pages || 1)),
        has_next: Boolean(response.pagination?.has_next),
        has_previous: Boolean(response.pagination?.has_previous),
      });
    } catch (error) {
      console.warn('[FlashcardsProgress] Attempt log load failed.', error);
    } finally {
      setAttemptLogLoading(false);
    }
  }, [id, user?.id]);

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
        const cachedDifficulty = readFlashcardDifficulty(id, cached.set?.difficulty);
        setSet(cached.set);
        setCards(cached.cards);
        setRelatedStudyGuideId(cached.relatedStudyGuideId || '');
        setRelatedQuizId(cached.relatedQuizId || '');
        setDifficulty(cachedDifficulty);
        setReviewStarted(false);
        if (getFlashcardDifficulty(cachedDifficulty).hintsLocked) {
          setHintVisible(false);
        }
        setLoading(false);
      } else {
        setLoading(true);
      }

      let response = null;
      try {
        response = await apiRequest(`/api/flashcards/${id}`);
      } catch {
        response = null;
      }

      if (!mounted) return;
      if (!response?.set) {
        setSet(null);
        setCards([]);
        setLoading(false);
        return;
      }

      const setData = response.set;
      const nextCards = (response.cards || []).map((card) => ({
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
        const progressResponse = await apiRequest(`/api/flashcards/${id}/progress`).catch(() => null);
        const remoteProgress = progressResponse?.progress || null;

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
      setReviewStarted(false);
      setLoading(false);

      const nextRelatedStudyGuideId = sanitizePlainText(response.relatedStudyGuideId || '');
      const nextRelatedQuizId = sanitizePlainText(response.relatedQuizId || '');
      const nextDifficulty = readFlashcardDifficulty(id, setData.difficulty);
      setRelatedStudyGuideId(nextRelatedStudyGuideId);
      setRelatedQuizId(nextRelatedQuizId);
      setDifficulty(nextDifficulty);
      if (getFlashcardDifficulty(nextDifficulty).hintsLocked) {
        setHintVisible(false);
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
  }, [id, saveProgressLocally, stopReading, syncProgressToDatabase, user?.id]);

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
    if (!set?.id || !user?.id) return undefined;
    const timer = window.setTimeout(() => {
      loadAttemptLog(attemptPage);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [attemptPage, loadAttemptLog, set?.id, user?.id]);

  useEffect(() => {
    if (!currentCard || flipped || completed || hintsLocked) return undefined;
    const timer = window.setTimeout(() => setHintVisible(true), HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [completed, currentCard, flipped, hintsLocked]);

  const withLock = useCallback((callback) => {
    if (actionLock || saving) return;
    setActionLock(true);
    callback();
    window.setTimeout(() => setActionLock(false), 220);
  }, [actionLock, saving]);

  const changeDifficulty = useCallback((value) => {
    const next = getFlashcardDifficulty(value);
    setDifficulty(next.value);
    if (next.hintsLocked) setHintVisible(false);
    setFlipped(false);
    setReviewStarted(false);
    updateProgress((current) => ({ ...current, currentIndex: 0 }));
  }, [updateProgress]);

  const startReview = useCallback(() => {
    if (!orderedCards.length) {
      toast.error(`No ${difficultyMeta.label.toLowerCase()} cards are available in this set yet.`);
      return;
    }
    stopReading();
    setFlipped(false);
    setHintVisible(false);
    setReviewStarted(true);
    cardStartedAtRef.current = Date.now();
  }, [difficultyMeta.label, orderedCards.length, stopReading]);

  const returnToPreview = useCallback(() => {
    stopReading();
    if (pendingProgressRef.current) {
      syncProgressToDatabase(pendingProgressRef.current);
      pendingProgressRef.current = null;
    }
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setFlipped(false);
    setHintVisible(false);
    setReviewStarted(false);
    setPreviewExitConfirm(false);
  }, [stopReading, syncProgressToDatabase]);

  const requestReturnToPreview = useCallback(() => {
    if (reviewStarted && orderedCards.length) {
      setPreviewExitConfirm(true);
      return;
    }
    returnToPreview();
  }, [orderedCards.length, returnToPreview, reviewStarted]);

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
        apiRequest(`/api/flashcards/${id}/attempts`, {
          method: 'POST',
          body: JSON.stringify({
            card_id: currentCard.id,
            result: status,
            response_ms: responseMs,
            difficulty: difficultyMeta.value,
          }),
        }).then(() => {
          setAttemptPage(1);
          loadAttemptLog(1);
        }).catch((error) => {
          console.warn('[FlashcardsProgress] Attempt sync failed.', error);
        });
      }
      setFlipped(false);
      setHintVisible(false);
    });
  }, [currentCard, difficultyMeta.value, id, loadAttemptLog, orderedCards.length, reviewedCount, stopReading, updateProgress, user, withLock]);

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
    setReviewStarted(false);
  }, [cards, saveProgressLocally, syncProgressToDatabase]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (!reviewStarted || showTutorial || deleteTarget || previewExitConfirm) return;
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
  }, [currentIndex, deleteTarget, flipCard, goToIndex, markCard, previewExitConfirm, reviewStarted, showTutorial, shuffleCards]);

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
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/library?tab=flashcards')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 text-xs font-black text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50"
                  aria-label="Back to flashcard library"
                  title="Back to flashcard library"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Library
                </button>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Flashcards</p>
              </div>
              <h1 className="mt-1 truncate text-2xl font-black leading-tight text-[color:var(--color-text)] sm:text-3xl">{set.title}</h1>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)] sm:text-sm">
                {orderedCards.length} cards in this set. Your progress is protected while you review.
              </p>
            </div>

            <div className="flex shrink-0 items-start justify-end gap-3">
              <StudyNotice
                className="mt-1"
                eyebrow="Difficulty notice"
                ariaLabel="Show flashcard difficulty notice"
                buttonTitle="Show flashcard difficulty notice"
                title="Choose a challenge before reviewing."
              >
                Easy keeps hints available. Normal is balanced. Hard and Expert lock hints for stricter recall practice.
              </StudyNotice>
              <div className="grid grid-cols-3 gap-2 rounded-[1.1rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-1.5 text-center sm:min-w-72">
                <Stat label="Known" value={knownCount} tone="success" />
                <Stat label="Learning" value={learningCount} tone="warning" />
                <Stat label="Progress" value={`${percent}%`} tone="accent" />
              </div>
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
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[color:var(--color-text-muted)]">
              This set is empty for now. Card adding from the review screen is temporarily hidden.
            </p>
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
        ) : !reviewStarted ? (
          <FlashcardPreview
            cards={orderedCards}
            knownCount={knownCount}
            learningCount={learningCount}
            difficulty={difficultyMeta.value}
            difficulties={FLASHCARD_DIFFICULTIES}
            difficultyCounts={difficultyCounts}
            attemptLog={attemptLog}
            attemptPagination={attemptPagination}
            attemptLogLoading={attemptLogLoading}
            onDifficultyChange={changeDifficulty}
            onStart={startReview}
            onPageChange={setAttemptPage}
            onLibrary={() => navigate('/library?tab=flashcards')}
            onEdit={() => navigate(`/flashcards/${id}/edit`)}
          />
        ) : (
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
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
                            if (!hintsLocked) setHintVisible(true);
                          }}
                          disabled={hintsLocked}
                          title={hintsLocked ? `${difficultyMeta.label} mode locks hints for stricter recall.` : 'Show hint'}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition hover:bg-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <HelpCircle size={16} />
                          {hintsLocked ? 'Hints locked' : 'Hint'}
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

            <aside className="space-y-3 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <SelectedFlashcardDifficulty
                difficulty={difficultyMeta}
                total={orderedCards.length}
                reviewed={reviewedCount}
              />
              <button onClick={requestReturnToPreview} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowLeft size={18} />
                Go back to preview
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

      <Modal isOpen={previewExitConfirm} onClose={() => saving ? null : setPreviewExitConfirm(false)} title="Go back to preview?" size="sm">
        <div className="space-y-4">
          <p className="text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
            Your flashcard session is still in progress. Going back will close this play screen and return to the difficulty preview. Any synced card results stay saved, but your current review flow will stop.
          </p>
          <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Current session</p>
            <p className="mt-1 text-sm font-black text-[color:var(--color-text)]">
              {difficultyMeta.label} · {reviewedCount}/{orderedCards.length} reviewed
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPreviewExitConfirm(false)}
              disabled={saving}
              className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] disabled:opacity-50"
            >
              Keep reviewing
            </button>
            <button
              type="button"
              onClick={returnToPreview}
              disabled={saving}
              className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              Go back to preview
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

function FlashcardPreview({
  cards,
  knownCount,
  learningCount,
  difficulty,
  difficulties,
  difficultyCounts,
  attemptLog,
  attemptPagination,
  attemptLogLoading,
  onDifficultyChange,
  onStart,
  onPageChange,
  onLibrary,
  onEdit,
}) {
  const selected = getFlashcardDifficulty(difficulty);
  const Icon = selected.icon;
  const remaining = Math.max(0, cards.length - knownCount - learningCount);
  const selectedCount = Number(difficultyCounts?.[selected.value] || 0);

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Review setup</p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)]">Choose your flashcard challenge.</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
              This set includes multiple challenge levels when generated by AI. Pick the pressure you want for this review session.
            </p>
          </div>
          <div className="grid min-w-[min(100%,22rem)] grid-cols-3 gap-2 rounded-[1.35rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-2 text-center">
              <Stat label="Cards" value={cards.length} tone="accent" />
              <Stat label="Known" value={knownCount} tone="success" />
              <Stat label="Left" value={remaining} tone="warning" />
            </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
          <DifficultyOptionGrid
            value={difficulty}
            options={difficulties}
            counts={difficultyCounts}
            onChange={onDifficultyChange}
          />

          <aside className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${selected.color}22`, color: selected.color }}>
                <Icon size={24} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Selected</p>
                <h3 className="text-xl font-black text-[color:var(--color-text)]">{selected.label}</h3>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">{selected.description}</p>
            <p className="mt-2 text-sm font-black text-[color:var(--color-text)]">
              {selectedCount} {selected.label.toLowerCase()} card{selectedCount === 1 ? '' : 's'} ready.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <StartStat label="Hints" value={selected.hintsLocked ? 'Locked' : 'Available'} />
              <StartStat label="Mode" value={selected.helper} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={onStart}
                disabled={selectedCount < 1}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50"
              >
                <PlayCircle size={20} aria-hidden="true" />
                Start flashcards
              </button>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 text-sm font-black text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface)]">
                  <BookOpen size={17} aria-hidden="true" />
                  Edit set
                </button>
                <button type="button" onClick={onLibrary} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 text-sm font-black text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface)]">
                  <Library size={17} aria-hidden="true" />
                  Library
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <FlashcardAttemptLog
        attempts={attemptLog}
        pagination={attemptPagination}
        loading={attemptLogLoading}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function DifficultyOptionGrid({ value, options, counts = {}, onChange }) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-[color:var(--color-text)]">Difficulty</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = option.value === value;
          const count = Number(counts[option.value] || 0);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`min-h-[8.5rem] rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50 ${
                active
                  ? 'bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] shadow-[0_14px_35px_rgba(15,23,42,0.12)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]'
              }`}
              style={{ borderColor: active ? option.color : undefined }}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${option.color}22`, color: option.color }}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-black">{option.label}</span>
                  <span className="block text-xs font-black uppercase tracking-[0.12em]">{option.helper}</span>
                </span>
              </span>
              <span className="mt-3 block text-sm font-semibold leading-6">{option.description}</span>
              <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em]">{count} ready</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FlashcardAttemptLog({ attempts, pagination, loading, onPageChange, compact = false }) {
  const safePage = Number(pagination?.page || 1);
  const totalPages = Math.max(1, Number(pagination?.total_pages || 1));
  const total = Number(pagination?.total || 0);

  return (
    <section className={`rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="text-[color:var(--color-accent)]" size={compact ? 17 : 20} aria-hidden="true" />
          <h2 className={`${compact ? 'text-base' : 'text-xl'} font-black text-[color:var(--color-text)]`}>Review log</h2>
        </div>
        <span className="rounded-full bg-[color:var(--color-surface-2)] px-2.5 py-1 text-xs font-black text-[color:var(--color-text-muted)]">
          {total} total
        </span>
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {loading ? (
          <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <div className="flex items-center gap-3 text-sm font-bold text-[color:var(--color-text-muted)]">
              <Loader2 className="animate-spin text-[color:var(--color-accent)]" size={18} aria-hidden="true" />
              Loading review history...
            </div>
          </div>
        ) : attempts.length ? attempts.map((attempt) => {
          const difficulty = getFlashcardDifficulty(attempt.difficulty);
          const resultKnown = attempt.result === 'known';
          return (
            <article key={attempt.id} className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[color:var(--color-text)]">{attempt.card_front}</p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                    {formatReviewDate(attempt.created_at)} · {formatResponseTime(attempt.response_ms)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${resultKnown ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                  {resultKnown ? 'Know' : 'Learning'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ background: `${difficulty.color}1f`, color: difficulty.color }}>
                  {difficulty.label}
                </span>
                <span className="rounded-full bg-[color:var(--color-surface)] px-2.5 py-1 text-xs font-black text-[color:var(--color-text-muted)]">
                  Synced
                </span>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[1.25rem] border border-dashed border-[color:var(--color-border)] p-4 text-sm font-semibold leading-6 text-[color:var(--color-text-muted)]">
            Your reviewed cards will appear here after they sync.
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Flashcard review log pagination">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={loading || safePage <= 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous review log page"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={loading || safePage >= totalPages}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next review log page"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function StartStat({ label, value }) {
  return (
    <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-3 text-center">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-black text-[color:var(--color-text)]">{value}</p>
    </div>
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

function SelectedFlashcardDifficulty({ difficulty, total, reviewed }) {
  const selected = getFlashcardDifficulty(difficulty?.value);
  const Icon = selected.icon;
  const progress = total ? Math.min(100, Math.round((reviewed / total) * 100)) : 0;

  return (
    <section className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${selected.color}22`, color: selected.color }}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Selected difficulty</p>
          <h2 className="mt-1 truncate text-xl font-black text-[color:var(--color-text)]">{selected.label}</h2>
          <p className="mt-1 text-xs font-bold text-[color:var(--color-text-muted)]">
            {selected.helper} · {selected.hintsLocked ? 'Hints locked' : 'Hints available'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold leading-6 text-[color:var(--color-text-muted)]">
        This session keeps the chosen difficulty locked. Return to preview if you want to pick another challenge.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StartStat label="Reviewed" value={`${reviewed}/${total}`} />
        <StartStat label="Session" value={`${progress}%`} />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface)]" role="progressbar" aria-label="Current flashcard session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress}%`, background: selected.color }} />
      </div>
    </section>
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

function FlashcardsLoadingDonut({ progress = 42 }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const degrees = Math.round((safeProgress / 100) * 360);

  return (
    <span
      className="quiz-save-donut-active relative inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-accent) ${degrees}deg, rgba(148, 163, 184, 0.24) 0deg)`,
      }}
      role="img"
      aria-label={`Flashcards loading ${safeProgress}%`}
      title={`Flashcards loading ${safeProgress}%`}
    >
      <span className="absolute inset-[10px] rounded-full bg-[color:var(--color-surface)]" />
      <span className="relative text-sm font-black text-[color:var(--color-text)]">{safeProgress}</span>
    </span>
  );
}

function FlashcardsSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-4 w-52 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
      <section className="mt-4 rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <FlashcardsLoadingDonut progress={38} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black text-[color:var(--color-text)]">Loading flashcards</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--color-text-muted)]">
              Syncing cards, difficulty levels, and your saved review progress.
            </p>
          </div>
        </div>
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
