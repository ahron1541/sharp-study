import React, { useState } from 'react';
import { Eye, EyeOff, Palette, Shield, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import PersonalizationPanel from '../components/PersonalizationPanel';
import AccountSecurityPanel from '../components/AccountSecurityPanel';
import LivePreviewCard from '../components/LivePreviewCard';
import { useSettings } from '../hooks/useSettings';

const TABS = [
  { id: 'personalization', label: 'Personalization', icon: Palette, sub: 'Fonts, colors, and atmosphere' },
  { id: 'account', label: 'Account & Security', icon: Shield, sub: 'Privacy, password, and safety' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('personalization');
  const [previewOpen, setPreviewOpen] = useState(false);
  const settings = useSettings();

  const changeTab = (tabId) => {
    if (tabId !== activeTab && settings.hasChanges) {
      settings.discardChanges({ notify: false });
    }
    if (tabId !== 'personalization') {
      setPreviewOpen(false);
    }
    setActiveTab(tabId);
  };

  return (
    <div className="relative min-h-full bg-bg">
      {settings.blocking ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/72 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 shadow-2xl">
            <p className="text-lg font-black text-text">{settings.saveState.title}</p>
            <p className="mt-2 text-sm leading-7 text-text-muted">{settings.saveState.detail}</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.max(10, settings.saveState.progress)}%` }}
              />
            </div>
            <p className="mt-3 text-right text-sm font-bold text-accent">{settings.saveState.progress}%</p>
          </div>
        </div>
      ) : null}

      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-display font-black text-text tracking-tight mb-2">Settings</h1>
            <p className="text-text-muted font-medium">Fine-tune your workspace to match your learning style.</p>
          </div>

          {activeTab === 'personalization' ? (
            <button
              type="button"
              onClick={() => setPreviewOpen((value) => !value)}
              aria-expanded={previewOpen}
              aria-controls="settings-live-preview"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 font-bold text-text transition hover:border-accent/45 hover:text-accent sm:w-auto"
            >
              {previewOpen ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              {previewOpen ? 'Hide live preview' : 'Show live preview'}
            </button>
          ) : null}
        </header>

        <div className="space-y-10">
            {/* Desktop Navigation */}
            <div className="flex flex-wrap gap-4">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={settings.blocking}
                    onClick={() => changeTab(tab.id)}
                    className={`flex min-h-14 min-w-[min(100%,14rem)] flex-1 items-center gap-3 rounded-3xl border-2 px-5 py-3 transition-all duration-300 sm:flex-none sm:px-6 sm:py-4 ${
                      isActive 
                        ? 'bg-accent border-accent text-white shadow-xl shadow-accent/20' 
                        : 'bg-surface border-border text-text-muted hover:border-accent/40'
                    }`}
                  >
                    <Icon size={20} />
                    <div className="text-left">
                       <p className={`font-bold ${isActive ? 'text-white' : 'text-text'}`}>{tab.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Panel area */}
            <Motion.div
              layout
              className="bg-surface rounded-[2rem] p-5 border border-border shadow-card sm:p-7 md:p-9"
            >
              <AnimatePresence mode="wait">
                <Motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeTab === 'personalization' && <PersonalizationPanel {...settings} />}
                  {activeTab === 'account' && <AccountSecurityPanel />}
                </Motion.div>
              </AnimatePresence>
            </Motion.div>
        </div>
      </div>

      <AnimatePresence>
        {activeTab === 'personalization' && previewOpen ? (
          <Motion.aside
            id="settings-live-preview"
            role="dialog"
            aria-label="Live personalization preview"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-3 z-30 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[1.75rem] border border-border bg-surface p-3 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[min(24rem,calc(100vw-3rem))] sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Live preview</p>
                <p className="text-sm font-semibold text-text-muted">Updates as you change personalization.</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-text-muted transition hover:text-text"
                aria-label="Close live preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <LivePreviewCard draft={settings.draft} showHeading={false} />
          </Motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
