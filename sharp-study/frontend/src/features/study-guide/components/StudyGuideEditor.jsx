import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import {
  Bold,
  ChevronDown,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Eraser,
  Italic,
} from 'lucide-react';
import { useEffect } from 'react';
import { createInstructionalStudyGuideTemplate } from '../utils/content';

function ToolButton({ onClick, active, label, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-[color:var(--color-accent)]
                 ${active
                   ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)]'
                   : 'hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)]'}`}
    >
      {children}
    </button>
  );
}

export default function StudyGuideEditor({
  content,
  onChange,
  mode = 'edit',
  starterContent,
}) {
  const initialContent = starterContent || content || createInstructionalStudyGuideTemplate();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [2, 3, 4] }),
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

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting toolbar"
        className="sticky top-0 z-20 flex items-center gap-1 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-3 py-2 backdrop-blur-md flex-wrap"
      >
        <div className="mr-1 flex items-center gap-2 rounded-full bg-[color:var(--color-surface-2)] px-3 py-2 text-sm font-bold text-[color:var(--color-text)]">
          <span>{mode === 'create' ? 'Create mode' : 'Edit mode'}</span>
          <ChevronDown size={14} />
        </div>
        <ToolButton
          label="Bold (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold size={16} />
        </ToolButton>
        <ToolButton
          label="Italic (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic size={16} />
        </ToolButton>
        <div className="w-px h-6 bg-[color:var(--color-border)] mx-1" aria-hidden="true" />
        <ToolButton
          label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 size={16} />
        </ToolButton>
        <ToolButton
          label="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 size={16} />
        </ToolButton>
        <div className="w-px h-6 bg-[color:var(--color-border)] mx-1" aria-hidden="true" />
        <ToolButton
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List size={16} />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered size={16} />
        </ToolButton>
        <ToolButton
          label="Block quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          <Quote size={16} />
        </ToolButton>
        <ToolButton
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          active={false}
        >
          <Minus size={16} />
        </ToolButton>
        <ToolButton
          label="Clear formatting"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          active={false}
        >
          <Eraser size={16} />
        </ToolButton>
      </div>

      {/* Editor area */}
      <div className="relative bg-[color:var(--color-surface)] px-5 py-6 sm:px-6">
        {mode === 'create' && (
          <div className="mb-5 rounded-[1.5rem] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 text-sm leading-6 text-[color:var(--color-text-muted)]">
            Start with headings, then add short bullet points and bold the important terms.
            The template already includes a structure, so the user only needs to replace the prompts.
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
