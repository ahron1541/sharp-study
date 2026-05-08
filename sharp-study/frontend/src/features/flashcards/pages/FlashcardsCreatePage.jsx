import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  GripVertical,
  Keyboard,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { apiRequest } from '../../../config/api';
import { sanitizePlainText } from '../../../shared/utils/sanitize';

const draftStorageKey = (userId) => `sharp-study-manual-flashcards-draft:${userId || 'guest'}`;

function createEmptyCard() {
  return {
    key: crypto.randomUUID(),
    front: '',
    back: '',
  };
}

function normalizeCards(cards = []) {
  return cards
    .map((card) => ({
      front: sanitizePlainText(card.front || '').slice(0, 500),
      back: sanitizePlainText(card.back || '').slice(0, 1000),
    }))
    .filter((card) => card.front && card.back)
    .slice(0, 80);
}

function normalizeDraftCards(cards = []) {
  const normalized = Array.isArray(cards)
    ? cards
      .map((card) => ({
        key: typeof card?.key === 'string' ? card.key : crypto.randomUUID(),
        front: sanitizePlainText(card?.front || '').slice(0, 500),
        back: sanitizePlainText(card?.back || '').slice(0, 1000),
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

function saveDraftToLocalStorage(userId, draft) {
  if (!hasDraftContent(draft)) {
    localStorage.removeItem(draftStorageKey(userId));
    return;
  }

  localStorage.setItem(draftStorageKey(userId), JSON.stringify(draft));
}

export default function FlashcardsCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards] = useState([createEmptyCard(), createEmptyCard()]);
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState('create');
  const [restoredDraft, setRestoredDraft] = useState(null);
  const [draftAction, setDraftAction] = useState(null);
  const [draftReady, setDraftReady] = useState(false);

  const validCards = useMemo(() => normalizeCards(cards), [cards]);
  const hasChanges = useMemo(
    () => hasDraftContent({ title, description, cards }),
    [cards, description, title]
  );
  const canSave = sanitizePlainText(title).length > 0 && validCards.length > 0 && !saving && !restoredDraft && !draftAction;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const rawDraft = localStorage.getItem(draftStorageKey(user?.id));
        if (!rawDraft) {
          setDraftReady(true);
          return;
        }

        const parsedDraft = JSON.parse(rawDraft);
        const sanitizedDraft = {
          ...buildSanitizedDraft(parsedDraft?.title || '', parsedDraft?.description || '', parsedDraft?.cards || []),
          updatedAt: parsedDraft?.updatedAt || null,
        };

        if (hasDraftContent(sanitizedDraft)) {
          setRestoredDraft(sanitizedDraft);
        }
      } catch {
        localStorage.removeItem(draftStorageKey(user?.id));
      } finally {
        setDraftReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!draftReady || restoredDraft || draftAction || saving) return;
    try {
      saveDraftToLocalStorage(user?.id, buildSanitizedDraft(title, description, cards));
    } catch (error) {
      console.warn('[FlashcardsCreateDraft] Failed to save local draft.', error);
    }
  }, [cards, description, draftAction, draftReady, restoredDraft, saving, title, user?.id]);

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
    setCards((current) => [...current, createEmptyCard()]);
  };

  const removeCard = (key) => {
    setCards((current) => (current.length <= 1 ? current : current.filter((card) => card.key !== key)));
  };

  const saveSet = async (nextIntent = 'create') => {
    if (!user?.id) {
      toast.error('You need to be logged in to create flashcards.');
      return;
    }

    const cleanTitle = sanitizePlainText(title).slice(0, 180);
    const cleanCards = normalizeCards(cards);

    if (!cleanTitle) {
      toast.error('Add a title before creating the set.');
      return;
    }
    if (!cleanCards.length) {
      toast.error('Add at least one complete question and answer.');
      return;
    }

    setSaving(true);
    setSaveIntent(nextIntent);

    try {
      const response = await apiRequest('/api/flashcards', {
        method: 'POST',
        body: JSON.stringify({
          title: cleanTitle,
          cards: cleanCards,
        }),
      });

      localStorage.removeItem(draftStorageKey(user.id));
      toast.success('Flashcard set created.');
      navigate(nextIntent === 'practice' ? `/flashcards/${response.item.id}` : '/library?tab=flashcards');
    } catch (error) {
      toast.error(error.message || 'Failed to create flashcard set.');
    } finally {
      setSaving(false);
    }
  };

  const continueDraft = () => {
    if (!restoredDraft) return;
    setDraftAction({
      title: 'Restoring your flashcard draft',
      detail: 'Loading the locally saved title, description, and cards into the creator.',
    });
    window.setTimeout(() => {
      setTitle(restoredDraft.title || '');
      setDescription(restoredDraft.description || '');
      setCards(normalizeDraftCards(restoredDraft.cards));
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Draft restored.');
    }, 450);
  };

  const discardDraft = () => {
    setDraftAction({
      title: 'Discarding local draft',
      detail: 'Removing the saved browser draft and preparing a blank flashcard set.',
    });
    window.setTimeout(() => {
      localStorage.removeItem(draftStorageKey(user?.id));
      setTitle('');
      setDescription('');
      setCards([createEmptyCard(), createEmptyCard()]);
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Local draft discarded.');
    }, 450);
  };

  const blocked = saving || Boolean(restoredDraft) || Boolean(draftAction);

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'Library', href: '/library?tab=flashcards' }, { label: 'Create flashcards' }]} />

        <section className="mt-4 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_20px_65px_rgba(15,23,42,0.1)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate('/library?tab=flashcards')}
                disabled={blocked}
                className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Library
              </button>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">Manual flashcards</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">Create a new flashcard set</h1>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => saveSet('create')} disabled={!canSave} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 text-sm font-black text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
                {saving && saveIntent === 'create' ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Create
              </button>
              <button type="button" onClick={() => saveSet('practice')} disabled={!canSave} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 text-sm font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                {saving && saveIntent === 'practice' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Create and practice
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="block">
              <span className="sr-only">Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={blocked} maxLength={180} placeholder="Title" className="h-14 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-black text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60" />
            </label>
            <label className="block">
              <span className="sr-only">Description</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={blocked} maxLength={500} placeholder="Add a description..." className="h-14 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 text-sm font-semibold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60" />
            </label>
          </div>
        </section>

        {saving ? (
          <section className="mt-5 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-[color:var(--color-accent)]" size={22} />
              <div>
                <p className="font-black text-[color:var(--color-text)]">Creating your flashcard set</p>
                <p className="text-sm text-[color:var(--color-text-muted)]">Sanitizing every field, saving the set, and locking actions until it is ready.</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[color:var(--color-accent)]" />
            </div>
          </section>
        ) : null}

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-black text-[color:var(--color-text-muted)]">
            <Keyboard size={16} />
            Manual question and answer cards
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
            <Check size={16} className={validCards.length ? 'text-emerald-500' : ''} />
            {validCards.length} complete card{validCards.length === 1 ? '' : 's'}
          </div>
        </section>

        <section className="mt-5 space-y-4">
          {cards.map((card, index) => (
            <article key={card.key} className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-black text-[color:var(--color-text)]">{index + 1}</p>
                <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
                  <GripVertical size={18} aria-hidden="true" />
                  <button type="button" onClick={() => removeCard(card.key)} disabled={blocked || cards.length <= 1} className="rounded-xl p-2 transition hover:bg-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Delete card ${index + 1}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="block">
                  <span className="sr-only">Card {index + 1} question</span>
                  <textarea value={card.front} onChange={(event) => updateCard(card.key, { front: event.target.value })} disabled={blocked} maxLength={500} rows={2} placeholder="Enter term" className="min-h-24 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 font-bold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60" />
                  <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">Term</span>
                </label>

                <label className="block">
                  <span className="sr-only">Card {index + 1} answer</span>
                  <textarea value={card.back} onChange={(event) => updateCard(card.key, { back: event.target.value })} disabled={blocked} maxLength={1000} rows={2} placeholder="Enter definition" className="min-h-24 w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 font-bold text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)] disabled:opacity-60" />
                  <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">Definition</span>
                </label>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-8 flex justify-center">
          <button type="button" onClick={addCard} disabled={blocked} className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-4 font-black text-[color:var(--color-text)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={18} />
            Add a card
          </button>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => saveSet('create')} disabled={!canSave} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-6 font-black text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50">
            {saving && saveIntent === 'create' ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Create
          </button>
          <button type="button" onClick={() => saveSet('practice')} disabled={!canSave} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-6 font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
            {saving && saveIntent === 'practice' ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Create and practice
          </button>
        </div>
      </main>

      <Modal isOpen={Boolean(restoredDraft) || Boolean(draftAction)} onClose={() => {}} title={draftAction ? draftAction.title : 'Continue your unsaved flashcards?'} size="md" closeOnBackdrop={false} closeOnEscape={false} showCloseButton={false}>
        {draftAction ? (
          <LocalDraftLoading title={draftAction.title} detail={draftAction.detail} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">
              A flashcard set draft was saved only in this browser. You can continue where you left off or discard it and start fresh.
            </p>
            <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
              <p className="text-sm font-black text-[color:var(--color-text)]">{restoredDraft?.title || 'Untitled flashcard set'}</p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                {normalizeCards(restoredDraft?.cards || []).length} complete card{normalizeCards(restoredDraft?.cards || []).length === 1 ? '' : 's'} saved locally
              </p>
              <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                Local draft {restoredDraft?.updatedAt ? new Date(restoredDraft.updatedAt).toLocaleString() : 'saved recently'}
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={discardDraft} className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)]">
                Discard
              </button>
              <button type="button" onClick={continueDraft} className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5">
                Continue draft
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function LocalDraftLoading({ title, detail }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-[color:var(--color-accent)]" size={20} />
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
