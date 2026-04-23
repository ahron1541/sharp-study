import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Edit2, Eye, List } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { sanitizeHtml } from '../../../shared/utils/sanitize';
import Navbar from '../../../shared/components/Navbar';
import Button from '../../../shared/components/Button';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import TTSButton from '../components/TTSButton';
import StudyGuideEditor from '../components/StudyGuideEditor';
import TableOfContents from '../components/TableOfContents';
import Spinner from '../../../shared/components/Spinner';
import toast from 'react-hot-toast';

export default function StudyGuidePage() {
  const { id } = useParams();
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [history, setHistory] = useState([]); // undo stack
  const [future, setFuture] = useState([]);   // redo stack

  useEffect(() => {
    supabase
      .from('study_guides')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) { setGuide(data); setContent(data.content); }
        setLoading(false);
      });
  }, [id, supabase]);

  const handleContentChange = (newContent) => {
    setHistory((prev) => [...prev.slice(-50), content]); // keep last 50 states
    setFuture([]);
    setContent(newContent);
  };

  const undo = () => {
    if (!history.length) return;
    setFuture((prev) => [content, ...prev]);
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setContent(prev);
  };

  const redo = () => {
    if (!future.length) return;
    setHistory((prev) => [...prev, content]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setContent(next);
  };

  // Keyboard undo/redo
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [content, history, future]);

  const save = async () => {
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

  if (loading) return <><Navbar /><div className="flex justify-center mt-20"><Spinner size="lg" /></div></>;
  if (!guide) return <><Navbar /><p className="text-center mt-20 text-[var(--muted)]">Guide not found.</p></>;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: guide.title },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              aria-label="Go back to dashboard"
              className="p-2 rounded-lg hover:bg-[var(--card-border)] transition-colors"
            >
              <ArrowLeft size={20} className="text-[var(--muted)]" />
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-color)]">{guide.title}</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* TTS */}
            <TTSButton text={content.replace(/<[^>]+>/g, ' ')} />

            {/* Undo/Redo — only in edit mode */}
            {editing && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={undo}
                  disabled={!history.length}
                  ariaLabel="Undo last change (Ctrl+Z)"
                >
                  ↩ Undo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={redo}
                  disabled={!future.length}
                  ariaLabel="Redo last change (Ctrl+Y)"
                >
                  ↪ Redo
                </Button>
              </>
            )}

            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Eye size={14} />}
                  onClick={() => setEditing(false)}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  icon={<Save size={14} />}
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
                icon={<Edit2 size={14} />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Two-column layout on desktop */}
        <div className="grid lg:grid-cols-[250px_1fr] gap-6">
          {/* Sidebar: Table of Contents */}
          <aside aria-label="Table of contents" className="hidden lg:block">
            <div className="sticky top-24">
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <List size={16} className="text-[var(--accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--text-color)]">Contents</h2>
                </div>
                <TableOfContents content={content} />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 md:p-8">
            {editing ? (
              <StudyGuideEditor content={content} onChange={handleContentChange} />
            ) : (
              <div
                className="prose prose-lg max-w-none"
                style={{ color: 'var(--text-color)' }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}