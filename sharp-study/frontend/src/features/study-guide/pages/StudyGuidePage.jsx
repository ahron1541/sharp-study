import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Loader2, PanelLeftClose, PanelLeftOpen, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { sanitizeHtml } from '../../../shared/utils/sanitize';
import StudyGuideEditor from '../components/StudyGuideEditor';
import StudyGuideSidebar from '../components/StudyGuideSidebar';
import SelectionToolbar from '../components/SelectionToolbar';
import DiscussionQuestions from '../components/DiscussionQuestions';
import {
  buildDiscussionQuestions,
  buildQuickReferenceGroups,
  extractStudyGuideSections,
  normalizeStudyGuideHtml,
  stripStudyGuideHtml,
} from '../utils/content';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fde68a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Purple', value: '#ddd6fe' },
  { name: 'Orange', value: '#fed7aa' },
];

const DRAFT_SYNC_DELAY_MS = 2 * 60 * 1000;
const draftStorageKey = (guideId) => `sharp-study-guide-draft:${guideId}`;
const saveLogPrefix = '[StudyGuideDraft]';

function formatRelativeSyncTime(timestamp) {
  if (!timestamp) return 'Not synced yet';

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function StudyGuidePage() {
  const { id } = useParams();
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [savedContent, setSavedContent] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState('guide');
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    position: null,
    selectedText: '',
  });
  const [syncClock, setSyncClock] = useState(0);

  const contentRef = useRef(null);
  const articleRef = useRef(null);
  const selectionRangeRef = useRef(null);
  const utteranceRef = useRef(null);
  const lastSavedContentRef = useRef('');
  const lastLocalSaveAtRef = useRef(0);
  const deferredContent = useDeferredValue(content);

  useEffect(() => {
    let isMounted = true;
    const skeletonTimer = window.setTimeout(() => {
      if (isMounted) setShowLoadingSkeleton(true);
    }, 250);

    const loadGuide = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_guides')
        .select('*, document:documents(title, extracted_text)')
        .eq('id', id)
        .single();

      if (!isMounted) return;
      window.clearTimeout(skeletonTimer);
      setShowLoadingSkeleton(false);

      if (error || !data) {
        setGuide(null);
        setContent('');
        setLoading(false);
        return;
      }

      const normalizedContent = normalizeStudyGuideHtml(data.content);
      let nextContent = normalizedContent;

      try {
        const cachedDraft = localStorage.getItem(draftStorageKey(id));
        if (cachedDraft) {
          const parsedDraft = JSON.parse(cachedDraft);
          if (parsedDraft?.content && parsedDraft.content !== normalizedContent) {
            nextContent = parsedDraft.content;
            setLastSyncedAt(parsedDraft.updatedAt || data.updated_at || data.created_at || null);
            console.info(`${saveLogPrefix} restored cached draft`, { guideId: id, updatedAt: parsedDraft.updatedAt });
          }
        }
      } catch (draftError) {
        console.warn(`${saveLogPrefix} failed to restore local draft`, draftError);
      }

      setGuide({ ...data, content: nextContent });
      setContent(nextContent);
      setSavedContent(normalizedContent);
      lastSavedContentRef.current = normalizedContent;
      setLastSyncedAt(data.updated_at || data.created_at || null);
      setSaveState(nextContent === normalizedContent ? 'saved' : 'cached');
      setLoading(false);
    };

    loadGuide();

    return () => {
      isMounted = false;
      window.clearTimeout(skeletonTimer);
    };
  }, [id, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSyncClock(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const sections = useMemo(() => extractStudyGuideSections(deferredContent), [deferredContent]);
  const lessonText = useMemo(
    () => guide?.document?.extracted_text || stripStudyGuideHtml(deferredContent),
    [deferredContent, guide?.document?.extracted_text]
  );
  const resolvedActiveSectionId = useMemo(
    () => (sections.some((section) => section.id === activeSectionId) ? activeSectionId : sections[0]?.id || ''),
    [sections, activeSectionId]
  );
  const quickReferenceGroups = useMemo(
    () => buildQuickReferenceGroups(sections, lessonText, guide?.document?.title || guide?.title),
    [sections, lessonText, guide?.document?.title, guide?.title]
  );
  const discussionQuestions = useMemo(
    () => buildDiscussionQuestions(sections, lessonText, guide?.document?.title || guide?.title, deferredContent),
    [sections, lessonText, guide?.document?.title, guide?.title, deferredContent]
  );

  const renderedHtml = useMemo(() => {
    const html = normalizeStudyGuideHtml(deferredContent);
    if (!html) return '';

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(doc.body.children);
    let sectionIndex = 0;

    nodes.forEach((node) => {
      if (/^H[1-6]$/.test(node.tagName)) {
        const section = sections[sectionIndex];
        if (section) node.id = section.id;
        sectionIndex += 1;
      }
    });

    return doc.body.innerHTML;
  }, [deferredContent, sections]);
  const sanitizedRenderedHtml = useMemo(() => sanitizeHtml(renderedHtml), [renderedHtml]);

  const plainTextContent = useMemo(() => stripStudyGuideHtml(deferredContent), [deferredContent]);
  const hasPendingChanges = editing && (saving || content !== savedContent);
  const effectiveSaveState = useMemo(() => {
    if (!editing) return saveState;
    if (saving) return 'saving';
    if (saveState === 'error') return 'error';
    return content === savedContent ? 'saved' : 'cached';
  }, [content, editing, saveState, savedContent, saving]);
  const lastSyncLabel = useMemo(() => {
    void syncClock;
    if (effectiveSaveState === 'cached') {
      return `Local draft ${formatRelativeSyncTime(lastSyncedAt)}`;
    }
    if (effectiveSaveState === 'saving') {
      return 'Syncing now';
    }
    if (effectiveSaveState === 'error') {
      return 'Sync failed';
    }
    return `Last sync ${formatRelativeSyncTime(lastSyncedAt)}`;
  }, [effectiveSaveState, lastSyncedAt, syncClock]);

  const stopReading = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const writeDraftToLocalCache = useCallback((nextContent) => {
    if (!id) return;
    try {
      const payload = {
        content: nextContent,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftStorageKey(id), JSON.stringify(payload));
      lastLocalSaveAtRef.current = Date.now();
      setLastSyncedAt(payload.updatedAt);
      console.info(`${saveLogPrefix} draft cached locally`, { guideId: id, bytes: nextContent.length });
    } catch (cacheError) {
      console.warn(`${saveLogPrefix} failed to cache draft locally`, cacheError);
    }
  }, [id]);

  const clearDraftFromLocalCache = useCallback(() => {
    if (!id) return;
    try {
      localStorage.removeItem(draftStorageKey(id));
      console.info(`${saveLogPrefix} cleared local draft cache`, { guideId: id });
    } catch (cacheError) {
      console.warn(`${saveLogPrefix} failed to clear local draft cache`, cacheError);
    }
  }, [id]);

  const handleReadAloud = useCallback(() => {
    if (!window.speechSynthesis) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speaking) {
      stopReading();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(plainTextContent);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [plainTextContent, speaking, stopReading]);

  useEffect(() => {
    return () => stopReading();
  }, [stopReading]);

  const jumpToSection = useCallback((sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      setActiveSectionId(sectionId);
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileSidebarOpen(false);
    }
  }, []);

  const clearSelectionToolbar = useCallback(() => {
    selectionRangeRef.current = null;
    setSelectionToolbar({
      visible: false,
      position: null,
      selectedText: '',
    });
  }, []);

  useEffect(() => {
    if (!renderedHtml || editing) return undefined;

    const headings = Array.from(
      articleRef.current?.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]') || []
    );

    if (!headings.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeading = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visibleHeading?.target?.id) {
          setActiveSectionId(visibleHeading.target.id);
        }
      },
      {
        rootMargin: '-96px 0px -55% 0px',
        threshold: [0.1, 0.5, 1],
      }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [renderedHtml, editing]);

  const save = useCallback(async ({ nextContent = content, exitEditing = false, showToast = true, reason = 'manual' } = {}) => {
    if (!guide) return false;
    if (nextContent === savedContent) {
      setSaveState('saved');
      if (exitEditing) setEditing(false);
      return true;
    }

    setSaving(true);
    setSaveState('saving');
    console.info(`${saveLogPrefix} syncing draft to database`, { guideId: id, reason, size: nextContent.length });

    const { error } = await supabase
      .from('study_guides')
      .update({ content: nextContent, title: guide.title })
      .eq('id', id);

    setSaving(false);

    if (error) {
      setSaveState('error');
      console.error(`${saveLogPrefix} database sync failed`, { guideId: id, reason, error });
      if (showToast) toast.error('Failed to save your study guide.');
      return false;
    }

    lastSavedContentRef.current = nextContent;
    setSavedContent(nextContent);
    setGuide((currentGuide) => (currentGuide ? { ...currentGuide, content: nextContent } : currentGuide));
    setLastSyncedAt(new Date().toISOString());
    setSaveState('saved');
    clearDraftFromLocalCache();
    console.info(`${saveLogPrefix} database sync complete`, { guideId: id, reason });
    if (showToast) toast.success('Study guide saved.');
    if (exitEditing) setEditing(false);
    return true;
  }, [clearDraftFromLocalCache, content, guide, id, savedContent, supabase]);

  const switchToReadMode = useCallback(async () => {
    const saved = await save({ exitEditing: true, showToast: false });
    if (saved) {
      setActiveTab('guide');
      clearSelectionToolbar();
    }
  }, [clearSelectionToolbar, save]);

  useEffect(() => {
    if (!editing) return undefined;
    if (content === savedContent) return undefined;

    const timer = window.setTimeout(() => {
      save({ nextContent: content, showToast: false, reason: 'scheduled-sync' });
    }, DRAFT_SYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [content, editing, save, savedContent]);

  const handleEditorChange = useCallback((nextContent) => {
    setContent(nextContent);
    if (nextContent !== savedContent) {
      setSaveState('cached');
      writeDraftToLocalCache(nextContent);
    }
  }, [savedContent, writeDraftToLocalCache]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasPendingChanges) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  useEffect(() => {
    if (!hasPendingChanges) return undefined;

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
  }, [hasPendingChanges]);

  const requestNavigation = useCallback((nextPath) => {
    if (hasPendingChanges) {
      setPendingNavigation({ kind: 'path', to: nextPath });
      return;
    }

    stopReading();
    navigate(nextPath);
  }, [hasPendingChanges, navigate, stopReading]);

  const showSelectionToolbar = () => {
    if (editing) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (!selection || selection.isCollapsed || !selectedText || !contentRef.current) {
      clearSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      clearSelectionToolbar();
      return;
    }

    selectionRangeRef.current = range;
    const rect = range.getBoundingClientRect();
    setSelectionToolbar({
      visible: true,
      position: {
        top: Math.max(16, rect.top - 56),
        left: Math.max(16, Math.min(window.innerWidth - 300, rect.left)),
      },
      selectedText,
    });
  };

  const highlightSelection = (highlightColor = HIGHLIGHT_COLORS[0].value) => {
    const range = selectionRangeRef.current;
    const container = articleRef.current;

    if (!range || !container) {
      clearSelectionToolbar();
      return;
    }

    const mark = document.createElement('mark');
    mark.className = 'study-guide-highlight';
    mark.setAttribute('data-highlight-color', highlightColor);

    try {
      range.surroundContents(mark);
    } catch {
      const extracted = range.extractContents();
      mark.appendChild(extracted);
      range.insertNode(mark);
    }

    const updatedContent = container.innerHTML;
    setContent(updatedContent);
    writeDraftToLocalCache(updatedContent);
    setSaveState('cached');
    clearSelectionToolbar();
    window.getSelection()?.removeAllRanges();
  };

  const handleDiscardAndLeave = () => {
    stopReading();
    if (pendingNavigation?.kind === 'path') {
      navigate(pendingNavigation.to);
    }
    setPendingNavigation(null);
  };

  const handleSaveAndLeave = async () => {
    const saved = await save({ showToast: false, reason: 'navigation-sync' });
    if (!saved) return;

    stopReading();
    if (pendingNavigation?.kind === 'path') {
      navigate(pendingNavigation.to);
    }
    setPendingNavigation(null);
  };

  const handleStayEditing = () => {
    setPendingNavigation(null);
  };

  if (loading) {
    return showLoadingSkeleton ? (
      <StudyGuideSkeleton />
    ) : (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-10 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[color:var(--color-accent)]/20" />
            <Loader2 className="relative animate-spin text-[color:var(--color-accent)]" size={28} />
          </div>
          <p className="text-sm font-bold text-[color:var(--color-text)]">Loading study guide...</p>
        </div>
      </div>
    );
  }

  if (!guide) {
    return <p className="mt-20 text-center text-[color:var(--color-text-muted)]">Guide not found.</p>;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb
          items={[
            { label: 'Library', href: '/library' },
            { label: guide.title },
          ]}
        />

        <section className="study-guide-fade-up mt-4 rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/96 p-5 shadow-[0_20px_65px_rgba(15,23,42,0.1)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => requestNavigation('/library')}
              aria-label="Go back to library"
              className="mt-1 rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">Study guide</p>
              <h1 className="mt-2 text-[clamp(2.2rem,3.5vw,3.85rem)] font-black leading-[1.05] text-[color:var(--color-text)]">
                {guide.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--color-text-muted)] sm:text-base">
                Built from the uploaded lesson and shaped for cleaner reading, quicker review, and steadier focus.
              </p>
            </div>
          </div>
        </section>

        {!editing && (
          <div
            className="mt-6 grid items-start gap-6 transition-[grid-template-columns] duration-300 lg:grid-cols-[var(--study-guide-sidebar-width)_minmax(0,1fr)]"
            style={{ '--study-guide-sidebar-width': sidebarCollapsed ? '92px' : '296px' }}
          >
            <div className="space-y-4 lg:self-start">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((value) => !value)}
                className="study-guide-fade-up flex w-full items-center justify-between rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-left shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:hidden"
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Contents</p>
                  <p className="mt-1 text-sm font-bold text-[color:var(--color-text)]">
                    {resolvedActiveSectionId ? sections.find((section) => section.id === resolvedActiveSectionId)?.title || 'Open headings' : 'Open headings'}
                  </p>
                </div>
                {mobileSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>

              <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} lg:block`}>
                <StudyGuideSidebar
                  sections={sections}
                  onJumpToSection={jumpToSection}
                  activeSectionId={resolvedActiveSectionId}
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
                />
              </div>
            </div>

            <div className="space-y-6">
              <section className="study-guide-fade-up rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
                <div className="flex flex-wrap items-center gap-2 rounded-full bg-[color:var(--color-surface-2)] p-1">
                  {[
                    { id: 'guide', label: 'Study guide' },
                    { id: 'reference', label: 'Key references' },
                  ].map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${
                          active
                            ? 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm'
                            : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  {activeTab === 'guide' ? (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-2xl font-black text-[color:var(--color-text)]">Study guide</h2>
                        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                          The contents rail stays with you as you read deeper into the lesson.
                        </p>
                      </div>

                      <div
                        ref={contentRef}
                        onMouseUp={showSelectionToolbar}
                        onKeyUp={showSelectionToolbar}
                        onBlur={() => {
                          window.setTimeout(() => {
                            if (!window.getSelection()?.toString()) {
                              clearSelectionToolbar();
                            }
                          }, 120);
                        }}
                        className="study-guide-reader study-guide-fade-up rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-8 sm:py-8"
                      >
                        <article
                          ref={articleRef}
                          className="study-guide-content max-w-none text-[color:var(--color-text)]"
                          dangerouslySetInnerHTML={{ __html: sanitizedRenderedHtml }}
                        />
                      </div>

                      <DiscussionQuestions questions={discussionQuestions} />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-2xl font-black text-[color:var(--color-text)]">Key references</h2>
                        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                          These reference cards shift with the uploaded lesson instead of staying fixed.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {quickReferenceGroups.map((group) => (
                          <section
                            key={group.id}
                            className="study-guide-reference-card study-guide-fade-up rounded-[1.6rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/65 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                          >
                            <div>
                              <h3 className="text-lg font-black text-[color:var(--color-text)]">{group.label}</h3>
                              <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                                Lesson-based notes for quick studying.
                              </p>
                            </div>

                            <div className="mt-4 grid items-start gap-3 sm:grid-cols-2">
                              {group.items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('guide');
                                    window.setTimeout(() => jumpToSection(item.id), 50);
                                  }}
                                  className="h-auto self-start rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left align-top transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                                >
                                  <p className="text-sm font-bold text-[color:var(--color-text)]">{item.title}</p>
                                  {item.entries?.length ? (
                                    item.format === 'ordered' ? (
                                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[color:var(--color-text-muted)]">
                                        {item.entries.map((entry, index) => (
                                          <li key={`${item.id}-entry-${index}`}>{entry}</li>
                                        ))}
                                      </ol>
                                    ) : (
                                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[color:var(--color-text-muted)]">
                                        {item.entries.map((entry, index) => (
                                          <li key={`${item.id}-entry-${index}`}>{entry}</li>
                                        ))}
                                      </ul>
                                    )
                                  ) : (
                                    <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">{item.detail}</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {editing && (
          <div className="mx-auto mt-6 max-w-6xl">
            <section className="study-guide-fade-up rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="mb-5">
                <h2 className="text-2xl font-black text-[color:var(--color-text)]">Edit study guide</h2>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                  The reading toggle and contents rail are hidden while you edit so the guide stays centered.
                </p>
              </div>

              <StudyGuideEditor
                content={content}
                onChange={handleEditorChange}
                saveState={effectiveSaveState}
                lastSyncLabel={lastSyncLabel}
                onSave={() => save({ showToast: true, reason: 'toolbar-save' })}
                onRead={handleReadAloud}
                onPreview={switchToReadMode}
                saving={saving}
              />
            </section>
          </div>
        )}

        {!editing && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/94 p-3 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReadAloud}
                  className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-all duration-200 ${
                    speaking
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]'
                  }`}
                >
                  {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  <span>{speaking ? 'Stop reading' : 'Read aloud'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('guide');
                    setEditing(true);
                  }}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 text-sm font-bold text-[color:var(--color-accent-text)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95"
                >
                  <Edit2 size={18} />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <SelectionToolbar
          visible={!editing && selectionToolbar.visible}
          position={selectionToolbar.position}
          selectedText={selectionToolbar.selectedText}
          onHighlight={highlightSelection}
          highlightColors={HIGHLIGHT_COLORS}
          onEdit={() => {
            setActiveTab('guide');
            setEditing(true);
          }}
          onClose={clearSelectionToolbar}
        />
      </main>

      <Modal
        isOpen={Boolean(pendingNavigation)}
        onClose={handleStayEditing}
        title="Save your progress?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[var(--text-color)]">
            You still have study guide changes in progress. Save before leaving, discard them, or stay in edit mode.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleStayEditing}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm font-bold text-[var(--text-color)] transition hover:bg-[var(--card-bg)]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={handleDiscardAndLeave}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm font-bold text-[var(--muted)] transition hover:bg-[var(--card-bg)]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveAndLeave}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Save and leave
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function StudyGuideSkeleton() {
  const card = 'study-guide-skeleton-shimmer animate-pulse rounded-[1.5rem] bg-[color:var(--color-surface)]/80';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="study-guide-skeleton-shimmer mb-4 h-4 w-48 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
      <section className="rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="space-y-4">
          <div className="study-guide-skeleton-shimmer h-4 w-24 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
          <div className="study-guide-skeleton-shimmer h-10 w-[min(42rem,80vw)] animate-pulse rounded-2xl bg-[color:var(--color-surface-2)]" />
          <div className="study-guide-skeleton-shimmer h-4 w-[min(36rem,70vw)] animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="study-guide-skeleton-shimmer h-4 w-24 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="study-guide-skeleton-shimmer h-14 rounded-2xl bg-[color:var(--color-surface-2)] animate-pulse" />
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`}>
            <div className="study-guide-skeleton-shimmer h-10 w-44 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
            <div className="mt-5 space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="study-guide-skeleton-shimmer h-36 rounded-[1.5rem] bg-[color:var(--color-surface-2)] animate-pulse" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
