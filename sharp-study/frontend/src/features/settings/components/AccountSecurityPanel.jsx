import { Shield, Key, Trash2 } from 'lucide-react';

/**
 * Account & Security placeholder panel.
 * Full implementation is a future module.
 */
export default function AccountSecurityPanel() {
  return (
    <section aria-labelledby="account-security-heading" className="flex-1">
      <div className="mb-6">
        <h2
          id="account-security-heading"
          className="text-xl font-bold text-text"
        >
          Account &amp; Security
        </h2>
        <p className="text-sm text-muted mt-1">
          Manage your login credentials and account security.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Change password */}
        <div className="bg-surface rounded-xl p-5 border border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text">Change Password</p>
              <p className="text-xs text-muted">
                Update your password to keep your account secure.
              </p>
            </div>
          </div>
          <button
            className="
              px-4 py-2 text-sm font-semibold rounded-pill
              border border-border text-text
              hover:bg-surface-2 transition-colors
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-accent focus-visible:ring-offset-2
            "
            aria-label="Change your password"
          >
            Update
          </button>
        </div>

        {/* Two-factor placeholder */}
        <div className="bg-surface rounded-xl p-5 border border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-green-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text">
                Two-Factor Authentication
              </p>
              <p className="text-xs text-muted">
                Add an extra layer of protection to your account.
              </p>
            </div>
          </div>
          <button
            disabled
            className="
              px-4 py-2 text-sm font-semibold rounded-pill
              border border-border text-muted
              cursor-not-allowed opacity-50
            "
            aria-label="Two-factor authentication — coming soon"
          >
            Coming soon
          </button>
        </div>

        {/* Danger zone */}
        <div className="bg-red-50 rounded-xl p-5 border border-red-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trash2 size={20} className="text-red-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-700">Delete Account</p>
              <p className="text-xs text-red-500">
                Permanently remove your account and all study materials.
              </p>
            </div>
          </div>
          <button
            className="
              px-4 py-2 text-sm font-semibold rounded-pill
              border border-red-300 text-red-600
              hover:bg-red-100 transition-colors
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-red-400 focus-visible:ring-offset-2
            "
            aria-label="Delete your account permanently"
          >
            Delete
          </button>
        </div>
      </div>
    </section>
  );
}