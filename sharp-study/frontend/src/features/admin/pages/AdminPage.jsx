import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileWarning,
  Gauge,
  Key,
  Loader2,
  Megaphone,
  Moon,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';

import Modal from '../../../shared/components/Modal';
import AdminStatCard from '../components/AdminStatCard';
import { DEFAULT_PREFERENCES } from '../../theme/constants/themes';
import { applyPreferences } from '../../theme/hooks/useTheme';
import { savePreferences } from '../../theme/services/preferences.service';
import { useAuth } from '../../auth/context/AuthContext';
import { changePassword } from '../../auth/shared/services/auth.service';
import {
  getPasswordScore,
  MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_SCORE,
  PASSWORD_REQUIREMENTS,
} from '../../auth/shared/utils/passwordPolicy';
import {
  clearAdminOldSystemLogs,
  createAdminAnnouncement,
  createAdminPromptTemplate,
  createAdminUser,
  deleteAdminAiRateLimitOverride,
  deleteAdminAnnouncement,
  deleteAdminFeedbackReport,
  deleteAdminPromptTemplate,
  deleteAdminSystemLog,
  deleteAdminUser,
  fetchAdminAiControls,
  fetchAdminAnnouncements,
  fetchAdminFeedback,
  fetchAdminHealth,
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminAiRateLimit,
  updateAdminAnnouncement,
  updateAdminFeedbackReport,
  updateAdminPromptTemplate,
  updateAdminUser,
  upsertAdminAiRateLimitOverride,
} from '../services/admin.service';

const MotionDiv = motion.div;

const USER_EMPTY = {
  email: '',
  username: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  password: '',
  role: 'student',
  is_blocked: false,
};

const ANNOUNCEMENT_EMPTY = {
  title: '',
  body: '',
  category: 'general',
  priority: 'normal',
  status: 'draft',
  starts_at: '',
  ends_at: '',
};

const PROMPT_EMPTY = {
  template_key: 'study_guide',
  title: '',
  description: '',
  content: '',
  is_active: false,
};

const SECTION_COPY = {
  overview: ['Overview', 'A simple control room for users, reports, AI activity, and platform health.'],
  users: ['User Management', 'Create accounts, update roles, block access, and delete accounts for privacy requests.'],
  feedback: ['Feedback', 'Review AI content reports and thumbs up/down signals from students.'],
  announcements: ['Announcements & Updates', 'Write updates that appear in the user Notifications page.'],
  ai: ['AI Controls', 'Adjust AI request limits and prompt templates without exposing API keys.'],
  health: ['Health & Logs', 'Check provider configuration, recent AI failures, and operational logs.'],
  settings: ['Settings', 'Keep admin appearance simple with light or dark mode only.'],
};

const PROMPT_LABELS = {
  study_guide: 'Study Guide',
  key_references: 'Key References',
  discussion_questions: 'Discussion Questions',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
};

const PROMPT_STARTERS = {
  study_guide: `Create a clear, student-friendly study guide from the lesson text below.

Requirements:
- Use only facts from the lesson text.
- Organize the output with headings, concise explanations, and important terms.
- Do not invent details.

Lesson text:
{{source_text}}`,
  key_references: `Return valid JSON only. Extract the most important references from the lesson text.

Use this shape:
[
  { "label": "Important term or reference", "detail": "Short explanation supported by the lesson" }
]

Lesson text:
{{source_text}}`,
  discussion_questions: `Return valid JSON only. Create discussion questions that can be answered from the lesson text.

Use this shape:
[
  { "question": "Question text", "support_snippet": "Short phrase from the lesson" }
]

Lesson text:
{{source_text}}`,
  flashcards: `Return valid JSON only. Create {{target_count}} {{difficulty}} flashcards from the lesson text.

Difficulty rules:
{{difficulty_rules}}

Use this shape:
[
  { "front": "Question or term", "back": "Answer", "hint": "Short clue" }
]

Lesson text:
{{source_text}}`,
  quiz: `Return valid JSON only. Create {{target_count}} {{difficulty}} quiz questions from the lesson text.

Difficulty rules:
{{difficulty_rules}}

Use this shape:
[
  {
    "type": "multiple_choice",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0,
    "support_snippet": "Short phrase from the lesson"
  }
]

Lesson text:
{{source_text}}`,
};

const OVERVIEW_PAGING_DEFAULTS = {
  aiPage: 1,
  aiPageSize: 5,
  activityPage: 1,
  activityPageSize: 6,
};

const HEALTH_PAGING_DEFAULTS = {
  logPage: 1,
  logPageSize: 8,
};

