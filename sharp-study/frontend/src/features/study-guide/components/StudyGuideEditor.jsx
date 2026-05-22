import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Heading from '@tiptap/extension-heading';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import {
  AlertCircle,
  Bold,
  Check,
  Cloud,
  Columns3,
  Eraser,
  FileCode2,
  Eye,
  Heading2,
  Heading3,
  Highlighter,
  Info,
  Italic,
  List,
  ListOrdered,
  Minus,
  PanelTop,
  Quote,
  Redo2,
  Rows3,
  Save,
  Table as TableIcon,
  Trash2,
  Undo2,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { createInstructionalStudyGuideTemplate } from '../utils/content';

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'yellow', swatch: '#fde68a' },
  { name: 'Green', value: 'green', swatch: '#bbf7d0' },
  { name: 'Blue', value: 'blue', swatch: '#bfdbfe' },
  { name: 'Pink', value: 'pink', swatch: '#fbcfe8' },
  { name: 'Purple', value: 'purple', swatch: '#ddd6fe' },
  { name: 'Orange', value: 'orange', swatch: '#fed7aa' },
];

const Highlight = Mark.create({
  name: 'highlight',

  addAttributes() {
    return {
      color: {
        default: 'yellow',
        parseHTML: (element) => element.getAttribute('data-highlight-color') || 'yellow',
        renderHTML: (attributes) => ({
          'data-highlight-color': attributes.color || 'yellow',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },
});

function ToolButton({ onClick, active, disabled = false, label, children }) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-[transform,background-color,color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] shadow-sm'
          : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:-translate-y-0.5 hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarAction({ label, icon, onClick, variant = 'secondary', disabled = false }) {
  const styles = {
    primary: 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] hover:opacity-95',
    secondary: 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]',
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-[transform,background-color,color,border-color,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BadgeIcon({ icon, badge }) {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      {icon}
      <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[color:var(--color-accent)] px-0.5 text-[0.55rem] font-black leading-none text-[color:var(--color-accent-text)]">
        {badge}
      </span>
    </span>
  );
}

export default function StudyGuideEditor({
  content,
  onChange,
  starterContent,
  saveState = 'saved',
  lastSyncLabel = '',
  onSave,
  onRead,
  onPreview,
  saving = false,
  showReadActions = true,
  saveActionLabel,
}) {
  const initialContent = starterContent || content || createInstructionalStudyGuideTemplate();
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Heading.configure({ levels: [2, 3, 4] }),
      CodeBlock.configure({
        defaultLanguage: 'python',
        HTMLAttributes: {
          class: 'study-guide-code-block',
        },
      }),
      TableExtension.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: 'study-guide-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Study guide editor',
        class: 'min-h-[520px] outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && content && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  if (!editor) return null;

  const insertTableTemplate = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const insertCodeSnippet = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: {
          language: 'python',
        },
        content: [
          {
            type: 'text',
            text: '# Python example only - displayed as text\nprint("Hello, world!")',
          },
        ],
      })
      .run();
  };

  const inTable = editor.isActive('table');

  const saveStatusMeta = {
    saved: {
      icon: <Check size={14} />,
      label: 'Autosaved',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    saving: {
      icon: <Cloud size={14} />,
      label: 'Saving...',
      className: 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]',
    },
    unsaved: {
      icon: <Cloud size={14} />,
      label: 'Unsaved changes',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
    },
    cached: {
      icon: <Cloud size={14} />,
      label: 'Cached locally',
      className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300',
    },
    error: {
      icon: <AlertCircle size={14} />,
      label: 'Save failed',
      className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
    },
  }[saveState] || {
    icon: <Cloud size={14} />,
    label: 'Ready',
    className: 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]',
  };

  return (
    <div className="study-guide-editor-shell flex h-[calc(100vh-17rem)] min-h-[36rem] flex-col overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[0_20px_55px_rgba(15,23,42,0.1)]">
      <div
        className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/96 px-4 py-3 backdrop-blur-xl sm:px-5"
        role="toolbar"
        aria-label="Study guide editor toolbar"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold ${saveStatusMeta.className}`}
              role="status"
              aria-live="polite"
            >
              {saveStatusMeta.icon}
              <span>{saveStatusMeta.label}</span>
            </div>
            {lastSyncLabel ? (
              <div className="inline-flex items-center rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                {lastSyncLabel}
              </div>
            ) : null}
            <div className="hidden text-xs font-medium text-[color:var(--color-text-muted)] sm:block">
              The editor stays pinned while the text scrolls below.
            </div>
            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-xs font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
              aria-label="Open editor notice"
              title="Open editor notice"
            >
              <Info size={14} aria-hidden="true" />
              <span>Notice</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className={`flex min-w-0 flex-col gap-3 ${saving ? 'pointer-events-none opacity-70' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <ToolButton
                  label="Undo"
                  onClick={() => editor.chain().focus().undo().run()}
                  active={false}
                  disabled={saving || !editor.can().chain().focus().undo().run()}
                >
                  <Undo2 size={16} />
                </ToolButton>
                <ToolButton
                  label="Redo"
                  onClick={() => editor.chain().focus().redo().run()}
                  active={false}
                  disabled={saving || !editor.can().chain().focus().redo().run()}
                >
                  <Redo2 size={16} />
                </ToolButton>
                <ToolButton
                  label="Bold"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  active={editor.isActive('bold')}
                  disabled={saving}
                >
                  <Bold size={16} />
                </ToolButton>
                <ToolButton
                  label="Italic"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  active={editor.isActive('italic')}
                  disabled={saving}
                >
                  <Italic size={16} />
                </ToolButton>
                <ToolButton
                  label="Heading 2"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  active={editor.isActive('heading', { level: 2 })}
                  disabled={saving}
                >
                  <Heading2 size={16} />
                </ToolButton>
                <ToolButton
                  label="Heading 3"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  active={editor.isActive('heading', { level: 3 })}
                  disabled={saving}
                >
                  <Heading3 size={16} />
                </ToolButton>
                <ToolButton
                  label="Bullet list"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  active={editor.isActive('bulletList')}
                  disabled={saving}
                >
                  <List size={16} />
                </ToolButton>
                <ToolButton
                  label="Numbered list"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  active={editor.isActive('orderedList')}
                  disabled={saving}
                >
                  <ListOrdered size={16} />
                </ToolButton>
                <ToolButton
                  label="Block quote"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  active={editor.isActive('blockquote')}
                  disabled={saving}
                >
                  <Quote size={16} />
                </ToolButton>
                <ToolButton
                  label="Horizontal rule"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  active={false}
                  disabled={saving}
                >
                  <Minus size={16} />
                </ToolButton>
                <ToolButton
                  label="Insert table"
                  onClick={insertTableTemplate}
                  active={false}
                  disabled={saving}
                >
                  <TableIcon size={16} />
                </ToolButton>
                <ToolButton
                  label="Insert code snippet"
                  onClick={insertCodeSnippet}
                  active={editor.isActive('codeBlock')}
                  disabled={saving}
                >
                  <FileCode2 size={16} />
                </ToolButton>
              </div>

              {inTable ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[1.35rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/70 p-2">
                  <div className="inline-flex items-center gap-2 px-2 text-xs font-bold text-[color:var(--color-text-muted)]">
                    <TableIcon size={14} />
                    <span>Table</span>
                  </div>
                  <ToolButton
                    label="Add row below"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    active={false}
                    disabled={saving}
                  >
                    <BadgeIcon icon={<Rows3 size={16} />} badge="+" />
                  </ToolButton>
                  <ToolButton
                    label="Add column right"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    active={false}
                    disabled={saving}
                  >
                    <BadgeIcon icon={<Columns3 size={16} />} badge="+" />
                  </ToolButton>
                  <ToolButton
                    label="Delete current row"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    active={false}
                    disabled={saving}
                  >
                    <BadgeIcon icon={<Rows3 size={16} />} badge="-" />
                  </ToolButton>
                  <ToolButton
                    label="Delete current column"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    active={false}
                    disabled={saving}
                  >
                    <BadgeIcon icon={<Columns3 size={16} />} badge="-" />
                  </ToolButton>
                  <ToolButton
                    label="Toggle header row"
                    onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                    active={false}
                    disabled={saving}
                  >
                    <PanelTop size={16} />
                  </ToolButton>
                  <ToolButton
                    label="Delete table"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    active={false}
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                  </ToolButton>
                </div>
              ) : null}

              <div className="relative flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHighlightOpen((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-surface-2)] px-3 py-2 text-xs font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-border)] hover:text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                  aria-expanded={highlightOpen}
                  aria-controls="study-guide-highlight-colors"
                  aria-label="Toggle highlight colors"
                  disabled={saving}
                >
                  <Highlighter size={14} aria-hidden="true" />
                  <span>Highlight</span>
                </button>
                {highlightOpen ? (
                  <div
                    id="study-guide-highlight-colors"
                    className="absolute left-0 top-11 z-30 flex w-[min(19rem,calc(100vw_-_2rem))] flex-wrap items-center gap-2 rounded-[1.35rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 shadow-[0_18px_44px_rgba(15,23,42,0.18)]"
                  >
                    {HIGHLIGHT_COLORS.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          editor.chain().focus().setMark('highlight', { color: color.value }).run();
                        }}
                        disabled={saving}
                        className="h-9 w-9 rounded-2xl border border-black/10 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Highlight selected text with ${color.name}`}
                        title={`Highlight selected text with ${color.name}`}
                        style={{ backgroundColor: color.swatch }}
                      />
                    ))}
                    <ToolButton
                      label="Remove highlight"
                      onClick={() => editor.chain().focus().unsetMark('highlight').run()}
                      active={editor.isActive('highlight')}
                      disabled={saving}
                    >
                      <Eraser size={16} />
                    </ToolButton>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {showReadActions ? <ToolbarAction label="Read aloud" icon={<Volume2 size={16} />} onClick={onRead} disabled={saving} /> : null}
              {showReadActions ? <ToolbarAction label="Read mode" icon={<Eye size={16} />} onClick={onPreview} disabled={saving} /> : null}
              <ToolbarAction
                label={saving ? 'Saving to cloud...' : saveActionLabel || (saveState === 'cached' ? 'Sync now' : 'Save')}
                icon={<Save size={16} />}
                onClick={onSave}
                variant="primary"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[color:var(--color-surface)] px-5 py-6 sm:px-7 sm:py-7">
        <div className="study-guide-panel-sheen pointer-events-none absolute inset-x-6 top-0 h-px" />

        <div className="study-guide-editor-scroll h-full overflow-y-auto pr-2">
          <div className="study-guide-editor rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/35 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-6 sm:py-6">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title="Editor notice"
        size="md"
      >
        <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">
          Edit freely while your draft is cached locally right away and synced to the cloud after a short pause. Use larger headings for main sections and smaller headings for subtopics.
        </p>
      </Modal>
    </div>
  );
}
