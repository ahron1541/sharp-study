import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Flame, Star, Zap, BookOpen, CreditCard, HelpCircle, Plus, Search, Archive, Trash2, Eye, ChevronRight, Sparkles, Trophy, ArrowRight } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { useAuth as useAuthCore } from '../../auth/context/AuthContext';

const materialMeta = {
  study_guides: { icon: BookOpen, label: 'Study Guide', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  flashcards: { icon: CreditCard, label: 'Flashcards', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  quizzes: { icon: HelpCircle, label: 'Quiz', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
};

export default function DashboardPage() {
  const { items = { study_guides: [], flashcards: [], quizzes: [] }, loading } = useDashboard();
  const { profile } = useAuthCore();
  const [search, setSearch] = useState('');

  const firstName = profile?.first_name || 'Student';
  const streak = profile?.preferences?.streak?.current || 0;
  const isFirstTime = items.study_guides.length === 0 && items.flashcards.length === 0 && items.quizzes.length === 0;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-48 bg-surface rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="h-32 bg-surface rounded-3xl" />
         <div className="h-32 bg-surface rounded-3xl" />
      </div>
    </div>
  );

  return (
    <Motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 md:p-10 max-w-7xl mx-auto space-y-10"
    >
      {/* Top Section: Welcome + Streak */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Welcome Card */}
        <Motion.div 
          variants={itemAnim}
          className="lg:col-span-2 relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl shadow-accent/20"
          style={{ background: 'var(--gradient-accent)' }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles size={160} />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <Motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest mb-6"
              >
                <Zap size={14} /> Global Achievement Unlocked
              </Motion.div>
              <h1 className="text-4xl md:text-5xl font-display font-extrabold leading-tight tracking-tight mb-4">
                {isFirstTime ? `Hello, ${firstName}!` : `Welcome back, ${firstName}!`}
              </h1>
              <p className="text-white/80 text-lg max-w-md font-medium leading-relaxed">
                {isFirstTime 
                  ? "Let's turn your documents into interactive study materials in seconds." 
                  : "Ready to pick up where you left off? Your study guides are waiting."}
              </p>
            </div>
            <div className="mt-8 flex gap-4">
              <button className="px-8 py-3.5 bg-white text-accent font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                Start Studying
              </button>
              <button className="px-8 py-3.5 bg-accent-hover text-white border border-white/20 font-bold rounded-2xl hover:bg-white/10 transition-all">
                Upload New
              </button>
            </div>
          </div>
        </Motion.div>

        {/* Streak Widget */}
        <Motion.div 
          variants={itemAnim}
          className="rounded-[2.5rem] bg-surface p-8 border border-border shadow-card flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-1">Daily Streak</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-display font-black text-streak">{streak}</span>
                <span className="text-lg font-bold text-text-muted">days</span>
              </div>
            </div>
            <div className="p-4 bg-streak/10 rounded-3xl animate-streak-pulse">
              <Flame size={32} className="text-streak" fill="currentColor" />
            </div>
          </div>
          
          <div className="space-y-4 mt-8">
             <div className="flex justify-between text-xs font-bold text-text-muted">
                <span>Weekly Progress</span>
                <span>{streak}/7 Days</span>
             </div>
             <div className="flex justify-between gap-2">
                {[...Array(7)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 flex-1 rounded-full ${i < streak ? 'bg-streak' : 'bg-surface-2'}`}
                  />
                ))}
             </div>
             <div className="p-4 bg-surface-2 rounded-2xl border border-border flex items-center gap-3">
                <Trophy size={18} className="text-yellow-500" />
                <span className="text-xs font-semibold text-text">Keep going for a 7-day bonus!</span>
             </div>
          </div>
        </Motion.div>
      </div>

      {/* Quick Access Section */}
      <Motion.section variants={itemAnim} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold text-text">Quick Access</h2>
          <button className="text-sm font-bold text-accent hover:underline flex items-center gap-1">
            See all <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <QuickAccessCard 
             label="Flashcard Arena"
             sub="Test your active recall"
             icon={CreditCard}
             color="text-violet-500"
             bg="bg-violet-500/10"
           />
           <QuickAccessCard 
             label="Quiz Challenge"
             sub="Master the core concepts"
             icon={HelpCircle}
             color="text-emerald-500"
             bg="bg-emerald-500/10"
           />
        </div>
      </Motion.section>

      {/* SEARCH AND MATERIALS */}
      <Motion.div variants={itemAnim} className="space-y-8">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Find a study guide, flashcard set, or quiz..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-surface border-2 border-transparent focus:border-accent/20 rounded-[2rem] shadow-card focus:shadow-xl focus:shadow-accent/5 focus:outline-none text-text font-medium transition-all"
          />
        </div>

        {Object.entries(items).map(([key, list]) => {
          const filteredList = search
            ? list.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()))
            : list;

          return (
          <section key={key} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className={`p-2 rounded-xl ${materialMeta[key].bg}`}>
                {React.createElement(materialMeta[key].icon, { className: materialMeta[key].color, size: 18 })}
              </div>
              <h3 className="text-lg font-bold text-text">{materialMeta[key].label}s</h3>
              <span className="text-xs bg-surface-2 px-2.5 py-1 rounded-full font-bold text-text-muted">{filteredList.length}</span>
            </div>
            
            {filteredList.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mb-4">
                    {React.createElement(materialMeta[key].icon, { className: 'text-text-muted opacity-50', size: 32 })}
                 </div>
                 <h4 className="font-bold text-text mb-2">No items found</h4>
                 <p className="text-sm text-text-muted max-w-xs mb-6">Create your first {materialMeta[key].label.toLowerCase()} by uploading a document.</p>
                 <button className="px-6 py-2 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20">Add New</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredList.map((item) => (
                  <MaterialCard key={item.id} item={item} type={key} />
                ))}
              </div>
            )}
          </section>
          );
        })}
      </Motion.div>
    </Motion.div>
  );
}

function QuickAccessCard({ label, sub, icon, color, bg }) {
  const Icon = icon;

  return (
    <Motion.button 
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-5 p-6 bg-surface border border-border rounded-[2rem] hover:border-accent hover:shadow-xl transition-all text-left w-full group"
    >
      <div className={`p-5 rounded-2xl ${bg}`}>
        <Icon className={color} size={28} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-text text-lg group-hover:text-accent transition-colors">{label}</h4>
        <p className="text-sm text-text-muted font-medium">{sub}</p>
      </div>
      <ChevronRight className="text-text-muted group-hover:text-accent transition-colors" />
    </Motion.button>
  );
}

function MaterialCard({ item, type }) {
  const meta = materialMeta[type];
  const Icon = meta.icon;
  const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Motion.div 
      whileHover={{ y: -8 }}
      className="group relative bg-surface border border-border rounded-[2rem] p-6 shadow-card hover:shadow-2xl hover:shadow-accent/10 transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl ${meta.bg}`}>
          <Icon className={meta.color} size={22} />
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button className="p-2 hover:bg-surface-2 rounded-xl text-text-muted"><Archive size={16} /></button>
           <button className="p-2 hover:bg-red-500/10 rounded-xl text-red-500"><Trash2 size={16} /></button>
        </div>
      </div>

      <h3 className="text-lg font-bold text-text mb-4 line-clamp-2 min-h-[3.5rem] group-hover:text-accent transition-colors">{item.title}</h3>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
        <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{date}</span>
        <button className="flex items-center gap-1 text-xs font-black text-accent hover:gap-2 transition-all">
          Study Now <ArrowRight size={14} />
        </button>
      </div>
    </Motion.div>
  );
}
