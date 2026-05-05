import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

import Breadcrumb from '../../../shared/components/Breadcrumb';
import { API_URL } from '../../../config/api';
import { useAuth } from '../../auth/context/AuthContext';
import StudyGuideEditor from '../components/StudyGuideEditor';
import { createInstructionalStudyGuideTemplate } from '../utils/content';

const EMPTY_EDITOR = createInstructionalStudyGuideTemplate();

export default function StudyGuideCreatePage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(
    () => title.trim().length > 0 || content !== EMPTY_EDITOR,
    [content, title]
  );

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
      const { data, error } = await supabase
        .from('study_guides')
        .insert({
          user_id: user.id,
          title: cleanTitle,
          content,
        })
        .select('id')
        .single();

      if (error) throw error;

      const token = localStorage.getItem('sharp-study-token');
      if (token) {
        await fetch(`${API_URL}/api/dashboard/invalidate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      toast.success('Study guide created.');
      navigate(`/study-guide/${data.id}`);
    } catch (createError) {
      toast.error(createError.message || 'Failed to create your study guide.');
      setSaving(false);
    }
  };

  return (
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
              onClick={() => navigate('/library')}
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

          <div className="rounded-[1.6rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/80 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Writing tips</p>
            <p className="mt-2 max-w-sm text-sm leading-7 text-[color:var(--color-text-muted)]">
              Use short headings, bold keywords, and a quick review section so the final guide is easier to scan.
            </p>
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
            onClick={() => navigate('/library')}
            disabled={saving}
            className="rounded-2xl px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
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
  );
}
