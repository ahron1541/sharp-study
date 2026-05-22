import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { apiRequest } from '../../../config/api';
import { sanitizeHtml, sanitizePlainText } from '../../../shared/utils/sanitize';
import { useAuth } from '../../auth/context/AuthContext';
import XpNotice from '../../gamification/components/XpNotice';
import StudyGuideEditor from '../components/StudyGuideEditor';
import { createInstructionalStudyGuideTemplate } from '../utils/content';

const EMPTY_EDITOR = createInstructionalStudyGuideTemplate();
const draftStorageKey = (userId) => `sharp-study-manual-study-guide-draft:${userId || 'guest'}`;

function hasDraftContent(draft) {
  return Boolean(draft?.title?.trim()) || Boolean(draft?.content && draft.content !== EMPTY_EDITOR);
}

function saveDraftToLocalStorage(userId, draft) {
  const sanitizedDraft = {
    title: sanitizePlainText(draft.title || '').slice(0, 180),
    content: sanitizeHtml(draft.content || EMPTY_EDITOR),
    updatedAt: new Date().toISOString(),
  };

  if (!hasDraftContent(sanitizedDraft)) {
    localStorage.removeItem(draftStorageKey(userId));
    return;
  }

  localStorage.setItem(draftStorageKey(userId), JSON.stringify(sanitizedDraft));
}

