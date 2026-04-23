import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { sanitizePlainText } from '../../../shared/utils/sanitize';
import Navbar from '../../../shared/components/Navbar';
import Button from '../../../shared/components/Button';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import Spinner from '../../../shared/components/Spinner';
import toast from 'react-hot-toast';

export default function FlashcardsPage() {
  const { id } = useParams();  // flashcard_sets id
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [set, setSet] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState('browse'); // browse | study
  const [editModal, setEditModal] = useState(null); // null | { front, back, id? }
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: setData }, { data: cardData }] = await Promise.all([
        supabase.from('flashcard_sets').select('*').eq('id', id).single(),
        supabase.from('flashcards').select('*').eq('set_id', id).order('created_at'),
      ]);
      setSet(setData);
      setCards(cardData ?? []);
      setLoading(false);
    };
    load();
  }, [id, supabase]);

  const saveCard = async () => {
    const { id: cardId, front, back } = editModal;
    const clean = { front: sanitizePlainText(front), back: sanitizePlainText(back) };
    if (!clean.front || !clean.back) { toast.error('Both sides are required.'); return; }

    if (cardId) {
      await supabase.from('flashcards').update(clean).eq('id', cardId);
      setCards((c) => c.map((x) => x.id === cardId ? { ...x, ...clean } : x));
      toast.success('Card updated!');
    } else {
      const { data } = await supabase
        .from('flashcards')
        .insert({ ...clean, set_id: id })
        .select()
        .single();
      setCards((c) => [...c, data]);
      toast.success('Card added!');
    }
    setEditModal(null);
  };

  const deleteCard = async () => {
    await supabase.from('flashcards').delete().eq('id', deleteTarget.id);
    setCards((c) => c.filter((x) => x.id !== deleteTarget.id));
    if (currentIndex >= cards.length - 1) setCurrentIndex(Math.max(0, cards.length - 2));
    setDeleteTarget(null);
    toast.success('Card deleted.');
  };

  const nextCard = () => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => (i + 1) % cards.length), 150);
  };
  const prevCard = () => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => (i - 1 + cards.length) % cards.length), 150);
  };

  if (loading) return <><Navbar /><div className="flex justify-center mt-20"><Spinner size="lg" /></div></>;
  if (!set) return <><Navbar /><p className="text-center mt-20">Set not found.</p></>;

  const card = cards[currentIndex];

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: set.title }]} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} aria-label="Back to dashboard"
              className="p-2 rounded-lg hover:bg-[var(--card-border)] transition-colors">
              <ArrowLeft size={20} className="text-[var(--muted)]" />
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-color)]">{set.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'browse' ? 'primary' : 'secondary'}
              onClick={() => setMode('browse')}
            >Browse All</Button>
            <Button
              size="sm"
              variant={mode === 'study' ? 'primary' : 'secondary'}
              onClick={() => { setMode('study'); setCurrentIndex(0); setFlipped(false); }}
            >Study Mode</Button>
            <Button
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setEditModal({ front: '', back: '' })}
            >Add Card</Button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-6xl mb-4">🃏</p>
            <p className="text-[var(--text-color)] font-semibold mb-2">No cards yet</p>
            <Button size="sm" onClick={() => setEditModal({ front: '', back: '' })} icon={<Plus size={14} />}>
              Add Your First Card
            </Button>
          </div>
        ) : mode === 'study' ? (
          // ─── STUDY MODE: flip card ───
          <div className="flex flex-col items-center">
            <p className="text-sm text-[var(--muted)] mb-6">
              Card {currentIndex + 1} of {cards.length} · Click the card to flip
            </p>
            {/* Flip card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFlipped(!flipped)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped(!flipped); }}
              aria-label={flipped ? `Answer: ${card.back}. Press to see question.` : `Question: ${card.front}. Press to reveal answer.`}
              style={{ perspective: '1000px' }}
              className="w-full max-w-xl h-64 cursor-pointer"
            >
              <div
                style={{
                  transition: 'transform 0.5s',
                  transformStyle: 'preserve-3d',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                {/* Front */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className="absolute inset-0 bg-[var(--card-bg)] border-2 border-[var(--accent)]
                             rounded-2xl flex flex-col items-center justify-center p-8 shadow-xl"
                >
                  <span className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wider mb-3">
                    Question
                  </span>
                  <p className="text-[var(--text-color)] text-xl text-center font-medium">{card.front}</p>
                  <span className="text-xs text-[var(--muted)] mt-4">Click to reveal answer</span>
                </div>
                {/* Back */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 bg-[var(--accent)] rounded-2xl flex flex-col items-center
                             justify-center p-8 shadow-xl"
                >
                  <span className="text-xs text-white/70 font-semibold uppercase tracking-wider mb-3">
                    Answer
                  </span>
                  <p className="text-white text-xl text-center font-medium">{card.back}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={prevCard}
                aria-label="Previous card"
                className="p-3 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)]
                           hover:bg-[var(--card-border)] transition-colors focus-visible:outline
                           focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => { setFlipped(false); setCurrentIndex(Math.floor(Math.random() * cards.length)); }}
                aria-label="Shuffle to random card"
                className="p-3 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)]
                           hover:bg-[var(--card-border)] transition-colors"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={nextCard}
                aria-label="Next card"
                className="p-3 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)]
                           hover:bg-[var(--card-border)] transition-colors focus-visible:outline
                           focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ) : (
          // ─── BROWSE MODE: list of all cards ───
          <div className="grid sm:grid-cols-2 gap-4">
            {cards.map((c) => (
              <div
                key={c.id}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5"
              >
                <div className="mb-3">
                  <p className="text-xs text-[var(--accent)] font-semibold mb-1">Front</p>
                  <p className="text-[var(--text-color)]">{c.front}</p>
                </div>
                <div className="pt-3 border-t border-[var(--card-border)]">
                  <p className="text-xs text-[var(--muted)] font-semibold mb-1">Back</p>
                  <p className="text-[var(--muted)]">{c.back}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Edit2 size={14} />}
                    onClick={() => setEditModal({ id: c.id, front: c.front, back: c.back })}
                  >Edit</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => setDeleteTarget(c)}
                  >Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Card Modal */}
      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={editModal?.id ? 'Edit Flashcard' : 'Add Flashcard'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="card-front" className="block text-sm font-medium text-[var(--text-color)] mb-1">
              Front (Question)
            </label>
            <textarea
              id="card-front"
              rows={3}
              value={editModal?.front ?? ''}
              onChange={(e) => setEditModal((m) => ({ ...m, front: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--card-border)]
                         bg-[var(--bg-color)] text-[var(--text-color)] focus:outline-none
                         focus:ring-2 focus:ring-[var(--accent)] resize-none"
              placeholder="What is...?"
            />
          </div>
          <div>
            <label htmlFor="card-back" className="block text-sm font-medium text-[var(--text-color)] mb-1">
              Back (Answer)
            </label>
            <textarea
              id="card-back"
              rows={3}
              value={editModal?.back ?? ''}
              onChange={(e) => setEditModal((m) => ({ ...m, back: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--card-border)]
                         bg-[var(--bg-color)] text-[var(--text-color)] focus:outline-none
                         focus:ring-2 focus:ring-[var(--accent)] resize-none"
              placeholder="The answer is..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveCard}>Save Card</Button>
            <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Card?" size="sm">
        <p className="text-[var(--text-color)] mb-4">
          Delete this flashcard permanently? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={deleteCard}>Delete</Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}