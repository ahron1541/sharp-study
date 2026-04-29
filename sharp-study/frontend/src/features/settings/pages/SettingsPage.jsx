import { useState } from 'react';
import { Settings, User } from 'lucide-react';
import { useSettings }          from '../hooks/useSettings';
import PersonalizationPanel     from '../components/PersonalizationPanel';
import AccountSecurityPanel     from '../components/AccountSecurityPanel';
import LivePreviewCard          from '../components/LivePreviewCard';

const TABS = [
  { id: 'personalization', label: 'Personalization',    icon: Settings },
  { id: 'account',         label: 'Account & Security', icon: User },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('personalization');
  const { draft, hasChanges, saving, updateDraft, discardChanges, save } = useSettings();

  return (
    <div
      className="flex h-full"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left sub-nav — desktop */}
      <aside
        className="hidden sm:flex flex-col w-52 flex-shrink-0 border-r p-4 gap-1"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
        aria-label="Settings navigation"
      >
        <h1
          className="text-base font-black mb-3 px-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
        >
          Settings
        </h1>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={isActive}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                         text-left w-full transition-colors focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                color:    isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontWeight: isActive ? '600' : '500',
                '--tw-ring-color': 'var(--color-accent)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: isActive ? 'var(--color-accent)' : 'transparent' }}
                aria-hidden="true"
              />
              {label}
            </button>
          );
        })}
      </aside>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Active panel */}
            <div
              id={`settings-panel-${activeTab}`}
              role="tabpanel"
              className="flex-1 min-w-0"
            >
              {activeTab === 'personalization' && (
                <PersonalizationPanel
                  draft={draft}
                  hasChanges={hasChanges}
                  saving={saving}
                  updateDraft={updateDraft}
                  discardChanges={discardChanges}
                  onSave={save}
                />
              )}
              {activeTab === 'account' && <AccountSecurityPanel />}
            </div>

            {/* Live preview — personalization only */}
            {activeTab === 'personalization' && (
              <div className="lg:w-56 flex-shrink-0">
                <LivePreviewCard draft={draft} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        role="tablist"
        aria-label="Settings sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={isActive}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium"
              style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}