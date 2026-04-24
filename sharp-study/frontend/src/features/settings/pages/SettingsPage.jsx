import { useState } from 'react';
import { Settings, User } from 'lucide-react';
import { useSettings }            from '../hooks/useSettings';
import PersonalizationPanel       from '../components/PersonalizationPanel';
import AccountSecurityPanel       from '../components/AccountSecurityPanel';
import LivePreviewCard             from '../components/LivePreviewCard';

const TABS = [
  { id: 'personalization', label: 'Personalization',     icon: Settings },
  { id: 'account',         label: 'Account & Security',  icon: User },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('personalization');
  const {
    draft,
    hasChanges,
    saving,
    updateDraft,
    discardChanges,
    save,
  } = useSettings();

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Settings sub-nav ── */}
      <aside
        className="
          w-[220px] flex-shrink-0 bg-surface-2 border-r border-border
          p-4 flex flex-col gap-1 overflow-y-auto
          hidden sm:flex
        "
        aria-label="Settings navigation"
      >
        <h1 className="text-xl font-black text-text mb-4 px-2">Settings</h1>

        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${id}`}
              className={`
                flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm
                font-medium text-left w-full
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-accent focus-visible:ring-offset-1
                ${isActive
                  ? 'text-accent font-semibold'
                  : 'text-muted hover:text-text hover:bg-surface'}
              `}
            >
              {/* Active indicator dot */}
              <span
                className={`
                  w-1.5 h-1.5 rounded-full flex-shrink-0
                  ${isActive ? 'bg-accent' : 'bg-transparent'}
                `}
                aria-hidden="true"
              />
              {label}
            </button>
          );
        })}
      </aside>

      {/* ── Mobile tab bar (visible only on small screens) ── */}
      <div
        className="
          sm:hidden fixed bottom-0 left-0 right-0 z-30
          bg-surface border-t border-border
          flex
        "
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
              className={`
                flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium
                transition-colors
                ${isActive ? 'text-accent' : 'text-muted'}
              `}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Center: active panel ── */}
      <div className="flex-1 overflow-y-auto p-6 sm:pb-6 pb-24">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-8">

          {/* Panel content */}
          <div
            id={`settings-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={activeTab}
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
            {activeTab === 'account' && (
              <AccountSecurityPanel />
            )}
          </div>

          {/* Live preview — only shown for personalization tab */}
          {activeTab === 'personalization' && (
            <div className="lg:w-[280px] flex-shrink-0">
              <LivePreviewCard draft={draft} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}