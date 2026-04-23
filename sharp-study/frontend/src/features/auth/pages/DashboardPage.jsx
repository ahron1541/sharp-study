import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, BookOpen, CreditCard, HelpCircle, Archive,
         Upload, Trash2, Eye, Edit } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar';
import Button from '../../../shared/components/Button';
import SkeletonCard from '../../../shared/components/SkeletonCard';
import Modal from '../../../shared/components/Modal';
import SessionTimeout from '../../../shared/components/SessionTimeout';
import UploadModal from '../../upload/components/UploadModal';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'study_guides', label: 'Study Guides', icon: <BookOpen size={16} /> },
  { id: 'flashcards',   label: 'Flashcards',   icon: <CreditCard size={16} /> },
  { id: 'quizzes',      label: 'Quizzes',       icon: <HelpCircle size={16} /> },
];

const TABLE_MAP = {
  study_guides: 'study_guides',
  flashcards:   'flashcard_sets',
  quizzes:      'quizzes',
};

const ROUTES_MAP = {
  study_guides: 'study-guide',
  flashcards:   'flashcards',
  quizzes:      'quiz',
};

export default function DashboardPage() {
  const { supabase, profile } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('study_guides');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const table = TABLE_MAP[tab];
    let query = supabase
      .from(table)
      .select('*')
      .eq('is_archived', showArchived)
      .order('created_at', { ascending: false });

    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (!error) setItems(data ?? []);
    setLoading(false);
  }, [tab, search, showArchived, supabase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleArchive = async (id) => {
    const table = TABLE_MAP[tab];
    await supabase.from(table).update({ is_archived: !showArchived }).eq('id', id);
    toast.success(showArchived ? 'Restored!' : 'Archived!');
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = TABLE_MAP[tab];
    await supabase.from(table).delete().eq('id', deleteTarget.id);
    toast.success('Deleted permanently.');
    setDeleteTarget(null);
    fetchItems();
  };

  const quickStats = [
    { label: 'Study Guides', value: 0, icon: <BookOpen size={20} />, color: 'text-blue-400' },
    { label: 'Flashcard Sets', value: 0, icon: <CreditCard size={20} />, color: 'text-purple-400' },
    { label: 'Quizzes', value: 0, icon: <HelpCircle size={20} />, color: 'text-green-400' },
  ];

  return (
    <>
      <Navbar />
      <SessionTimeout />
      <main className="container mx-auto px-4 py-8 max-w-6xl" id="main-content">

        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-color)]">
              Welcome back, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              Your study library — all your materials in one place.
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)} icon={<Upload size={16} />}>
            Upload & Generate
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4
                         flex items-center gap-3"
            >
              <span className={stat.color} aria-hidden="true">{stat.icon}</span>
              <div>
                <p className="text-xs text-[var(--muted)]">{stat.label}</p>
                <p className="font-bold text-[var(--text-color)]">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Library */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl">
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Study material categories"
            className="flex border-b border-[var(--card-border)] px-4"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2
                           transition-colors focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-[var(--accent)]
                           ${tab === t.id
                             ? 'border-[var(--accent)] text-[var(--accent)]'
                             : 'border-transparent text-[var(--muted)] hover:text-[var(--text-color)]'}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder={`Search ${TABS.find((t) => t.id === tab)?.label}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search study materials"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--card-border)]
                           bg-[var(--bg-color)] text-[var(--text-color)] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              aria-pressed={showArchived}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors
                         ${showArchived
                           ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                           : 'border-[var(--card-border)] text-[var(--muted)]'}`}
            >
              <Archive size={14} />
              {showArchived ? 'Showing Archived' : 'Show Archived'}
            </button>
          </div>

          {/* Tab Panels */}
          {TABS.map((t) => (
            <div
              key={t.id}
              id={`panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={t.id}
              hidden={tab !== t.id}
              className="p-4"
            >
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonCard key={n} />)}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4" aria-hidden="true">
                    {tab === 'study_guides' ? '📖' : tab === 'flashcards' ? '🃏' : '❓'}
                  </div>
                  <h3 className="text-[var(--text-color)] font-semibold mb-2">
                    {showArchived ? 'No archived items' : 'Nothing here yet'}
                  </h3>
                  <p className="text-[var(--muted)] text-sm mb-4">
                    {showArchived
                      ? 'Archived items will appear here.'
                      : 'Upload a file to generate your first study material.'}
                  </p>
                  {!showArchived && (
                    <Button size="sm" onClick={() => setUploadOpen(true)} icon={<Plus size={14} />}>
                      Upload & Generate
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="bg-[var(--bg-color)] border border-[var(--card-border)] rounded-xl p-5
                                 hover:border-[var(--accent)] hover:shadow-lg transition-all duration-200
                                 group"
                    >
                      <h3 className="font-semibold text-[var(--text-color)] mb-1 line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mb-4">
                        {new Date(item.created_at).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          icon={<Eye size={14} />}
                          onClick={() => navigate(`/${ROUTES_MAP[tab]}/${item.id}`)}
                          ariaLabel={`Open ${item.title}`}
                        >
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Archive size={14} />}
                          onClick={() => handleArchive(item.id)}
                          ariaLabel={showArchived ? `Restore ${item.title}` : `Archive ${item.title}`}
                        >
                          {showArchived ? 'Restore' : 'Archive'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleteTarget(item)}
                          ariaLabel={`Delete ${item.title}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => { setUploadOpen(false); fetchItems(); }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Permanently?"
        size="sm"
      >
        <p className="text-[var(--text-color)] mb-4">
          Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>?
          This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete}>Yes, Delete</Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}