const REPORT_REASONS = {
  incorrect: 'Incorrect content',
  confusing: 'Confusing wording',
  incomplete: 'Incomplete output',
  formatting: 'Formatting issue',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

const PASSWORD_CHECK_LABELS = {
  length: '12+ characters strength point',
  upper: 'One uppercase letter',
  lower: 'One lowercase letter',
  number: 'One number',
  special: 'One special character',
};

const PASSWORD_POLICY_CHECKS = [
  { key: 'minimum', label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (value) => value.length >= MIN_PASSWORD_LENGTH },
  ...PASSWORD_REQUIREMENTS.map((rule) => ({
    ...rule,
    label: PASSWORD_CHECK_LABELS[rule.key] || rule.key,
  })),
];

export default function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const section = useMemo(() => {
    const value = searchParams.get('section') || 'overview';
    return Object.keys(SECTION_COPY).includes(value) ? value : 'overview';
  }, [searchParams]);

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [feedback, setFeedback] = useState({ reports: [], pagination: { page: 1, totalPages: 1, totalCount: 0 } });
  const [announcements, setAnnouncements] = useState([]);
  const [aiControls, setAiControls] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState({ active: false, label: '' });
  const [overviewPaging, setOverviewPaging] = useState(OVERVIEW_PAGING_DEFAULTS);
  const [healthPaging, setHealthPaging] = useState(HEALTH_PAGING_DEFAULTS);
  const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all', page: 1 });
  const [feedbackFilters, setFeedbackFilters] = useState({ search: '', status: 'all', type: 'all', page: 1 });
  const [announcementFilter, setAnnouncementFilter] = useState('all');
  const [userModal, setUserModal] = useState({ open: false, mode: 'create', form: USER_EMPTY, target: null });
  const [announcementModal, setAnnouncementModal] = useState({ open: false, mode: 'create', form: ANNOUNCEMENT_EMPTY, target: null });
  const [promptModal, setPromptModal] = useState({ open: false, mode: 'create', form: PROMPT_EMPTY, target: null });
  const [confirm, setConfirm] = useState({ open: false, title: '', body: '', action: null, danger: true });
  const [rateDraft, setRateDraft] = useState({ daily_limit: 10, window_hours: 24 });
  const [overrideDraft, setOverrideDraft] = useState({ user_id: '', daily_limit: 10, is_enabled: true });
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    ...(profile?.preferences || {}),
  }));

  const title = SECTION_COPY[section][0];
  const subtitle = SECTION_COPY[section][1];

  const loadOverview = useCallback(async () => {
    const data = await fetchAdminOverview(overviewPaging);
    setOverview(data);
  }, [overviewPaging]);

  const loadUsers = useCallback(async () => {
    const data = await fetchAdminUsers(userFilters);
    setUsers(data.users || []);
    setUsersPagination(data.pagination || { page: 1, totalPages: 1, totalCount: 0 });
  }, [userFilters]);

  const loadFeedback = useCallback(async () => {
    const data = await fetchAdminFeedback(feedbackFilters);
    setFeedback(data);
  }, [feedbackFilters]);

  const loadAnnouncements = useCallback(async () => {
    const data = await fetchAdminAnnouncements({ status: announcementFilter });
    setAnnouncements(data.announcements || []);
  }, [announcementFilter]);

  const loadAiControls = useCallback(async () => {
    const data = await fetchAdminAiControls();
    setAiControls(data);
    setRateDraft({
      daily_limit: Number(data.rate_limit?.daily_limit || 10),
      window_hours: Number(data.rate_limit?.window_hours || 24),
    });
  }, []);

  const loadHealth = useCallback(async () => {
    const data = await fetchAdminHealth(healthPaging);
    setHealth(data);
  }, [healthPaging]);

  const reloadCurrentSection = useCallback(async () => {
    if (section === 'overview') await loadOverview();
    if (section === 'users') await loadUsers();
    if (section === 'feedback') await loadFeedback();
    if (section === 'announcements') await loadAnnouncements();
    if (section === 'ai') await loadAiControls();
    if (section === 'health') await loadHealth();
  }, [loadAiControls, loadAnnouncements, loadFeedback, loadHealth, loadOverview, loadUsers, section]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reloadCurrentSection()
      .catch((error) => {
        if (active) toast.error(error.message || 'Failed to load admin data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadCurrentSection]);

  useEffect(() => {
    setSettingsDraft({
      ...DEFAULT_PREFERENCES,
      ...(profile?.preferences || {}),
    });
  }, [profile?.preferences]);

  async function runAction(label, task, after) {
    setAction({ active: true, label });
    try {
      const result = await task();
      if (after) await after(result);
      toast.success(label);
      return result;
    } catch (error) {
      toast.error(error.message || 'Action failed.');
      throw error;
    } finally {
      setAction({ active: false, label: '' });
    }
  }

  function openCreateUser() {
    setUserModal({ open: true, mode: 'create', form: USER_EMPTY, target: null });
  }

  function openEditUser(user) {
    setUserModal({
      open: true,
      mode: 'edit',
      target: user,
      form: {
        email: user.email || '',
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

  async function submitUser(event) {
    event.preventDefault();
    const form = userModal.form;
    if (userModal.mode === 'create') {
      await runAction('Account created', () => createAdminUser(form), async () => {
        setUserModal({ open: false, mode: 'create', form: USER_EMPTY, target: null });
        await Promise.all([loadUsers(), loadOverview()]);
      });
      return;
    }

    await runAction('User updated', () => updateAdminUser(userModal.target.id, {
      username: form.username,
      first_name: form.first_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
      role: form.role,
      is_blocked: Boolean(form.is_blocked),
    }), async () => {
      setUserModal({ open: false, mode: 'create', form: USER_EMPTY, target: null });
      await Promise.all([loadUsers(), loadOverview()]);
    });
  }

  function requestDeleteUser(user) {
    setConfirm({
      open: true,
      danger: true,
      title: 'Delete user account?',
      body: `This removes ${user.email} and their dependent study data for privacy cleanup.`,
      action: async () => {
        await runAction('User deleted', () => deleteAdminUser(user.id), async () => {
          await Promise.all([loadUsers(), loadOverview()]);
        });
      },
    });
  }

  function requestToggleBlock(user) {
    setConfirm({
      open: true,
      danger: !user.is_blocked,
      title: user.is_blocked ? 'Unblock account?' : 'Block account?',
      body: user.is_blocked ? 'This restores access for the selected user.' : 'This prevents the selected user from using protected app routes.',
      action: async () => {
        await runAction(user.is_blocked ? 'User unblocked' : 'User blocked', () => updateAdminUser(user.id, { is_blocked: !user.is_blocked }), async () => {
          await Promise.all([loadUsers(), loadOverview()]);
        });
      },
    });
  }

  function openReportDetail(report) {
    const returnTo = `${location.pathname}${location.search || '?section=feedback'}`;
    navigate(`/admin/reports/${report.id}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function requestUpdateReport(report, payload) {
    const nextStatus = payload.status || report.status;
    if (nextStatus === report.status) {
      toast.success('Report already has that status.');
      return;
    }

    setConfirm({
      open: true,
      title: 'Update report status?',
      body: `Move "${report.content_title || 'this report'}" from ${report.status} to ${nextStatus}.`,
      danger: nextStatus === 'dismissed',
      action: async () => {
        await runAction('Report updated', () => updateAdminFeedbackReport(report.id, payload), async () => {
          await Promise.all([loadFeedback(), loadOverview()]);
        });
      },
    });
  }

  function requestDeleteReport(report) {
    setConfirm({
      open: true,
      title: 'Delete report?',
      body: 'This removes the report from the moderation queue.',
      danger: true,
      action: async () => {
        await runAction('Report deleted', () => deleteAdminFeedbackReport(report.id), async () => {
          await Promise.all([loadFeedback(), loadOverview()]);
        });
      },
    });
  }

  function openAnnouncement(announcement = null) {
    setAnnouncementModal({
      open: true,
      mode: announcement ? 'edit' : 'create',
      target: announcement,
      form: announcement
        ? {
          title: announcement.title || '',
          body: announcement.body || '',
          category: announcement.category || 'general',
          priority: announcement.priority || 'normal',
          status: announcement.status || 'draft',
          starts_at: toDatetimeLocal(announcement.starts_at),
          ends_at: toDatetimeLocal(announcement.ends_at),
        }
        : ANNOUNCEMENT_EMPTY,
    });
  }

  async function submitAnnouncement(event) {
    event.preventDefault();
    const payload = {
      ...announcementModal.form,
      starts_at: fromDatetimeLocal(announcementModal.form.starts_at),
      ends_at: fromDatetimeLocal(announcementModal.form.ends_at),
    };
    const task = announcementModal.mode === 'create'
      ? () => createAdminAnnouncement(payload)
      : () => updateAdminAnnouncement(announcementModal.target.id, payload);
    await runAction(announcementModal.mode === 'create' ? 'Announcement created' : 'Announcement updated', task, async () => {
      setAnnouncementModal({ open: false, mode: 'create', form: ANNOUNCEMENT_EMPTY, target: null });
      await Promise.all([loadAnnouncements(), loadOverview()]);
    });
  }

  function requestDeleteAnnouncement(announcement) {
    setConfirm({
      open: true,
      title: 'Delete announcement?',
      body: 'Users will no longer see this notification.',
      danger: true,
      action: async () => {
        await runAction('Announcement deleted', () => deleteAdminAnnouncement(announcement.id), async () => {
          await Promise.all([loadAnnouncements(), loadOverview()]);
        });
      },
    });
  }

  function openPrompt(template = null) {
    setPromptModal({
      open: true,
      mode: template ? 'edit' : 'create',
      target: template,
      form: template
        ? {
          template_key: template.template_key || 'study_guide',
          title: template.title || '',
          description: template.description || '',
          content: template.content || '',
          is_active: Boolean(template.is_active),
        }
        : PROMPT_EMPTY,
    });
  }

  async function submitPrompt(event) {
    event.preventDefault();
    const task = promptModal.mode === 'create'
      ? () => createAdminPromptTemplate(promptModal.form)
      : () => updateAdminPromptTemplate(promptModal.target.id, promptModal.form);
    await runAction(promptModal.mode === 'create' ? 'Prompt template created' : 'Prompt template updated', task, async () => {
      setPromptModal({ open: false, mode: 'create', form: PROMPT_EMPTY, target: null });
      await loadAiControls();
    });
  }

  function requestDeletePrompt(template) {
    setConfirm({
      open: true,
      title: 'Delete prompt template?',
      body: 'AI generation will use another active template or the built-in fallback prompt.',
      danger: true,
      action: async () => {
        await runAction('Prompt template deleted', () => deleteAdminPromptTemplate(template.id), loadAiControls);
      },
    });
  }

  function saveRateLimit(event) {
    event.preventDefault();
    const nextLimit = {
      daily_limit: Number(rateDraft.daily_limit),
      window_hours: Number(rateDraft.window_hours),
    };
    const currentLimit = {
      daily_limit: Number(aiControls?.rate_limit?.daily_limit || 10),
      window_hours: Number(aiControls?.rate_limit?.window_hours || 24),
    };

    if (nextLimit.daily_limit === currentLimit.daily_limit && nextLimit.window_hours === currentLimit.window_hours) {
      toast.success('AI request limit is already up to date.');
      return;
    }

    setConfirm({
      open: true,
      title: 'Save AI request limit?',
      body: `Users will be limited to ${nextLimit.daily_limit} AI request${nextLimit.daily_limit === 1 ? '' : 's'} every ${nextLimit.window_hours} hour${nextLimit.window_hours === 1 ? '' : 's'}.`,
      danger: false,
      action: async () => {
        await runAction('AI rate limit saved', () => updateAdminAiRateLimit(nextLimit), loadAiControls);
      },
    });
  }

  async function saveOverride(event) {
    event.preventDefault();
    await runAction('User AI limit saved', () => upsertAdminAiRateLimitOverride({
      user_id: overrideDraft.user_id,
      daily_limit: Number(overrideDraft.daily_limit),
      is_enabled: Boolean(overrideDraft.is_enabled),
    }), async () => {
      setOverrideDraft({ user_id: '', daily_limit: 10, is_enabled: true });
      await loadAiControls();
    });
  }

  function requestDeleteOverride(override) {
    setConfirm({
      open: true,
      title: 'Remove user AI limit?',
      body: `${override.user_name || override.user_id} will use the global AI request limit again.`,
      danger: true,
      action: async () => {
        await runAction('User AI limit removed', () => deleteAdminAiRateLimitOverride(override.user_id), loadAiControls);
      },
    });
  }

  function requestDeleteLog(log) {
    setConfirm({
      open: true,
      title: 'Delete system log?',
      body: `This removes the "${log.message || log.source || 'selected'}" log entry from the admin view.`,
      danger: true,
      action: async () => {
        await runAction('Log deleted', () => deleteAdminSystemLog(log.id), loadHealth);
      },
    });
  }

  function requestClearOldLogs() {
    setConfirm({
      open: true,
      title: 'Clear old system logs?',
      body: 'This permanently deletes system logs older than 30 days.',
      danger: true,
      action: async () => {
        await runAction('Old logs cleared', () => clearAdminOldSystemLogs(30), loadHealth);
      },
    });
  }

  async function saveSettings() {
    const next = { ...DEFAULT_PREFERENCES, ...(profile?.preferences || {}), display_mode: settingsDraft.display_mode };
    await runAction('Admin settings saved', async () => {
      applyPreferences(next);
      return savePreferences(next);
    });
  }

  async function confirmAction() {
    const task = confirm.action;
    setConfirm({ open: false, title: '', body: '', action: null, danger: true });
    if (task) await task();
  }

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card">
          {action.active ? (
            <div className="h-1 overflow-hidden bg-surface-2" aria-hidden="true">
              <div className="sharp-route-progress h-full rounded-full bg-accent" />
            </div>
          ) : null}
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-text-muted">Administrator Workspace</p>
              <h1 className="mt-3 text-[clamp(2rem,4vw,3.6rem)] font-black leading-none text-text">{title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">{subtitle}</p>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-surface-2 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Status</p>
              <p className="mt-2 text-lg font-black text-text">{action.active ? action.label : 'Role protected'}</p>
              <p className="mt-1 text-sm text-text-muted">Admin-only backend routes and audit logs are active.</p>
            </div>
          </div>
        </section>

        {loading ? <SectionSkeleton /> : null}
        {!loading && section === 'overview' ? (
          <OverviewSection
            overview={overview}
            onAiPage={(aiPage) => setOverviewPaging((current) => ({ ...current, aiPage }))}
            onActivityPage={(activityPage) => setOverviewPaging((current) => ({ ...current, activityPage }))}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'users' ? (
          <UsersSection
            users={users}
            filters={userFilters}
            pagination={usersPagination}
            onFilters={setUserFilters}
            onCreate={openCreateUser}
            onEdit={openEditUser}
            onDelete={requestDeleteUser}
            onToggleBlock={requestToggleBlock}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'feedback' ? (
          <FeedbackSection
            feedback={feedback}
            filters={feedbackFilters}
            onFilters={setFeedbackFilters}
            onView={openReportDetail}
            onUpdate={requestUpdateReport}
            onDelete={requestDeleteReport}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'announcements' ? (
          <AnnouncementsSection
            announcements={announcements}
            filter={announcementFilter}
            onFilter={setAnnouncementFilter}
            onCreate={() => openAnnouncement()}
            onEdit={openAnnouncement}
            onDelete={requestDeleteAnnouncement}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'ai' ? (
          <AiControlsSection
            data={aiControls}
            rateDraft={rateDraft}
            overrideDraft={overrideDraft}
            onRateDraft={setRateDraft}
            onOverrideDraft={setOverrideDraft}
            onSaveRate={saveRateLimit}
            onSaveOverride={saveOverride}
            onDeleteOverride={requestDeleteOverride}
            onCreatePrompt={() => openPrompt()}
            onEditPrompt={openPrompt}
            onDeletePrompt={requestDeletePrompt}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'health' ? (
          <HealthSection
            data={health}
            onDeleteLog={requestDeleteLog}
            onClearOldLogs={requestClearOldLogs}
            onLogPage={(logPage) => setHealthPaging((current) => ({ ...current, logPage }))}
            busy={action.active}
          />
        ) : null}
        {!loading && section === 'settings' ? (
          <SettingsSection draft={settingsDraft} onDraft={setSettingsDraft} onSave={saveSettings} busy={action.active} />
        ) : null}
      </main>

      <UserModal state={userModal} setState={setUserModal} onSubmit={submitUser} busy={action.active} />
      <AnnouncementModal state={announcementModal} setState={setAnnouncementModal} onSubmit={submitAnnouncement} busy={action.active} />
      <PromptModal state={promptModal} setState={setPromptModal} onSubmit={submitPrompt} busy={action.active} />

      <Modal isOpen={confirm.open} onClose={() => setConfirm({ open: false, title: '', body: '', action: null, danger: true })} title={confirm.title} size="sm">
        <p className="text-sm leading-7 text-text-muted">{confirm.body}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirm({ open: false, title: '', body: '', action: null, danger: true })} className="rounded-2xl border border-border px-4 py-2.5 font-bold text-text">
            Cancel
          </button>
          <button type="button" onClick={confirmAction} disabled={action.active} className={`rounded-2xl px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${confirm.danger ? 'bg-red-600' : 'bg-accent'}`}>
            Confirm
          </button>
        </div>
      </Modal>
    </>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="sharp-skeleton-shimmer h-36 rounded-[1.8rem] border border-border" />)}
      </div>
      <div className="sharp-skeleton-shimmer h-96 rounded-[2rem] border border-border" />
    </div>
  );
}

function OverviewSection({ overview, onAiPage, onActivityPage, busy }) {
  const metrics = overview?.metrics || {};
  const totalMaterials = Number(metrics.documents || 0) + Number(metrics.study_guides || 0) + Number(metrics.flashcard_sets || 0) + Number(metrics.quizzes || 0);
  const activeMaterials = Number(metrics.documents_active || 0) + Number(metrics.study_guides_active || 0) + Number(metrics.flashcard_sets_active || 0) + Number(metrics.quizzes_active || 0);
  const topAiUsers = normalizePagedList(overview?.top_ai_users, OVERVIEW_PAGING_DEFAULTS.aiPage, OVERVIEW_PAGING_DEFAULTS.aiPageSize);
  const recentActivity = normalizePagedList(overview?.recent_activity, OVERVIEW_PAGING_DEFAULTS.activityPage, OVERVIEW_PAGING_DEFAULTS.activityPageSize);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Users" value={metrics.total_users || 0} hint={`${metrics.active_users || 0} active, ${metrics.blocked_users || 0} blocked.`} tone="accent" />
        <AdminStatCard label="Reports" value={metrics.open_reports || 0} hint={`${metrics.total_reports || 0} total AI content reports.`} tone="warning" />
        <AdminStatCard label="AI Requests" value={metrics.ai_requests_window || 0} hint={`${metrics.ai_failed_window || 0} failed in the last 24 hours.`} tone="neutral" />
        <AdminStatCard label="Announcements" value={metrics.published_announcements || 0} hint="Published updates visible to students." tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Panel title="Platform Overview" eyebrow="Dashboard" icon={Shield}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
            <DocumentReadinessCard metrics={metrics} />
            <MetricCard icon={Database} label="Total materials" value={totalMaterials} detail={`${activeMaterials} active items`} />
            <MetricCard icon={FileWarning} label="Open reports" value={metrics.open_reports || 0} detail="Needs admin review" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniRow label="Documents" value={metrics.documents || 0} />
            <MiniRow label="Study guides" value={metrics.study_guides || 0} />
            <MiniRow label="Flashcard sets" value={metrics.flashcard_sets || 0} />
            <MiniRow label="Quizzes" value={metrics.quizzes || 0} />
          </div>
        </Panel>

        <Panel title="Top AI Users" eyebrow="Usage" icon={Gauge}>
          <p className="mb-3 text-sm leading-6 text-text-muted">AI request counts from the last 24 hours.</p>
          <div className="space-y-3">
            {topAiUsers.items.length ? topAiUsers.items.map((user) => (
              <article key={user.user_id} className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-text">{user.user_name}</p>
                    <p className="truncate text-xs text-text-muted">{user.email || 'No email available'}</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-black text-accent">{user.requests}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-text-muted">{user.failed} failed request{user.failed === 1 ? '' : 's'}</p>
              </article>
            )) : <EmptyState icon={Users} title="No AI usage yet" body="AI request counts appear after students generate materials." />}
          </div>
          <Pagination
            page={topAiUsers.pagination.page}
            totalPages={topAiUsers.pagination.totalPages}
            totalCount={topAiUsers.pagination.totalCount}
            onPrev={() => onAiPage(Math.max(1, topAiUsers.pagination.page - 1))}
            onNext={() => onAiPage(Math.min(topAiUsers.pagination.totalPages, topAiUsers.pagination.page + 1))}
            disabled={busy}
          />
        </Panel>
      </div>

      <Panel title="Recent Admin Activity" eyebrow="Audit" icon={Activity}>
        <p className="mb-3 text-sm leading-6 text-text-muted">Audit trail for admin actions like account changes, announcements, feedback moderation, prompt edits, rate limits, and log cleanup.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {recentActivity.items.length ? recentActivity.items.map((item) => (
            <article key={item.id} className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
              <p className="text-sm font-black text-text">{formatEvent(item.event)}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{summarizeMetadata(item.metadata)}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{formatDateTime(item.created_at)}</p>
            </article>
          )) : <EmptyState icon={Activity} title="No admin actions yet" body="Moderation and management actions will show up here." />}
        </div>
        <Pagination
          page={recentActivity.pagination.page}
          totalPages={recentActivity.pagination.totalPages}
          totalCount={recentActivity.pagination.totalCount}
          onPrev={() => onActivityPage(Math.max(1, recentActivity.pagination.page - 1))}
          onNext={() => onActivityPage(Math.min(recentActivity.pagination.totalPages, recentActivity.pagination.page + 1))}
          disabled={busy}
        />
      </Panel>
    </div>
  );
}

function UsersSection({ users, filters, pagination, onFilters, onCreate, onEdit, onDelete, onToggleBlock, busy }) {
  return (
    <Panel title="Accounts, Roles, And Access" eyebrow="User management" icon={Users} action={<PrimaryButton onClick={onCreate} icon={Plus} disabled={busy}>Create account</PrimaryButton>}>
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
        <SearchInput value={filters.search} onChange={(search) => onFilters({ ...filters, search, page: 1 })} placeholder="Search users" />
        <Select value={filters.role} onChange={(role) => onFilters({ ...filters, role, page: 1 })} options={[['all', 'All roles'], ['student', 'Students'], ['admin', 'Admins']]} label="Role filter" />
        <Select value={filters.status} onChange={(status) => onFilters({ ...filters, status, page: 1 })} options={[['all', 'All statuses'], ['active', 'Active'], ['blocked', 'Blocked']]} label="Status filter" />
      </div>

      <div className="mt-5 space-y-3">
        {users.length ? users.map((user) => (
          <MotionDiv key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black text-text">{user.full_name || 'Unnamed user'}</h3>
                  <Chip tone={user.role === 'admin' ? 'warning' : 'accent'}>{user.role}</Chip>
                  <Chip tone={user.is_blocked ? 'danger' : 'success'}>{user.is_blocked ? 'Blocked' : 'Active'}</Chip>
                </div>
                <p className="mt-1 truncate text-sm text-text-muted">{user.email} · @{user.username || 'no-username'}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Joined {formatDate(user.created_at)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <SecondaryButton onClick={() => onEdit(user)} icon={UserCog} disabled={busy}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => onToggleBlock(user)} icon={AlertTriangle} disabled={busy}>{user.is_blocked ? 'Unblock' : 'Block'}</SecondaryButton>
                <DangerButton onClick={() => onDelete(user)} icon={Trash2} disabled={busy}>Delete</DangerButton>
              </div>
            </div>
          </MotionDiv>
        )) : <EmptyState icon={Users} title="No users found" body="Try a different filter or create a managed account." />}
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} onPrev={() => onFilters({ ...filters, page: Math.max(1, pagination.page - 1) })} onNext={() => onFilters({ ...filters, page: Math.min(pagination.totalPages, pagination.page + 1) })} disabled={busy} />
    </Panel>
  );
}

function FeedbackSection({ feedback, filters, onFilters, onView, onUpdate, onDelete, busy }) {
  const reports = feedback?.reports || [];
  const pagination = feedback?.pagination || { page: 1, totalPages: 1, totalCount: 0 };

  return (
    <Panel title="AI Content Reports" eyebrow="Feedback" icon={FileWarning}>
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
        <SearchInput value={filters.search} onChange={(search) => onFilters({ ...filters, search, page: 1 })} placeholder="Search report text" />
        <Select value={filters.status} onChange={(status) => onFilters({ ...filters, status, page: 1 })} options={[['all', 'All statuses'], ['open', 'Open'], ['reviewing', 'Reviewing'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']]} label="Status filter" />
        <Select value={filters.type} onChange={(type) => onFilters({ ...filters, type, page: 1 })} options={[['all', 'All modules'], ['study_guide', 'Study guides'], ['flashcards', 'Flashcards'], ['quiz', 'Quizzes']]} label="Module filter" />
      </div>

      <div className="mt-5 space-y-3">
        {reports.length ? reports.map((report) => (
          <article key={report.id} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={report.status === 'open' ? 'warning' : report.status === 'resolved' ? 'success' : 'neutral'}>{report.status}</Chip>
                  <Chip tone="accent">{labelContentType(report.content_type)}</Chip>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                    <ThumbsUp size={13} aria-hidden="true" /> {report.reaction_counts?.up || 0}
                    <ThumbsDown size={13} aria-hidden="true" /> {report.reaction_counts?.down || 0}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-text">{report.content_title}</h3>
                <p className="mt-1 text-sm font-bold text-text">{REPORT_REASONS[report.reason] || report.reason}</p>
                {report.details ? <p className="mt-2 text-sm leading-7 text-text-muted">{report.details}</p> : null}
                <p className="mt-3 text-xs text-text-muted">Reporter: {report.reporter?.name} · Owner: {report.owner?.name} · {formatDateTime(report.created_at)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:w-52 xl:grid-cols-1">
                <SecondaryButton onClick={() => onView(report)} icon={Eye} disabled={busy}>View report</SecondaryButton>
                <SecondaryButton onClick={() => onUpdate(report, { status: 'reviewing' })} icon={Search} disabled={busy}>Reviewing</SecondaryButton>
                <SecondaryButton onClick={() => onUpdate(report, { status: 'resolved' })} icon={CheckCircle2} disabled={busy}>Resolve</SecondaryButton>
                <SecondaryButton onClick={() => onUpdate(report, { status: 'dismissed' })} icon={XCircle} disabled={busy}>Dismiss</SecondaryButton>
                <DangerButton onClick={() => onDelete(report)} icon={Trash2} disabled={busy}>Delete</DangerButton>
              </div>
            </div>
          </article>
        )) : <EmptyState icon={FileWarning} title="No reports matched" body="AI reports from study guides, flashcards, and quizzes will appear here." />}
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} onPrev={() => onFilters({ ...filters, page: Math.max(1, pagination.page - 1) })} onNext={() => onFilters({ ...filters, page: Math.min(pagination.totalPages, pagination.page + 1) })} disabled={busy} />
    </Panel>
  );
}

function AnnouncementsSection({ announcements, filter, onFilter, onCreate, onEdit, onDelete, busy }) {
  return (
    <Panel title="Announcements & Updates" eyebrow="Notifications" icon={Bell} action={<PrimaryButton onClick={onCreate} icon={Plus} disabled={busy}>New announcement</PrimaryButton>}>
      <div className="max-w-xs">
        <Select value={filter} onChange={onFilter} options={[['all', 'All statuses'], ['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']]} label="Announcement status" />
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {announcements.length ? announcements.map((announcement) => (
          <article key={announcement.id} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={announcement.status === 'published' ? 'success' : announcement.status === 'archived' ? 'neutral' : 'warning'}>{announcement.status}</Chip>
              <Chip tone={announcement.priority === 'high' ? 'danger' : 'accent'}>{announcement.priority}</Chip>
              <Chip tone="neutral">{announcement.category}</Chip>
            </div>
            <h3 className="mt-3 text-lg font-black text-text">{announcement.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-7 text-text-muted">{announcement.body}</p>
            <p className="mt-3 text-xs font-semibold text-text-muted">Updated {formatDateTime(announcement.updated_at)}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <SecondaryButton onClick={() => onEdit(announcement)} icon={Edit3} disabled={busy}>Edit</SecondaryButton>
              <DangerButton onClick={() => onDelete(announcement)} icon={Trash2} disabled={busy}>Delete</DangerButton>
            </div>
          </article>
        )) : <EmptyState icon={Megaphone} title="No announcements yet" body="Create one to publish it to the user Notifications page." />}
      </div>
    </Panel>
  );
}

function AiControlsSection({ data, rateDraft, overrideDraft, onRateDraft, onOverrideDraft, onSaveRate, onSaveOverride, onDeleteOverride, onCreatePrompt, onEditPrompt, onDeletePrompt, busy }) {
  const providers = data?.provider_health || [];
  const templates = data?.prompt_templates || [];
  const overrides = data?.overrides || [];
  const events = data?.recent_events || [];

  return (
    <div className="space-y-5">
      <Panel title="Provider Status" eyebrow="AI health" icon={SlidersHorizontal}>
        <div className="grid gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <MetricCard key={provider.provider} icon={provider.configured ? CheckCircle2 : XCircle} label={provider.provider} value={provider.configured ? 'Configured' : 'Missing'} detail={provider.model} tone={provider.configured ? 'success' : 'danger'} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Panel title="AI Request Limits" eyebrow="Rate limits" icon={Gauge}>
          <form className="space-y-3" onSubmit={onSaveRate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Requests per window">
              <NumberInput value={rateDraft.daily_limit} min={1} max={500} onChange={(daily_limit) => onRateDraft({ ...rateDraft, daily_limit })} />
              </Field>
              <Field label="Window hours">
              <NumberInput value={rateDraft.window_hours} min={1} max={168} onChange={(window_hours) => onRateDraft({ ...rateDraft, window_hours })} />
              </Field>
            </div>
            <PrimaryButton type="submit" icon={CheckCircle2} disabled={busy}>Save limit</PrimaryButton>
          </form>

          <form className="mt-5 space-y-3 rounded-[1.3rem] border border-border bg-surface-2 p-4" onSubmit={onSaveOverride}>
            <p className="text-sm font-black text-text">Optional per-user override</p>
            <Field label="User ID">
              <input required value={overrideDraft.user_id} onChange={(event) => onOverrideDraft({ ...overrideDraft, user_id: event.target.value })} className="admin-form-control" placeholder="Paste user UUID" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Daily limit">
                <NumberInput value={overrideDraft.daily_limit} min={1} max={500} onChange={(daily_limit) => onOverrideDraft({ ...overrideDraft, daily_limit })} />
              </Field>
              <div className="flex items-end">
                <PrimaryButton type="submit" icon={Plus} disabled={busy}>Save override</PrimaryButton>
              </div>
            </div>
          </form>

          <div className="mt-5 space-y-2">
            {overrides.length ? overrides.map((override) => (
              <div key={override.user_id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-text">{override.user_name}</p>
                  <p className="truncate text-xs text-text-muted">{override.email || override.user_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="accent">{override.daily_limit} requests</Chip>
                  <IconButton label="Remove user override" onClick={() => onDeleteOverride(override)} icon={Trash2} tone="danger" disabled={busy} />
                </div>
              </div>
            )) : <p className="text-sm text-text-muted">No per-user overrides yet.</p>}
          </div>
        </Panel>

        <Panel title="Prompt Templates" eyebrow="Gemini prompts" icon={Edit3} action={<PrimaryButton onClick={onCreatePrompt} icon={Plus} disabled={busy}>New template</PrimaryButton>}>
          <div className="space-y-3">
            {templates.length ? templates.map((template) => (
              <article key={template.id} className="rounded-[1.3rem] border border-border bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={template.is_active ? 'success' : 'neutral'}>{template.is_active ? 'Active' : 'Inactive'}</Chip>
                  <Chip tone="accent">{PROMPT_LABELS[template.template_key] || template.template_key}</Chip>
                </div>
                <h3 className="mt-3 text-lg font-black text-text">{template.title}</h3>
                <p className="mt-1 text-sm leading-6 text-text-muted">{template.description || 'No description.'}</p>
                <p className="mt-2 text-xs text-text-muted">{template.content.length} characters · Updated {formatDateTime(template.updated_at)}</p>
                {template.is_active && !hasSourcePlaceholder(template.content) ? (
                  <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">Active template is missing {'{{source_text}}'}, so user lesson content may not reach Gemini.</p>
                ) : null}
                {template.is_active && ['flashcards', 'quiz'].includes(template.template_key) && !mentionsJson(template.content) ? (
                  <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">Flashcard and quiz prompts should request valid JSON output.</p>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <SecondaryButton onClick={() => onEditPrompt(template)} icon={Edit3} disabled={busy}>Edit</SecondaryButton>
                  <DangerButton onClick={() => onDeletePrompt(template)} icon={Trash2} disabled={busy}>Delete</DangerButton>
                </div>
              </article>
            )) : <EmptyState icon={Edit3} title="No prompt templates yet" body="AI generation will use built-in fallback prompts until you add active templates." />}
          </div>
        </Panel>
      </div>

      <Panel title="Recent AI Requests" eyebrow="Events" icon={Activity}>
        <ResponsiveTable
          headers={['User', 'Feature', 'Status', 'When']}
          rows={events.map((event) => [
            event.user_name || 'Unknown user',
            event.feature,
            event.status,
            formatDateTime(event.created_at),
          ])}
          empty="No AI request events yet."
        />
      </Panel>
    </div>
  );
}

function HealthSection({ data, onDeleteLog, onClearOldLogs, onLogPage, busy }) {
  const metrics = data?.metrics || {};
  const logsPage = normalizePagedList(data?.logs, HEALTH_PAGING_DEFAULTS.logPage, HEALTH_PAGING_DEFAULTS.logPageSize);
  const logs = logsPage.items;
  const providers = data?.provider_health || [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="AI Requests" value={metrics.ai_requests_24h || 0} hint="Requests in the last 24 hours." tone="accent" />
        <AdminStatCard label="AI Failed" value={metrics.ai_failed_24h || 0} hint="Failed generation events." tone="danger" />
        <AdminStatCard label="Warnings" value={metrics.warning_logs || 0} hint="Recent warning logs." tone="warning" />
        <AdminStatCard label="Errors" value={metrics.error_logs || 0} hint="Recent error logs." tone="danger" />
      </div>

      <Panel title="Provider Health" eyebrow="AI status" icon={Activity}>
        <div className="grid gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <MetricCard key={provider.provider} icon={provider.configured ? CheckCircle2 : XCircle} label={provider.provider} value={provider.configured ? 'Ready' : 'Not configured'} detail={provider.quota_note} tone={provider.configured ? 'success' : 'danger'} />
          ))}
        </div>
      </Panel>

      <Panel title="System Logs" eyebrow="Read/delete" icon={Database} action={<SecondaryButton onClick={onClearOldLogs} icon={Trash2} disabled={busy}>Clear 30+ days</SecondaryButton>}>
        <div className="space-y-3">
          {logs.length ? logs.map((log) => (
            <article key={log.id} className="grid gap-3 rounded-[1.25rem] border border-border bg-surface-2 p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={log.level === 'error' ? 'danger' : log.level === 'warning' ? 'warning' : 'neutral'}>{log.level}</Chip>
                  <Chip tone="accent">{log.source}</Chip>
                </div>
                <p className="mt-2 text-sm font-black text-text">{log.message}</p>
                <p className="mt-2 text-xs text-text-muted">{formatDateTime(log.created_at)}</p>
              </div>
              <IconButton label="Delete log" icon={Trash2} tone="danger" onClick={() => onDeleteLog(log)} disabled={busy} />
            </article>
          )) : <EmptyState icon={Database} title="No logs yet" body="Operational logs will appear when the backend records warnings or errors." />}
        </div>
        <Pagination
          page={logsPage.pagination.page}
          totalPages={logsPage.pagination.totalPages}
          totalCount={logsPage.pagination.totalCount}
          onPrev={() => onLogPage(Math.max(1, logsPage.pagination.page - 1))}
          onNext={() => onLogPage(Math.min(logsPage.pagination.totalPages, logsPage.pagination.page + 1))}
          disabled={busy}
        />
      </Panel>
    </div>
  );
}

function SettingsSection({ draft, onDraft, onSave, busy }) {
  return (
    <div className="space-y-5">
      <Panel title="Theme Settings" eyebrow="Light/Dark only" icon={Sun}>
        <div className="grid gap-4 md:grid-cols-2">
          <ThemeCard active={draft.display_mode === 'light'} icon={Sun} title="Light mode" body="Bright surfaces for classroom or daytime review." onClick={() => onDraft({ ...draft, display_mode: 'light' })} />
          <ThemeCard active={draft.display_mode === 'dark'} icon={Moon} title="Dark mode" body="Lower-glare surfaces for longer admin review sessions." onClick={() => onDraft({ ...draft, display_mode: 'dark' })} />
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={onSave} icon={CheckCircle2} disabled={busy}>Save settings</PrimaryButton>
        </div>
      </Panel>

      <Panel title="Account Security" eyebrow="Password" icon={Key}>
        <AdminPasswordChangeForm disabled={busy} />
      </Panel>
    </div>
  );
}

function AdminPasswordChangeForm({ disabled }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const checks = PASSWORD_POLICY_CHECKS.map((rule) => ({ ...rule, passed: rule.test(form.newPassword) }));
  const passwordScore = getPasswordScore(form.newPassword);
  const meetsPolicy = form.newPassword.length >= MIN_PASSWORD_LENGTH && passwordScore >= MIN_PASSWORD_SCORE;
  const passwordsMatch = form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;
  const formDisabled = disabled || saving;
  const canSubmit = Boolean(form.currentPassword) && meetsPolicy && passwordsMatch && !formDisabled;

  async function submitPassword(event) {
    event.preventDefault();
    if (!meetsPolicy) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters and pass ${MIN_PASSWORD_SCORE} strength checks.`);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(result.message || 'Password updated successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setVisible({ current: false, next: false, confirm: false });
    } catch (error) {
      toast.error(error.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]" onSubmit={submitPassword}>
      <div className="space-y-4">
        <PasswordField
          id="admin-current-password"
          label="Current password"
          value={form.currentPassword}
          visible={visible.current}
          disabled={formDisabled}
          autoComplete="current-password"
          onToggle={() => setVisible((current) => ({ ...current, current: !current.current }))}
          onChange={(currentPassword) => setForm((current) => ({ ...current, currentPassword }))}
        />
        <PasswordField
          id="admin-new-password"
          label="New password"
          value={form.newPassword}
          visible={visible.next}
          disabled={formDisabled}
          autoComplete="new-password"
          onToggle={() => setVisible((current) => ({ ...current, next: !current.next }))}
          onChange={(newPassword) => setForm((current) => ({ ...current, newPassword }))}
        />
        <PasswordField
          id="admin-confirm-password"
          label="Confirm new password"
          value={form.confirmPassword}
          visible={visible.confirm}
          disabled={formDisabled}
          autoComplete="new-password"
          invalid={passwordsMismatch}
          onToggle={() => setVisible((current) => ({ ...current, confirm: !current.confirm }))}
          onChange={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))}
        />
        {passwordsMatch ? <p className="text-sm font-bold text-emerald-500">Passwords match.</p> : null}
        {passwordsMismatch ? <p className="text-sm font-bold text-red-500">Passwords do not match yet.</p> : null}
      </div>

      <div className="rounded-[1.5rem] border border-border bg-surface-2 p-4">
        <p className="text-sm font-black text-text">Password policy</p>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Pass at least {MIN_PASSWORD_SCORE} strength checks and use {MIN_PASSWORD_LENGTH}+ characters.
        </p>
        <div className="mt-4 space-y-2">
          {checks.map((rule) => (
            <div key={rule.key} className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className={rule.passed ? 'text-emerald-500' : 'text-text-muted'} aria-hidden="true" />
              <span className={rule.passed ? 'font-bold text-text' : 'font-semibold text-text-muted'}>{rule.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton type="submit" icon={saving ? Loader2 : Key} disabled={!canSubmit}>
            {saving ? 'Updating' : 'Change password'}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}

function PasswordField({ id, label, value, visible, disabled, invalid = false, autoComplete, onToggle, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex min-h-8 items-end text-xs font-black uppercase leading-4 tracking-[0.14em] text-text-muted">{label}</span>
      <span className="relative block">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`admin-form-control pr-12 disabled:cursor-not-allowed disabled:opacity-60 ${invalid ? 'border-red-500 focus:border-red-500' : ''}`}
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

function UserModal({ state, setState, onSubmit, busy }) {
  return (
    <Modal isOpen={state.open} onClose={() => setState({ open: false, mode: 'create', form: USER_EMPTY, target: null })} title={state.mode === 'create' ? 'Create account' : 'Edit user'} size="lg">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name"><input required value={state.form.first_name} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, first_name: event.target.value } }))} className="admin-form-control" /></Field>
          <Field label="Last name"><input required value={state.form.last_name} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, last_name: event.target.value } }))} className="admin-form-control" /></Field>
          <Field label="Middle name"><input value={state.form.middle_name} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, middle_name: event.target.value } }))} className="admin-form-control" /></Field>
          <Field label="Username"><input required value={state.form.username} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, username: event.target.value.toLowerCase() } }))} className="admin-form-control" /></Field>
          <Field label="Email"><input required disabled={state.mode === 'edit'} type="email" value={state.form.email} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, email: event.target.value } }))} className="admin-form-control disabled:opacity-60" /></Field>
          <Field label="Role">
            <select value={state.form.role} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, role: event.target.value } }))} className="admin-form-control cursor-pointer">
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </div>
        {state.mode === 'create' ? (
          <Field label="Temporary password"><input required type="password" value={state.form.password} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, password: event.target.value } }))} className="admin-form-control" /></Field>
        ) : (
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-bold text-text">
            <input type="checkbox" checked={Boolean(state.form.is_blocked)} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, is_blocked: event.target.checked } }))} />
            Block this account
          </label>
        )}
        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={busy} icon={busy ? Loader2 : CheckCircle2}>{state.mode === 'create' ? 'Create' : 'Save changes'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function AnnouncementModal({ state, setState, onSubmit, busy }) {
  return (
    <Modal isOpen={state.open} onClose={() => setState({ open: false, mode: 'create', form: ANNOUNCEMENT_EMPTY, target: null })} title={state.mode === 'create' ? 'Create announcement' : 'Edit announcement'} size="lg">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Title"><input required value={state.form.title} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, title: event.target.value } }))} className="admin-form-control" /></Field>
        <Field label="Body"><textarea required rows={6} value={state.form.body} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, body: event.target.value } }))} className="admin-form-control" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Category" value={state.form.category} onChange={(category) => setState((current) => ({ ...current, form: { ...current.form, category } }))} options={[['general', 'General'], ['update', 'Update'], ['maintenance', 'Maintenance'], ['feature', 'Feature'], ['security', 'Security']]} />
          <SelectField label="Priority" value={state.form.priority} onChange={(priority) => setState((current) => ({ ...current, form: { ...current.form, priority } }))} options={[['normal', 'Normal'], ['high', 'High']]} />
          <SelectField label="Status" value={state.form.status} onChange={(status) => setState((current) => ({ ...current, form: { ...current.form, status } }))} options={[['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']]} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts at"><input type="datetime-local" value={state.form.starts_at} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, starts_at: event.target.value } }))} className="admin-form-control" /></Field>
          <Field label="Ends at"><input type="datetime-local" value={state.form.ends_at} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, ends_at: event.target.value } }))} className="admin-form-control" /></Field>
        </div>
        <div className="flex justify-end"><PrimaryButton type="submit" disabled={busy} icon={CheckCircle2}>Save announcement</PrimaryButton></div>
      </form>
    </Modal>
  );
}

