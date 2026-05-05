import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
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

const MATERIAL_TYPES = {
  study_guide: {
    label: 'Study Guide',
    plural: 'Study Guides',
    table: 'study_guides',
    icon: BookOpen,
    color: '#3B82F6',
    generateId: 'study_guide',
    manualLabel: 'Open full editor',
  },
  flashcards: {
    label: 'Flashcards',
    plural: 'Flashcards',
    table: 'flashcard_sets',
    icon: CreditCard,
    color: '#8B5CF6',
    generateId: 'flashcards',
    manualLabel: 'Quick create',
  },
  quiz: {
    label: 'Quiz',
    plural: 'Quizzes',
    table: 'quizzes',
    icon: HelpCircle,
    color: '#10B981',
    generateId: 'quiz',
    manualLabel: 'Quick create',
  },
};

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const GENERATION_STEPS = [
  { value: 18, title: 'Uploading your document', detail: 'Preparing your file for secure processing.' },
  { value: 42, title: 'Extracting readable text', detail: 'Looking for usable content from your document.' },
  { value: 76, title: 'Generating with Gemini AI', detail: 'Building the selected study material step by step.' },
  { value: 100, title: 'Finishing your library update', detail: 'Saving the result and refreshing your workspace.' },
];

function createDefaultManualText(selectedType) {
  if (selectedType === 'flashcards') return 'Front | Back';
  if (selectedType === 'quiz') return 'Write your question here';
  return '';
}

