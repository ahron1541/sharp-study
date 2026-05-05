import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Heading from '@tiptap/extension-heading';
import {
  AlertCircle,
  Bold,
  Check,
  Cloud,
  FileCode2,
  Eye,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Save,
  Table,
  Undo2,
  Volume2,
} from 'lucide-react';
import { useEffect } from 'react';
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
      'data-highlight-color': {
        default: 'yellow',
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
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
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
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
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
}) {
  const initialContent = starterContent || content || createInstructionalStudyGuideTemplate();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [2, 3, 4] }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'study-guide-code-block',
        },
      }),
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
      .insertContent(`
        <table>
          <thead>
            <tr>
              <th>Heading 1</th>
              <th>Heading 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Detail</td>
              <td>Detail</td>
            </tr>
            <tr>
              <td>Detail</td>
              <td>Detail</td>
            </tr>
          </tbody>
        </table>
      `)
      .run();
  };

  const insertCodeSnippet = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        content: [
          {
            type: 'text',
            text: '// Code snippet only. This is displayed as text and never executed.\nSELECT * FROM study_guides WHERE id = "example";',
          },
        ],
      })
      .run();
  };

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
            <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold ${saveStatusMeta.className}`}>
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
                  <Table size={16} />
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-surface-2)] px-3 py-2 text-xs font-bold text-[color:var(--color-text-muted)]">
                  <Highlighter size={14} />
                  <span>Highlight</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor.chain().focus().setMark('highlight', { 'data-highlight-color': color.value }).run();
                      }}
                      disabled={saving}
                      className="h-9 w-9 rounded-2xl border border-black/10 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Highlight with ${color.name}`}
                      title={color.name}
                      style={{ backgroundColor: color.swatch }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <ToolbarAction label="Read aloud" icon={<Volume2 size={16} />} onClick={onRead} disabled={saving} />
              <ToolbarAction label="Read mode" icon={<Eye size={16} />} onClick={onPreview} disabled={saving} />
              <ToolbarAction
                label={saving ? 'Saving to cloud...' : saveState === 'cached' ? 'Sync now' : 'Save'}
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
        <div className="mb-5 rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/75 p-4 text-sm leading-6 text-[color:var(--color-text-muted)]">
          Edit freely while the guide autosaves every 5 seconds. Use larger headings for main sections and smaller headings for subtopics.
        </div>

        <div className="study-guide-editor-scroll h-[calc(100%-5.5rem)] overflow-y-auto pr-2">
          <div className="study-guide-editor rounded-[1.75rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/35 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-6 sm:py-6">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