function PromptModal({ state, setState, onSubmit, busy }) {
  const starter = PROMPT_STARTERS[state.form.template_key] || PROMPT_STARTERS.study_guide;
  const activeMissingSource = state.form.is_active && !hasSourcePlaceholder(state.form.content);
  const activeJsonWarning = state.form.is_active && ['flashcards', 'quiz'].includes(state.form.template_key) && !mentionsJson(state.form.content);
  const insertStarter = () => {
    setState((current) => ({
      ...current,
      form: {
        ...current.form,
        content: current.form.content ? `${current.form.content.trim()}\n\n${starter}` : starter,
      },
    }));
  };

  return (
    <Modal isOpen={state.open} onClose={() => setState({ open: false, mode: 'create', form: PROMPT_EMPTY, target: null })} title={state.mode === 'create' ? 'Create prompt template' : 'Edit prompt template'} size="xl">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Template type" value={state.form.template_key} onChange={(template_key) => setState((current) => ({ ...current, form: { ...current.form, template_key } }))} options={Object.entries(PROMPT_LABELS)} />
          <Field label="Title"><input required value={state.form.title} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, title: event.target.value } }))} className="admin-form-control" /></Field>
        </div>
        <Field label="Description"><input value={state.form.description} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, description: event.target.value } }))} className="admin-form-control" /></Field>
        <div className="rounded-[1.2rem] border border-border bg-surface-2 p-3 text-xs leading-6 text-text-muted">
          <p className="font-bold text-text">Required to save: template type, title, and prompt content with at least 20 characters.</p>
          <p className="mt-1">Check "Make active" when this should replace the built-in Gemini prompt. Include {'{{source_text}}'} so user content reaches the AI.</p>
          <p className="mt-1">Available placeholders: {'{{source_text}}'}, {'{{lesson_text}}'}, {'{{difficulty}}'}, {'{{difficulty_rules}}'}, {'{{count}}'}, {'{{target_count}}'}.</p>
          <div className="mt-3">
            <SecondaryButton onClick={insertStarter} icon={Plus} disabled={busy}>Insert starter prompt</SecondaryButton>
          </div>
        </div>
        {activeMissingSource ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">This active template is missing {'{{source_text}}'}.</p>
        ) : null}
        {activeJsonWarning ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">Flashcard and quiz templates should explicitly request valid JSON output.</p>
        ) : null}
        <Field label="Prompt content">
          <textarea required rows={16} value={state.form.content} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, content: event.target.value } }))} className="admin-form-control font-mono" />
        </Field>
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-bold text-text">
          <input type="checkbox" checked={Boolean(state.form.is_active)} onChange={(event) => setState((current) => ({ ...current, form: { ...current.form, is_active: event.target.checked } }))} />
          Make active for this template type
        </label>
        <div className="flex justify-end"><PrimaryButton type="submit" disabled={busy} icon={CheckCircle2}>Save template</PrimaryButton></div>
      </form>
    </Modal>
  );
}