export default function LibraryPage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const { items, loading, error, refetch } = useDashboard();
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [creationMode, setCreationMode] = useState(null);
  const [title, setTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ value: 0, title: '', detail: '' });
  const abortControllerRef = useRef(null);
  const deferredSearch = useDeferredValue(search);

  const allMaterials = useMemo(() => {
    const safeItems = items ?? { study_guides: [], flashcards: [], quizzes: [] };
    const query = deferredSearch.trim().toLowerCase();
    const merged = [
      ...(safeItems.study_guides ?? []).map((item) => ({ ...item, type: 'study_guide' })),
      ...(safeItems.flashcards ?? []).map((item) => ({ ...item, type: 'flashcards' })),
      ...(safeItems.quizzes ?? []).map((item) => ({ ...item, type: 'quiz' })),
    ];

    if (!query) return merged;
    return merged.filter((item) => item.title?.toLowerCase().includes(query));
  }, [deferredSearch, items]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const resetWizard = (force = false) => {
    if (saving && !force) return;
    setWizardOpen(false);
    setSelectedType(null);
    setCreationMode(null);
    setTitle('');
    setManualText('');
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
  };

  const openWizard = () => {
    setWizardOpen(true);
    setSelectedType(null);
    setCreationMode(null);
    setTitle('');
    setManualText('');
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const extension = nextFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'txt'].includes(extension)) {
      toast.error('Please upload a TXT, PDF, DOCX, or PPTX file.');
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
    setCreationMode(null);
    setTitle('');
    setManualText(createDefaultManualText(nextType));
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
  };

  const handleSelectMode = (nextMode) => {
    if (selectedType === 'study_guide' && nextMode === 'manual') {
      setWizardOpen(false);
      navigate('/study-guide/new');
      return;
    }

    setCreationMode(nextMode);
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
      if (selectedType === 'flashcards') {
        const { data: set, error: setError } = await supabase
          .from('flashcard_sets')
          .insert({ user_id: user.id, title: cleanTitle })
          .select('id')
          .single();
        if (setError) throw setError;

        const [front = 'Question', back = manualText] = manualText
          .split('|')
          .map((part) => part.trim())
          .filter(Boolean);

        const { error: cardError } = await supabase.from('flashcards').insert({
          set_id: set.id,
          front,
          back: back || 'Answer',
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

        const { error: questionError } = await supabase.from('quiz_questions').insert({
          quiz_id: quiz.id,
          question: manualText.trim() || 'Write your question here',
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
      setSaving(false);
      resetWizard(true);
    } catch (manualError) {
      setSaving(false);
      toast.error(manualError.message || 'Failed to create material.');
    }
  };

  const generateAutomatically = async () => {
    if (!selectedType || !file) {
      toast.error('Choose a material type and upload a file first.');
      return;
    }

    const token = localStorage.getItem('sharp-study-token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('generate', JSON.stringify([MATERIAL_TYPES[selectedType].generateId]));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setSaving(true);
    setProgress(GENERATION_STEPS[0]);

    const timers = [
      window.setTimeout(() => setProgress(GENERATION_STEPS[1]), 700),
      window.setTimeout(() => setProgress(GENERATION_STEPS[2]), 1700),
    ];

    const abortGeneration = () => abortController.abort();
    window.addEventListener('beforeunload', abortGeneration);
    window.addEventListener('pagehide', abortGeneration);

    try {
      const response = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'AI generation failed.');
      }

      setProgress(GENERATION_STEPS[3]);
      toast.success('Generated successfully.');
      await refetch();
      setSaving(false);
      resetWizard(true);
    } catch (generationError) {
      setSaving(false);
      if (generationError.name === 'AbortError') {
        return;
      }

      setProgress({ value: 0, title: '', detail: '' });
      toast.error(generationError.message || 'Generation failed.');
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('beforeunload', abortGeneration);
      window.removeEventListener('pagehide', abortGeneration);
      abortControllerRef.current = null;
    }
  };

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2.5rem] border border-border bg-surface px-6 py-6 shadow-card sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Your library</p>
              <h1 className="mt-3 text-[clamp(2.35rem,4vw,4.25rem)] font-display font-black leading-none text-text">
                Study materials that stay organized and easy to review.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
                Create a study guide, flashcards, or quiz manually, or generate one from your notes with Gemini AI.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={openWizard}
                className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] bg-accent px-6 py-3.5 font-bold text-accent-text shadow-lg shadow-accent/15 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <Plus size={18} aria-hidden="true" />
                Create study material
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {Object.entries(MATERIAL_TYPES).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = key === 'study_guide'
              ? items.study_guides.length
              : key === 'flashcards'
                ? items.flashcards.length
                : items.quizzes.length;

            return (
              <div
                key={key}
                className="rounded-[2rem] border border-border bg-surface px-5 py-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: `${meta.color}1A`, color: meta.color }}
                  >
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

        <section className="rounded-[2.5rem] border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your library..."
              className="w-full rounded-2xl border border-border bg-surface-2 py-3 pl-11 pr-4 font-medium text-text outline-none transition-colors duration-200 focus:border-accent"
            />
          </div>

          {error ? <p className="mb-4 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-500">{error}</p> : null}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-44 rounded-[2rem] bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : allMaterials.length === 0 ? (
            <div className="rounded-[2rem] border-2 border-dashed border-border px-6 py-12 text-center">
              <FileText className="mx-auto mb-4 text-text-muted" size={42} aria-hidden="true" />
              <h2 className="text-xl font-bold text-text">No materials found</h2>
              <p className="mt-2 text-text-muted">Create one manually or generate one from a document with Gemini AI.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                    className="group cursor-pointer rounded-[2rem] border border-border bg-surface-2 p-5 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ background: `${meta.color}1A`, color: meta.color }}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <div className="flex gap-1 text-text-muted">
                        <button
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-xl p-2 transition-colors duration-200 hover:bg-surface"
                          aria-label="Archive"
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-xl p-2 text-red-500 transition-colors duration-200 hover:bg-red-500/10"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">{meta.label}</p>
                    <h3 className="mt-2 min-h-14 text-lg font-bold text-text">{material.title}</h3>
                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-muted">
                        {new Date(material.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-text-muted transition-transform duration-200 group-hover:translate-x-0.5">
                        Open
                        <ArrowRight size={14} />
                      </span>
                    </div>
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
        manualText={manualText}
        file={file}
        saving={saving}
        progress={progress}
        onClose={resetWizard}
        onSelectType={handleSelectType}
        onSelectMode={handleSelectMode}
        onTitleChange={setTitle}
        onManualTextChange={setManualText}
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
  manualText,
  file,
  saving,
  progress,
  onClose,
  onSelectType,
  onSelectMode,
  onTitleChange,
  onManualTextChange,
  onFileChange,
  onManualCreate,
  onAutoCreate,
}) {
  const selectedMeta = selectedType ? MATERIAL_TYPES[selectedType] : null;
  const currentStep = !selectedType ? 1 : !creationMode ? 2 : 3;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Create Study Material"
      size="xl"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      showCloseButton={!saving}
    >
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-border bg-surface-2/80 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Step {currentStep} of 3</p>
              <h3 className="mt-2 text-2xl font-black text-text">
                {!selectedType
                  ? 'Choose what you want to create'
                  : !creationMode
                    ? `Choose how to create your ${selectedMeta.label.toLowerCase()}`
                    : creationMode === 'automatic'
                      ? `Generate ${selectedMeta.label} from a file`
                      : `Quick create ${selectedMeta.label.toLowerCase()}`}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-muted">
                {!selectedType
                  ? 'Start with the material type, then decide whether you want a manual flow or AI generation.'
                  : !creationMode
                    ? 'Manual study guide creation opens a full-page editor. Flashcards and quizzes stay lightweight here.'
                    : creationMode === 'automatic'
                      ? 'Keep this window open while Gemini AI works. Closing the tab will stop the request on your side.'
                      : 'Use the quick form below for smaller manual entries.'}
              </p>
            </div>
            {selectedType ? (
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  onSelectType(null);
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-bold text-text transition-colors duration-200 hover:bg-surface"
              >
                Change type
              </button>
            ) : null}
          </div>
        </section>

        {!selectedType ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(MATERIAL_TYPES).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => onSelectType(key)}
                  className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${meta.color}1A`, color: meta.color }}
                  >
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-black text-text">{meta.label}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-muted">Create a new {meta.label.toLowerCase()} with a cleaner, focused flow.</p>
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedType && !creationMode ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <button
              onClick={() => onSelectMode('manual')}
              className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <FileText className="text-accent" size={30} aria-hidden="true" />
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-text">{selectedMeta.manualLabel}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    {selectedType === 'study_guide'
                      ? 'Open the dedicated study guide editor page with a larger layout, cleaner focus, and better room for longer writing.'
                      : 'Create a starter entry quickly without leaving the library.'}
                  </p>
                </div>
                <ArrowRight className="shrink-0 text-text-muted" size={20} />
              </div>
            </button>

            <button
              onClick={() => onSelectMode('automatic')}
              className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <Sparkles className="text-accent" size={30} aria-hidden="true" />
              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-text">Generate with Gemini AI</h3>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    Upload a TXT, PDF, DOCX, or PPTX file and let Gemini AI build the first draft for you.
                  </p>
                </div>
                <ArrowRight className="shrink-0 text-text-muted" size={20} />
              </div>
            </button>
          </div>
        ) : null}

        {selectedType && creationMode === 'automatic' ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <label className="flex min-h-56 cursor-pointer flex-col justify-between rounded-[2rem] border border-dashed border-border bg-surface p-6 transition-colors duration-200 hover:border-accent">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <Upload size={24} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-text">{file ? file.name : 'Choose a file or drag one here'}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-muted">
                    Works best with readable notes, exported slides, reviewers, and text-based documents up to 150MB.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4 text-sm font-semibold text-text-muted">
                  <span>Accepted: TXT, PDF, DOCX, PPTX</span>
                  <span>Max 150MB</span>
                </div>
                <input className="sr-only" type="file" accept=".txt,.pdf,.docx,.pptx" onChange={onFileChange} />
              </label>

              <div className="rounded-[2rem] border border-border bg-surface p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Tips</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-text-muted">
                  <li>Use PPTX instead of old PPT so slide text can be extracted properly.</li>
                  <li>Free-tier AI can be busy, so generation now retries more gently instead of bursting requests.</li>
                  <li>Keep this modal open while generating. It locks on purpose to protect the request from accidental interruption.</li>
                </ul>
              </div>
            </div>

            {saving ? (
              <div className="rounded-[2rem] border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-accent" size={20} />
                  <div>
                    <p className="font-bold text-text">{progress.title}</p>
                    <p className="text-sm text-text-muted">{progress.detail}</p>
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${progress.value}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-[1.5rem] border border-border bg-surface-2 p-4">
                      <div className="h-4 w-24 rounded-full bg-surface animate-pulse" />
                      <div className="mt-4 h-3 w-full rounded-full bg-surface animate-pulse" />
                      <div className="mt-2 h-3 w-4/5 rounded-full bg-surface animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-2xl px-5 py-3 font-bold text-text-muted transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onAutoCreate}
                disabled={!file || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-bold text-accent-text transition-transform duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate with Gemini AI
              </button>
            </div>
          </div>
        ) : null}

        {selectedType && creationMode === 'manual' ? (
          <div className="space-y-5">
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={`${selectedMeta.label} title`}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 font-bold text-text outline-none transition-colors duration-200 focus:border-accent"
            />

            <div className="rounded-[2rem] border border-border bg-surface-2/80 p-4 text-sm leading-7 text-text-muted">
              {selectedType === 'flashcards'
                ? 'Add one starter card using Front | Back. You can expand the set after opening it.'
                : 'Write one clear starter question. The quiz page can handle the rest of the editing.'}
            </div>

            <textarea
              value={manualText}
              onChange={(event) => onManualTextChange(event.target.value)}
              placeholder={selectedType === 'flashcards' ? 'Front | Back' : 'Write your question here'}
              rows={8}
              className="w-full rounded-[2rem] border border-border bg-surface px-4 py-4 text-sm leading-7 text-text outline-none transition-colors duration-200 focus:border-accent"
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-2xl px-5 py-3 font-bold text-text-muted transition-colors duration-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
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
        ) : null}
      </div>
    </Modal>
  );
}
