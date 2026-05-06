import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Archive, ArrowRight, BookOpen, FileText, FolderKanban, GraduationCap, Layers3, LoaderCircle, MonitorCog, Moon, Search, Shield, Sparkles, Sun, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Button from '../../../shared/components/Button';
import Modal from '../../../shared/components/Modal';
import { sanitizeHtml } from '../../../shared/utils/sanitize';
import AdminStatCard from '../components/AdminStatCard';
import AdminTableSkeleton from '../components/AdminTableSkeleton';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { savePreferences } from '../../theme/services/preferences.service';
import { useAuth } from '../../auth/context/AuthContext';
import versoLogo from '../../../assets/logo/verso_w_name.svg';
import {
  createAdminUser,
  deleteAdminContent,
  deleteAdminUser,
  fetchAdminContent,
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminContent,
  updateAdminUser,
} from '../services/admin.service';

const USER_EMPTY = {
  email: '',
  username: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  password: '',
  role: 'student',
};

const DEFAULT_USER_FILTERS = {
  search: '',
  role: 'all',
  status: 'all',
  page: 1,
};

const DEFAULT_CONTENT_FILTERS = {
  search: '',
  type: 'all',
  owner: '',
  owner_id: '',
  page: 1,
};

const CONTENT_TYPE_META = {
  documents: { label: 'Documents', singular: 'Document', icon: FolderKanban, accent: 'accent' },
  study_guides: { label: 'Study Guides', singular: 'Study Guide', icon: BookOpen, accent: 'success' },
  flashcard_sets: { label: 'Flashcard Sets', singular: 'Flashcard Set', icon: Layers3, accent: 'warning' },
  quizzes: { label: 'Quizzes', singular: 'Quiz', icon: GraduationCap, accent: 'neutral' },
};

const SECTION_TITLES = {
  overview: 'See the platform clearly.',
  users: 'Manage who gets access and why.',
  content: 'Moderate what users can actively access.',
  archived: 'Review materials that are stored away.',
  settings: 'Tune the admin workspace.',
};