function Panel({ title, eyebrow, icon: Icon, action, children }) {
  return (
    <section className="rounded-[2rem] border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-accent">
            {createElement(Icon, { size: 20, 'aria-hidden': 'true' })}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-black text-text">{title}</h2>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'accent' }) {
  const toneClass = tone === 'danger' ? 'text-rose-500 bg-rose-500/10' : tone === 'success' ? 'text-emerald-500 bg-emerald-500/10' : 'text-accent bg-accent/10';
  return (
    <article className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass}`}>
        {createElement(Icon, { size: 18, 'aria-hidden': 'true' })}
      </span>
      <p className="mt-3 text-sm font-bold text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-text">{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>
    </article>
  );
}

function DocumentReadinessCard({ metrics }) {
  const total = Number(metrics.documents || 0);
  const ready = Number(metrics.documents_done || 0);
  const processing = Number(metrics.documents_processing || 0);
  const failed = Number(metrics.documents_error || 0);
  const readiness = total ? percent(ready, total) : 0;

  return (
    <article className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-text-muted">Document readiness</p>
          <p className="mt-1 text-2xl font-black text-text">{readiness}%</p>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-black text-accent">{total ? `${ready}/${total} ready` : 'No documents yet'}</span>
      </div>
      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label="Document readiness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={readiness}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${readiness}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniCount label="Ready" value={ready} />
        <MiniCount label="Processing" value={processing} />
        <MiniCount label="Errors" value={failed} />
      </div>
    </article>
  );
}

function MiniCount({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface px-2 py-2">
      <p className="text-sm font-black leading-5 text-text">{value}</p>
      <p className="truncate text-[0.72rem] font-bold leading-4 text-text-muted">{label}</p>
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
      <span className="text-sm font-bold text-text">{label}</span>
      <span className="rounded-full bg-surface px-3 py-1 text-sm font-black text-text-muted">{value}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border bg-surface-2 p-8 text-center">
      {createElement(Icon, { className: 'mx-auto text-text-muted', size: 34, 'aria-hidden': 'true' })}
      <h3 className="mt-3 text-lg font-black text-text">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-text-muted">{body}</p>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="admin-form-control admin-search-control" />
    </label>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="admin-form-control cursor-pointer">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="admin-form-control cursor-pointer">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </Field>
  );
}

function NumberInput({ value, onChange, min, max }) {
  return <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="admin-form-control" />;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex min-h-8 items-end text-xs font-black uppercase leading-4 tracking-[0.14em] text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function PrimaryButton({ children, icon: Icon, type = 'button', onClick, disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-black text-accent-text transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
      {Icon ? createElement(Icon, { className: Icon === Loader2 ? 'animate-spin' : '', size: 17, 'aria-hidden': 'true' }) : null}
      {children}
    </button>
  );
}

function SecondaryButton({ children, icon: Icon, onClick, type = 'button', disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-text transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60">
      {Icon ? createElement(Icon, { size: 16, 'aria-hidden': 'true' }) : null}
      {children}
    </button>
  );
}

function DangerButton({ children, icon: Icon, onClick, type = 'button', disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
      {Icon ? createElement(Icon, { size: 16, 'aria-hidden': 'true' }) : null}
      {children}
    </button>
  );
}

function IconButton({ label, icon: Icon, onClick, tone = 'neutral', disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border ${tone === 'danger' ? 'bg-red-600 text-white' : 'bg-surface text-text'} transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60`}>
      {createElement(Icon, { size: 16, 'aria-hidden': 'true' })}
    </button>
  );
}

