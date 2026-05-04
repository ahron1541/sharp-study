import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../auth/context/AuthContext';
import Button from '../../../shared/components/Button';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Spinner from '../../../shared/components/Spinner';
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
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    position: null,
    selectedText: '',
  });

  const contentRef = useRef(null);
  const selectionRangeRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadGuide = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('id', id)
        .single();

      if (!isMounted) return;

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
    return (
      <div className="flex justify-center mt-20">
        <Spinner size="lg" />
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
                onClick={() => setEditing(true)}
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
          <section className="rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[color:var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">Inside the guide</p>
                <h2 className="mt-2 text-2xl font-black text-[color:var(--color-text)]">Outline</h2>
              </div>
              <p className="text-sm text-[color:var(--color-text-muted)]">
                Tap any item to jump to that section.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
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
          </section>

          <section className="rounded-[2.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[color:var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">Inside the guide</p>
                <h2 className="mt-2 text-2xl font-black text-[color:var(--color-text)]">Quick reference</h2>
              </div>
              <p className="text-sm text-[color:var(--color-text-muted)]">
                A compact review area for fast studying.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {quickReferenceGroups.map((group) => (
                <details
                  key={group.id}
                  className="group rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
                    <div>
                      <h3 className="text-lg font-black text-[color:var(--color-text)]">{group.label}</h3>
                      <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                        Tap to collapse or expand the review notes.
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-xs font-bold text-[color:var(--color-text-muted)] transition group-open:rotate-180">
                      More
                    </span>
                  </summary>

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
                </details>
              ))}
            </div>
          </section>

          {editing ? (
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
          )}

          {!editing && (
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
        onEdit={() => setEditing(true)}
        onClose={clearSelectionToolbar}
      />
    </main>
  );
}