export default function AdminPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [contentItems, setContentItems] = useState([]);
  const [contentPagination, setContentPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [actionState, setActionState] = useState({ active: false, label: '', progress: 0 });
  const [userModal, setUserModal] = useState({ mode: 'create', open: false, form: USER_EMPTY, target: null });
  const [contentModal, setContentModal] = useState({ open: false, form: null, target: null, previewMode: 'preview' });
  const [confirmState, setConfirmState] = useState({ open: false, mode: '', target: null });
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    display_mode: readStoredDisplayMode(),
  }));
  const [settingsSaved, setSettingsSaved] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    display_mode: readStoredDisplayMode(),
  }));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const progressTimerRef = useRef(null);

  const section = useMemo(() => {
    const value = searchParams.get('section') || 'overview';
    return ['overview', 'users', 'content', 'archived', 'settings'].includes(value) ? value : 'overview';
  }, [searchParams]);
  const userFilters = useMemo(() => ({
    ...DEFAULT_USER_FILTERS,
    search: searchParams.get('user_q') || '',
    role: searchParams.get('role') || 'all',
    status: searchParams.get('status') || 'all',
    page: Math.max(1, Number(searchParams.get('user_page') || 1)),
  }), [searchParams]);
  const contentFilters = useMemo(() => ({
    ...DEFAULT_CONTENT_FILTERS,
    search: searchParams.get('q') || '',
    type: searchParams.get('type') || 'all',
    owner: searchParams.get('owner') || '',
    owner_id: searchParams.get('owner_id') || '',
    page: Math.max(1, Number(searchParams.get('page') || 1)),
  }), [searchParams]);
  const archivedState = section === 'archived' ? 'archived' : 'active';
  const metrics = useMemo(() => overview?.metrics || {}, [overview]);
  const recentActivity = useMemo(() => overview?.recent_activity || [], [overview]);

  const activeMaterialTotal = Number(metrics.documents_active || 0)
    + Number(metrics.study_guides_active || 0)
    + Number(metrics.flashcard_sets_active || 0)
    + Number(metrics.quizzes_active || 0);
  const archivedMaterialTotal = Number(metrics.documents_archived || 0)
    + Number(metrics.study_guides_archived || 0)
    + Number(metrics.flashcard_sets_archived || 0)
    + Number(metrics.quizzes_archived || 0);

  const contentStatusBreakdown = useMemo(() => {
    const done = Number(metrics.documents_done || 0);
    const processing = Number(metrics.documents_processing || 0);
    const errored = Number(metrics.documents_error || 0);
    const total = Math.max(done + processing + errored, 1);

    return {
      done,
      processing,
      errored,
      donePct: Math.round((done / total) * 100),
      processingPct: Math.round((processing / total) * 100),
      erroredPct: Math.round((errored / total) * 100),
    };
  }, [metrics]);
  const settingsChanged = JSON.stringify(settingsDraft) !== JSON.stringify(settingsSaved);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await fetchAdminOverview();
      setOverview(data);
    } catch (error) {
      toast.error(error.message || 'Failed to load the admin overview.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await fetchAdminUsers(userFilters);
      setUsers(data.users || []);
      setUsersPagination(data.pagination || { page: 1, totalPages: 1, totalCount: 0 });
    } catch (error) {
      toast.error(error.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [userFilters]);

  const loadContent = useCallback(async () => {
    setContentLoading(true);
    try {
      const data = await fetchAdminContent({
        ...contentFilters,
        archived: archivedState,
      });
      setContentItems(data.items || []);
      setContentPagination(data.pagination || { page: 1, totalPages: 1, totalCount: 0 });
    } catch (error) {
      toast.error(error.message || 'Failed to load content.');
    } finally {
      setContentLoading(false);
    }
  }, [contentFilters, archivedState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    if (section === 'users') {
      const timer = window.setTimeout(() => {
        void loadUsers();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [section, loadUsers]);

  useEffect(() => {
    if (section === 'content' || section === 'archived') {
      const timer = window.setTimeout(() => {
        void loadContent();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [section, loadContent]);

  useEffect(() => () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const nextPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(profile?.preferences || {}),
    };
    const timer = window.setTimeout(() => {
      setSettingsDraft(nextPreferences);
      setSettingsSaved(nextPreferences);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile?.preferences]);

  async function trackAction(label, task) {
    setActionState({ active: true, label, progress: 16 });
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);

    progressTimerRef.current = window.setInterval(() => {
      setActionState((current) => ({
        ...current,
        progress: current.progress >= 92 ? current.progress : current.progress + 7,
      }));
    }, 170);

    try {
      const result = await task();
      setActionState({ active: true, label, progress: 100 });
      window.setTimeout(() => setActionState({ active: false, label: '', progress: 0 }), 260);
      return result;
    } catch (error) {
      setActionState({ active: false, label: '', progress: 0 });
      throw error;
    } finally {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }
  }

  async function saveAdminSettings() {
    if (settingsSaving || !settingsChanged) return;

    setSettingsSaving(true);
    try {
      applyPreferences(settingsDraft);
      await savePreferences(settingsDraft);
      setSettingsSaved(settingsDraft);
      toast.success('Admin settings saved.');
    } catch (error) {
      toast.error(error.message || 'Failed to save admin settings.');
    } finally {
      setSettingsSaving(false);
    }
  }

  function mergeSearchParams(updates) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  }

  function updateUserFilter(key, value) {
    const updates = {
      user_q: key === 'search' ? value : userFilters.search,
      role: key === 'role' ? value : userFilters.role,
      status: key === 'status' ? value : userFilters.status,
      user_page: key === 'page' ? value : 1,
    };
    if (key === 'search' || key === 'role' || key === 'status') {
      updates.user_page = null;
    }
    mergeSearchParams(updates);
  }

  function updateContentFilter(key, value) {
    const updates = {
      q: key === 'search' ? value : contentFilters.search,
      type: key === 'type' ? value : contentFilters.type,
      owner: key === 'owner' ? value : contentFilters.owner,
      owner_id: key === 'owner_id' ? value : contentFilters.owner_id,
      page: key === 'page' ? value : 1,
      archived: archivedState,
    };
    if (key !== 'page') {
      updates.page = null;
    }
    mergeSearchParams(updates);
  }

  function openCreateUserModal() {
    setUserModal({ mode: 'create', open: true, form: USER_EMPTY, target: null });
  }

  function openEditUserModal(user) {
    setUserModal({
      mode: 'edit',
      open: true,
      target: user,
      form: {
        email: user.email,
        username: user.username || '',
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        last_name: user.last_name || '',
        password: '',
        role: user.role || 'student',
        is_blocked: Boolean(user.is_blocked),
      },
    });
  }

  function openEditContentModal(item) {
    setContentModal({
      open: true,
      target: item,
      previewMode: item.type === 'study_guides' ? 'preview' : 'meta',
      form: {
        title: item.title || '',
        is_archived: Boolean(item.is_archived),
        status: item.status || 'done',
        content: item.type === 'study_guides' ? item.content || '' : '',
      },
    });
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    try {
      if (userModal.mode === 'create') {
        const response = await trackAction('Creating account', () => createAdminUser(userModal.form));
        toast.success(`Created ${response.user.full_name}.`);
      } else {
        const response = await trackAction('Saving user changes', () => updateAdminUser(userModal.target.id, {
          username: userModal.form.username,
          first_name: userModal.form.first_name,
          middle_name: userModal.form.middle_name,
          last_name: userModal.form.last_name,
          role: userModal.form.role,
          is_blocked: Boolean(userModal.form.is_blocked),
        }));
        toast.success(`Updated ${response.user.full_name}.`);
      }

      setUserModal({ mode: 'create', open: false, form: USER_EMPTY, target: null });
      await Promise.all([loadOverview(), loadUsers()]);
    } catch (error) {
      toast.error(error.message || 'User action failed.');
    }
  }

  async function handleContentSubmit(event) {
    event.preventDefault();
    try {
      const payload = {
        title: contentModal.form.title,
        is_archived: Boolean(contentModal.form.is_archived),
      };

      if (contentModal.target.type === 'documents') {
        payload.status = contentModal.form.status;
      }

      if (contentModal.target.type === 'study_guides') {
        payload.content = contentModal.form.content;
      }

      await trackAction('Saving content changes', () => updateAdminContent(contentModal.target.type, contentModal.target.id, payload));
      toast.success('Content updated.');
      setContentModal({ open: false, form: null, target: null, previewMode: 'preview' });
      await Promise.all([loadOverview(), loadContent()]);
    } catch (error) {
      toast.error(error.message || 'Failed to update content.');
    }
  }

  async function handleConfirmAction() {
    const { mode, target } = confirmState;
    if (!target) return;

    try {
      if (mode === 'delete-user') {
        await trackAction('Removing user account', () => deleteAdminUser(target.id));
        toast.success('User deleted.');
        await Promise.all([loadOverview(), loadUsers()]);
      } else if (mode === 'delete-content') {
        await trackAction('Deleting content', () => deleteAdminContent(target.type, target.id));
        toast.success('Content deleted.');
        await Promise.all([loadOverview(), loadContent()]);
      } else if (mode === 'toggle-block') {
        await trackAction(target.is_blocked ? 'Restoring account' : 'Blocking account', () =>
          updateAdminUser(target.id, { is_blocked: !target.is_blocked })
        );
        toast.success(target.is_blocked ? 'User unblocked.' : 'User blocked.');
        await Promise.all([loadOverview(), loadUsers()]);
      }
    } catch (error) {
      toast.error(error.message || 'Action failed.');
    } finally {
      setConfirmState({ open: false, mode: '', target: null });
    }
  }

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:space-y-8 sm:px-5 sm:py-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[1.7rem] border border-border bg-surface px-4 py-5 shadow-card sm:rounded-[2rem] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_58%)] lg:block" />
          {actionState.active ? (
            <div className="absolute inset-x-0 top-0 h-1 bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${actionState.progress}%` }} />
            </div>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Administrator Workspace</p>
              <h1 className="mt-3 text-[clamp(2rem,4vw,4rem)] font-display font-black leading-none text-text">
                {SECTION_TITLES[section]}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
                {section === 'overview'
                  ? 'Track account access, content flow, and moderation activity from one cleaner control surface.'
                  : section === 'users'
                    ? 'Create, edit, block, and review users without mixing that work into the content panel.'
                    : section === 'content'
                      ? 'Review active materials by owner and content type so moderation stays tied to real users.'
                      : section === 'archived'
                        ? 'Inspect archived materials separately so the active library stays easy to manage.'
                        : 'Use a dedicated settings page so your admin preferences can grow cleanly over time.'}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-border bg-surface-2 px-4 py-4 sm:rounded-[1.6rem] sm:px-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Current focus</p>
              <p className="mt-2 text-lg font-black text-text">
                {section === 'overview' ? 'System overview' : section === 'users' ? 'User management' : section === 'content' ? 'Active content' : section === 'archived' ? 'Archived content' : 'Admin settings'}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {actionState.active ? `${actionState.label}...` : section === 'settings' ? 'Preferences sync to your saved account settings.' : 'Protected by backend role checks and audit logs.'}
              </p>
            </div>
          </div>
        </section>

        {section === 'overview' ? (
          <OverviewSection
            loading={overviewLoading}
            metrics={metrics}
            activeMaterialTotal={activeMaterialTotal}
            archivedMaterialTotal={archivedMaterialTotal}
            recentActivity={recentActivity}
            contentStatusBreakdown={contentStatusBreakdown}
            onJump={(targetSection, updates = {}) => mergeSearchParams({ section: targetSection, ...updates })}
          />
        ) : null}

        {section === 'users' ? (
          <UsersSection
            users={users}
            loading={usersLoading}
            filters={userFilters}
            pagination={usersPagination}
            onFilterChange={updateUserFilter}
            onCreateUser={openCreateUserModal}
            onEditUser={openEditUserModal}
            onViewUserContent={(user, archived) => mergeSearchParams({
              section: archived ? 'archived' : 'content',
              owner: user.email,
              owner_id: user.id,
              archived: archived ? 'archived' : 'active',
              page: null,
            })}
            onToggleBlock={(user) => setConfirmState({ open: true, mode: 'toggle-block', target: user })}
            onDeleteUser={(user) => setConfirmState({ open: true, mode: 'delete-user', target: user })}
          />
        ) : null}

        {section === 'content' || section === 'archived' ? (
          <ContentSection
            archived={section === 'archived'}
            items={contentItems}
            loading={contentLoading}
            filters={contentFilters}
            pagination={contentPagination}
            metrics={metrics}
            onFilterChange={updateContentFilter}
            onClearOwner={() => updateContentFilter('owner', null) || updateContentFilter('owner_id', null)}
            onEditContent={openEditContentModal}
            onDeleteContent={(item) => setConfirmState({ open: true, mode: 'delete-content', target: item })}
          />
        ) : null}

        {section === 'settings' ? (
          <AdminSettingsSection
            draft={settingsDraft}
            saving={settingsSaving}
            hasChanges={settingsChanged}
            onThemeChange={(display_mode) => setSettingsDraft((current) => ({ ...current, display_mode }))}
            onDiscard={() => setSettingsDraft(settingsSaved)}
            onSave={saveAdminSettings}
          />
        ) : null}
      </main>

      <Modal
        isOpen={userModal.open}
        onClose={() => setUserModal({ mode: 'create', open: false, form: USER_EMPTY, target: null })}
        title={userModal.mode === 'create' ? 'Create a managed account' : 'Update user account'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleUserSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input required value={userModal.form.first_name} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, first_name: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
            </Field>
            <Field label="Last name">
              <input required value={userModal.form.last_name} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, last_name: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
            </Field>
            <Field label="Middle name">
              <input value={userModal.form.middle_name} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, middle_name: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
            </Field>
            <Field label="Username">
              <input required value={userModal.form.username} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, username: event.target.value.toLowerCase() } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
            </Field>
            <Field label="Email">
              <input required type="email" disabled={userModal.mode === 'edit'} value={userModal.form.email} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, email: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent disabled:opacity-60" />
            </Field>
            <Field label="Role">
              <select value={userModal.form.role} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, role: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent">
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>

          {userModal.mode === 'create' ? (
            <Field label="Temporary password">
              <input required type="password" value={userModal.form.password} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, password: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
              <p className="mt-2 text-xs leading-6 text-text-muted">Must include uppercase, lowercase, number, and special character.</p>
            </Field>
          ) : (
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text">
              <input type="checkbox" checked={Boolean(userModal.form.is_blocked)} onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, is_blocked: event.target.checked } }))} />
              Block this account
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit">{userModal.mode === 'create' ? 'Create account' : 'Save changes'}</Button>
            <Button type="button" variant="secondary" onClick={() => setUserModal({ mode: 'create', open: false, form: USER_EMPTY, target: null })}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={contentModal.open}
        onClose={() => setContentModal({ open: false, form: null, target: null, previewMode: 'preview' })}
        title={contentModal.target ? `Edit ${CONTENT_TYPE_META[contentModal.target.type]?.singular || 'Content'}` : 'Edit content'}
        size={contentModal.target?.type === 'study_guides' ? 'xl' : 'lg'}
      >
        {contentModal.form && contentModal.target ? (
          <form className="space-y-5" onSubmit={handleContentSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <input required value={contentModal.form.title} onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, title: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent" />
              </Field>

              {contentModal.target.type === 'documents' ? (
                <Field label="Processing status">
                  <select value={contentModal.form.status} onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, status: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent">
                    <option value="processing">Processing</option>
                    <option value="done">Done</option>
                    <option value="error">Error</option>
                  </select>
                </Field>
              ) : (
                <Field label="Owner">
                  <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text">
                    {contentModal.target.owner?.full_name || contentModal.target.owner?.email || 'Unknown owner'}
                  </div>
                </Field>
              )}
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text">
              <input type="checkbox" checked={Boolean(contentModal.form.is_archived)} onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, is_archived: event.target.checked } }))} />
              Keep this item in archived storage
            </label>

            {contentModal.target.type === 'study_guides' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={contentModal.previewMode === 'preview' ? 'primary' : 'secondary'} onClick={() => setContentModal((current) => ({ ...current, previewMode: 'preview' }))}>
                    Preview
                  </Button>
                  <Button type="button" size="sm" variant={contentModal.previewMode === 'split' ? 'primary' : 'secondary'} onClick={() => setContentModal((current) => ({ ...current, previewMode: 'split' }))}>
                    Split view
                  </Button>
                  <Button type="button" size="sm" variant={contentModal.previewMode === 'source' ? 'primary' : 'secondary'} onClick={() => setContentModal((current) => ({ ...current, previewMode: 'source' }))}>
                    Source
                  </Button>
                </div>

                <div className={`grid gap-4 ${contentModal.previewMode === 'split' ? 'xl:grid-cols-2' : ''}`}>
                  {contentModal.previewMode !== 'preview' ? (
                    <Field label="Guide source">
                      <textarea rows={14} value={contentModal.form.content} onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, content: event.target.value } }))} className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent" />
                    </Field>
                  ) : null}

                  {contentModal.previewMode !== 'source' ? (
                    <div>
                      <span className="mb-2 block text-sm font-bold text-text">Rendered preview</span>
                      <div className="prose prose-sm max-w-none rounded-2xl border border-border bg-surface-2 p-4 text-text">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentModal.form.content || '<p>No content yet.</p>') }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm leading-7 text-text-muted">
                {contentModal.target.type === 'documents'
                  ? 'Document editing here is limited to moderation metadata for now. File content stays managed through the upload and extraction flow.'
                  : 'Full card and quiz editing in Admin Control can be added once those content experiences are fully live. For now this panel handles moderation metadata cleanly.'}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setContentModal({ open: false, form: null, target: null, previewMode: 'preview' })}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal isOpen={confirmState.open} onClose={() => setConfirmState({ open: false, mode: '', target: null })} title={buildConfirmTitle(confirmState.mode)} size="sm">
        <p className="text-sm leading-7 text-text">{buildConfirmMessage(confirmState.mode, confirmState.target)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant={confirmState.mode.includes('delete') ? 'danger' : 'primary'} onClick={handleConfirmAction}>Confirm</Button>
          <Button variant="secondary" onClick={() => setConfirmState({ open: false, mode: '', target: null })}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}

