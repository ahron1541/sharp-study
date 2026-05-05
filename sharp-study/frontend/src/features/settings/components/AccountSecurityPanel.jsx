import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Key, Loader2, Mail, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '../../../shared/components/Modal';
import { useAuth } from '../../auth/context/AuthContext';
import { changePassword, resendVerificationEmail } from '../../auth/shared/services/auth.service';

const PASSWORD_RULES = [
  { label: 'At least 12 characters', test: (value) => value.length >= 12 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /[0-9]/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function AccountSecurityPanel() {
  const { user, profile } = useAuth();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [busyAction, setBusyAction] = useState('');

  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const emailLabel = profile?.email || user?.email || 'No email available';
  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(passwordForm.newPassword) })),
    [passwordForm.newPassword],
  );
  const passwordsMatch =
    passwordForm.confirmPassword.length > 0 && passwordForm.newPassword === passwordForm.confirmPassword;
  const passwordsMismatch =
    passwordForm.confirmPassword.length > 0 && passwordForm.newPassword !== passwordForm.confirmPassword;
  const canSubmitPassword =
    passwordForm.currentPassword.trim() &&
    passwordChecks.every((rule) => rule.passed) &&
    passwordsMatch &&
    busyAction !== 'password';

  const closePasswordModal = () => {
    if (busyAction === 'password') return;
    setPasswordModalOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handlePasswordChange = async () => {
    if (!passwordChecks.every((rule) => rule.passed)) {
      toast.error('Please meet all password requirements first.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Your new passwords do not match.');
      return;
    }

    setBusyAction('password');
    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      toast.success(result.message || 'Password updated successfully.');
      closePasswordModal();
    } catch (error) {
      toast.error(error.message || 'Failed to update password.');
    } finally {
      setBusyAction('');
    }
  };

  const handleVerificationAction = async () => {
    if (isEmailVerified) {
      toast.success('Your email is already verified.');
      return;
    }

    setBusyAction('verification');
    try {
      const result = await resendVerificationEmail();
      toast.success(result.message || 'Verification email sent.');
    } catch (error) {
      toast.error(error.message || 'Failed to send verification email.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <>
      <div className="space-y-12">
        <header>
          <h2 className="text-2xl font-bold text-text mb-2">Account & Safety</h2>
          <p className="text-text-muted font-medium">Keep your account secure with working essentials first.</p>
        </header>

        <div className="space-y-4">
          <SecurityOption
            icon={<Key className="text-blue-500" aria-hidden="true" />}
            label="Change Password"
            sub="Update your password with confirmation and reuse protection."
            actionLabel="Change password"
            onAction={() => setPasswordModalOpen(true)}
            busy={busyAction === 'password'}
          />

          <SecurityOption
            icon={<Mail className="text-emerald-500" aria-hidden="true" />}
            label="Email Verification"
            sub={isEmailVerified ? `Verified: ${emailLabel}` : `Not verified yet: ${emailLabel}`}
            actionLabel={isEmailVerified ? 'Verified' : 'Send verification'}
            onAction={handleVerificationAction}
            busy={busyAction === 'verification'}
            disabled={busyAction === 'password' || isEmailVerified}
          />
        </div>

        <div className="rounded-[2rem] border border-border bg-surface-2 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-surface p-4 shadow-sm">
              <Shield className="text-accent" size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-text">Security roadmap</p>
              <p className="mt-1 text-sm leading-7 text-text-muted">
                Two-factor authentication and advanced account controls are being prepared. For now, this page focuses on password updates and email verification only.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={passwordModalOpen}
        onClose={closePasswordModal}
        title="Change Password"
        size="md"
        closeOnBackdrop={busyAction !== 'password'}
        closeOnEscape={busyAction !== 'password'}
        showCloseButton={busyAction !== 'password'}
      >
        <div className="relative space-y-4 [content-visibility:auto]" aria-busy={busyAction === 'password'}>
          {busyAction === 'password' ? (
            <div className="absolute inset-0 z-10 rounded-[1.5rem] bg-bg/70 backdrop-blur-sm" aria-hidden="true" />
          ) : null}

          <div className="space-y-4">
            <div className="relative space-y-2">
              <label className="text-sm font-bold text-text" htmlFor="current-password">
                Current password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showPassword.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  disabled={busyAction === 'password'}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 pr-14 text-text outline-none transition-colors duration-150 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={busyAction === 'password'}
                  onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                  aria-label={showPassword.current ? 'Hide current password' : 'Show current password'}
                  className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition-colors duration-150 hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="relative space-y-2">
              <label className="text-sm font-bold text-text" htmlFor="new-password">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword.next ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  disabled={busyAction === 'password'}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 pr-14 text-text outline-none transition-colors duration-150 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={busyAction === 'password'}
                  onClick={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
                  aria-label={showPassword.next ? 'Hide new password' : 'Show new password'}
                  className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition-colors duration-150 hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword.next ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="relative space-y-2">
              <label className="text-sm font-bold text-text" htmlFor="confirm-password">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPassword.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  disabled={busyAction === 'password'}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  className={`w-full rounded-2xl border bg-surface-2 px-4 py-3 pr-14 text-text outline-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                    passwordsMismatch ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  disabled={busyAction === 'password'}
                  onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                  aria-label={showPassword.confirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-2 my-auto inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-muted transition-colors duration-150 hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordsMatch ? (
                <p className="text-sm font-semibold text-emerald-500">Passwords match.</p>
              ) : null}
              {passwordsMismatch ? (
                <p className="text-sm font-semibold text-red-500">Passwords do not match yet.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-surface-2 p-4">
            <p className="text-sm font-bold text-text">Password checklist</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {passwordChecks.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2
                    size={16}
                    className={rule.passed ? 'text-emerald-500' : 'text-text-muted'}
                    aria-hidden="true"
                  />
                  <span className={rule.passed ? 'text-text' : 'text-text-muted'}>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>

          {busyAction === 'password' ? (
            <div className="relative z-20 rounded-[1.5rem] border border-border bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-text">Updating your password securely</p>
                <span className="text-sm font-black text-accent">Please wait</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Please keep this window open while we finish the update.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full w-full origin-left animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePasswordModal}
              disabled={busyAction === 'password'}
              className="w-full rounded-2xl border border-border px-5 py-3 font-bold text-text disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={!canSubmitPassword}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-bold text-accent-text disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {busyAction === 'password' ? <Loader2 className="animate-spin" size={16} /> : null}
              Update password
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SecurityOption({ icon, label, sub, actionLabel, onAction, disabled = false, busy = false }) {
  return (
    <div className="p-6 rounded-[2rem] border border-border bg-surface-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-4 bg-surface rounded-2xl shadow-sm" aria-hidden="true">
          {icon}
        </div>
        <div>
          <p className="font-bold text-text">{label}</p>
          <p className="text-sm text-text-muted font-medium">{sub}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled || busy}
        className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm border transition-all ${
          disabled || busy
            ? 'bg-transparent text-text-muted cursor-not-allowed border-border opacity-70'
            : 'bg-surface text-text border-border hover:border-accent hover:text-accent shadow-sm'
        }`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}
