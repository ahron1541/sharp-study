import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Archive, BookOpen, FileText, LoaderCircle, Shield, Sparkles, Trash2, UserCog, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../../shared/components/Button';
import Modal from '../../../shared/components/Modal';
import AdminStatCard from '../components/AdminStatCard';
import AdminTableSkeleton from '../components/AdminTableSkeleton';
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'content', label: 'Content', icon: FileText },
];

const USER_EMPTY = {
  email: '',
  username: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  password: '',
  role: 'student',
};

const USER_FILTERS = {
  search: '',
  role: 'all',
  status: 'all',
  page: 1,
};

const CONTENT_FILTERS = {
  search: '',
  type: 'all',
  page: 1,
};

const CONTENT_TYPE_LABELS = {
  documents: 'Document',
  study_guides: 'Study Guide',
  flashcard_sets: 'Flashcard Set',
  quizzes: 'Quiz',
};

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [userFilters, setUserFilters] = useState(USER_FILTERS);
  const [contentItems, setContentItems] = useState([]);
  const [contentPagination, setContentPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [contentFilters, setContentFilters] = useState(CONTENT_FILTERS);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [actionState, setActionState] = useState({ active: false, label: '', progress: 0 });
  const [userModal, setUserModal] = useState({ mode: 'create', open: false, form: USER_EMPTY, target: null });
  const [contentModal, setContentModal] = useState({ open: false, form: null, target: null });
  const [confirmState, setConfirmState] = useState({ open: false, mode: '', target: null });
  const progressTimerRef = useRef(null);

  const metrics = useMemo(() => overview?.metrics || {}, [overview]);
  const recentActivity = useMemo(() => overview?.recent_activity || [], [overview]);

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

  async function trackAction(label, task) {
    setActionState({ active: true, label, progress: 18 });
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);

    progressTimerRef.current = window.setInterval(() => {
      setActionState((current) => ({
        ...current,
        progress: current.progress >= 90 ? current.progress : current.progress + 8,
      }));
    }, 180);

    try {
      const result = await task();
      setActionState({ active: true, label, progress: 100 });
      window.setTimeout(() => {
        setActionState({ active: false, label: '', progress: 0 });
      }, 280);
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
      const data = await fetchAdminContent(contentFilters);
      setContentItems(data.items || []);
      setContentPagination(data.pagination || { page: 1, totalPages: 1, totalCount: 0 });
    } catch (error) {
      toast.error(error.message || 'Failed to load content.');
    } finally {
      setContentLoading(false);
    }
  }, [contentFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'users') {
      const timer = window.setTimeout(() => {
        void loadUsers();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [tab, loadUsers]);

  useEffect(() => {
    if (tab === 'content') {
      const timer = window.setTimeout(() => {
        void loadContent();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [tab, loadContent]);

  useEffect(() => () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }
  }, []);

  function updateUserFilter(key, value) {
    setUserFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  function updateContentFilter(key, value) {
    setContentFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
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
        const payload = {
          username: userModal.form.username,
          first_name: userModal.form.first_name,
          middle_name: userModal.form.middle_name,
          last_name: userModal.form.last_name,
          role: userModal.form.role,
          is_blocked: Boolean(userModal.form.is_blocked),
        };
        const response = await trackAction('Saving user changes', () => updateAdminUser(userModal.target.id, payload));
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
      setContentModal({ open: false, form: null, target: null });
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
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-6 shadow-card sm:px-8 sm:py-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_58%)] lg:block" />
        {actionState.active ? (
          <div className="absolute inset-x-0 top-0 h-1 bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${actionState.progress}%` }}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-text-muted">Administrator Workspace</p>
            <h1 className="mt-3 text-[clamp(2.2rem,4vw,4rem)] font-display font-black leading-none text-text">
              Secure control for users and study content.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
              Manage accounts, moderate uploaded materials, and review system activity from one protected dashboard that follows your existing app experience.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="md"
              icon={<UserPlus size={16} />}
              onClick={openCreateUserModal}
            >
              Create account
            </Button>
            <Button
              size="md"
              variant="secondary"
              icon={actionState.active ? <LoaderCircle size={16} /> : <Sparkles size={16} />}
              onClick={() => {
                void Promise.all([loadOverview(), tab === 'users' ? loadUsers() : Promise.resolve(), tab === 'content' ? loadContent() : Promise.resolve()]);
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {actionState.active ? (
          <p className="mt-5 text-sm font-bold text-accent">{actionState.label}...</p>
        ) : (
          <p className="mt-5 text-sm text-text-muted">
            Access is enforced on the backend with live admin role checks and blocked-account protection.
          </p>
        )}
      </section>

      <section className="rounded-[2rem] border border-border bg-surface p-3 shadow-card">
        <div role="tablist" className="grid gap-2 sm:grid-cols-3">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 rounded-[1.4rem] px-4 py-4 text-left transition-colors ${
                tab === id
                  ? 'bg-accent text-accent-text'
                  : 'bg-surface-2 text-text hover:bg-surface'
              }`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tab === id ? 'bg-white/16' : 'bg-surface'}`}>
                {createElement(icon, { size: 20 })}
              </span>
              <span>
                <span className="block text-base font-black">{label}</span>
                <span className={`block text-xs ${tab === id ? 'text-white/80' : 'text-text-muted'}`}>
                  {id === 'overview' ? 'Live status' : id === 'users' ? 'Profiles and permissions' : 'Uploaded materials'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {tab === 'overview' ? (
        overviewLoading ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[1.8rem] border border-border bg-surface" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
              <div className="h-72 animate-pulse rounded-[1.8rem] border border-border bg-surface" />
              <div className="h-72 animate-pulse rounded-[1.8rem] border border-border bg-surface" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard label="Users" value={metrics.total_users || 0} hint={`${metrics.active_users || 0} active and ${metrics.blocked_users || 0} blocked accounts.`} tone="accent" />
              <AdminStatCard label="Admins" value={metrics.admins || 0} hint="Protected accounts with elevated access." tone="warning" />
              <AdminStatCard label="Documents" value={metrics.documents || 0} hint={`${metrics.documents_processing || 0} still processing right now.`} tone="neutral" />
              <AdminStatCard label="Materials" value={(metrics.study_guides || 0) + (metrics.flashcard_sets || 0) + (metrics.quizzes || 0)} hint="Generated and manually managed study items." tone="success" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
              <section className="rounded-[1.8rem] border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-accent">
                    <Archive size={20} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-text">Document flow</h2>
                    <p className="text-sm text-text-muted">A quick health check for uploaded files and generated outputs.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <ProgressRow label="Done" value={contentStatusBreakdown.done} percent={contentStatusBreakdown.donePct} tone="bg-emerald-500" />
                  <ProgressRow label="Processing" value={contentStatusBreakdown.processing} percent={contentStatusBreakdown.processingPct} tone="bg-amber-500" />
                  <ProgressRow label="Errored" value={contentStatusBreakdown.errored} percent={contentStatusBreakdown.erroredPct} tone="bg-rose-500" />
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <MiniMetric icon={BookOpen} label="Study guides" value={metrics.study_guides || 0} />
                  <MiniMetric icon={FileText} label="Quizzes" value={metrics.quizzes || 0} />
                  <MiniMetric icon={Sparkles} label="Flashcard sets" value={metrics.flashcard_sets || 0} />
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-accent">
                    <Shield size={20} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-black text-text">Recent activity</h2>
                    <p className="text-sm text-text-muted">Audit events from your protected administrator actions.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {recentActivity.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-border px-4 py-6 text-sm text-text-muted">
                      No audit events have been recorded yet.
                    </div>
                  ) : (
                    recentActivity.map((item) => (
                      <article key={item.id} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
                        <p className="text-sm font-black text-text">{formatAuditEvent(item.event)}</p>
                        <p className="mt-1 text-sm text-text-muted">{summarizeAudit(item.metadata)}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                          {formatDateTime(item.created_at)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )
      ) : null}

      {tab === 'users' ? (
        <section className="rounded-[2rem] border border-border bg-surface shadow-card">
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">User directory</p>
                <h2 className="mt-2 text-3xl font-black text-text">Manage accounts and access.</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="search"
                  value={userFilters.search}
                  onChange={(event) => updateUserFilter('search', event.target.value)}
                  placeholder="Search email or username"
                  className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                />
                <select
                  value={userFilters.role}
                  onChange={(event) => updateUserFilter('role', event.target.value)}
                  className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="all">All roles</option>
                  <option value="student">Students</option>
                  <option value="admin">Admins</option>
                </select>
                <select
                  value={userFilters.status}
                  onChange={(event) => updateUserFilter('status', event.target.value)}
                  className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </div>

          {usersLoading ? (
            <AdminTableSkeleton rows={6} />
          ) : users.length === 0 ? (
            <EmptyPanel
              icon={Users}
              title="No users matched this filter."
              body="Try a broader search or create the first account from this protected workspace."
              actionLabel="Create account"
              onAction={openCreateUserModal}
            />
          ) : (
            <>
              <div className="space-y-3 p-5">
                {users.map((user) => (
                  <article key={user.id} className="grid gap-4 rounded-[1.6rem] border border-border bg-surface-2 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_0.7fr_0.8fr_0.8fr_auto] lg:items-center">
                    <div>
                      <p className="text-base font-black text-text">{user.full_name || 'Unnamed user'}</p>
                      <p className="mt-1 text-sm text-text-muted">@{user.username || 'no-username'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">Joined {formatShortDate(user.created_at)}</p>
                    </div>
                    <Chip tone={user.role === 'admin' ? 'warning' : 'accent'}>{user.role}</Chip>
                    <Chip tone={user.is_blocked ? 'danger' : 'success'}>{user.is_blocked ? 'Blocked' : 'Active'}</Chip>
                    <div className="text-sm text-text-muted">
                      <p>Login attempts: {user.login_attempts || 0}</p>
                      <p>{user.locked_until ? `Locked until ${formatDateTime(user.locked_until)}` : 'No active lock'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="secondary" icon={<UserCog size={14} />} onClick={() => openEditUserModal(user)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<AlertTriangle size={14} />}
                        onClick={() => setConfirmState({ open: true, mode: 'toggle-block', target: user })}
                      >
                        {user.is_blocked ? 'Unblock' : 'Block'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        onClick={() => setConfirmState({ open: true, mode: 'delete-user', target: user })}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <PaginationBar
                page={usersPagination.page}
                totalPages={usersPagination.totalPages}
                totalCount={usersPagination.totalCount}
                onPrev={() => updateUserFilter('page', Math.max(1, usersPagination.page - 1))}
                onNext={() => updateUserFilter('page', Math.min(usersPagination.totalPages, usersPagination.page + 1))}
              />
            </>
          )}
        </section>
      ) : null}

      {tab === 'content' ? (
        <section className="rounded-[2rem] border border-border bg-surface shadow-card">
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Content moderation</p>
                <h2 className="mt-2 text-3xl font-black text-text">Review uploaded files and generated materials.</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_12rem]">
                <input
                  type="search"
                  value={contentFilters.search}
                  onChange={(event) => updateContentFilter('search', event.target.value)}
                  placeholder="Search by title"
                  className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                />
                <select
                  value={contentFilters.type}
                  onChange={(event) => updateContentFilter('type', event.target.value)}
                  className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="all">All content</option>
                  <option value="documents">Documents</option>
                  <option value="study_guides">Study guides</option>
                  <option value="flashcard_sets">Flashcard sets</option>
                  <option value="quizzes">Quizzes</option>
                </select>
              </div>
            </div>
          </div>

          {contentLoading ? (
            <AdminTableSkeleton rows={6} />
          ) : contentItems.length === 0 ? (
            <EmptyPanel
              icon={FileText}
              title="No content matched this filter."
              body="Try another content type or search term to inspect the materials flowing through the platform."
            />
          ) : (
            <>
              <div className="space-y-3 p-5">
                {contentItems.map((item) => (
                  <article key={`${item.type}:${item.id}`} className="grid gap-4 rounded-[1.6rem] border border-border bg-surface-2 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_0.85fr_0.85fr_auto] lg:items-center">
                    <div>
                      <p className="text-base font-black text-text">{item.title}</p>
                      <p className="mt-1 text-sm text-text-muted">
                        {CONTENT_TYPE_LABELS[item.type] || item.type}
                        {item.type === 'documents' && item.file_type ? ` • ${item.file_type.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{item.owner?.full_name || item.owner?.email || 'Unknown owner'}</p>
                      <p className="mt-1 text-sm text-text-muted">{item.owner?.email || 'No email available'}</p>
                    </div>
                    <div className="space-y-2">
                      <Chip tone="neutral">{item.is_archived ? 'Archived' : 'Active'}</Chip>
                      {item.type === 'documents' ? (
                        <Chip tone={item.status === 'done' ? 'success' : item.status === 'error' ? 'danger' : 'warning'}>
                          {item.status}
                        </Chip>
                      ) : null}
                    </div>
                    <p className="text-sm text-text-muted">{formatShortDate(item.created_at)}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => openEditContentModal(item)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        onClick={() => setConfirmState({ open: true, mode: 'delete-content', target: item })}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <PaginationBar
                page={contentPagination.page}
                totalPages={contentPagination.totalPages}
                totalCount={contentPagination.totalCount}
                onPrev={() => updateContentFilter('page', Math.max(1, contentPagination.page - 1))}
                onNext={() => updateContentFilter('page', Math.min(contentPagination.totalPages, contentPagination.page + 1))}
              />
            </>
          )}
        </section>
      ) : null}

      <Modal
        isOpen={userModal.open}
        onClose={() => setUserModal({ mode: 'create', open: false, form: USER_EMPTY, target: null })}
        title={userModal.mode === 'create' ? 'Create a managed account' : 'Update user account'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleUserSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input
                required
                value={userModal.form.first_name}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, first_name: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={userModal.form.last_name}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, last_name: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>
            <Field label="Middle name">
              <input
                value={userModal.form.middle_name}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, middle_name: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>
            <Field label="Username">
              <input
                required
                value={userModal.form.username}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, username: event.target.value.toLowerCase() } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                disabled={userModal.mode === 'edit'}
                value={userModal.form.email}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, email: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
              />
            </Field>
            <Field label="Role">
              <select
                value={userModal.form.role}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, role: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>

          {userModal.mode === 'create' ? (
            <Field label="Temporary password">
              <input
                required
                type="password"
                value={userModal.form.password}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, password: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
              <p className="mt-2 text-xs leading-6 text-text-muted">
                Must include uppercase, lowercase, number, and special character.
              </p>
            </Field>
          ) : (
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text">
              <input
                type="checkbox"
                checked={Boolean(userModal.form.is_blocked)}
                onChange={(event) => setUserModal((current) => ({ ...current, form: { ...current.form, is_blocked: event.target.checked } }))}
              />
              Block this account
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit">{userModal.mode === 'create' ? 'Create account' : 'Save changes'}</Button>
            <Button type="button" variant="secondary" onClick={() => setUserModal({ mode: 'create', open: false, form: USER_EMPTY, target: null })}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={contentModal.open}
        onClose={() => setContentModal({ open: false, form: null, target: null })}
        title="Update managed content"
        size={contentModal.target?.type === 'study_guides' ? 'xl' : 'lg'}
      >
        {contentModal.form ? (
          <form className="space-y-4" onSubmit={handleContentSubmit}>
            <Field label="Title">
              <input
                required
                value={contentModal.form.title}
                onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, title: event.target.value } }))}
                className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>

            {contentModal.target?.type === 'documents' ? (
              <Field label="Processing status">
                <select
                  value={contentModal.form.status}
                  onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, status: event.target.value } }))}
                  className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="processing">Processing</option>
                  <option value="done">Done</option>
                  <option value="error">Error</option>
                </select>
              </Field>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text">
              <input
                type="checkbox"
                checked={Boolean(contentModal.form.is_archived)}
                onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, is_archived: event.target.checked } }))}
              />
              Archive this item
            </label>

            {contentModal.target?.type === 'study_guides' ? (
              <Field label="Guide content">
                <textarea
                  rows={12}
                  value={contentModal.form.content}
                  onChange={(event) => setContentModal((current) => ({ ...current, form: { ...current.form, content: event.target.value } }))}
                  className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-accent"
                />
              </Field>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setContentModal({ open: false, form: null, target: null })}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        isOpen={confirmState.open}
        onClose={() => setConfirmState({ open: false, mode: '', target: null })}
        title={buildConfirmTitle(confirmState.mode)}
        size="sm"
      >
        <p className="text-sm leading-7 text-text">
          {buildConfirmMessage(confirmState.mode, confirmState.target)}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant={confirmState.mode.includes('delete') ? 'danger' : 'primary'}
            onClick={handleConfirmAction}
          >
            Confirm
          </Button>
          <Button variant="secondary" onClick={() => setConfirmState({ open: false, mode: '', target: null })}>
            Cancel
          </Button>
        </div>
      </Modal>
    </main>
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

function MiniMetric({ icon, label, value }) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-accent">
          {createElement(icon, { size: 18 })}
        </span>
        <div>
          <p className="text-sm font-semibold text-text-muted">{label}</p>
          <p className="text-xl font-black text-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ icon, title, body, actionLabel, onAction }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-surface-2 text-accent">
        {createElement(icon, { size: 28 })}
      </div>
      <h3 className="mt-5 text-2xl font-black text-text">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-muted">{body}</p>
      {actionLabel ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
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

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
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
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-muted">{totalCount} total records</p>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={onPrev} disabled={page <= 1}>
          Previous
        </Button>
        <span className="text-sm font-bold text-text">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" variant="secondary" onClick={onNext} disabled={page >= totalPages}>
          Next
        </Button>
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
  if (mode === 'delete-content') return `Delete "${target.title}" from ${CONTENT_TYPE_LABELS[target.type] || 'content'} records? This action cannot be undone.`;
  if (mode === 'toggle-block') return `${target.is_blocked ? 'Restore' : 'Block'} access for ${target.full_name || target.email}?`;
  return 'Confirm this action.';
}

function formatShortDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