function AdminSettingsSection({ draft, saving, hasChanges, onThemeChange, onDiscard, onSave }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] xl:items-start">
        <section className="rounded-[1.7rem] border border-border bg-surface shadow-card sm:rounded-[2rem]">
          <div className="border-b border-border px-4 py-5 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Admin settings</p>
            <h2 className="mt-2 text-2xl font-black text-text sm:text-3xl">Theme and identity controls.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-text-muted">
              This lives as a page now so you can expand it later with new controls from your professor without being boxed into a modal.
            </p>
          </div>

          <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-6">
            <div className="rounded-[1.4rem] border border-border bg-surface-2 p-4 sm:rounded-[1.6rem]">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">
                  <MonitorCog size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-black text-text">Theme appearance</p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">
                    Choose how the admin workspace looks. Light mode keeps a bright surface with dark content, while dark mode flips that balance for lower-glare reviewing.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ThemeChoiceCard
                  active={draft.display_mode === 'light'}
                  icon={Sun}
                  title="Light mode"
                  body="Light surfaces with darker text and controls for daytime clarity."
                  tone="light"
                  onClick={() => onThemeChange('light')}
                />
                <ThemeChoiceCard
                  active={draft.display_mode === 'dark'}
                  icon={Moon}
                  title="Dark mode"
                  body="Dark surfaces with bright text for a calmer late-night control room."
                  tone="dark"
                  onClick={() => onThemeChange('dark')}
                />
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-border bg-surface-2 p-4 sm:rounded-[1.6rem]">
              <p className="text-lg font-black text-text">Save behavior</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoPill label="Current mode" value={titleCase(draft.display_mode)} />
                <InfoPill label="Status" value={hasChanges ? 'Unsaved changes' : 'Saved'} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={onSave} loading={saving} disabled={!hasChanges}>
                  Save settings
                </Button>
                <Button variant="secondary" onClick={onDiscard} disabled={!hasChanges || saving}>
                  Discard changes
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-border bg-surface p-4 shadow-card sm:rounded-[2rem] sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Brand identity</p>
          <h3 className="mt-2 text-2xl font-black text-text">Verso Admin Control</h3>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            A dedicated admin workspace for moderation, oversight, and role management.
          </p>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-border bg-surface-2 sm:rounded-[1.8rem]">
            <div className={`p-5 transition-colors sm:p-6 ${draft.display_mode === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img src={versoLogo} alt="Verso" className="h-12 w-auto" />
                <div>
                  <p className="text-lg font-black">Admin Control</p>
                  <p className={`text-sm ${draft.display_mode === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>Responsive oversight for users and learning content.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-border bg-surface-2 p-4 sm:rounded-[1.6rem]">
            <p className="text-sm font-black text-text">Why this page helps later</p>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              It gives you room to add more controls later, like typography, admin-only density settings, moderation defaults, or analytics preferences, without redesigning the whole flow.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function OverviewSection({ loading, metrics, activeMaterialTotal, archivedMaterialTotal, recentActivity, contentStatusBreakdown, onJump }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[1.5rem] border border-border bg-surface sm:h-40 sm:rounded-[1.8rem]" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
          <div className="h-72 animate-pulse rounded-[1.5rem] border border-border bg-surface sm:h-80 sm:rounded-[1.8rem]" />
          <div className="h-72 animate-pulse rounded-[1.5rem] border border-border bg-surface sm:h-80 sm:rounded-[1.8rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Users" value={metrics.total_users || 0} hint={`${metrics.active_users || 0} active, ${metrics.blocked_users || 0} blocked.`} tone="accent" />
        <AdminStatCard label="Admins" value={metrics.admins || 0} hint="Accounts with elevated control access." tone="warning" />
        <AdminStatCard label="Active Materials" value={activeMaterialTotal} hint="Visible to users in their live library flows." tone="success" />
        <AdminStatCard label="Archived Materials" value={archivedMaterialTotal} hint="Stored out of the primary learning workspace." tone="neutral" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
        <section className="rounded-[1.6rem] border border-border bg-surface p-4 shadow-card sm:rounded-[1.8rem] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Platform health</p>
              <h2 className="mt-2 text-2xl font-black text-text sm:text-3xl">A cleaner picture of content flow.</h2>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-accent">
              <Shield size={22} />
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <MetricPanel title="Documents" meta={`${metrics.documents || 0} total`} items={[
              ['Processing', metrics.documents_processing || 0, 'bg-amber-500'],
              ['Done', metrics.documents_done || 0, 'bg-emerald-500'],
              ['Error', metrics.documents_error || 0, 'bg-rose-500'],
            ]} />
            <MetricPanel title="Storage" meta={`${activeMaterialTotal + archivedMaterialTotal} materials`} items={[
              ['Active', activeMaterialTotal, 'bg-accent'],
              ['Archived', archivedMaterialTotal, 'bg-slate-500'],
            ]} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric icon={FolderKanban} label="Documents" value={metrics.documents || 0} />
            <MiniMetric icon={BookOpen} label="Study guides" value={metrics.study_guides || 0} />
            <MiniMetric icon={Layers3} label="Flashcard sets" value={metrics.flashcard_sets || 0} />
            <MiniMetric icon={GraduationCap} label="Quizzes" value={metrics.quizzes || 0} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <QuickActionCard icon={Users} title="Review users" body="Move straight into account moderation and role checks." onClick={() => onJump('users')} />
            <QuickActionCard icon={FileText} title="Open active content" body="Audit what learners can access right now." onClick={() => onJump('content', { archived: 'active' })} />
            <QuickActionCard icon={Archive} title="Inspect archive" body="Restore or delete stored materials from one page." onClick={() => onJump('archived', { archived: 'archived' })} />
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-border bg-surface p-4 shadow-card sm:rounded-[1.8rem] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">Recent activity</p>
              <h2 className="mt-2 text-2xl font-black text-text">Latest admin actions</h2>
            </div>
            <div className="rounded-2xl bg-surface-2 px-3 py-2 text-sm font-bold text-text-muted">
              {recentActivity.length} shown
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {recentActivity.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-border px-4 py-6 text-sm text-text-muted">
                No audit events yet. Actions from user management and content moderation will appear here.
              </div>
            ) : recentActivity.map((item) => (
              <article key={item.id} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
                <p className="text-sm font-black text-text">{formatAuditEvent(item.event)}</p>
                <p className="mt-1 text-sm text-text-muted">{summarizeAudit(item.metadata)}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{formatDateTime(item.created_at)}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-text">Document readiness</span>
              <span className="text-text-muted">{contentStatusBreakdown.donePct}% done</span>
            </div>
            <div className="space-y-3">
              <ProgressRow label="Done" value={contentStatusBreakdown.done} percent={contentStatusBreakdown.donePct} tone="bg-emerald-500" />
              <ProgressRow label="Processing" value={contentStatusBreakdown.processing} percent={contentStatusBreakdown.processingPct} tone="bg-amber-500" />
              <ProgressRow label="Errored" value={contentStatusBreakdown.errored} percent={contentStatusBreakdown.erroredPct} tone="bg-rose-500" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersSection({ users, loading, filters, pagination, onFilterChange, onCreateUser, onEditUser, onViewUserContent, onToggleBlock, onDeleteUser }) {
  return (
    <section className="rounded-[1.7rem] border border-border bg-surface shadow-card sm:rounded-[2rem]">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">User management</p>
            <h2 className="mt-2 text-2xl font-black text-text sm:text-3xl">Accounts, roles, and access history.</h2>
            <p className="mt-2 text-sm leading-7 text-text-muted">Create accounts here, then inspect each user’s active and archived content without leaving this workspace.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_10rem_10rem_auto]">
            <FilterInput value={filters.search} onChange={(value) => onFilterChange('search', value)} placeholder="Search email, name, or username" />
            <select value={filters.role} onChange={(event) => onFilterChange('role', event.target.value)} className="cursor-pointer rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent">
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="admin">Admins</option>
            </select>
            <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)} className="cursor-pointer rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <Button className="w-full sm:w-auto" icon={<UserPlus size={16} />} onClick={onCreateUser}>Create account</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={6} />
      ) : users.length === 0 ? (
        <EmptyPanel icon={Users} title="No users matched this filter." body="Try a broader search or create a new account directly from this management panel." actionLabel="Create account" onAction={onCreateUser} />
      ) : (
        <>
          <div className="space-y-3 p-4 sm:p-5">
            {users.map((user) => (
              <article key={user.id} className="rounded-[1.5rem] border border-border bg-surface-2 p-4 sm:rounded-[1.8rem] sm:p-5">
                <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
                  <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]">
                    <div>
                      <p className="text-lg font-black text-text">{user.full_name || 'Unnamed user'}</p>
                      <p className="mt-1 text-sm text-text-muted">@{user.username || 'no-username'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">Joined {formatShortDate(user.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip tone={user.role === 'admin' ? 'warning' : 'accent'}>{user.role}</Chip>
                      <Chip tone={user.is_blocked ? 'danger' : 'success'}>{user.is_blocked ? 'Blocked' : 'Active'}</Chip>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
                    <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => onViewUserContent(user, false)}>View content</Button>
                    <Button size="sm" variant="secondary" icon={<Archive size={14} />} onClick={() => onViewUserContent(user, true)}>View archive</Button>
                    <Button size="sm" variant="secondary" icon={<UserCog size={14} />} onClick={() => onEditUser(user)}>Edit</Button>
                    <Button size="sm" variant="secondary" icon={<AlertTriangle size={14} />} onClick={() => onToggleBlock(user)}>{user.is_blocked ? 'Unblock' : 'Block'}</Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => onDeleteUser(user)}>Delete</Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <InfoPill label="Login attempts" value={user.login_attempts || 0} />
                  <InfoPill label="Lock status" value={user.locked_until ? `Until ${formatDateTime(user.locked_until)}` : 'Not locked'} />
                  <InfoPill label="User id" value={truncateMiddle(user.id)} />
                  <InfoPill label="Account type" value={user.role === 'admin' ? 'Administrative access' : 'Student access'} />
                </div>
              </article>
            ))}
          </div>
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} onPrev={() => onFilterChange('page', Math.max(1, pagination.page - 1))} onNext={() => onFilterChange('page', Math.min(pagination.totalPages, pagination.page + 1))} />
        </>
      )}
    </section>
  );
}

