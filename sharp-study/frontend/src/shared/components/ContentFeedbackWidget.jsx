import { createElement, useEffect, useMemo, useState } from 'react';
import { Flag, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from './Modal';
import { apiRequest } from '../../config/api';

const REPORT_REASONS = [
  ['incorrect', 'Incorrect content'],
  ['confusing', 'Confusing wording'],
  ['incomplete', 'Incomplete output'],
  ['formatting', 'Formatting issue'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Other'],
];

export default function ContentFeedbackWidget({ contentType, contentId, label = 'AI content', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [counts, setCounts] = useState({ up: 0, down: 0 });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'incorrect', details: '' });
  const canLoad = Boolean(contentType && contentId);

  const endpoint = useMemo(() => (
    canLoad ? `/api/feedback/content/${contentType}/${contentId}` : ''
  ), [canLoad, contentId, contentType]);

  useEffect(() => {
    if (!endpoint) return undefined;
    let active = true;
    setLoading(true);
    apiRequest(endpoint)
      .then((data) => {
        if (!active) return;
        setReaction(data.reaction || null);
        setCounts(data.counts || { up: 0, down: 0 });
      })
      .catch(() => {
        if (active) {
          setReaction(null);
          setCounts({ up: 0, down: 0 });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  async function saveReaction(nextReaction) {
    if (!canLoad || saving) return;
    const finalReaction = reaction === nextReaction ? null : nextReaction;
    setSaving(true);
    try {
      await apiRequest('/api/feedback/reaction', {
        method: 'PUT',
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          reaction: finalReaction,
        }),
      });
      setReaction(finalReaction);
      setCounts((current) => {
        const next = { ...current };
        if (reaction === 'up') next.up = Math.max(0, next.up - 1);
        if (reaction === 'down') next.down = Math.max(0, next.down - 1);
        if (finalReaction === 'up') next.up += 1;
        if (finalReaction === 'down') next.down += 1;
        return next;
      });
      toast.success(finalReaction ? 'Thanks for the feedback.' : 'Feedback removed.');
    } catch (error) {
      toast.error(error.message || 'Could not save feedback.');
    } finally {
      setSaving(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!canLoad || saving) return;
    setSaving(true);
    try {
      await apiRequest('/api/feedback/reports', {
        method: 'POST',
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          reason: reportForm.reason,
          details: reportForm.details,
        }),
      });
      setReportOpen(false);
      setReportForm({ reason: 'incorrect', details: '' });
      toast.success('Report sent to the admin.');
    } catch (error) {
      toast.error(error.message || 'Could not send report.');
    } finally {
      setSaving(false);
    }
  }

  if (!canLoad) return null;

  return (
    <>
      <div className={`rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-card ${className}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">AI Feedback</p>
            <p className="mt-1 text-sm font-bold text-[color:var(--color-text)]">{label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-sm font-bold text-[color:var(--color-text-muted)]">
                <Loader2 className="animate-spin" size={15} aria-hidden="true" />
                Loading
              </span>
            ) : (
              <>
                <FeedbackButton
                  active={reaction === 'up'}
                  label={`Like this ${label}`}
                  count={counts.up}
                  icon={ThumbsUp}
                  onClick={() => saveReaction('up')}
                  disabled={saving}
                />
                <FeedbackButton
                  active={reaction === 'down'}
                  label={`Dislike this ${label}`}
                  count={counts.down}
                  icon={ThumbsDown}
                  onClick={() => saveReaction('down')}
                  disabled={saving}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-500 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Flag size={16} aria-hidden="true" />
              Report
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title={`Report ${label}`} size="md">
        <form className="space-y-4" onSubmit={submitReport}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Reason</span>
            <select
              value={reportForm.reason}
              onChange={(event) => setReportForm((current) => ({ ...current, reason: event.target.value }))}
              className="w-full cursor-pointer rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            >
              {REPORT_REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">Details</span>
            <textarea
              rows={5}
              value={reportForm.details}
              onChange={(event) => setReportForm((current) => ({ ...current, details: event.target.value }))}
              placeholder="Optional: describe what looks wrong or confusing."
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 text-sm font-semibold leading-7 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setReportOpen(false)} className="rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 font-bold text-[color:var(--color-text)]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-bold text-[color:var(--color-accent-text)] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Flag size={17} aria-hidden="true" />}
              Send report
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function FeedbackButton({ active, label, count, icon: Icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
          : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'
      }`}
    >
      {createElement(Icon, { size: 16, 'aria-hidden': 'true' })}
      <span>{count}</span>
    </button>
  );
}
