import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  GripVertical,
  Keyboard,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { apiRequest } from '../../../config/api';
import { sanitizePlainText } from '../../../shared/utils/sanitize';
import StudyNotice from '../../../shared/components/StudyNotice';
import { FlashcardsBuilderSkeleton } from '../../../shared/components/PageSkeletons';

const CARD_PAGE_SIZE = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const draftStorageKey = (userId, scope = 'new') => `sharp-study-manual-flashcards-draft:${userId || 'guest'}:${scope || 'new'}`;
const contentCacheKey = (setId) => `sharp-study-flashcards-content:${setId}`;
const FLASHCARD_DIFFICULTIES = [
  { value: 'easy', label: 'Easy', helper: 'Direct recall', description: 'Shorter, beginner-friendly cards.', color: '#22c55e', icon: Sparkles },
  { value: 'normal', label: 'Normal', helper: 'Balanced review', description: 'A steady default for most lessons.', color: '#8b3dff', icon: ShieldCheck },
  { value: 'hard', label: 'Hard', helper: 'Applied recall', description: 'Better for cards that need deeper thinking.', color: '#f97316', icon: Flame },
  { value: 'expert', label: 'Expert', helper: 'Strict recall', description: 'Use for your toughest memory checks.', color: '#facc15', icon: Star },
];

function getFlashcardDifficulty(value = 'normal') {
  return FLASHCARD_DIFFICULTIES.find((item) => item.value === value) || FLASHCARD_DIFFICULTIES[1];
}

function createEmptyCard() {
  return {
    key: crypto.randomUUID(),
    id: '',
    front: '',
    back: '',
    difficulty: 'normal',
  };
}

function normalizeCards(cards = []) {
  return cards
    .map((card) => ({
      id: UUID_PATTERN.test(card?.id || '') ? card.id : undefined,
      front: sanitizePlainText(card?.front || '').slice(0, 500),
      back: sanitizePlainText(card?.back || '').slice(0, 1000),
      difficulty: getFlashcardDifficulty(card?.difficulty).value,
    }))
    .filter((card) => card.front && card.back)
    .slice(0, 80);
}

function normalizeDraftCards(cards = []) {
  const normalized = Array.isArray(cards)
    ? cards
      .map((card) => ({
        key: typeof card?.key === 'string' ? card.key : card?.id || crypto.randomUUID(),
        id: UUID_PATTERN.test(card?.id || '') ? card.id : '',
        front: sanitizePlainText(card?.front || '').slice(0, 500),
        back: sanitizePlainText(card?.back || '').slice(0, 1000),
        difficulty: getFlashcardDifficulty(card?.difficulty).value,
      }))
      .filter((card) => card.front || card.back)
      .slice(0, 80)
    : [];

  return normalized.length ? normalized : [createEmptyCard(), createEmptyCard()];
}

function hasDraftContent(draft) {
  return Boolean(draft?.title?.trim())
    || Boolean(draft?.description?.trim())
    || Boolean((draft?.cards || []).some((card) => card.front?.trim() || card.back?.trim()));
}

function buildSanitizedDraft(title, description, cards) {
  return {
    title: sanitizePlainText(title || '').slice(0, 180),
    description: sanitizePlainText(description || '').slice(0, 500),
    cards: normalizeDraftCards(cards),
    updatedAt: new Date().toISOString(),
  };
}

function saveDraftToLocalStorage(storageKey, draft) {
  if (!hasDraftContent(draft)) {
    localStorage.removeItem(storageKey);
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(draft));
}