function ContentSection({ archived, items, loading, filters, pagination, metrics, onFilterChange, onClearOwner, onEditContent, onDeleteContent }) {
  const sectionLabel = archived ? 'Archived content' : 'Active content';
  const totalBySection = archived
    ? Number(metrics.documents_archived || 0) + Number(metrics.study_guides_archived || 0) + Number(metrics.flashcard_sets_archived || 0) + Number(metrics.quizzes_archived || 0)
    : Number(metrics.documents_active || 0) + Number(metrics.study_guides_active || 0) + Number(metrics.flashcard_sets_active || 0) + Number(metrics.quizzes_active || 0);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(CONTENT_TYPE_META).map(([type, meta]) => {
          const key = archived ? `${type}_archived` : `${type}_active`;
          return (
            <ContentTypeCard key={type} icon={meta.icon} label={meta.label} value={metrics[key] || 0} active={filters.type === type} onClick={() => onFilterChange('type', filters.type === type ? 'all' : type)} />
          );
        })}
      </div>

      <section className="rounded-[1.7rem] border border-border bg-surface shadow-card sm:rounded-[2rem]">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">{sectionLabel}</p>
              <h2 className="mt-2 text-2xl font-black text-text sm:text-3xl">{archived ? 'Stored and restorable materials.' : 'Live materials users can reach now.'}</h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">{totalBySection} items in this section. Filter by owner, type, or title to moderate specific content.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_minmax(15rem,1fr)_12rem]">
              <FilterInput value={filters.search} onChange={(value) => onFilterChange('search', value)} placeholder="Search by title" />
              <FilterInput value={filters.owner} onChange={(value) => onFilterChange('owner', value)} placeholder="Search owner email or username" />
              <select value={filters.type} onChange={(event) => onFilterChange('type', event.target.value)} className="cursor-pointer rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent sm:col-span-2 xl:col-span-1">
                <option value="all">All types</option>
                <option value="documents">Documents</option>
                <option value="study_guides">Study guides</option>
                <option value="flashcard_sets">Flashcard sets</option>
                <option value="quizzes">Quizzes</option>
              </select>
            </div>
          </div>

          {filters.owner || filters.owner_id ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-border bg-surface-2 px-4 py-3">
              <Chip tone="accent">Owner scoped</Chip>
              <p className="text-sm text-text">Showing content for <span className="font-bold">{filters.owner || filters.owner_id}</span></p>
              <Button size="sm" variant="secondary" onClick={onClearOwner}>Clear owner filter</Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <AdminTableSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyPanel icon={archived ? Archive : FileText} title={`No ${archived ? 'archived' : 'active'} content matched this filter.`} body="Try another content type, a different owner filter, or a broader title search." />
        ) : (
          <>
          <div className="space-y-3 p-4 sm:p-5">
            {items.map((item) => (
                <article key={`${item.type}:${item.id}`} className="rounded-[1.5rem] border border-border bg-surface-2 p-4 sm:rounded-[1.8rem] sm:p-5">
                  <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
                    <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-accent">
                            {createElement(CONTENT_TYPE_META[item.type]?.icon || FileText, { size: 18 })}
                          </span>
                          <div>
                            <p className="text-lg font-black text-text">{item.title}</p>
                            <p className="text-sm text-text-muted">{CONTENT_TYPE_META[item.type]?.singular || item.type}</p>
                          </div>
                        </div>

                        {item.type === 'study_guides' ? (
                          <div className="mt-4 rounded-[1.2rem] border border-border bg-surface p-3 sm:rounded-[1.4rem] sm:p-4">
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-text-muted">Preview</p>
                            <div className="prose prose-sm max-w-none text-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(extractPreviewHtml(item.content)) }} />
                          </div>
                        ) : item.type === 'documents' ? (
                          <p className="mt-4 text-sm text-text-muted">File type: {item.file_type ? item.file_type.toUpperCase() : 'Unknown'}{item.status ? ` • ${item.status}` : ''}</p>
                        ) : (
                          <p className="mt-4 text-sm text-text-muted">Detail editing for {CONTENT_TYPE_META[item.type]?.label.toLowerCase()} can expand as those creation flows go fully live.</p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-text">{item.owner?.full_name || item.owner?.email || 'Unknown owner'}</p>
                        <p className="mt-1 text-sm text-text-muted">{item.owner?.email || 'No email available'}</p>
                        <p className="mt-1 text-sm text-text-muted">@{item.owner?.username || 'no-username'}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Chip tone={archived ? 'neutral' : 'success'}>{archived ? 'Archived' : 'Active'}</Chip>
                        {item.type === 'documents' ? <Chip tone={item.status === 'done' ? 'success' : item.status === 'error' ? 'danger' : 'warning'}>{item.status}</Chip> : null}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
                      <Button size="sm" variant="secondary" icon={<Search size={14} />} onClick={() => onFilterChange('owner_id', item.user_id)}>More from owner</Button>
                      <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => onEditContent(item)}>Edit</Button>
                      <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => onDeleteContent(item)}>Delete</Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-muted">
                    <span>Created {formatShortDate(item.created_at)}</span>
                    <span>ID {truncateMiddle(item.id)}</span>
                    {item.document_id ? <span>Document link {truncateMiddle(item.document_id)}</span> : null}
                  </div>
                </article>
              ))}
            </div>
            <PaginationBar page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} onPrev={() => onFilterChange('page', Math.max(1, pagination.page - 1))} onNext={() => onFilterChange('page', Math.min(pagination.totalPages, pagination.page + 1))} />
          </>
        )}
      </section>
    </section>
  );
}