function Chip({ children, tone = 'neutral' }) {
  const classes = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-rose-500/10 text-rose-500',
    neutral: 'bg-surface text-text-muted',
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${classes[tone] || classes.neutral}`}>{children}</span>;
}

function Pagination({ page, totalPages, totalCount, onPrev, onNext, disabled = false }) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-muted">{totalCount || 0} results · page {page || 1} of {totalPages || 1}</p>
      <div className="flex gap-2">
        <SecondaryButton onClick={onPrev} disabled={disabled || page <= 1}>Previous</SecondaryButton>
        <SecondaryButton onClick={onNext} disabled={disabled || page >= totalPages}>Next</SecondaryButton>
      </div>
    </div>
  );
}

function ResponsiveTable({ headers, rows, empty }) {
  if (!rows.length) return <EmptyState icon={Activity} title={empty} body="Nothing has been recorded here yet." />;
  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-[0.14em] text-text-muted">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-t border-border">
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-text-muted first:font-bold first:text-text">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThemeCard({ active, icon: Icon, title, body, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-[1.5rem] border p-5 text-left transition hover:-translate-y-0.5 ${active ? 'border-accent bg-accent/10' : 'border-border bg-surface-2'}`}>
      {createElement(Icon, { size: 22, className: active ? 'text-accent' : 'text-text-muted', 'aria-hidden': 'true' })}
      <h3 className="mt-4 text-xl font-black text-text">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
    </button>
  );
}

