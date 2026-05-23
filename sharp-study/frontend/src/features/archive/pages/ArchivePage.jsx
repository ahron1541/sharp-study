import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Modal from '../../../shared/components/Modal';
import { MaterialCollectionSkeleton } from '../../../shared/components/PageSkeletons';
import { API_URL } from '../../../config/api';
import { useAuth } from '../../auth/context/AuthContext';
import MaterialTypeIcon from '../../library/components/MaterialTypeIcon';
import PaginationControls from '../../library/components/PaginationControls';
import {
  MATERIAL_TYPES,
  MATERIAL_TYPE_KEYS,
  PAGE_SIZE,
  archiveMaterial,
  deleteMaterial,
  fetchMaterialCounts,
  fetchMaterialsPage,
  getMaterialRoute,
} from '../../library/utils/materials';

export default function ArchivePage() {
  const { user, supabase } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ study_guide: 0, flashcards: 0, quiz: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionIntent, setActionIntent] = useState(null);
  const [actionProgress, setActionProgress] = useState(null);
  const [busyItemId, setBusyItemId] = useState('');

  const search = searchParams.get('q') || '';
  const activeType = MATERIAL_TYPE_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'study_guide';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const activeMeta = MATERIAL_TYPES[activeType];

  const setArchiveParams = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadPage = async ({ nextType = activeType, nextPage = page, nextSearch = search } = {}) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [nextCounts, paged] = await Promise.all([
        fetchMaterialCounts(supabase, user.id, true),
        fetchMaterialsPage({
          supabase,
          userId: user.id,
          type: nextType,
          archived: true,
          search: nextSearch,
          page: nextPage,
        }),
      ]);

      setCounts(nextCounts);
      setItems(paged.items);
      setTotalPages(paged.totalPages);
      if (nextPage > paged.totalPages) {
        setArchiveParams({ page: null });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load the archive.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!user?.id) return;

      setLoading(true);

      Promise.all([
        fetchMaterialCounts(supabase, user.id, true),
        fetchMaterialsPage({
          supabase,
          userId: user.id,
          type: activeType,
          archived: true,
          search,
          page,
        }),
      ])
        .then(([nextCounts, paged]) => {
          setCounts(nextCounts);
          setItems(paged.items);
          setTotalPages(paged.totalPages);
          if (page > paged.totalPages) {
            setArchiveParams({ page: null });
          }
        })
        .catch((error) => {
          toast.error(error.message || 'Failed to load the archive.');
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeType, page, search, searchParams, setArchiveParams, supabase, user?.id]);

  const invalidateDashboardCache = async () => {
    const token = localStorage.getItem('sharp-study-token');
    if (!token) return;

    await fetch(`${API_URL}/api/dashboard/invalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const runAction = async () => {
    if (!actionIntent) return;
    const { action, material } = actionIntent;

    setBusyItemId(material.id);
    setActionProgress({
      title: action === 'restore' ? 'Restoring material' : 'Deleting material',
      detail: action === 'restore'
        ? 'Moving the material back into the main library.'
        : 'Removing the material permanently from your archive.',
      value: 22,
    });

    try {
      window.setTimeout(() => setActionProgress((current) => current ? { ...current, value: 66 } : current), 500);

      if (action === 'restore') {
        await archiveMaterial({ supabase, type: material.type, id: material.id, archived: false });
      } else {
        await deleteMaterial({ supabase, type: material.type, id: material.id });
      }

      setActionProgress((current) => current ? { ...current, value: 100 } : current);
      await invalidateDashboardCache();
      await loadPage({ nextType: activeType, nextPage: page, nextSearch: search });
      toast.success(action === 'restore' ? 'Restored to library.' : 'Deleted successfully.');
    } catch (error) {
      toast.error(error.message || 'Action failed.');
    } finally {
      setBusyItemId('');
      setActionIntent(null);
      setActionProgress(null);
    }
  };

  if (loading && !actionIntent) {
    return <MaterialCollectionSkeleton archive />;
  }

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-border bg-surface px-6 py-6 shadow-card sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Archive</p>
          <h1 className="mt-3 text-[clamp(2.1rem,4vw,3.8rem)] font-display font-black leading-none text-text">
            Stored materials, separated and easy to restore.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted">
            Archived study guides, flashcards, and quizzes stay out of the main library until you need them again.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {MATERIAL_TYPE_KEYS.map((typeKey) => {
            const meta = MATERIAL_TYPES[typeKey];
            const active = typeKey === activeType;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setArchiveParams({ tab: typeKey, page: null })}
                className={`rounded-[1.8rem] border px-5 py-5 text-left ${active ? 'border-accent bg-surface shadow-card' : 'border-border bg-surface hover:bg-surface-2'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
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
              <p className="mt-2 text-sm leading-7 text-text-muted">Restore archived items or delete them permanently.</p>
            </div>

            <input
              value={search}
              onChange={(event) => setArchiveParams({ q: event.target.value || null, page: null })}
              placeholder={`Search archived ${activeMeta.plural.toLowerCase()}...`}
              className="w-full max-w-md rounded-2xl border border-border bg-surface-2 px-4 py-3 font-medium text-text outline-none focus:border-accent"
            />
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <div key={index} className="sharp-skeleton-shimmer h-44 rounded-[1.8rem]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-[1.8rem] border-2 border-dashed border-border px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
                <MaterialTypeIcon type={activeType} size={28} className="text-text-muted" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-text">No archived {activeMeta.plural.toLowerCase()}</h3>
              <p className="mt-2 text-text-muted">When you archive items from the library, they will appear here in their own section.</p>
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
                    className={`rounded-[1.8rem] border border-border bg-surface-2 p-5 ${busyItemId ? 'cursor-wait opacity-75' : 'cursor-pointer hover:bg-surface'}`}
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${activeMeta.color}1A`, color: activeMeta.color }}>
                        <MaterialTypeIcon type={activeType} size={20} />
                      </span>
                      <div className="flex gap-1 text-text-muted">
                        <button
                          type="button"
                          disabled={Boolean(busyItemId)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionIntent({ action: 'restore', material: { ...material, type: activeType } });
                          }}
                          className="rounded-xl p-2 hover:bg-surface disabled:opacity-40"
                          aria-label={`Restore ${material.title}`}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyItemId)}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionIntent({ action: 'delete', material: { ...material, type: activeType } });
                          }}
                          className="rounded-xl p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                          aria-label={`Delete ${material.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">{activeMeta.label}</p>
                    <h3 className="mt-2 min-h-14 text-lg font-bold text-text">{material.title}</h3>
                    <p className="mt-5 text-xs font-semibold text-text-muted">
                      {new Date(material.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </article>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <PaginationControls page={page} totalPages={totalPages} onChange={(nextPage) => setArchiveParams({ page: nextPage === 1 ? null : String(nextPage) })} />
              </div>
            </>
          )}
        </section>
      </main>

      <Modal
        isOpen={Boolean(actionIntent) && !actionProgress}
        onClose={() => setActionIntent(null)}
        title={actionIntent?.action === 'restore' ? 'Restore material?' : 'Delete material?'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-text">
            {actionIntent?.action === 'restore'
              ? `Restore "${actionIntent?.material?.title}" back to your main library?`
              : `Delete "${actionIntent?.material?.title}" permanently from the archive?`}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActionIntent(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-text">
              Cancel
            </button>
            <button
              type="button"
              onClick={runAction}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${actionIntent?.action === 'restore' ? 'bg-accent text-accent-text' : 'bg-red-500 text-white'}`}
            >
              {actionIntent?.action === 'restore' ? 'Restore' : 'Delete'}
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
