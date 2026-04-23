import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { sanitizePlainText } from '../../../shared/utils/sanitize';
import Navbar from '../../../shared/components/Navbar';
import Button from '../../../shared/components/Button';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import Spinner from '../../../shared/components/Spinner';
import toast from 'react-hot-toast';

export default function QuizPage() {
  const { id } = useParams();
  const { supabase } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('preview');   // preview | taking | results
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});    // { questionId: selectedIndex }
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: q }, { data: qs }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', id).single(),
        supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('created_at'),
      ]);
      setQuiz(q);
      setQuestions(qs ?? []);
      setLoading(false);
    };
    load();
  }, [id, supabase]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeLeft === null) return;
    if (timeLeft <= 0) { finishQuiz(); return; }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const startQuiz = (withTimer = false) => {
    setAnswers({});
    setCurrent(0);
    setMode('taking');
    if (withTimer) {
      setTimeLeft(questions.length * 60); // 1 min per question
      setTimerActive(true);
    } else {
      setTimeLeft(null);
      setTimerActive(false);
    }
  };

  const selectAnswer = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const finishQuiz = useCallback(() => {
    setTimerActive(false);
    setMode('results');
  }, []);

  const getScore = () => {
    const correct = questions.filter(
      (q) => answers[q.id] !== undefined && answers[q.id] === q.correct_index
    ).length;
    return { correct, total: questions.length, percent: Math.round((correct / questions.length) * 100) };
  };

  const saveQuestion = async () => {
    const { id: qId, question, options, correct_index } = editModal;
    const cleanQ = sanitizePlainText(question);
    const cleanOpts = options.map((o) => sanitizePlainText(o));
    if (!cleanQ || cleanOpts.some((o) => !o)) { toast.error('Fill in all fields.'); return; }

    const payload = {
      question: cleanQ,
      options: cleanOpts,
      correct_index: Number(correct_index),
      quiz_id: id,
    };

    if (qId) {
      const { data } = await supabase.from('quiz_questions').update(payload).eq('id', qId).select().single();
      setQuestions((qs) => qs.map((x) => x.id === qId ? data : x));
      toast.success('Question updated!');
    } else {
      const { data } = await supabase.from('quiz_questions').insert(payload).select().single();
      setQuestions((qs) => [...qs, data]);
      toast.success('Question added!');
    }
    setEditModal(null);
  };

  const deleteQuestion = async () => {
    await supabase.from('quiz_questions').delete().eq('id', deleteTarget.id);
    setQuestions((qs) => qs.filter((q) => q.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('Question deleted.');
  };

  if (loading) return <><Navbar /><div className="flex justify-center mt-20"><Spinner size="lg" /></div></>;
  if (!quiz) return <><Navbar /><p className="text-center mt-20">Quiz not found.</p></>;

  const q = questions[current];
  const score = mode === 'results' ? getScore() : null;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: quiz.title }]} />

        <div className="flex items-center justify-between gap-4 mt-4 mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} aria-label="Back"
              className="p-2 rounded-lg hover:bg-[var(--card-border)]">
              <ArrowLeft size={20} className="text-[var(--muted)]" />
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-color)]">{quiz.title}</h1>
          </div>
          {mode === 'preview' && (
            <Button
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setEditModal({ question: '', options: ['', '', '', ''], correct_index: 0 })}
            >
              Add Question
            </Button>
          )}
        </div>

        {/* ─── PREVIEW MODE ─── */}
        {mode === 'preview' && (
          <>
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 mb-6">
              <p className="text-[var(--text-color)] mb-2">
                <strong>{questions.length}</strong> questions
              </p>
              <p className="text-sm text-[var(--muted)] mb-6">
                Take this quiz to test your knowledge. One question at a time — no overwhelm.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={() => startQuiz(false)}>Start Quiz (No Timer)</Button>
                <Button
                  variant="secondary"
                  icon={<Clock size={16} />}
                  onClick={() => startQuiz(true)}
                >
                  Start with Timer
                </Button>
              </div>
            </div>

            {/* Question list */}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4"
                >
                  <p className="text-sm text-[var(--accent)] font-semibold mb-1">Q{i + 1}</p>
                  <p className="text-[var(--text-color)] mb-3">{q.question}</p>
                  <ol className="space-y-1 mb-3">
                    {q.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={`text-sm px-3 py-1.5 rounded-lg
                                   ${oi === q.correct_index
                                     ? 'bg-green-500/10 text-green-600 font-medium'
                                     : 'text-[var(--muted)]'}`}
                      >
                        {oi === q.correct_index ? '✓ ' : ''}{opt}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary"
                      onClick={() => setEditModal({ id: q.id, question: q.question,
                                                    options: [...q.options], correct_index: q.correct_index })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger"
                      onClick={() => setDeleteTarget(q)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── TAKING MODE ─── */}
        {mode === 'taking' && q && (
          <div>
            {/* Progress + timer */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[var(--muted)]">
                Question <strong>{current + 1}</strong> of <strong>{questions.length}</strong>
              </div>
              {timeLeft !== null && (
                <div
                  aria-live="polite"
                  aria-label={`Time remaining: ${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds`}
                  className={`flex items-center gap-1.5 text-sm font-semibold
                             ${timeLeft < 30 ? 'text-red-500' : 'text-[var(--text-color)]'}`}
                >
                  <Clock size={14} aria-hidden="true" />
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div
              className="h-2 bg-[var(--card-border)] rounded-full mb-6 overflow-hidden"
              role="progressbar"
              aria-valuenow={current + 1}
              aria-valuemin={1}
              aria-valuemax={questions.length}
            >
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question card */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 md:p-8 mb-6">
              <p className="text-lg font-semibold text-[var(--text-color)] mb-6 leading-relaxed">
                {q.question}
              </p>

              {/* Options */}
              <fieldset>
                <legend className="sr-only">Choose your answer</legend>
                <div className="space-y-3" role="radiogroup">
                  {q.options.map((opt, oi) => {
                    const isSelected = answers[q.id] === oi;
                    return (
                      <label
                        key={oi}
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer
                                   transition-all duration-150
                                   ${isSelected
                                     ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                     : 'border-[var(--card-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--card-border)]/50'}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={oi}
                          checked={isSelected}
                          onChange={() => selectAnswer(q.id, oi)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                                     flex-shrink-0 transition-colors
                                     ${isSelected
                                       ? 'border-[var(--accent)] bg-[var(--accent)]'
                                       : 'border-[var(--card-border)]'}`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-[var(--text-color)]">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button
                variant="secondary"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
              >
                ← Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>Next →</Button>
              ) : (
                <Button onClick={finishQuiz} icon={<Trophy size={16} />}>
                  Finish Quiz
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ─── RESULTS MODE ─── */}
        {mode === 'results' && score && (
          <div className="text-center">
            <div
              className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold
                          text-white mx-auto mb-6 shadow-lg
                          ${score.percent >= 80
                            ? 'bg-green-500'
                            : score.percent >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'}`}
              aria-label={`Score: ${score.percent}%`}
            >
              {score.percent}%
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-color)] mb-2">
              {score.percent >= 80 ? '🎉 Excellent!' : score.percent >= 60 ? '👍 Good work!' : '📚 Keep studying!'}
            </h2>
            <p className="text-[var(--muted)] mb-8">
              You got {score.correct} out of {score.total} correct.
            </p>

            {/* Per-question breakdown */}
            <div className="space-y-3 text-left mb-8">
              {questions.map((q, i) => {
                const userAns = answers[q.id];
                const isCorrect = userAns === q.correct_index;
                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border ${isCorrect
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-red-500/30 bg-red-500/5'}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {isCorrect
                        ? <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        : <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />}
                      <p className="text-sm font-medium text-[var(--text-color)]">
                        Q{i + 1}: {q.question}
                      </p>
                    </div>
                    {!isCorrect && (
                      <p className="text-xs text-green-600 ml-6">
                        Correct answer: {q.options[q.correct_index]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => startQuiz(false)}>Retake Quiz</Button>
              <Button variant="secondary" onClick={() => setMode('preview')}>Back to Preview</Button>
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Question Modal */}
      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title={editModal?.id ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        {editModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-color)] mb-1">Question</label>
              <textarea
                rows={2}
                value={editModal.question}
                onChange={(e) => setEditModal((m) => ({ ...m, question: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--card-border)]
                           bg-[var(--bg-color)] text-[var(--text-color)] focus:outline-none
                           focus:ring-2 focus:ring-[var(--accent)] resize-none"
                placeholder="Enter your question..."
              />
            </div>
            <fieldset>
              <legend className="block text-sm font-medium text-[var(--text-color)] mb-2">
                Answer Options (mark the correct one)
              </legend>
              {editModal.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={editModal.correct_index === i}
                    onChange={() => setEditModal((m) => ({ ...m, correct_index: i }))}
                    aria-label={`Mark option ${i + 1} as correct`}
                    className="accent-[var(--accent)]"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const opts = [...editModal.options];
                      opts[i] = e.target.value;
                      setEditModal((m) => ({ ...m, options: opts }));
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--card-border)]
                               bg-[var(--bg-color)] text-[var(--text-color)] text-sm focus:outline-none
                               focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              ))}
              <p className="text-xs text-[var(--muted)]">
                ○ Select the radio button next to the correct answer.
              </p>
            </fieldset>
            <div className="flex gap-2">
              <Button onClick={saveQuestion}>Save Question</Button>
              <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Question?" size="sm">
        <p className="text-[var(--text-color)] mb-4">Delete this question permanently?</p>
        <div className="flex gap-2">
          <Button variant="danger" onClick={deleteQuestion}>Delete</Button>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}