export default function StudyGuideCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(null);
  const [draftAction, setDraftAction] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const browserBackGuardActiveRef = useRef(false);
  const allowBrowserBackRef = useRef(false);

  const hasChanges = useMemo(
    () => title.trim().length > 0 || content !== EMPTY_EDITOR,
    [content, title]
  );

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
          title: sanitizePlainText(parsedDraft?.title || '').slice(0, 180),
          content: sanitizeHtml(parsedDraft?.content || EMPTY_EDITOR),
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
      saveDraftToLocalStorage(user?.id, { title, content });
    } catch (error) {
      console.warn('[StudyGuideCreateDraft] Failed to save local draft.', error);
    }
  }, [content, draftAction, draftReady, restoredDraft, saving, title, user?.id]);

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

  useEffect(() => {
    if (!hasChanges || saving) return undefined;

    if (!browserBackGuardActiveRef.current) {
      window.history.pushState({ sharpStudyGuard: 'study-guide-create' }, '', window.location.href);
      browserBackGuardActiveRef.current = true;
    }

    const handlePopState = () => {
      if (allowBrowserBackRef.current) return;
      browserBackGuardActiveRef.current = false;
      setPendingNavigation({ kind: 'browser-back' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasChanges, saving]);

  const restoreBrowserBackGuard = useCallback(() => {
    if (!hasChanges || saving || browserBackGuardActiveRef.current) return;
    window.history.pushState({ sharpStudyGuard: 'study-guide-create' }, '', window.location.href);
    browserBackGuardActiveRef.current = true;
  }, [hasChanges, saving]);

  const clearLocalDraft = useCallback(() => {
    localStorage.removeItem(draftStorageKey(user?.id));
  }, [user?.id]);

  const requestNavigation = useCallback((nextPath) => {
    if (hasChanges && !saving) {
      setPendingNavigation({ kind: 'path', to: nextPath });
      return;
    }

    navigate(nextPath);
  }, [hasChanges, navigate, saving]);

  useEffect(() => {
    if (!hasChanges || saving) return undefined;

    const handleDocumentClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link) return;
      if (link.target && link.target !== '_self') return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({ kind: 'path', to: nextPath });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasChanges, saving]);

  const handleCreate = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Please add a title.');
      return;
    }

    if (!user?.id) {
      toast.error('You need to be logged in to create a study guide.');
      return;
    }

    setSaving(true);
    try {
      const sanitizedContent = sanitizeHtml(content);
      const response = await apiRequest('/api/study-guides', {
        method: 'POST',
        body: JSON.stringify({
          title: cleanTitle,
          content: sanitizedContent,
        }),
      });

      toast.success('Study guide created.');
      clearLocalDraft();
      navigate(`/study-guide/${response.item.id}`);
    } catch (createError) {
      toast.error(createError.message || 'Failed to create your study guide.');
      setSaving(false);
    }
  };

  const continueDraft = () => {
    if (!restoredDraft) return;
    setDraftAction({
      title: 'Restoring your draft',
      detail: 'Loading the locally saved title and editor content back into this page.',
    });
    window.setTimeout(() => {
      setTitle(restoredDraft.title || '');
      setContent(restoredDraft.content || EMPTY_EDITOR);
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Draft restored.');
    }, 450);
  };

  const discardDraft = () => {
    setDraftAction({
      title: 'Discarding local draft',
      detail: 'Removing the saved browser draft and preparing a blank study guide.',
    });
    window.setTimeout(() => {
      clearLocalDraft();
      setTitle('');
      setContent(EMPTY_EDITOR);
      setRestoredDraft(null);
      setDraftAction(null);
      toast.success('Local draft discarded.');
    }, 450);
  };

  const stayOnPage = () => {
    if (pendingNavigation?.kind === 'browser-back') {
      restoreBrowserBackGuard();
    }
    setPendingNavigation(null);
  };

  const discardAndLeave = () => {
    clearLocalDraft();
    setPendingNavigation(null);

    if (pendingNavigation?.kind === 'browser-back') {
      allowBrowserBackRef.current = true;
      window.history.back();
      return;
    }

    if (pendingNavigation?.kind === 'path') {
      navigate(pendingNavigation.to);
    }
  };

  return (
    <>
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: 'Library', href: '/library' },
          { label: 'New study guide' },
        ]}
      />

      <section className="mt-4 rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <button
              type="button"
              onClick={() => requestNavigation('/library')}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
            >
              <ArrowLeft size={16} />
              Back to library
            </button>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">Manual creation</p>
            <h1 className="mt-3 text-[clamp(2.3rem,4vw,4.1rem)] font-black leading-none text-[color:var(--color-text)]">
              Build a study guide in a full-page editor.
            </h1>
            <p className="mt-4 text-sm leading-7 text-[color:var(--color-text-muted)] sm:text-base">
              This layout gives you more room than a modal, keeps the editor centered, and stays comfortable in both light and dark mode.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-start">
            <XpNotice title="Creating a study guide counts as study progress.">
              After the guide saves successfully, it can count for your daily study streak and daily XP. Drafts only count when they are created on the server.
            </XpNotice>
            <div className="rounded-[1.6rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/80 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Writing tips</p>
              <p className="mt-2 max-w-sm text-sm leading-7 text-[color:var(--color-text-muted)]">
                Use short headings, bold keywords, and a quick review section so the final guide is easier to scan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <label className="block">
            <span className="mb-3 block text-sm font-bold text-[color:var(--color-text)]">Study guide title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={saving || Boolean(restoredDraft) || Boolean(draftAction)}
              placeholder="Ex. Biology Chapter 4 Reviewer"
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 font-bold text-[color:var(--color-text)] outline-none transition-colors duration-200 focus:border-[color:var(--color-accent)]"
            />
          </label>
        </div>

        <StudyGuideEditor
          content={content}
          onChange={setContent}
          starterContent={EMPTY_EDITOR}
          saveState={saving ? 'saving' : hasChanges ? 'cached' : 'saved'}
          lastSyncLabel={saving ? 'Creating your study guide now' : 'Saved only after you press Create study guide'}
          onSave={handleCreate}
          onRead={() => {}}
          onPreview={() => {}}
          saving={saving}
          showReadActions={false}
          saveActionLabel="Create study guide"
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => requestNavigation('/library')}
            disabled={saving || Boolean(draftAction)}
            className="rounded-2xl px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || Boolean(restoredDraft) || Boolean(draftAction)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-6 py-3 font-bold text-[color:var(--color-accent-text)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Create study guide
          </button>
        </div>

        <div className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[color:var(--color-text)]">Want AI to start the draft instead?</h2>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">
                Go back to the library and choose the Gemini AI generation flow if you already have a document ready.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <Modal
      isOpen={Boolean(restoredDraft) || Boolean(draftAction)}
      onClose={() => {}}
      title={draftAction ? draftAction.title : 'Continue your unsaved draft?'}
      size="md"
      closeOnBackdrop={false}
      closeOnEscape={false}
      showCloseButton={false}
    >
      {draftAction ? (
        <LocalDraftLoading title={draftAction.title} detail={draftAction.detail} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">
            A study guide draft was saved only in this browser. You can continue where you left off or discard it and start fresh.
          </p>
          <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
            <p className="text-sm font-black text-[color:var(--color-text)]">{restoredDraft?.title || 'Untitled study guide'}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
              Local draft {restoredDraft?.updatedAt ? new Date(restoredDraft.updatedAt).toLocaleString() : 'saved recently'}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={continueDraft}
              className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5"
            >
              Continue draft
            </button>
          </div>
        </div>
      )}
    </Modal>
    <Modal
      isOpen={Boolean(pendingNavigation)}
      onClose={stayOnPage}
      title="Leave study guide?"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">
          Your study guide is not created yet. You can stay on this page, create it now, or discard the draft and leave.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={discardAndLeave}
            className="rounded-2xl border border-rose-500/40 px-5 py-3 font-bold text-rose-500 transition hover:bg-rose-500/10"
          >
            Discard and leave
          </button>
          <button
            type="button"
            onClick={stayOnPage}
            className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)]"
          >
            Stay on page
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || Boolean(restoredDraft) || Boolean(draftAction)}
            className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create study guide
          </button>
        </div>
      </div>
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
