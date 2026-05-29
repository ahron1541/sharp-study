import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  FileWarning,
  Loader2,
  MessageSquare,
  Save,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from 'lucide-react';

import Modal from '../../../shared/components/Modal';
import { sanitizeHtml } from '../../../shared/utils/sanitize';
import {
  deleteAdminFeedbackReport,
  fetchAdminFeedbackReport,
  updateAdminFeedbackReport,
} from '../services/admin.service';

const REPORT_REASONS = {
  incorrect: 'Incorrect content',
  confusing: 'Confusing wording',
  incomplete: 'Incomplete output',
  formatting: 'Formatting issue',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

const STATUS_OPTIONS = [
  ['open', 'Open', FileWarning],
  ['reviewing', 'Reviewing', Search],
  ['resolved', 'Resolved', CheckCircle2],
  ['dismissed', 'Dismissed', XCircle],
];

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState({ active: false, label: '' });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const returnTo = useMemo(() => {
    const requested = searchParams.get('returnTo');
    return requested?.startsWith('/admin') ? requested : '/admin?section=feedback';
  }, [searchParams]);

  const loadReport = useCallback(async () => {
    const data = await fetchAdminFeedbackReport(id);
    setReport(data.report || null);
    setNotes(data.report?.admin_notes || '');
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminFeedbackReport(id)
      .then((data) => {
        if (!active) return;
        setReport(data.report || null);
        setNotes(data.report?.admin_notes || '');
      })
      .catch((error) => {
        if (active) toast.error(error.message || 'Failed to load report.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

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

  async function updateStatus(nextStatus) {
    if (!report || nextStatus === report.status) {
      toast.success('Report already has that status.');
      return;
    }

    await runAction('Report updated', () => updateAdminFeedbackReport(report.id, { status: nextStatus }), loadReport);
  }

  async function saveNotes(event) {
    event.preventDefault();
    if (!report) return;
    await runAction('Admin notes saved', () => updateAdminFeedbackReport(report.id, { admin_notes: notes }), loadReport);
  }

  async function confirmDelete() {
    if (!report) return;
    await runAction('Report deleted', () => deleteAdminFeedbackReport(report.id), () => {
      setDeleteModalOpen(false);
      navigate(returnTo, { replace: true });
    });
  }

  return (
    <>
      <main className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-black text-text transition hover:bg-surface-2"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to feedback
        </button>

        {loading ? <DetailSkeleton /> : null}
        {!loading && !report ? <EmptyReportState /> : null}

        {!loading && report ? (
          <>
            <section className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card">
              {action.active ? (
                <div className="h-1 overflow-hidden bg-surface-2" aria-hidden="true">
                  <div className="sharp-route-progress h-full rounded-full bg-accent" />
                </div>
              ) : null}
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:p-7">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={report.status} />
                    <Chip tone="accent">{labelContentType(report.content_type)}</Chip>
                    <Chip tone="neutral">{REPORT_REASONS[report.reason] || report.reason}</Chip>
                  </div>
                  <h1 className="mt-3 break-words text-[clamp(1.8rem,4vw,3.2rem)] font-black leading-tight text-text">
                    {report.content_title || 'Reported AI content'}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
                    Review the complaint, inspect the generated material, and update the report status.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border bg-surface-2 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Moderation</p>
                  <p className="mt-2 text-lg font-black text-text">{action.active ? action.label : 'Admin review'}</p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">Created {formatDateTime(report.created_at)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
              <div className="min-w-0 space-y-5">
                <ComplaintPanel report={report} />
                <ModerationPanel
                  report={report}
                  notes={notes}
                  busy={action.active}
                  onNotes={setNotes}
                  onSaveNotes={saveNotes}
                  onStatus={updateStatus}
                  onDelete={() => setDeleteModalOpen(true)}
                />
              </div>

              <Panel title="Reported Content" eyebrow={labelContentType(report.content_type)} icon={FileQuestion}>
                <ReportedContent report={report} />
              </Panel>
            </div>
          </>
        ) : null}
      </main>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete report?" size="sm">
        <p className="text-sm leading-7 text-text-muted">
          This removes the report from the moderation queue. The reported study material is not deleted.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(false)}
            className="rounded-2xl border border-border px-4 py-2.5 font-bold text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={action.active}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action.active ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}

function ComplaintPanel({ report }) {
  return (
    <Panel title="Complaint" eyebrow="User report" icon={MessageSquare}>
      <div className="space-y-4">
        <div className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">Reason</p>
          <p className="mt-2 break-words text-base font-black text-text">{REPORT_REASONS[report.reason] || report.reason}</p>
          {report.details ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-text-muted">{report.details}</p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-text-muted">No extra details were provided by the reporter.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PersonBlock label="Reporter" person={report.reporter} />
          <PersonBlock label="Owner" person={report.owner} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatBlock icon={ThumbsUp} label="Likes" value={report.reaction_counts?.up || 0} />
          <StatBlock icon={ThumbsDown} label="Dislikes" value={report.reaction_counts?.down || 0} />
        </div>

        <div className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">Report activity</p>
          <p className="mt-2 text-sm leading-7 text-text-muted">
            This content has {report.report_count_for_content || 0} total report{(report.report_count_for_content || 0) === 1 ? '' : 's'}.
          </p>
          {report.resolved_by_admin ? (
            <p className="mt-2 text-sm leading-7 text-text-muted">
              Resolved by {report.resolved_by_admin.name} on {formatDateTime(report.resolved_at)}.
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function ModerationPanel({ report, notes, busy, onNotes, onSaveNotes, onStatus, onDelete }) {
  return (
    <Panel title="Actions" eyebrow="Moderation" icon={Shield}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map(([status, label, statusIcon]) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatus(status)}
              disabled={busy}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                report.status === status
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface-2 text-text hover:bg-surface'
              }`}
            >
              {createElement(statusIcon, { size: 16, 'aria-hidden': 'true' })}
              {label}
            </button>
          ))}
        </div>

        <form className="space-y-3" onSubmit={onSaveNotes}>
          <label className="block">
            <span className="mb-1.5 flex min-h-8 items-end text-xs font-black uppercase leading-4 tracking-[0.14em] text-text-muted">Admin notes</span>
            <textarea
              rows={6}
              value={notes}
              onChange={(event) => onNotes(event.target.value)}
              disabled={busy}
              maxLength={800}
              className="admin-form-control min-h-40 resize-y leading-7 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Add what you reviewed or why this was resolved."
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-500 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete report
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-black text-accent-text transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save notes
            </button>
          </div>
        </form>
      </div>
    </Panel>
  );
}

function ReportedContent({ report }) {
  const content = report.content;
  if (!content) {
    return (
      <div className="rounded-[1.4rem] border border-amber-500/30 bg-amber-500/10 p-5">
        <AlertTriangle className="text-amber-500" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-lg font-black text-text">Original content is unavailable</h2>
        <p className="mt-2 text-sm leading-7 text-text-muted">
          The report is still available, but the referenced material may have been deleted or moved.
        </p>
      </div>
    );
  }

  if (report.content_type === 'study_guide') return <StudyGuidePreview content={content} />;
  if (report.content_type === 'flashcards') return <FlashcardsPreview content={content} />;
  if (report.content_type === 'quiz') return <QuizPreview content={content} />;

  return <EmptyReportState />;
}

function StudyGuidePreview({ content }) {
  const safeHtml = useMemo(() => sanitizeHtml(content.content || ''), [content.content]);

  return (
    <div className="space-y-4">
      <ContentHeader content={content} detail="Study guide body" />
      <div className="max-h-[70vh] overflow-y-auto rounded-[1.4rem] border border-border bg-surface-2 p-4">
        {safeHtml ? (
          <article
            className="study-guide-content min-w-0 max-w-none break-words text-text"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p className="text-sm leading-7 text-text-muted">This study guide has no content body.</p>
        )}
      </div>
    </div>
  );
}

function FlashcardsPreview({ content }) {
  const cards = content.cards || [];

  return (
    <div className="space-y-4">
      <ContentHeader content={content} detail={`${cards.length} card${cards.length === 1 ? '' : 's'}`} />
      <div className="grid gap-3">
        {cards.length ? cards.map((card, index) => (
          <article key={card.id || index} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">Card {index + 1}</p>
              {card.difficulty ? <Chip tone="neutral">{card.difficulty}</Chip> : null}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ContentTextBlock label="Front" value={card.front} />
              <ContentTextBlock label="Back" value={card.back} />
            </div>
            {card.hint ? <ContentTextBlock className="mt-3" label="Hint" value={card.hint} /> : null}
          </article>
        )) : (
          <EmptyInline icon={FileWarning} title="No flashcards found" body="The set exists, but it does not have any cards attached." />
        )}
      </div>
    </div>
  );
}

function QuizPreview({ content }) {
  const questions = content.questions || [];

  return (
    <div className="space-y-4">
      <ContentHeader content={content} detail={`${questions.length} question${questions.length === 1 ? '' : 's'}`} />
      <div className="grid gap-3">
        {questions.length ? questions.map((question, index) => {
          const options = normalizeOptions(question.options);
          return (
            <article key={question.id || index} className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">Question {index + 1}</p>
                {question.difficulty ? <Chip tone="neutral">{question.difficulty}</Chip> : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-base font-black leading-7 text-text">{question.question}</p>
              <div className="mt-4 grid gap-2">
                {options.map((option, optionIndex) => {
                  const correct = Number(question.correct_index) === optionIndex;
                  return (
                    <div
                      key={`${question.id || index}-${optionIndex}`}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold leading-6 ${
                        correct
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                          : 'border-border bg-surface text-text'
                      }`}
                    >
                      <span className="font-black">{String.fromCharCode(65 + optionIndex)}.</span> {displayOption(option)}
                      {correct ? <span className="ml-2 font-black">Correct answer</span> : null}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        }) : (
          <EmptyInline icon={FileWarning} title="No quiz questions found" body="The quiz exists, but it does not have any questions attached." />
        )}
      </div>
    </div>
  );
}

function ContentHeader({ content, detail }) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {content.is_archived ? <Chip tone="warning">Archived</Chip> : <Chip tone="success">Active</Chip>}
        {content.difficulty ? <Chip tone="accent">{content.difficulty}</Chip> : null}
      </div>
      <h2 className="mt-3 break-words text-xl font-black text-text">{content.title || 'Untitled content'}</h2>
      <p className="mt-2 text-sm leading-7 text-text-muted">{detail} - Created {formatDateTime(content.created_at)}</p>
    </div>
  );
}

function ContentTextBlock({ label, value, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-3 ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-text">{value || 'No text available.'}</p>
    </div>
  );
}

function PersonBlock({ label, person }) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-text">{person?.name || 'Unknown user'}</p>
      {person?.email ? <p className="mt-1 break-words text-xs font-semibold text-text-muted">{person.email}</p> : null}
    </div>
  );
}

function StatBlock({ icon, label, value }) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-surface-2 p-4">
      {createElement(icon, { size: 18, className: 'text-accent', 'aria-hidden': 'true' })}
      <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-text">{value}</p>
    </div>
  );
}

