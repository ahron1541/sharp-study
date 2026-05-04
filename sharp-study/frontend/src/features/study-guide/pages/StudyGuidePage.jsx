import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, Eye, Loader2, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Button from '../../../shared/components/Button';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import { sanitizeHtml } from '../../../shared/utils/sanitize';
import TTSButton from '../components/TTSButton';
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

export default function StudyGuidePage() {
  const { id } = useParams();
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState('outline');
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    position: null,
    selectedText: '',
  });

  const contentRef = useRef(null);
  const selectionRangeRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const skeletonTimer = window.setTimeout(() => {
      if (isMounted) setShowLoadingSkeleton(true);
    }, 250);

    const loadGuide = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_guides')
        .select('*')
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
      setGuide({ ...data, content: normalizedContent });
      setContent(normalizedContent);
      setLoading(false);
    };

    loadGuide();

    return () => {
      isMounted = false;
      window.clearTimeout(skeletonTimer);
    };
  }, [id, supabase]);

  const sections = useMemo(() => extractStudyGuideSections(content), [content]);
  const quickReferenceGroups = useMemo(
    () => buildQuickReferenceGroups(sections, guide?.title),
    [sections, guide?.title]
  );
  const discussionQuestions = useMemo(
    () => buildDiscussionQuestions(sections, guide?.title),
    [sections, guide?.title]
  );

  const renderedHtml = useMemo(() => {
    const html = normalizeStudyGuideHtml(content);
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
  }, [content, sections]);

  const plainTextContent = useMemo(() => stripStudyGuideHtml(content), [content]);
  const outlineCards = useMemo(() => sections.filter((section) => section.title), [sections]);

  const jumpToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const save = async () => {
    if (!guide) return;

    setSaving(true);
    const { error } = await supabase
      .from('study_guides')
      .update({ content, title: guide.title })
      .eq('id', id);
    setSaving(false);

    if (!error) {
      toast.success('Study guide saved!');
      setEditing(false);
    } else {
      toast.error('Failed to save.');
    }
  };

  const clearSelectionToolbar = () => {
    selectionRangeRef.current = null;
    setSelectionToolbar({
      visible: false,
      position: null,
      selectedText: '',
    });
  };

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
    const container = contentRef.current;

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

    setContent(container.innerHTML);
    clearSelectionToolbar();
    window.getSelection()?.removeAllRanges();
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
    return <p className="text-center mt-20 text-[color:var(--color-text-muted)]">Guide not found.</p>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: 'Library', href: '/library' },
          { label: guide.title },
        ]}
      />

      <section className="mt-4 rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/library')}
              aria-label="Go back to library"
              className="mt-1 rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">Study guide</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">
                {guide.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--color-text-muted)] sm:text-base">
                The guide is rendered as structured sections, quick references, and discussion questions
                so the text feels easier to scan and easier to study.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <TTSButton text={plainTextContent} />

            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Eye size={16} />}
                  onClick={() => setEditing(false)}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  icon={<Save size={16} />}
                  onClick={save}
                  loading={saving}
                >
                  Save
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                icon={<Edit2 size={16} />}
                onClick={() => {
                  setActiveTab('outline');
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <StudyGuideSidebar sections={sections} onJumpToSection={jumpToSection} />

        <div className="space-y-6">
          <section className="rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-[color:var(--color-surface-2)] p-1">
              {[
                { id: 'outline', label: 'Outline' },
                { id: 'reference', label: 'Quick reference' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-5 py-2 text-sm font-bold transition ${
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
              {activeTab === 'outline' ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-[color:var(--color-text)]">Outline</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reference')}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-2 text-sm font-bold text-[color:var(--color-text)] transition hover:-translate-y-0.5"
                    >
                      Quick reference
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {outlineCards.map((section, index) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => jumpToSection(section.id)}
                        className="group rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                              Section {String(index + 1).padStart(2, '0')}
                            </p>
                            <h3 className="mt-2 text-base font-bold text-[color:var(--color-text)]">
                              {section.title}
                            </h3>
                          </div>
                          <span className="rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-xs font-bold text-[color:var(--color-text-muted)]">
                            Jump
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--color-text-muted)]">
                          {section.summary || 'Open this section to review the full details.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-[color:var(--color-text)]">Quick reference</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('outline')}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-2 text-sm font-bold text-[color:var(--color-text)] transition hover:-translate-y-0.5"
                    >
                      Outline
                    </button>
                  </div>

                  <div className="space-y-4">
                    {quickReferenceGroups.map((group) => (
                      <section
                        key={group.id}
                        className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-[color:var(--color-text)]">{group.label}</h3>
                            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                              Compact review notes for quick studying.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`More actions for ${group.label}`}
                            className="rounded-full p-2 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => jumpToSection(item.id)}
                              className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <p className="text-sm font-bold text-[color:var(--color-text)]">{item.title}</p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">{item.detail}</p>
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

          {activeTab === 'outline' && (
            editing ? (
              <div className="scroll-mt-24">
                <StudyGuideEditor
                  content={content}
                  onChange={setContent}
                  mode="edit"
                />
              </div>
            ) : (
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
                className="study-guide-reader rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8"
              >
                <article
                  className="study-guide-content max-w-none text-[color:var(--color-text)] leading-8"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderedHtml) }}
                />
              </div>
            )
          )}

          {activeTab === 'outline' && !editing && (
            <DiscussionQuestions questions={discussionQuestions} />
          )}
        </div>
      </div>

      <SelectionToolbar
        visible={selectionToolbar.visible}
        position={selectionToolbar.position}
        selectedText={selectionToolbar.selectedText}
        onHighlight={highlightSelection}
        highlightColors={HIGHLIGHT_COLORS}
        onEdit={() => {
          setActiveTab('outline');
          setEditing(true);
        }}
        onClose={clearSelectionToolbar}
      />
    </main>
  );
}

function StudyGuideSkeleton() {
  const card = 'animate-pulse rounded-[1.5rem] bg-[color:var(--color-surface)]/80';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 h-4 w-48 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
      <section className="rounded-[2.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="h-4 w-24 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
            <div className="h-10 w-[min(42rem,80vw)] rounded-2xl bg-[color:var(--color-surface-2)] animate-pulse" />
            <div className="h-4 w-[min(36rem,70vw)] rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-32 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
            <div className="h-11 w-24 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="h-4 w-24 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 rounded-2xl bg-[color:var(--color-surface-2)] animate-pulse" />
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`}>
            <div className="flex gap-2">
              <div className="h-10 w-28 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
              <div className="h-10 w-40 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-28 rounded-[1.5rem] bg-[color:var(--color-surface-2)] animate-pulse" />
              ))}
            </div>
          </section>

          <section className={`${card} p-5 sm:p-6`}>
            <div className="h-6 w-44 rounded-full bg-[color:var(--color-surface-2)] animate-pulse" />
            <div className="mt-5 space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 rounded-[1.5rem] bg-[color:var(--color-surface-2)] animate-pulse" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