function labelContentType(type) {
  if (type === 'study_guide') return 'Study guide';
  if (type === 'flashcards') return 'Flashcards';
  if (type === 'quiz') return 'Quiz';
  return type || 'Content';
}

function normalizePagedList(value, fallbackPage = 1, fallbackPageSize = 10) {
  if (Array.isArray(value)) {
    return {
      items: value,
      pagination: {
        page: fallbackPage,
        pageSize: fallbackPageSize,
        totalCount: value.length,
        totalPages: Math.max(1, Math.ceil(value.length / fallbackPageSize)),
      },
    };
  }

  const items = value?.items || [];
  return {
    items,
    pagination: {
      page: Number(value?.pagination?.page || fallbackPage),
      pageSize: Number(value?.pagination?.pageSize || fallbackPageSize),
      totalCount: Number(value?.pagination?.totalCount || items.length),
      totalPages: Number(value?.pagination?.totalPages || Math.max(1, Math.ceil(items.length / fallbackPageSize))),
    },
  };
}

function hasSourcePlaceholder(content = '') {
  return /\{\{\s*source_text\s*\}\}/i.test(content);
}

function mentionsJson(content = '') {
  return /\bjson\b/i.test(content);
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatEvent(event = '') {
  return String(event || 'Admin event')
    .replace(/^admin\./, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return 'No extra details.';
  const entries = Object.entries(metadata).slice(0, 3);
  if (!entries.length) return 'No extra details.';
  return entries.map(([key, value]) => `${formatEvent(key)}: ${String(value).slice(0, 80)}`).join(' · ');
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
