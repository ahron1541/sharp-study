import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
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
import MaterialTypeIcon from '../components/MaterialTypeIcon';
import PaginationControls from '../components/PaginationControls';
import {
  MATERIAL_TYPES,
  MATERIAL_TYPE_KEYS,
  PAGE_SIZE,
  archiveMaterial,
  deleteMaterial,
  fetchMaterialCounts,
  fetchMaterialsPage,
  getMaterialRoute,
} from '../utils/materials';

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const GENERATION_STEPS = [
  { value: 18, title: 'Uploading your document', detail: 'Preparing your file for secure processing.' },
  { value: 42, title: 'Extracting readable text', detail: 'Looking for usable content from your document.' },
  { value: 76, title: 'Generating with Gemini AI', detail: 'Building the selected study material step by step.' },
  { value: 100, title: 'Finishing your library update', detail: 'Saving the result and refreshing your workspace.' },
];
const GENERATION_CANCEL_DELAY_MS = 60000;

function createDefaultManualText(selectedType) {
  if (selectedType === 'quiz') return 'Write your question here';
  return '';
}

export default function LibraryPage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deferredSearch = useDeferredValue(searchParams.get('q') || '');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ study_guide: 0, flashcards: 0, quiz: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyItemId, setBusyItemId] = useState('');
  const [selectedTypeState, setSelectedTypeState] = useState(null);
  const [creationModeState, setCreationModeState] = useState(null);
  const [title, setTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ value: 0, title: '', detail: '' });
  const [generationJob, setGenerationJob] = useState(null);
  const [generationElapsedMs, setGenerationElapsedMs] = useState(0);
  const [actionIntent, setActionIntent] = useState(null);
  const [actionProgress, setActionProgress] = useState(null);
  const pollTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);

  const activeType = MATERIAL_TYPE_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'study_guide';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const activeMeta = MATERIAL_TYPES[activeType];
  const search = searchParams.get('q') || '';
  const showCreateModal = searchParams.get('modal') === 'create';
  const requestedType = searchParams.get('type');
  const requestedMode = searchParams.get('mode');
  const selectedType = selectedTypeState || (MATERIAL_TYPE_KEYS.includes(requestedType) ? requestedType : null);
  const creationMode = creationModeState || (requestedMode === 'automatic' || requestedMode === 'manual' ? requestedMode : null);

  const setLibraryParams = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadPage = async ({ nextType = activeType, nextPage = page, nextSearch = deferredSearch } = {}) => {
    if (!user?.id) return;

    setLoading(true);
    setError('');

    try {
      const [nextCounts, paged] = await Promise.all([
        fetchMaterialCounts(supabase, user.id, false),
        fetchMaterialsPage({
          supabase,
          userId: user.id,
          type: nextType,
          archived: false,
          search: nextSearch,
          page: nextPage,
        }),
      ]);

      setCounts(nextCounts);
      setItems(paged.items);
      setTotalPages(paged.totalPages);
      if (nextPage > paged.totalPages) {
        setLibraryParams({ page: null });
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load your library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!saving || !generationJob?.id) return undefined;

    const token = localStorage.getItem('sharp-study-token');
    const cancelOnPageHide = () => {
      if (!token) return;

      fetch(`${API_URL}/api/ai/generate/${generationJob.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('pagehide', cancelOnPageHide);
    window.addEventListener('beforeunload', cancelOnPageHide);
    return () => {
      window.removeEventListener('pagehide', cancelOnPageHide);
      window.removeEventListener('beforeunload', cancelOnPageHide);
    };
  }, [generationJob?.id, saving]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!user?.id) return;

      setLoading(true);
      setError('');

      Promise.all([
        fetchMaterialCounts(supabase, user.id, false),
        fetchMaterialsPage({
          supabase,
          userId: user.id,
          type: activeType,
          archived: false,
          search: deferredSearch,
          page,
        }),
      ])
        .then(([nextCounts, paged]) => {
          setCounts(nextCounts);
          setItems(paged.items);
          setTotalPages(paged.totalPages);
          if (page > paged.totalPages) {
            setLibraryParams({ page: null });
          }
        })
        .catch((loadError) => {
          setError(loadError.message || 'Failed to load your library.');
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeType, deferredSearch, page, searchParams, setLibraryParams, supabase, user?.id]);

  const openWizard = () => {
    setSelectedTypeState(null);
    setCreationModeState(null);
    setTitle('');
    setManualText('');
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
    setGenerationJob(null);
    setGenerationElapsedMs(0);
    setLibraryParams({ modal: 'create', type: null, mode: null });
  };

  const closeWizard = (force = false) => {
    if (saving && !force) return;
    setSelectedTypeState(null);
    setCreationModeState(null);
    setTitle('');
    setManualText('');
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
    setGenerationJob(null);
    setGenerationElapsedMs(0);
    setLibraryParams({ modal: null, type: null, mode: null });
  };

  const handleSelectType = (nextType) => {
    if (!nextType) {
      setSelectedTypeState(null);
      setCreationModeState(null);
      setLibraryParams({ type: null, mode: null });
      return;
    }

    setSelectedTypeState(nextType);
    setCreationModeState(null);
    setTitle('');
    setManualText(createDefaultManualText(nextType));
    setFile(null);
    setProgress({ value: 0, title: '', detail: '' });
    setLibraryParams({ type: nextType, mode: null });
  };

  const handleSelectMode = (nextMode) => {
    if (selectedType === 'study_guide' && nextMode === 'manual') {
      closeWizard(true);
      navigate('/study-guide/new');
      return;
    }

    if (selectedType === 'flashcards' && nextMode === 'manual') {
      closeWizard(true);
      navigate('/flashcards/new');
      return;
    }

    if (selectedType === 'quiz' && nextMode === 'manual') {
      closeWizard(true);
      navigate('/quiz/new');
      return;
    }

    setCreationModeState(nextMode);
    setLibraryParams({ mode: nextMode });
  };

  const handleSearchChange = (value) => {
    setLibraryParams({ q: value || null, page: null });
  };

  const handleChangeTypeTab = (type) => {
    setLibraryParams({ tab: type, page: null });
  };

  const invalidateDashboardCache = async () => {
    const token = localStorage.getItem('sharp-study-token');
    if (!token) return;

    await fetch(`${API_URL}/api/dashboard/invalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
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

  const saveManualMaterial = async () => {
    if (!selectedType || !user?.id) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Please add a title.');
      return;
    }

    setSaving(true);
    setProgress({
      value: 24,
      title: `Creating ${MATERIAL_TYPES[selectedType].label.toLowerCase()}`,
      detail: 'Sanitizing your input and preparing the saved record.',
    });
    try {
      if (selectedType === 'flashcards') {
        closeWizard(true);
        navigate('/flashcards/new');
        return;
      }

      if (selectedType === 'quiz') {
        closeWizard(true);
        navigate('/quiz/new');
        return;
      }

      await invalidateDashboardCache();
      await loadPage({ nextType: activeType, nextPage: page, nextSearch: deferredSearch });
      toast.success(`${MATERIAL_TYPES[selectedType].label} created.`);
      closeWizard(true);
    } catch (manualError) {
      toast.error(manualError.message || 'Failed to create material.');
    } finally {
      setSaving(false);
      setProgress({ value: 0, title: '', detail: '' });
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

    setSaving(true);
    setProgress(GENERATION_STEPS[0]);
    setGenerationJob(null);
    setGenerationElapsedMs(0);

    try {
      const response = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || 'AI generation failed.');
      }

      const queuedJob = body?.job;
      if (!queuedJob?.id) {
        throw new Error('The AI queue did not return a valid job id.');
      }

      setGenerationJob(queuedJob);
      setProgress({
        value: queuedJob.progressValue || 10,
        title: queuedJob.status === 'queued' ? 'Queued for Gemini AI' : 'Preparing your generation',
        detail: queuedJob.detail || 'Your request was accepted and is being prepared.',
      });

      if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
      const startTime = Date.now();
      elapsedTimerRef.current = window.setInterval(() => {
        setGenerationElapsedMs(Date.now() - startTime);
      }, 1000);

      const updateFromJob = async (nextJob) => {
        setGenerationJob(nextJob);
        setProgress({
          value: nextJob?.progressValue || 10,
          title: nextJob?.message || 'Waiting for Gemini AI',
          detail: nextJob?.status === 'queued' && typeof nextJob?.positionAhead === 'number'
            ? nextJob.positionAhead > 0
              ? `${nextJob.detail} ${nextJob.positionAhead} request${nextJob.positionAhead === 1 ? '' : 's'} ahead of you.`
              : 'Your request is first in line and should start shortly.'
            : (nextJob?.detail || 'Your request is being processed.'),
        });

        if (nextJob?.status === 'completed') {
          setProgress(GENERATION_STEPS[3]);
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
          pollTimerRef.current = null;
          elapsedTimerRef.current = null;
          setSaving(false);
          await invalidateDashboardCache();
          await loadPage({ nextType: selectedType || activeType, nextPage: 1, nextSearch: deferredSearch });
          toast.success('Generated successfully.');

          const createdStudyGuideId = nextJob?.result?.created?.study_guide?.id;
          const createdFlashcardsId = nextJob?.result?.created?.flashcards?.id;
          const createdQuizId = nextJob?.result?.created?.quiz?.id;
          if (selectedType === 'study_guide' && createdStudyGuideId) {
            setProgress({
              value: 100,
              title: 'Opening your study guide',
              detail: 'Your generated material is ready. Taking you there now.',
            });
            window.setTimeout(() => {
              closeWizard(true);
              navigate(`/study-guide/${createdStudyGuideId}`);
            }, 550);
          } else if (selectedType === 'flashcards' && createdFlashcardsId) {
            setProgress({
              value: 100,
              title: 'Opening your flashcards',
              detail: 'Your generated flashcard set is ready. Taking you there now.',
            });
            window.setTimeout(() => {
              closeWizard(true);
              navigate(`/flashcards/${createdFlashcardsId}`);
            }, 550);
          } else if (selectedType === 'quiz' && createdQuizId) {
            setProgress({
              value: 100,
              title: 'Opening your quiz',
              detail: 'Your generated quiz is ready. Taking you there now.',
            });
            window.setTimeout(() => {
              closeWizard(true);
              navigate(`/quiz/${createdQuizId}`);
            }, 550);
          } else {
            closeWizard(true);
            setLibraryParams({ tab: selectedType || activeType, page: null });
          }
          return true;
        }

        if (nextJob?.status === 'failed') {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
          pollTimerRef.current = null;
          elapsedTimerRef.current = null;
          setSaving(false);
          throw new Error(nextJob.error || 'AI generation failed.');
        }

        if (nextJob?.status === 'cancelled') {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
          pollTimerRef.current = null;
          elapsedTimerRef.current = null;
          setSaving(false);
          throw new Error('Generation was cancelled.');
        }

        return false;
      };

      const firstFinished = await updateFromJob(queuedJob);
      if (firstFinished) return;

      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_URL}/api/ai/generate/${queuedJob.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const statusBody = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) {
            throw new Error(statusBody.error || 'Failed to check generation status.');
          }

          const done = await updateFromJob(statusBody.job);
          if (done && pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
          }
        } catch (pollError) {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
          pollTimerRef.current = null;
          elapsedTimerRef.current = null;
          setSaving(false);
          setGenerationJob(null);
          setProgress({ value: 0, title: '', detail: '' });
          toast.error(pollError.message || 'Failed to check generation status.');
        }
      }, 2000);
    } catch (generationError) {
      setProgress({ value: 0, title: '', detail: '' });
      setGenerationJob(null);
      const message = generationError.message || 'Generation failed.';
      toast.error(message);

      if (/no readable text|small amount of readable text|legacy ppt|unsupported document format/i.test(message)) {
        toast(() => (
          <div className="space-y-1">
            <p className="font-bold">We could not read enough text from that file.</p>
            <p className="text-sm leading-6 text-text-muted">
              Try exporting the slides again as a text-based PPTX or PDF, then re-upload the clearer version.
            </p>
          </div>
        ), { id: 'file-readability-help', duration: 5200 });
      }
    } finally {
      if (!pollTimerRef.current) {
        if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
        setSaving(false);
      }
    }
  };

  const cancelGeneration = async () => {
    if (!generationJob?.id) return;
    const token = localStorage.getItem('sharp-study-token');

    try {
      const response = await fetch(`${API_URL}/api/ai/generate/${generationJob.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Failed to cancel the generation.');
      }

      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
      pollTimerRef.current = null;
      elapsedTimerRef.current = null;
      setSaving(false);
      setGenerationJob(body.job || null);
      setProgress({ value: 0, title: '', detail: '' });
      toast.success('Generation request cancelled.');
      closeWizard(true);
    } catch (cancelError) {
      toast.error(cancelError.message || 'Failed to cancel the generation.');
    }
  };

  const runAction = async () => {
    if (!actionIntent) return;
    const { action, material } = actionIntent;

    setBusyItemId(material.id);
    setActionProgress({
      title: action === 'archive' ? 'Archiving material' : 'Deleting material',
      detail: action === 'archive'
        ? 'Saving the material into your archive and refreshing your library.'
        : 'Removing the material and updating the visible list safely.',
      value: 24,
    });

    try {
      if (action === 'archive') {
        window.setTimeout(() => setActionProgress((current) => current ? { ...current, value: 68 } : current), 500);
        await archiveMaterial({ supabase, type: material.type, id: material.id, archived: true });
      } else {
        window.setTimeout(() => setActionProgress((current) => current ? { ...current, value: 68 } : current), 500);
        await deleteMaterial({ supabase, type: material.type, id: material.id });
      }

      setActionProgress((current) => current ? { ...current, value: 100 } : current);
      await invalidateDashboardCache();
      await loadPage({ nextType: activeType, nextPage: page, nextSearch: deferredSearch });
      toast.success(action === 'archive' ? 'Moved to archive.' : 'Deleted successfully.');
    } catch (actionError) {
      toast.error(actionError.message || 'Action failed.');
    } finally {
      setBusyItemId('');
      setActionIntent(null);
      setActionProgress(null);
    }
  };

  const totalVisible = counts[activeType] || 0;

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-border bg-surface px-6 py-6 shadow-card sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Your library</p>
              <h1 className="mt-3 text-[clamp(2.1rem,4vw,3.8rem)] font-display font-black leading-none text-text">
                Keep your study momentum moving.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
                Return to the lesson you need, stay focused on one material type at a time, and build a library that makes every study session easier to start.
              </p>
            </div>

            <button
              onClick={openWizard}
              className="inline-flex items-center justify-center gap-2 rounded-[1.25rem] bg-accent px-6 py-3.5 font-bold text-accent-text transition-colors hover:bg-accent-hover"
            >
              <Plus size={18} aria-hidden="true" />
              Create study material
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {MATERIAL_TYPE_KEYS.map((typeKey) => {
            const meta = MATERIAL_TYPES[typeKey];
            const active = activeType === typeKey;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => handleChangeTypeTab(typeKey)}
                className={`rounded-[1.8rem] border px-5 py-5 text-left transition-colors ${
                  active
                    ? 'border-accent bg-surface shadow-card'
                    : 'border-border bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: `${meta.color}1A`, color: meta.color }}
                  >
                    <MaterialTypeIcon type={typeKey} size={22} />
                  </span>
                  <div>
                    <p className="text-2xl font-black text-text">{counts[typeKey] || 0}</p>
                    <p className="text-sm font-semibold text-text-muted">{meta.plural}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">{activeMeta.label}</p>
              <h2 className="mt-2 text-3xl font-black text-text">{activeMeta.plural}</h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                One clear page at a time, so you can review, practice, and keep making progress without losing your focus.
              </p>
            </div>

            <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={`Search ${activeMeta.plural.toLowerCase()}...`}
                className="w-full rounded-2xl border border-border bg-surface-2 py-3 pl-11 pr-4 font-medium text-text outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          {error ? <p className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-500">{error}</p> : null}

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <div key={index} className="h-44 rounded-[1.8rem] bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-[1.8rem] border-2 border-dashed border-border px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
                <MaterialTypeIcon type={activeType} size={28} className="text-text-muted" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-text">No {activeMeta.plural.toLowerCase()} yet</h3>
              <p className="mt-2 max-w-md mx-auto text-text-muted">
                {search
                  ? `No ${activeMeta.plural.toLowerCase()} match "${search}".`
                  : `Create your first ${activeMeta.label.toLowerCase()} or move older ones into the archive when this section grows.`}
              </p>
              <button
                onClick={openWizard}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 font-bold text-accent-text"
              >
                <Plus size={16} />
                Add new
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((material) => (
                  <article
                    key={material.id}
                    onClick={() => {
                      if (busyItemId) return;
                      navigate(getMaterialRoute(activeType, material.id));
                    }}
                    className={`group rounded-[1.8rem] border border-border bg-surface-2 p-5 transition-colors ${
                      busyItemId ? 'cursor-wait opacity-75' : 'cursor-pointer hover:bg-surface'
                    }`}
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ background: `${activeMeta.color}1A`, color: activeMeta.color }}
                      >
                        <MaterialTypeIcon type={activeType} size={20} />
                      </span>

                      <div className="flex gap-1 text-text-muted">
                        <button
                          type="button"
                          disabled={Boolean(busyItemId)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionIntent({ action: 'archive', material: { ...material, type: activeType } });
                          }}
                          className="rounded-xl p-2 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Archive ${material.title}`}
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyItemId)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionIntent({ action: 'delete', material: { ...material, type: activeType } });
                          }}
                          className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Delete ${material.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">{activeMeta.label}</p>
                    <h3 className="mt-2 min-h-14 text-lg font-bold text-text">{material.title}</h3>
                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-muted">
                        {new Date(material.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-text-muted">
                        Open
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-muted">
                  Showing {items.length} of {totalVisible} {activeMeta.plural.toLowerCase()}.
                </p>
                <PaginationControls page={page} totalPages={totalPages} onChange={(nextPage) => setLibraryParams({ page: nextPage === 1 ? null : String(nextPage) })} />
              </div>
            </>
          )}
        </section>
      </main>

      <CreateWizard
        isOpen={showCreateModal}
        selectedType={selectedType}
        creationMode={creationMode}
        title={title}
        manualText={manualText}
        file={file}
        saving={saving}
        progress={progress}
        generationJob={generationJob}
        generationElapsedMs={generationElapsedMs}
        onClose={closeWizard}
        onSelectType={handleSelectType}
        onSelectMode={handleSelectMode}
        onTitleChange={setTitle}
        onManualTextChange={setManualText}
        onFileChange={handleFileChange}
        onManualCreate={saveManualMaterial}
        onAutoCreate={generateAutomatically}
        onCancelGeneration={cancelGeneration}
      />

      <Modal
        isOpen={Boolean(actionIntent) && !actionProgress}
        onClose={() => setActionIntent(null)}
        title={actionIntent?.action === 'archive' ? 'Archive material?' : 'Delete material?'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-text">
            {actionIntent?.action === 'archive'
              ? `Move "${actionIntent?.material?.title}" to the archive? You can restore it later from the Archive page.`
              : `Delete "${actionIntent?.material?.title}" permanently? This will also remove its related cards or questions when needed.`}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setActionIntent(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runAction}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                actionIntent?.action === 'archive'
                  ? 'bg-accent text-accent-text'
                  : 'bg-red-500 text-white'
              }`}
            >
              {actionIntent?.action === 'archive' ? 'Archive' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(actionProgress)}
        onClose={() => {}}
        title={actionProgress?.title || 'Processing'}
        size="md"
        closeOnBackdrop={false}
        closeOnEscape={false}
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-accent" size={18} />
            <p className="text-sm text-text-muted">{actionProgress?.detail}</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${actionProgress?.value || 0}%` }} />
          </div>
        </div>
      </Modal>
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
  generationJob,
  generationElapsedMs,
  onClose,
  onSelectType,
  onSelectMode,
  onTitleChange,
  onManualTextChange,
  onFileChange,
  onManualCreate,
  onAutoCreate,
  onCancelGeneration,
}) {
  const selectedMeta = selectedType ? MATERIAL_TYPES[selectedType] : null;
  const currentStep = !selectedType ? 1 : !creationMode ? 2 : 3;
  const canCancelGeneration = saving && generationElapsedMs >= GENERATION_CANCEL_DELAY_MS;
  const generationSeconds = Math.floor(generationElapsedMs / 1000);

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
                  ? selectedType === 'flashcards' || selectedType === 'quiz'
                    ? 'Gemini AI will prepare Easy, Normal, Hard, and Expert challenge levels in one material. Longer lessons can take more time, and the status below will keep changing while it works.'
                    : 'If another request is ahead of you, your file will wait in line. Longer lessons, scanned files, or busy AI periods can make generation take more time.'
                  : 'Use the quick form below for smaller manual entries.'}
          </p>
        </section>

        {!selectedType ? (
          <div className="grid gap-4 md:grid-cols-3">
            {MATERIAL_TYPE_KEYS.map((typeKey) => {
              const meta = MATERIAL_TYPES[typeKey];
              return (
                <button
                  key={typeKey}
                  onClick={() => onSelectType(typeKey)}
                  className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${meta.color}1A`, color: meta.color }}
                  >
                    <MaterialTypeIcon type={typeKey} size={28} />
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
              className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-colors hover:bg-surface-2"
            >
              <h3 className="text-xl font-black text-text">{selectedType === 'study_guide' ? 'Open full editor' : 'Quick create'}</h3>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                {selectedType === 'study_guide'
                  ? 'Open the dedicated study guide editor page with more room, better focus, and less lag.'
                  : 'Create a starter entry quickly without leaving the library.'}
              </p>
            </button>

            <button
              onClick={() => onSelectMode('automatic')}
              className="rounded-[2rem] border border-border bg-surface p-6 text-left transition-colors hover:bg-surface-2"
            >
              <h3 className="text-xl font-black text-text">Generate with Gemini AI</h3>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                Upload a TXT, PDF, DOCX, or PPTX file and let Gemini AI build the first draft for you.
              </p>
            </button>
          </div>
        ) : null}

        {selectedType && creationMode === 'automatic' ? (
          <div className="space-y-5">
            <label className="flex min-h-56 cursor-pointer flex-col justify-between rounded-[2rem] border border-dashed border-border bg-surface p-6 transition-colors hover:border-accent">
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

            {(selectedType === 'flashcards' || selectedType === 'quiz') ? (
              <section className="rounded-[2rem] border border-border bg-surface p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Challenge levels included</p>
                <h3 className="mt-1 text-lg font-black text-text">Easy, Normal, Hard, and Expert will be created together.</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-text-muted">
                  After generation, choose the difficulty when you start studying. Harder play modes use stricter rules.
                </p>
              </section>
            ) : null}

            {saving ? (
              <div className="rounded-[2rem] border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-accent" size={20} />
                  <div>
                    <p className="font-bold text-text">{progress.title}</p>
                    <p className="text-sm text-text-muted">{progress.detail}</p>
                  </div>
                </div>

                {generationJob?.status === 'queued' ? (
                  <div className="mt-4 rounded-[1.25rem] border border-border bg-surface-2 p-4 text-sm leading-6 text-text-muted">
                    <p className="font-bold text-text">
                      {generationJob.positionAhead > 0
                        ? `${generationJob.positionAhead} request${generationJob.positionAhead === 1 ? '' : 's'} ahead of you`
                        : 'You are first in line'}
                    </p>
                    <p className="mt-1">
                      The server is keeping AI requests in a short queue so Gemini AI does not get overwhelmed.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-border bg-surface-2 px-3 py-1 font-semibold text-text-muted">
                    {generationJob?.status === 'queued' ? 'Waiting in line' : 'Now generating'}
                  </span>
                  <span className="text-text-muted">
                    {generationSeconds}s elapsed
                  </span>
                  <span className="text-text-muted">
                    Longer lessons, image-heavy slides, and busy AI periods can make this take a bit longer.
                  </span>
                  {canCancelGeneration ? (
                    <span className="text-amber-400">
                      This is taking longer than usual. You can cancel this request now.
                    </span>
                  ) : (
                    <span className="text-text-muted">
                      Cancel becomes available after 1 minute.
                    </span>
                  )}
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress.value}%` }} />
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
              {saving ? (
                <button
                  onClick={canCancelGeneration ? onCancelGeneration : undefined}
                  disabled={!canCancelGeneration}
                  className="rounded-2xl px-5 py-3 font-bold text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel request
                </button>
              ) : (
                <button onClick={onClose} disabled={saving} className="rounded-2xl px-5 py-3 font-bold text-text-muted disabled:opacity-50">
                  Cancel
                </button>
              )}
              <button
                onClick={onAutoCreate}
                disabled={!file || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 font-bold text-accent-text disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate with Gemini AI
              </button>
            </div>
          </div>
        ) : null}

        {selectedType && creationMode === 'manual' ? (
          <div className="space-y-5">
            {saving ? (
              <div className="rounded-[2rem] border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-accent" size={20} />
                  <div>
                    <p className="font-bold text-text">{progress.title || 'Creating your material'}</p>
                    <p className="text-sm text-text-muted">{progress.detail || 'Saving your sanitized content now.'}</p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress.value || 20}%` }} />
                </div>
              </div>
            ) : null}

            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={`${selectedMeta.label} title`}
              disabled={saving}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 font-bold text-text outline-none focus:border-accent"
            />

            <textarea
              value={manualText}
              onChange={(event) => onManualTextChange(event.target.value)}
              placeholder={selectedType === 'flashcards' ? 'Question | Answer\nAnother question | Another answer' : 'Write your question here'}
              rows={8}
              disabled={saving}
              className="w-full rounded-[2rem] border border-border bg-surface px-4 py-4 text-sm leading-7 text-text outline-none focus:border-accent"
            />

            {selectedType === 'flashcards' ? (
              <p className="text-sm leading-6 text-text-muted">
                Add one card per line using Question | Answer. Images are not included in this flashcard version.
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={onClose} disabled={saving} className="rounded-2xl px-5 py-3 font-bold text-text-muted disabled:opacity-50">
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
