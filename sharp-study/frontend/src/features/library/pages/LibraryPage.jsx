import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../shared/components/Modal';
import { API_URL } from '../../../config/api';
import { useAuth } from '../../auth/context/AuthContext';
import { useDashboard } from '../../dashboard/hooks/useDashboard';
import StudyGuideEditor from '../../study-guide/components/StudyGuideEditor';
import { createInstructionalStudyGuideTemplate } from '../../study-guide/utils/content';

const MATERIAL_TYPES = {
  study_guide: {
    label: 'Study Guide',
    plural: 'Study Guides',
    table: 'study_guides',
    icon: BookOpen,
    color: '#3B82F6',
    generateId: 'study_guide',
  },
  flashcards: {
    label: 'Flashcards',
    plural: 'Flashcards',
    table: 'flashcard_sets',
    icon: CreditCard,
    color: '#8B5CF6',
    generateId: 'flashcards',
  },
  quiz: {
    label: 'Quiz',
    plural: 'Quizzes',
    table: 'quizzes',
    icon: HelpCircle,
    color: '#10B981',
    generateId: 'quiz',
  },
};

const EMPTY_EDITOR = createInstructionalStudyGuideTemplate();
const MAX_FILE_BYTES = 150 * 1024 * 1024;

export default function LibraryPage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const { items, loading, error, refetch } = useDashboard();
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [creationMode, setCreationMode] = useState(null);
  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState(EMPTY_EDITOR);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ value: 0, message: '' });

  const allMaterials = useMemo(() => {
    const safeItems = items ?? { study_guides: [], flashcards: [], quizzes: [] };
    return [
      ...(safeItems.study_guides ?? []).map((item) => ({ ...item, type: 'study_guide' })),
      ...(safeItems.flashcards ?? []).map((item) => ({ ...item, type: 'flashcards' })),
      ...(safeItems.quizzes ?? []).map((item) => ({ ...item, type: 'quiz' })),
    ].filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

  const resetWizard = () => {
    setWizardOpen(false);
    setSelectedType(null);
    setCreationMode(null);
    setTitle('');
    setEditorHtml(EMPTY_EDITOR);
    setFile(null);
    setSaving(false);
    setProgress({ value: 0, message: '' });
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const extension = nextFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'ppt', 'txt'].includes(extension)) {
      toast.error('Please upload a TXT, PDF, DOCX, PPT, or PPTX file.');
      return;
    }

    if (nextFile.size > MAX_FILE_BYTES) {
      toast.error('File size must be 150MB or less.');
      return;
    }

    setFile(nextFile);
  };

  const handleSelectType = (nextType) => {
    setSelectedType(nextType);
    setEditorHtml(nextType === 'study_guide' ? EMPTY_EDITOR : '');
  };

  const saveManualMaterial = async () => {
    if (!selectedType || !user?.id) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Please add a title.');
      return;
    }

    setSaving(true);
    try {
      if (selectedType === 'study_guide') {
        const { error: insertError } = await supabase.from('study_guides').insert({
          user_id: user.id,
          title: cleanTitle,
          content: editorHtml,
        });
        if (insertError) throw insertError;
      }

      if (selectedType === 'flashcards') {
        const { data: set, error: setError } = await supabase
          .from('flashcard_sets')
          .insert({ user_id: user.id, title: cleanTitle })
          .select('id')
          .single();
        if (setError) throw setError;

        const text = new DOMParser().parseFromString(editorHtml, 'text/html').body.textContent?.trim() || 'Front | Back';
        const [front = 'Question', back = text] = text.split('|').map((part) => part.trim());
        const { error: cardError } = await supabase.from('flashcards').insert({
          set_id: set.id,
          front,
          back,
        });
        if (cardError) throw cardError;
      }

      if (selectedType === 'quiz') {
        const { data: quiz, error: quizError } = await supabase
          .from('quizzes')
          .insert({ user_id: user.id, title: cleanTitle })
          .select('id')
          .single();
        if (quizError) throw quizError;

        const text = new DOMParser().parseFromString(editorHtml, 'text/html').body.textContent?.trim() || 'Write your question here';
        const { error: questionError } = await supabase.from('quiz_questions').insert({
          quiz_id: quiz.id,
          question: text,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_index: 0,
        });
        if (questionError) throw questionError;
      }

      const token = localStorage.getItem('sharp-study-token');
      if (token) {
        await fetch(`${API_URL}/api/dashboard/invalidate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      toast.success(`${MATERIAL_TYPES[selectedType].label} created.`);
      await refetch();
      resetWizard();
    } catch (manualError) {
      toast.error(manualError.message || 'Failed to create material.');
    } finally {
      setSaving(false);
    }
  };

  const generateAutomatically = async () => {
    if (!selectedType || !file) {
      toast.error('Choose a material type and upload a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('generate', JSON.stringify([MATERIAL_TYPES[selectedType].generateId]));

    setSaving(true);
    setProgress({ value: 20, message: 'Uploading your file securely...' });

    try {
      window.setTimeout(() => {
        setProgress({ value: 45, message: 'Extracting readable text from your document...' });
      }, 500);
      window.setTimeout(() => {
        setProgress({ value: 72, message: 'Gemini is generating your study material...' });
      }, 1200);

      const token = localStorage.getItem('sharp-study-token');
      const response = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'AI generation failed.');
      }

      setProgress({ value: 100, message: 'Finished. Refreshing your library...' });
      toast.success('Generated successfully.');
      await refetch();
      resetWizard();
    } catch (generationError) {
      toast.error(generationError.message || 'Generation failed.');
      setProgress({ value: 0, message: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <section className="rounded-[2.5rem] border border-border bg-surface p-6 md:p-8 shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-text-muted">Your Library</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-display font-black text-text">Study Materials</h1>
              <p className="mt-2 max-w-2xl text-text-muted">
                Create, search, and manage your study guides, flashcards, and quizzes in one workspace.
              </p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-bold text-accent-text shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-hover"
            >
              <Plus size={18} aria-hidden="true" />
              Add New
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {Object.entries(MATERIAL_TYPES).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = key === 'study_guide'
              ? items.study_guides.length
              : key === 'flashcards'
                ? items.flashcards.length
                : items.quizzes.length;

            return (
              <div key={key} className="rounded-[2rem] border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-2xl font-black text-text">{count}</p>
                    <p className="text-sm font-semibold text-text-muted">{meta.plural}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[2.5rem] border border-border bg-surface p-5 md:p-6 shadow-card">
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your library..."
              className="w-full rounded-2xl border border-border bg-surface-2 py-3 pl-11 pr-4 font-medium text-text outline-none transition focus:border-accent"
            />
          </div>

          {error && <p className="mb-4 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-500">{error}</p>}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-44 animate-pulse rounded-[2rem] bg-surface-2" />
              ))}
            </div>
          ) : allMaterials.length === 0 ? (
            <div className="rounded-[2rem] border-2 border-dashed border-border p-10 text-center">
              <FileText className="mx-auto mb-4 text-text-muted" size={42} aria-hidden="true" />
              <h2 className="text-xl font-bold text-text">No materials found</h2>
              <p className="mt-2 text-text-muted">Create manually or let Gemini generate one from a document.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allMaterials.map((material) => {
                const meta = MATERIAL_TYPES[material.type];
                const Icon = meta.icon;
                return (
                  <article 
                    key={`${material.type}-${material.id}`} 
                    onClick={() => {
                      const route = material.type === 'study_guide' ? 'study-guide' : material.type;
                      navigate(`/${route}/${material.id}`);
                    }}
                    className="cursor-pointer rounded-[2rem] border border-border bg-surface-2 p-5 transition hover:-translate-y-1 hover:border-accent hover:shadow-card-hover"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <div className="flex gap-1 text-text-muted">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Future archive functionality
                          }}
                          className="rounded-xl p-2 hover:bg-surface" 
                          aria-label="Archive"
                        >
                          <Archive size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Future delete functionality
                          }}
                          className="rounded-xl p-2 text-red-500 hover:bg-red-500/10" 
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{meta.label}</p>
                    <h3 className="mt-2 line-clamp-2 min-h-14 text-lg font-bold text-text">{material.title}</h3>
                    <p className="mt-4 text-xs font-semibold text-text-muted">
                      {new Date(material.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CreateWizard
        isOpen={wizardOpen}
        selectedType={selectedType}
        creationMode={creationMode}
        title={title}
        editorHtml={editorHtml}
        file={file}
        saving={saving}
        progress={progress}
        onClose={resetWizard}
        onSelectType={handleSelectType}
        onSelectMode={setCreationMode}
        onTitleChange={setTitle}
        onEditorChange={setEditorHtml}
        onFileChange={handleFileChange}
        onManualCreate={saveManualMaterial}
        onAutoCreate={generateAutomatically}
      />
    </>
  );
}

function CreateWizard({
  isOpen,
  selectedType,
  creationMode,
  title,
  editorHtml,
  file,
  saving,
  progress,
  onClose,
  onSelectType,
  onSelectMode,
  onTitleChange,
  onEditorChange,
  onFileChange,
  onManualCreate,
  onAutoCreate,
}) {
  const selectedMeta = selectedType ? MATERIAL_TYPES[selectedType] : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Study Material" size="xl">
      <div className="max-h-[78vh] overflow-y-auto pr-1">
        {!selectedType && (
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(MATERIAL_TYPES).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => onSelectType(key)}
                  className="rounded-[2rem] border border-border bg-surface-2 p-6 text-left transition hover:-translate-y-1 hover:border-accent"
                >
                  <Icon size={28} style={{ color: meta.color }} aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-bold text-text">{meta.label}</h3>
                  <p className="mt-2 text-sm text-text-muted">Create a new {meta.label.toLowerCase()}.</p>
                </button>
              );
            })}
          </div>
        )}

        {selectedType && !creationMode && (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => onSelectMode('manual')}
              className="rounded-[2rem] border border-border bg-surface-2 p-6 text-left transition hover:-translate-y-1 hover:border-accent"
            >
              <FileText className="text-accent" size={30} aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold text-text">Create Manually</h3>
              <p className="mt-2 text-sm text-text-muted">Use the web-based editor to type and format your own material.</p>
            </button>
            <button
              onClick={() => onSelectMode('automatic')}
              className="rounded-[2rem] border border-border bg-surface-2 p-6 text-left transition hover:-translate-y-1 hover:border-accent"
            >
              <Sparkles className="text-accent" size={30} aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold text-text">Generate Automatically</h3>
              <p className="mt-2 text-sm text-text-muted">Upload a document and generate with Gemini API.</p>
            </button>
          </div>
        )}

        {selectedType && creationMode === 'automatic' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-surface-2 p-5">
              <p className="font-bold text-text">Generate {selectedMeta.label}</p>
              <p className="mt-1 text-sm text-text-muted">TXT, PDF, DOCX, PPT, or PPTX up to 150MB.</p>
            </div>
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-border bg-surface-2 p-8 text-center transition hover:border-accent">
              <Upload className="mb-3 text-accent" size={36} aria-hidden="true" />
              <span className="font-bold text-text">{file ? file.name : 'Choose a file or drag one here'}</span>
              <span className="mt-1 text-sm text-text-muted">Maximum file size: 150MB</span>
              <input className="sr-only" type="file" accept=".txt,.pdf,.docx,.ppt,.pptx" onChange={onFileChange} />
            </label>

            {saving && (
              <div className="rounded-2xl border border-border bg-surface-2 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <Loader2 className="animate-spin text-accent" size={20} />
                  <p className="font-semibold text-text">{progress.message}</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress.value}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={onClose} className="rounded-2xl px-5 py-3 font-bold text-text-muted hover:bg-surface-2">Cancel</button>
              <button
                onClick={onAutoCreate}
                disabled={!file || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-bold text-accent-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate with Gemini
              </button>
            </div>
          </div>
        )}

        {selectedType && creationMode === 'manual' && (
          <div className="space-y-5">
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={`${selectedMeta.label} title`}
              className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 font-bold text-text outline-none focus:border-accent"
            />
            {selectedType === 'study_guide' ? (
              <>
                <div className="rounded-[2rem] border border-dashed border-border bg-surface-2 p-4 text-sm leading-7 text-text-muted">
                  Build the guide like a study coach would: short headings, tight bullets, bold keywords,
                  and a quick review section at the bottom. The template already includes those prompts.
                </div>
                <StudyGuideEditor
                  content={editorHtml}
                  onChange={onEditorChange}
                  mode="create"
                  starterContent={EMPTY_EDITOR}
                />
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-[2rem] border border-dashed border-border bg-surface-2 p-4 text-sm leading-7 text-text-muted">
                  {selectedType === 'flashcards'
                    ? 'Type one flashcard as Front | Back, or add a short note you can transform later.'
                    : 'Write one clear question, then save it into the quiz builder.'}
                </div>
                <textarea
                  value={editorHtml}
                  onChange={(event) => onEditorChange(event.target.value)}
                  placeholder={selectedType === 'flashcards' ? 'Front | Back' : 'Write your question here'}
                  rows={8}
                  className="w-full rounded-[2rem] border border-border bg-surface-2 px-4 py-4 text-sm leading-7 text-text outline-none focus:border-accent"
                />
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={onClose} className="rounded-2xl px-5 py-3 font-bold text-text-muted hover:bg-surface-2">Cancel</button>
              <button
                onClick={onManualCreate}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-bold text-accent-text disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Create
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