function Panel({ title, eyebrow, icon, children }) {
  return (
    <section className="min-w-0 rounded-[2rem] border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-5 flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-accent">
          {createElement(icon, { size: 20, 'aria-hidden': 'true' })}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p>
          <h2 className="mt-1 break-words text-xl font-black text-text">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusChip({ status }) {
  const tone = status === 'resolved' ? 'success' : status === 'open' ? 'warning' : status === 'dismissed' ? 'danger' : 'accent';
  return <Chip tone={tone}>{status || 'unknown'}</Chip>;
}

function Chip({ children, tone = 'neutral' }) {
  const classes = {
    accent: 'bg-accent/10 text-accent border-accent/20',
    danger: 'bg-red-500/10 text-red-500 border-red-500/20',
    neutral: 'bg-surface-2 text-text-muted border-border',
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black capitalize ${classes[tone] || classes.neutral}`}>
      {children}
    </span>
  );
}

function EmptyInline({ icon, title, body }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border bg-surface-2 p-8 text-center">
      {createElement(icon, { className: 'mx-auto text-text-muted', size: 34, 'aria-hidden': 'true' })}
      <h3 className="mt-3 text-lg font-black text-text">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-text-muted">{body}</p>
    </div>
  );
}

function EmptyReportState() {
  return (
    <EmptyInline
      icon={FileWarning}
      title="Report not found"
      body="This report may have been deleted or is no longer available."
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-48 animate-pulse rounded-[2rem] border border-border bg-surface" />
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
        <div className="h-96 animate-pulse rounded-[2rem] border border-border bg-surface" />
        <div className="h-[34rem] animate-pulse rounded-[2rem] border border-border bg-surface" />
      </div>
    </div>
  );
}

function normalizeOptions(options) {
  if (Array.isArray(options)) return options;
  if (options && typeof options === 'object') return Object.values(options);
  return [];
}

function displayOption(option) {
  if (option === null || option === undefined) return '';
  if (typeof option === 'string') return option;
  if (typeof option === 'number' || typeof option === 'boolean') return String(option);
  return option.text || option.label || option.value || JSON.stringify(option);
}

function labelContentType(type) {
  if (type === 'study_guide') return 'Study guide';
  if (type === 'flashcards') return 'Flashcards';
  if (type === 'quiz') return 'Quiz';
  return type || 'Content';
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