function MetricPanel({ title, meta, items }) {
  return (
    <div className="rounded-[1.3rem] border border-border bg-surface-2 p-4 sm:rounded-[1.5rem]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-black text-text">{title}</p>
        <span className="text-sm text-text-muted">{meta}</span>
      </div>
      <div className="space-y-3">
        {items.map(([label, value, tone]) => (
          <div key={label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold text-text">{label}</span>
              <span className="text-text-muted">{value}</span>
            </div>
            <div className="h-3 rounded-full bg-surface">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${resolvePercent(value, items)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentTypeCard({ icon, label, value, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-[1.5rem] border p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 sm:rounded-[1.8rem] sm:p-5 ${active ? 'border-accent bg-surface' : 'border-border bg-surface hover:bg-surface-2'}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-accent">
          {createElement(icon, { size: 20 })}
        </span>
        <div>
          <p className="text-2xl font-black text-text">{value}</p>
          <p className="text-sm font-semibold text-text-muted">{label}</p>
        </div>
      </div>
    </button>
  );
}

function QuickActionCard({ icon, title, body, onClick }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-[1.3rem] border border-border bg-surface-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface sm:rounded-[1.5rem]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-accent">
          {createElement(icon, { size: 18 })}
        </span>
        <ArrowRight size={16} className="text-text-muted" />
      </div>
      <p className="mt-4 text-lg font-black text-text">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
    </button>
  );
}

function FilterInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-border bg-surface-2 py-3 pl-11 pr-4 text-sm text-text outline-none transition-colors focus:border-accent" />
    </label>
  );
}

function ThemeChoiceCard({ active, icon, title, body, tone, onClick }) {
  const toneClasses = tone === 'dark'
    ? active
      ? 'border-accent bg-slate-950 text-white'
      : 'border-border bg-slate-950 text-white hover:border-accent/50'
    : active
      ? 'border-accent bg-surface text-text'
      : 'border-border bg-white text-slate-900 hover:border-accent/50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-[1.3rem] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 sm:rounded-[1.5rem] sm:p-5 ${toneClasses}`}
    >
      <div className="flex items-center gap-3">
        {createElement(icon, { size: 18 })}
        <span className="text-sm font-black">{title}</span>
      </div>
      <p className={`mt-3 text-sm leading-6 ${tone === 'dark' ? 'text-white/75' : 'opacity-75'}`}>{body}</p>
    </button>
  );
}

function MiniMetric({ icon, label, value }) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-surface-2 p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:rounded-[1.4rem]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-accent">{createElement(icon, { size: 18 })}</span>
        <div>
          <p className="text-sm font-semibold text-text-muted">{label}</p>
          <p className="text-xl font-black text-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-[1.1rem] border border-border bg-surface px-4 py-3 sm:rounded-[1.2rem]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function ProgressRow({ label, value, percent, tone }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-text">{label}</span>
        <span className="text-text-muted">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyPanel({ icon, title, body, actionLabel, onAction }) {
  return (
    <div className="px-4 py-10 text-center sm:px-5 sm:py-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-surface-2 text-accent">{createElement(icon, { size: 28 })}</div>
      <h3 className="mt-5 text-2xl font-black text-text">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-muted">{body}</p>
      {actionLabel ? <Button className="mt-6" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-surface text-text',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-700',
    danger: 'bg-rose-500/10 text-rose-600',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${tones[tone] || tones.neutral}`}>{children}</span>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-text">{label}</span>
      {children}
    </label>
  );
}

function PaginationBar({ page, totalPages, totalCount, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-text-muted">{totalCount} total records</p>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={onPrev} disabled={page <= 1}>Previous</Button>
        <span className="text-sm font-bold text-text">Page {page} of {totalPages}</span>
        <Button size="sm" variant="secondary" onClick={onNext} disabled={page >= totalPages}>Next</Button>
      </div>
    </div>
  );
}

function buildConfirmTitle(mode) {
  if (mode === 'delete-user') return 'Delete user account';
  if (mode === 'delete-content') return 'Delete content item';
  if (mode === 'toggle-block') return 'Change account access';
  return 'Confirm action';
}

function buildConfirmMessage(mode, target) {
  if (!target) return 'Confirm this action.';
  if (mode === 'delete-user') return `Delete ${target.full_name || target.email}? This action cannot be undone.`;
  if (mode === 'delete-content') return `Delete "${target.title}" from ${CONTENT_TYPE_META[target.type]?.singular || 'content'} records? This action cannot be undone.`;
  if (mode === 'toggle-block') return `${target.is_blocked ? 'Restore' : 'Block'} access for ${target.full_name || target.email}?`;
  return 'Confirm this action.';
}

function formatShortDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAuditEvent(event) {
  return String(event || 'Admin event')
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' • ');
}

function summarizeAudit(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return 'No extra metadata was recorded for this action.';
  }

  const keys = ['target_email', 'target_user_id', 'type', 'target_id', 'role'];
  const parts = keys
    .filter((key) => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '')
    .map((key) => `${key.replace(/_/g, ' ')}: ${metadata[key]}`);

  return parts.length ? parts.join(' • ') : 'No extra metadata was recorded for this action.';
}

function truncateMiddle(value = '', size = 8) {
  if (!value || value.length <= size * 2) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

function readStoredDisplayMode() {
  try {
    const cached = JSON.parse(localStorage.getItem('sharp-study-prefs') || 'null');
    return cached?.display_mode || DEFAULT_PREFERENCES.display_mode;
  } catch {
    return DEFAULT_PREFERENCES.display_mode;
  }
}

function titleCase(value = '') {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function extractPreviewHtml(content = '') {
  const normalized = String(content || '').trim();
  if (!normalized) return '<p>No content yet.</p>';
  return normalized.length > 1200 ? `${normalized.slice(0, 1200)}<p>...</p>` : normalized;
}

function resolvePercent(value, items) {
  const total = items.reduce((sum, [, next]) => sum + Number(next || 0), 0) || 1;
  return Math.max(8, Math.round((Number(value || 0) / total) * 100));
}