function writeFlashcardsContentCache(setId, payload) {
  if (!setId || !payload?.set || !Array.isArray(payload?.cards)) return;

  try {
    localStorage.setItem(contentCacheKey(setId), JSON.stringify({
      set: payload.set,
      cards: payload.cards,
      relatedStudyGuideId: payload.relatedStudyGuideId || '',
      relatedQuizId: payload.relatedQuizId || '',
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[FlashcardsCreateCache] Failed to refresh saved flashcards.', error);
  }
}

function createSnapshot(title, description, cards) {
  return JSON.stringify({
    title: sanitizePlainText(title || '').slice(0, 180),
    description: sanitizePlainText(description || '').slice(0, 500),
    cards: normalizeDraftCards(cards).map((card) => ({
      id: card.id || '',
      front: card.front,
      back: card.back,
      difficulty: getFlashcardDifficulty(card.difficulty).value,
    })),
  });
}

export default function FlashcardsCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: routeSetId } = useParams();
  const isEdit = Boolean(routeSetId);
  const saveLockRef = useRef(false);

  const [setId, setSetId] = useState(routeSetId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState([createEmptyCard(), createEmptyCard()]);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState('save');
  const [saveStatus, setSaveStatus] = useState({
    active: false,
    progress: 0,
    title: 'Saving flashcards',
    detail: 'Preparing your flashcards.',
  });
  const [loadingSet, setLoadingSet] = useState(isEdit);
  const [restoredDraft, setRestoredDraft] = useState(null);
  const [draftAction, setDraftAction] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const [rawCurrentPage, setCurrentPage] = useState(0);
  const [initialSnapshot, setInitialSnapshot] = useState('');

  const draftKey = useMemo(
    () => draftStorageKey(user?.id, isEdit ? routeSetId : 'new'),
    [isEdit, routeSetId, user?.id]
  );
  const validCards = useMemo(() => normalizeCards(cards), [cards]);
  const totalPages = Math.max(1, Math.ceil(cards.length / CARD_PAGE_SIZE));
  const currentPage = Math.min(rawCurrentPage, totalPages - 1);
  const pageStart = currentPage * CARD_PAGE_SIZE;
  const visibleCards = cards.slice(pageStart, pageStart + CARD_PAGE_SIZE);
  const currentSnapshot = useMemo(() => createSnapshot(title, description, cards), [cards, description, title]);
  const hasChanges = isEdit ? draftReady && currentSnapshot !== initialSnapshot : hasDraftContent({ title, description, cards });
  const blocked = saving || loadingSet || Boolean(restoredDraft) || Boolean(draftAction);
  const canSave = sanitizePlainText(title).length > 0
    && validCards.length > 0
    && !blocked;
  const visibleSaveStatus = saving || saveStatus.active
    ? saveStatus
    : {
      active: false,
      progress: 0,
      title: 'Saving flashcards',
      detail: 'Preparing your flashcards.',
    };

  useEffect(() => {
    let mounted = true;

    const loadFlashcards = async () => {
      setDraftReady(false);
      setRestoredDraft(null);
      setDraftAction(null);

      try {
        if (isEdit) {
          setLoadingSet(true);
          const response = await apiRequest(`/api/flashcards/${routeSetId}`);
          if (!mounted) return;

          const nextTitle = sanitizePlainText(response?.set?.title || '').slice(0, 180);
          const nextCards = normalizeDraftCards(response?.cards || []);
          setSetId(response?.set?.id || routeSetId);
          setTitle(nextTitle);
          setDescription('');
          setCards(nextCards);
          setInitialSnapshot(createSnapshot(nextTitle, '', nextCards));
        } else {
          setSetId('');
          setTitle('');
          setDescription('');
          const blankCards = [createEmptyCard(), createEmptyCard()];
          setCards(blankCards);
          setInitialSnapshot(createSnapshot('', '', blankCards));
        }

        const rawDraft = localStorage.getItem(draftKey);
        if (!rawDraft) return;

        const parsedDraft = JSON.parse(rawDraft);
        const sanitizedDraft = {
          ...buildSanitizedDraft(parsedDraft?.title || '', parsedDraft?.description || '', parsedDraft?.cards || []),
          updatedAt: parsedDraft?.updatedAt || null,
        };

        if (hasDraftContent(sanitizedDraft) && mounted) {
          setRestoredDraft(sanitizedDraft);
        }
      } catch (error) {
        if (isEdit) {
          toast.error(error.message || 'Failed to load this flashcard set.');
          navigate('/library?tab=flashcards', { replace: true });
        } else {
          localStorage.removeItem(draftKey);
        }
      } finally {
        if (mounted) {
          setLoadingSet(false);
          setDraftReady(true);
        }
      }
    };

    loadFlashcards();
    return () => {
      mounted = false;
    };
  }, [draftKey, isEdit, navigate, routeSetId]);

  useEffect(() => {
    if (!draftReady || restoredDraft || draftAction || saving || loadingSet) return;
    try {
      if (isEdit && currentSnapshot === initialSnapshot) {
        localStorage.removeItem(draftKey);
        return;
      }
      saveDraftToLocalStorage(draftKey, buildSanitizedDraft(title, description, cards));
    } catch (error) {
      console.warn('[FlashcardsCreateDraft] Failed to save draft.', error);
    }
  }, [cards, currentSnapshot, description, draftAction, draftKey, draftReady, initialSnapshot, isEdit, loadingSet, restoredDraft, saving, title]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasChanges || saving) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, saving]);

  const updateCard = (key, patch) => {
    setCards((current) => current.map((card) => (card.key === key ? { ...card, ...patch } : card)));
  };

  const addCard = () => {
    setCards((current) => {
      const next = [...current, createEmptyCard()];
      setCurrentPage(Math.floor((next.length - 1) / CARD_PAGE_SIZE));
      return next;
    });
  };

  const removeCard = (key) => {
    setCards((current) => (current.length <= 1 ? current : current.filter((card) => card.key !== key)));
  };

  const goBack = () => {
    navigate(isEdit ? `/flashcards/${setId || routeSetId}` : '/library?tab=flashcards');
  };

  const saveSet = async (nextIntent = 'save') => {
    if (saveLockRef.current || saving) return;

    if (!user?.id) {
      toast.error('Please sign in before saving flashcards.');
      return;
    }

    const cleanTitle = sanitizePlainText(title).slice(0, 180);
    const cleanCards = normalizeCards(cards);

    if (!cleanTitle) {
      toast.error('Add a title before saving the set.');
      return;
    }
    if (!cleanCards.length) {
      toast.error('Add at least one complete question and answer.');
      return;
    }

    saveLockRef.current = true;
    setSaving(true);
    setSaveIntent(nextIntent);
    setSaveStatus({
      active: true,
      progress: 18,
      title: 'Checking your flashcards',
      detail: 'Reviewing the title, terms, and definitions before saving.',
    });

    try {
      setSaveStatus({
        active: true,
        progress: 46,
        title: 'Saving your flashcards',
        detail: 'Keeping your set protected while the latest changes are applied.',
      });

      const endpoint = isEdit ? `/api/flashcards/${setId || routeSetId}` : '/api/flashcards';
      const response = await apiRequest(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: cleanTitle,
          cards: cleanCards,
        }),
      });
      const savedId = response?.set?.id || response?.item?.id || setId || routeSetId;

      setSaveStatus({
        active: true,
        progress: 82,
        title: 'Finishing up',
        detail: 'Refreshing the editor with the saved version of your set.',
      });

      localStorage.removeItem(draftKey);
      if (savedId && response?.set && Array.isArray(response?.cards)) {
        writeFlashcardsContentCache(savedId, {
          set: response.set,
          cards: response.cards,
          relatedStudyGuideId: response.relatedStudyGuideId,
          relatedQuizId: response.relatedQuizId,
        });
      } else if (savedId) {
        localStorage.removeItem(contentCacheKey(savedId));
      }

      if (isEdit && Array.isArray(response?.cards)) {
        const nextCards = normalizeDraftCards(response.cards);
        setCards(nextCards);
        setInitialSnapshot(createSnapshot(cleanTitle, description, nextCards));
      } else {
        setInitialSnapshot(createSnapshot(cleanTitle, description, cleanCards));
      }

      if (savedId) setSetId(savedId);

      setSaveStatus({
        active: true,
        progress: 100,
        title: 'Flashcards saved',
        detail: 'Your set is ready.',
      });
      toast.success(isEdit ? 'Flashcard set saved.' : 'Flashcard set created.');

      if (nextIntent === 'practice' && savedId) {
        navigate(`/flashcards/${savedId}`);
      } else if (!isEdit) {
        navigate('/library?tab=flashcards');
      }
    } catch (error) {
      toast.error(error.message || (isEdit ? 'Failed to save flashcard set.' : 'Failed to create flashcard set.'));
      setSaveStatus({
        active: true,
        progress: 0,
        title: 'Saving did not finish',
        detail: 'Please review your connection and try again.',
      });
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      window.setTimeout(() => {
        setSaveStatus((current) => ({ ...current, active: false }));
      }, 300);
    }
  };

  const continueDraft = () => {
    if (!restoredDraft) return;
    setDraftAction({
      title: 'Preparing your flashcards',
      detail: 'Opening the most recent saved version of your work.',
    });
    window.setTimeout(() => {
      setTitle(restoredDraft.title || '');
      setDescription(restoredDraft.description || '');
      setCards(normalizeDraftCards(restoredDraft.cards));
      setCurrentPage(0);
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Flashcards restored.');
    }, 450);
  };

  const discardDraft = () => {
    setDraftAction({
      title: 'Starting fresh',
      detail: 'Clearing the unfinished version and preparing the editor.',
    });
    window.setTimeout(() => {
      localStorage.removeItem(draftKey);
      if (!isEdit) {
        const blankCards = [createEmptyCard(), createEmptyCard()];
        setTitle('');
        setDescription('');
        setCards(blankCards);
        setInitialSnapshot(createSnapshot('', '', blankCards));
      }
      setCurrentPage(0);
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Ready for a fresh start.');
    }, 450);
  };

  if (loadingSet) {
    return <FlashcardsBuilderSkeleton />;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb
          items={[
            { label: 'Library', href: '/library?tab=flashcards' },
            isEdit
              ? { label: 'Edit flashcards' }
              : { label: 'Create flashcards' },
          ]}
        />

        <section className="mt-4 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_20px_65px_rgba(15,23,42,0.1)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={goBack}
                disabled={blocked}
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isEdit ? 'Back to flashcard preview' : 'Back to flashcard library'}
                title={isEdit ? 'Back to flashcard preview' : 'Back to flashcard library'}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {isEdit ? 'Flashcard preview' : 'Library'}
              </button>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
                {isEdit ? 'Edit flashcards' : 'Manual flashcards'}
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">
                {isEdit ? 'Edit flashcard set' : 'Create a new flashcard set'}
              </h1>
            </div>

            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              <StudyNotice title={isEdit ? 'Saving flashcard changes can count as study activity.' : 'Creating flashcards can count as study activity.'}>
                Saved sets can keep your streak active. Practicing the cards afterward records review progress.
              </StudyNotice>
              <button
                type="button"
                onClick={() => saveSet('save')}
                disabled={!canSave}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 text-sm font-black text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isEdit ? 'Save flashcard changes' : 'Create flashcard set'}
                title={isEdit ? 'Save flashcard changes' : 'Create flashcard set'}
              >
                {saving && saveIntent === 'save' ? <SaveProgressDonut progress={visibleSaveStatus.progress} active size="sm" /> : <Save size={18} aria-hidden="true" />}
                {isEdit ? 'Save changes' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => saveSet('practice')}
                disabled={!canSave}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 text-sm font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isEdit ? 'Save and review flashcards' : 'Create and practice flashcards'}
                title={isEdit ? 'Save and review flashcards' : 'Create and practice flashcards'}
              >
                {saving && saveIntent === 'practice' ? <SaveProgressDonut progress={visibleSaveStatus.progress} active size="sm" /> : <Sparkles size={18} aria-hidden="true" />}
                {isEdit ? 'Save and review' : 'Create and practice'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="block">
              <span className="sr-only">Flashcard set title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={blocked}
                maxLength={180}
                placeholder="Title"
                className="h-14 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-black text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="sr-only">Flashcard set note</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={blocked}
                maxLength={500}
                placeholder="Add a short note for yourself..."
                className="h-14 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 text-sm font-semibold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-black text-[color:var(--color-text-muted)]">
            <Keyboard size={16} aria-hidden="true" />
            Manual question and answer cards
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
            <Check size={16} className={validCards.length ? 'text-emerald-500' : ''} aria-hidden="true" />
            {validCards.length} complete card{validCards.length === 1 ? '' : 's'}
          </div>
        </section>

        <FlashcardsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCards={cards.length}
          pageStart={pageStart}
          pageCount={visibleCards.length}
          disabled={blocked}
          onPrevious={() => setCurrentPage((page) => Math.max(0, page - 1))}
          onNext={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
        />

        <section className="mt-4 space-y-4">
          {visibleCards.map((card, offset) => {
            const index = pageStart + offset;
            return (
              <article key={card.key} className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-lg font-black text-[color:var(--color-text)]">{index + 1}</p>
                  <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
                    <GripVertical size={18} aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => removeCard(card.key)}
                      disabled={blocked || cards.length <= 1}
                      className="rounded-xl p-2 transition hover:bg-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Delete flashcard ${index + 1}`}
                      title={`Delete flashcard ${index + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <FlashcardDifficultyPicker
                  value={card.difficulty}
                  disabled={blocked}
                  onChange={(difficulty) => updateCard(card.key, { difficulty })}
                />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="block">
                    <span className="sr-only">Flashcard {index + 1} question</span>
                    <textarea
                      value={card.front}
                      onChange={(event) => updateCard(card.key, { front: event.target.value })}
                      disabled={blocked}
                      maxLength={500}
                      rows={2}
                      placeholder="Enter term"
                      className="min-h-24 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 font-bold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60"
                    />
                    <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">Term</span>
                  </label>

                  <label className="block">
                    <span className="sr-only">Flashcard {index + 1} answer</span>
                    <textarea
                      value={card.back}
                      onChange={(event) => updateCard(card.key, { back: event.target.value })}
                      disabled={blocked}
                      maxLength={1000}
                      rows={2}
                      placeholder="Enter definition"
                      className="min-h-24 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 font-bold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60"
                    />
                    <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">Definition</span>
                  </label>
                </div>
              </article>
            );
          })}
        </section>

        <FlashcardsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCards={cards.length}
          pageStart={pageStart}
          pageCount={visibleCards.length}
          disabled={blocked}
          onPrevious={() => setCurrentPage((page) => Math.max(0, page - 1))}
          onNext={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
        />

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={addCard}
            disabled={blocked}
            className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-4 font-black text-[color:var(--color-text)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add another flashcard"
            title="Add another flashcard"
          >
            <Plus size={18} aria-hidden="true" />
            Add a card
          </button>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => saveSet('save')}
            disabled={!canSave}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-6 font-black text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isEdit ? 'Save flashcard changes' : 'Create flashcard set'}
            title={isEdit ? 'Save flashcard changes' : 'Create flashcard set'}
          >
            {saving && saveIntent === 'save' ? <SaveProgressDonut progress={visibleSaveStatus.progress} active size="sm" /> : <Save size={18} aria-hidden="true" />}
            {isEdit ? 'Save changes' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => saveSet('practice')}
            disabled={!canSave}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-6 font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isEdit ? 'Save and review flashcards' : 'Create and practice flashcards'}
            title={isEdit ? 'Save and review flashcards' : 'Create and practice flashcards'}
          >
            {saving && saveIntent === 'practice' ? <SaveProgressDonut progress={visibleSaveStatus.progress} active size="sm" /> : <Sparkles size={18} aria-hidden="true" />}
            {isEdit ? 'Save and review' : 'Create and practice'}
          </button>
        </div>
      </main>

      <Modal
        isOpen={saving || saveStatus.active}
        onClose={() => {}}
        title={visibleSaveStatus.title}
        size="md"
        closeOnBackdrop={false}
        closeOnEscape={false}
        showCloseButton={false}
      >
        <div className="space-y-5 text-center" aria-live="assertive">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <SaveProgressDonut progress={visibleSaveStatus.progress} active size="lg" />
          </div>
          <div>
            <p className="text-xl font-black text-[color:var(--color-text)]">{visibleSaveStatus.title}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
              {visibleSaveStatus.detail}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]" role="progressbar" aria-valuenow={visibleSaveStatus.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-300" style={{ width: `${visibleSaveStatus.progress}%` }} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
            Please keep this page open
          </p>
        </div>
      </Modal>

      <Modal isOpen={Boolean(restoredDraft) || Boolean(draftAction)} onClose={() => {}} title={draftAction ? draftAction.title : 'Continue unfinished flashcards?'} size="md" closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false}>
        {draftAction ? (
          <LocalDraftLoading title={draftAction.title} detail={draftAction.detail} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">
              We found unfinished flashcard edits. You can continue where you left off or start fresh.
            </p>
            <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
              <p className="text-sm font-black text-[color:var(--color-text)]">{restoredDraft?.title || 'Untitled flashcard set'}</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                {normalizeCards(restoredDraft?.cards || []).length} complete card{normalizeCards(restoredDraft?.cards || []).length === 1 ? '' : 's'} available
              </p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                {restoredDraft?.updatedAt ? `Updated ${new Date(restoredDraft.updatedAt).toLocaleString()}` : 'Updated recently'}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={discardDraft} className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)]">
                Start fresh
              </button>
              <button type="button" onClick={continueDraft} className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5">
                Continue editing
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function FlashcardDifficultyPicker({ value, disabled, onChange }) {
  const selected = getFlashcardDifficulty(value);

  return (
    <fieldset className="mb-4 rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
        Card difficulty
      </legend>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-[color:var(--color-text-muted)]">
          Choose how challenging this card should feel in review.
        </p>
        <p className="text-xs font-bold text-[color:var(--color-text-muted)]">
          Current: <span className="text-[color:var(--color-text)]">{selected.label}</span>
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {FLASHCARD_DIFFICULTIES.map((option) => {
          const Icon = option.icon;
          const active = option.value === selected.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              aria-pressed={active}
              className={`min-h-[5.25rem] rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50 ${
                active
                  ? 'bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] shadow-[0_12px_30px_rgba(15,23,42,0.1)]'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]'
              }`}
              style={{ borderColor: active ? option.color : undefined }}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${option.color}22`, color: option.color }}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{option.label}</span>
                  <span className="block truncate text-[0.68rem] font-bold uppercase tracking-[0.1em]">{option.helper}</span>
                </span>
              </span>
              <span className="mt-2 block text-xs font-semibold leading-5">{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FlashcardsPagination({ currentPage, totalPages, totalCards, pageStart, pageCount, disabled, onPrevious, onNext }) {
  const start = totalCards ? pageStart + 1 : 0;
  const end = Math.min(totalCards, pageStart + pageCount);

  return (
    <nav className="mt-5 flex flex-col gap-3 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Flashcard editor pagination">
      <p className="text-sm font-bold text-[color:var(--color-text-muted)]">
        Page {currentPage + 1} of {totalPages}. Showing {start}-{end} of {totalCards} cards.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled || currentPage === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-4 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous flashcard editor page"
          title="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || currentPage >= totalPages - 1}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-4 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next flashcard editor page"
          title="Next page"
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function LocalDraftLoading({ title, detail }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-[color:var(--color-accent)]" size={20} aria-hidden="true" />
        <div>
          <p className="font-black text-[color:var(--color-text)]">{title}</p>
          <p className="text-sm leading-6 text-[color:var(--color-text-muted)]">{detail}</p>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-[color:var(--color-accent)]" />
      </div>
    </div>
  );
}

function SaveProgressDonut({ progress = 0, active = false, size = 'md' }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const degrees = Math.round((safeProgress / 100) * 360);
  const dimensions = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
  const innerDimensions = size === 'sm' ? 'inset-[4px]' : size === 'lg' ? 'inset-[10px]' : 'inset-[7px]';
  const textSize = size === 'lg' ? 'text-sm' : 'text-[0.62rem]';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${dimensions} ${active ? 'quiz-save-donut-active' : ''}`}
      style={{
        background: `conic-gradient(var(--color-accent) ${degrees}deg, rgba(148, 163, 184, 0.24) 0deg)`,
      }}
      role="img"
      aria-label={`Save progress ${safeProgress}%`}
      title={`Save progress ${safeProgress}%`}
    >
      <span className={`absolute rounded-full bg-[color:var(--color-surface)] ${innerDimensions}`} />
      {size === 'sm' ? null : (
        <span className={`relative font-black text-[color:var(--color-text)] ${textSize}`}>{safeProgress}</span>
      )}
    </span>
  );
}
