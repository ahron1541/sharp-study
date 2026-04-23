import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3 } from 'lucide-react';
import { useEffect } from 'react';

export default function StudyGuideEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [2, 3, 4] }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Study guide editor',
        class: 'min-h-[400px] outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content]);

  if (!editor) return null;

  const ToolButton = ({ onClick, active, label, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-[var(--accent)]
                 ${active
                   ? 'bg-[var(--accent)] text-white'
                   : 'hover:bg-[var(--card-border)] text-[var(--muted)]'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-[var(--card-border)] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting toolbar"
        className="flex items-center gap-1 p-2 border-b border-[var(--card-border)]
                   bg-[var(--bg-color)] flex-wrap"
      >
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
        <div className="w-px h-6 bg-[var(--card-border)] mx-1" aria-hidden="true" />
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
        <div className="w-px h-6 bg-[var(--card-border)] mx-1" aria-hidden="true" />
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
      </div>

      {/* Editor area */}
      <div className="p-6 bg-[var(--card-bg)] study-guide-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}