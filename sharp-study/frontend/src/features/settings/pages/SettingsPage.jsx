import React, { useState } from 'react';
import { Settings, User, Palette, Shield, ChevronRight } from 'lucide-react';
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
  const settings = useSettings();

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
        <header className="mb-10">
           <h1 className="text-4xl font-display font-black text-text tracking-tight mb-2">Settings</h1>
           <p className="text-text-muted font-medium">Fine-tune your workspace to match your learning style.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-8 items-start">
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
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-3xl transition-all duration-300 border-2 ${
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
              className="bg-surface rounded-[2.5rem] p-8 md:p-10 border border-border shadow-card"
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

          {/* Sticky Sidebar (Preview) */}
          <aside className="xl:sticky xl:top-10 space-y-6">
             <div className="bg-surface-2 p-1 rounded-[2.8rem] border border-border">
                <LivePreviewCard draft={settings.draft} />
             </div>
             <div className="p-8 rounded-[2.5rem] bg-accent/5 border border-accent/10">
                <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                   <Palette size={18} /> Accessibility Tip
                </h4>
                <p className="text-sm text-text-muted leading-relaxed">
                   High contrast modes and Dyslexia-friendly fonts are available to make reading easier for everyone.
                </p>
             </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
