import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Flame,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../../config/api';
import Modal from '../../../shared/components/Modal';
import { sanitizePlainText } from '../../../shared/utils/sanitize';
import StudyNotice from '../../../shared/components/StudyNotice';
import { QuizBuilderSkeleton } from '../../../shared/components/PageSkeletons';

const DRAFT_PREFIX = 'sharp-study-quiz-builder-draft';
const DEFAULT_CHOICES = ['Option A', 'Option B', 'Option C', 'Option D'];
const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: 'Easy', helper: 'Calmer recall', description: 'Best for warmups and beginner checks.', color: '#22c55e', icon: Sparkles },
  { value: 'normal', label: 'Normal', helper: 'Balanced', description: 'A steady default for regular quiz review.', color: '#8b3dff', icon: ShieldCheck },
  { value: 'hard', label: 'Hard', helper: 'Applied', description: 'Better for comparison and deeper thinking.', color: '#f97316', icon: Flame },
  { value: 'expert', label: 'Expert', helper: 'Strict', description: 'Use for the toughest challenge questions.', color: '#facc15', icon: Trophy },
];

function getQuizDifficulty(value = 'normal') {
  return QUIZ_DIFFICULTIES.find((item) => item.value === value) || QUIZ_DIFFICULTIES[1];
}

function createClientId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function draftKey(id) {
  return `${DRAFT_PREFIX}:${id || 'new'}`;
}

function cleanText(value = '', maxLength = 600) {
  return sanitizePlainText(String(value || '')).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function createBlankQuestion(type = 'multiple_choice') {
  return {
    client_id: createClientId(),
    id: '',
    type,
    question: '',
    choices: [...DEFAULT_CHOICES],
    correct_index: 0,
    correct_answer: '',
    accepted_answers: [],
    explanation: '',
    support_snippet: '',
    difficulty: 'normal',
  };
}

function normalizeBuilderQuestion(question, index = 0) {
  const type = question?.type === 'identification' ? 'identification' : 'multiple_choice';
  const choices = type === 'multiple_choice'
    ? (Array.isArray(question?.choices) ? question.choices : DEFAULT_CHOICES).map((choice) => cleanText(choice, 240)).slice(0, 4)
    : [];
  while (choices.length < 4 && type === 'multiple_choice') choices.push(`Option ${choices.length + 1}`);

  const correctIndex = Math.max(0, Math.min(Number(question?.correct_index) || 0, 3));
  const correctAnswer = type === 'multiple_choice'
    ? choices[correctIndex] || ''
    : cleanText(question?.correct_answer, 160);

  return {
    client_id: question?.client_id || question?.id || createClientId(),
    id: question?.id || '',
    type,
    question: cleanText(question?.question, 800),
    choices,
    correct_index: correctIndex,
    correct_answer: correctAnswer,
    accepted_answers: Array.isArray(question?.accepted_answers)
      ? question.accepted_answers.map((answer) => cleanText(answer, 160)).filter(Boolean).slice(0, 8)
      : [],
    explanation: cleanText(question?.explanation, 1200),
    support_snippet: cleanText(question?.support_snippet, 500),
    difficulty: getQuizDifficulty(question?.difficulty).value,
    order: index,
  };
}

function snapshotOf(title, questions) {
  return JSON.stringify({
    title: cleanText(title, 200),
    questions: questions.map((question, index) => {
      const normalized = normalizeBuilderQuestion(question, index);
      return {
        id: normalized.id,
        type: normalized.type,
        question: normalized.question,
        choices: normalized.choices,
        correct_index: normalized.correct_index,
        correct_answer: normalized.correct_answer,
        accepted_answers: normalized.accepted_answers,
        explanation: normalized.explanation,
        support_snippet: normalized.support_snippet,
        difficulty: normalized.difficulty,
        order: index,
      };
    }),
  });
}

function readDraft(id) {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      title: cleanText(parsed.title, 200),
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.map(normalizeBuilderQuestion).filter(Boolean)
        : [],
      autosaveRemote: Boolean(parsed.autosaveRemote),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    localStorage.removeItem(draftKey(id));
    return null;
  }
}

function writeDraft(id, payload) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[QuizBuilder] Could not write local draft.', error);
  }
}

function removeDraft(id) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // Draft cleanup is best effort.
  }
}

function buildPayload(title, questions) {
  const cleanTitle = cleanText(title, 200);
  if (!cleanTitle) throw new Error('Add a quiz title first.');

  const normalizedQuestions = questions.map(normalizeBuilderQuestion);
  if (!normalizedQuestions.length) throw new Error('Add at least one question.');

  normalizedQuestions.forEach((question, index) => {
    if (!question.question) throw new Error(`Question ${index + 1} needs question text.`);
    if (question.type === 'multiple_choice') {
      if (question.choices.filter(Boolean).length !== 4) {
        throw new Error(`Question ${index + 1} needs four answer choices.`);
      }
    }
    if (question.type === 'identification' && !question.correct_answer) {
      throw new Error(`Question ${index + 1} needs a keyword answer.`);
    }
  });

  return {
    title: cleanTitle,
    document_id: null,
    questions: normalizedQuestions.map((question, index) => ({
      id: question.id || undefined,
      type: question.type,
      question: question.question,
      choices: question.type === 'multiple_choice' ? question.choices : [],
      correct_index: question.type === 'multiple_choice' ? question.correct_index : 0,
      correct_answer: question.correct_answer,
      accepted_answers: question.type === 'identification'
        ? Array.from(new Set([question.correct_answer, ...question.accepted_answers].filter(Boolean)))
        : [],
      explanation: question.explanation,
      wrong_explanations: [],
      support_snippet: question.support_snippet,
      difficulty: question.difficulty,
      order: index,
    })),
  };
}

export default function QuizBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [quizId, setQuizId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState(() => [createBlankQuestion()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveRemote, setAutosaveRemote] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [leaveModal, setLeaveModal] = useState({ open: false, action: null });
  const [saveStatus, setSaveStatus] = useState({
    active: false,
    progress: 100,
    title: 'Ready',
    detail: 'Your changes are protected while you work.',
  });
  const autosaveTimerRef = useRef(null);
  const saveLockRef = useRef(false);

  const currentSnapshot = useMemo(() => snapshotOf(title, questions, autosaveRemote), [autosaveRemote, questions, title]);
  const dirty = loaded && currentSnapshot !== lastSavedSnapshot;
  const validQuestionCount = questions.filter((question) => cleanText(question.question)).length;
  const visibleSaveStatus = useMemo(() => {
    if (saving || autosaving || saveStatus.active) return saveStatus;
    if (dirty) {
      return {
        active: false,
        progress: autosaveRemote && quizId ? 48 : 28,
        title: autosaveRemote && quizId ? 'Auto-save is queued' : 'Changes are ready',
        detail: autosaveRemote && quizId ? 'Recent edits will save automatically in a moment.' : 'Use Save when you want to keep this version.',
      };
    }
    return {
      active: false,
      progress: 100,
      title: 'All changes saved',
      detail: 'Your quiz is up to date.',
    };
  }, [autosaveRemote, autosaving, dirty, quizId, saveStatus, saving]);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const localDraft = readDraft(id);
      let savedSnapshot = snapshotOf('', [createBlankQuestion()], false);

      if (isEdit) {
        const response = await apiRequest(`/api/quizzes/${id}`);
        const serverTitle = cleanText(response.quiz?.title || 'Untitled quiz', 200);
        const serverQuestions = (response.questions || []).map(normalizeBuilderQuestion);
        savedSnapshot = snapshotOf(serverTitle, serverQuestions.length ? serverQuestions : [createBlankQuestion()], false);

        if (localDraft?.questions?.length) {
          setTitle(localDraft.title || serverTitle);
          setQuestions(localDraft.questions);
          setAutosaveRemote(localDraft.autosaveRemote);
          toast('Restored your local quiz draft.');
        } else {
          setTitle(serverTitle);
          setQuestions(serverQuestions.length ? serverQuestions : [createBlankQuestion()]);
          setAutosaveRemote(false);
        }
      } else if (localDraft?.questions?.length) {
        setTitle(localDraft.title || '');
        setQuestions(localDraft.questions);
        setAutosaveRemote(localDraft.autosaveRemote);
        toast('Restored your unsaved quiz draft.');
      } else {
        const blank = createBlankQuestion();
        setQuestions([blank]);
        savedSnapshot = snapshotOf('', [blank], false);
      }
      setLastSavedSnapshot(savedSnapshot);
    } catch (error) {
      toast.error(error.message || 'Failed to load quiz builder.');
      if (isEdit) navigate('/library?tab=quiz');
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  }, [id, isEdit, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuiz();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuiz]);

  useEffect(() => {
    if (!loaded) return;
    writeDraft(quizId || 'new', {
      title,
      questions,
      autosaveRemote,
    });
  }, [autosaveRemote, loaded, questions, quizId, title]);

  useEffect(() => {
    if (!loaded || !autosaveRemote || !quizId || !dirty || saving) return undefined;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveQuiz({ silent: true });
    }, 1800);

    return () => window.clearTimeout(autosaveTimerRef.current);
    // saveQuiz is intentionally omitted so typing does not reset from a new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveRemote, currentSnapshot, dirty, loaded, quizId, saving]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    window.history.pushState({ sharpStudyBuilderGuard: true }, '', window.location.href);
    const handlePopState = () => {
      setLeaveModal({ open: true, action: () => navigate('/library?tab=quiz') });
      window.history.pushState({ sharpStudyBuilderGuard: true }, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dirty, navigate]);

  async function saveQuiz({ silent = false } = {}) {
    if (saveLockRef.current || saving || autosaving) return null;
    saveLockRef.current = true;

    try {
      setSaveStatus({
        active: true,
        progress: 16,
        title: silent ? 'Auto-saving edits' : 'Preparing to save',
        detail: 'Checking required fields and cleaning quiz text.',
      });
      const payload = buildPayload(title, questions);
      if (silent) setAutosaving(true);
      else setSaving(true);

      setSaveStatus({
        active: true,
        progress: 44,
        title: silent ? 'Updating saved copy' : 'Saving quiz',
        detail: 'Saving the latest title, questions, answers, and explanations.',
      });
      const response = await apiRequest(quizId ? `/api/quizzes/${quizId}` : '/api/quizzes', {
        method: quizId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });

      setSaveStatus({
        active: true,
        progress: 78,
        title: 'Refreshing builder',
        detail: 'Loading the saved version back into the editor.',
      });
      const nextId = response.quiz?.id || quizId;
      setQuizId(nextId);
      setTitle(cleanText(response.quiz?.title || payload.title, 200));
      setQuestions((response.questions || payload.questions).map(normalizeBuilderQuestion));
      setLastSavedSnapshot(snapshotOf(response.quiz?.title || payload.title, response.questions || payload.questions, autosaveRemote));
      removeDraft(quizId || 'new');
      if (!quizId && nextId) {
        removeDraft('new');
        writeDraft(nextId, {
          title: response.quiz?.title || payload.title,
          questions: response.questions || payload.questions,
          autosaveRemote,
        });
        navigate(`/quiz/${nextId}/edit`, { replace: true });
      }

      setSaveStatus({
        active: true,
        progress: 100,
        title: 'Save complete',
        detail: 'Your quiz is up to date.',
      });
      window.setTimeout(() => {
        setSaveStatus({
          active: false,
          progress: 100,
          title: 'All changes saved',
          detail: 'Your quiz is up to date.',
        });
      }, 900);
      if (!silent) toast.success('Quiz saved.');
      return response;
    } catch (error) {
      setSaveStatus({
        active: false,
        progress: 0,
        title: 'Save needs attention',
        detail: error.message || 'Something stopped the save. Review the message and try again.',
      });
      toast.error(error.message || 'Failed to save quiz.');
      return null;
    } finally {
      saveLockRef.current = false;
      setSaving(false);
      setAutosaving(false);
    }
  }

  function updateQuestion(index, patch) {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? normalizeBuilderQuestion({ ...question, ...patch }, questionIndex) : question
    )));
  }

  function updateChoice(questionIndex, choiceIndex, value) {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const choices = [...question.choices];
      choices[choiceIndex] = value;
      return normalizeBuilderQuestion({ ...question, choices }, index);
    }));
  }

  function moveQuestion(index, direction) {
    setQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy.map(normalizeBuilderQuestion);
    });
  }

  function deleteQuestion(index) {
    setQuestions((current) => {
      const next = current.filter((_, questionIndex) => questionIndex !== index);
      return (next.length ? next : [createBlankQuestion()]).map(normalizeBuilderQuestion);
    });
  }

  function guardedNavigate(action) {
    if (dirty) {
      setLeaveModal({ open: true, action });
      return;
    }
    action();
  }

  function discardAndLeave() {
    removeDraft(quizId || 'new');
    removeDraft('new');
    const action = leaveModal.action;
    setLeaveModal({ open: false, action: null });
    if (typeof action === 'function') action();
  }

  if (loading) {
    return <QuizBuilderSkeleton />;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 pb-24 sm:px-6 lg:px-8">
        <section className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => guardedNavigate(() => navigate(quizId ? `/quiz/${quizId}` : '/library?tab=quiz'))}
                className="mb-3 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)]"
                aria-label={quizId ? 'Back to quiz preview' : 'Back to library'}
                title={quizId ? 'Back to quiz preview' : 'Back to library'}
              >
                <ArrowLeft size={16} role="img" aria-label={quizId ? 'Back to quiz preview icon' : 'Back to library icon'} />
                {quizId ? 'Quiz preview' : 'Library'}
              </button>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent)]">
                  <FileQuestion size={23} role="img" aria-label={quizId ? 'Edit quiz icon' : 'Create quiz icon'} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">{quizId ? 'Edit quiz' : 'Create quiz'}</p>
                  <h1 className="truncate text-2xl font-black text-[color:var(--color-text)] sm:text-3xl">Quiz Builder</h1>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center lg:justify-end">
              <StudyNotice title={quizId ? 'Saving quiz changes can count as study activity.' : 'Creating a quiz can count as study activity.'}>
                Saved quizzes can keep your streak active. Taking the quiz afterward records your attempt history.
              </StudyNotice>
              <button
                type="button"
                onClick={() => saveQuiz()}
                disabled={saving || autosaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 font-black text-[color:var(--color-text)] disabled:opacity-60"
                aria-label="Save quiz"
                title="Save quiz"
              >
                {saving ? <SaveProgressDonut progress={visibleSaveStatus.progress} size="sm" /> : <Save size={18} role="img" aria-label="Save quiz icon" />}
                Save
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <label className="block">
              <span className="text-sm font-black text-[color:var(--color-text)]">Quiz title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                placeholder="Untitled quiz"
              />
            </label>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[color:var(--color-text)]">Auto-save</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--color-text-muted)]">
                      Keeps recent edits protected while you work. You can still save manually anytime.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                      {autosaveRemote ? 'On' : 'Off'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutosaveRemote((value) => !value)}
                      aria-pressed={autosaveRemote}
                      className={`relative inline-flex h-9 w-16 shrink-0 items-center overflow-hidden rounded-full border p-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] ${
                        autosaveRemote
                          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/85'
                          : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
                      }`}
                      title="Toggle auto-save"
                    >
                      <span className={`h-7 w-7 rounded-full bg-white shadow-[0_4px_14px_rgba(15,23,42,0.25)] transition-transform duration-200 ${autosaveRemote ? 'translate-x-7' : 'translate-x-0'}`} />
                      <span className="sr-only">Toggle auto-save</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3" aria-live="polite">
                <div className="flex items-center gap-3">
                  <SaveProgressDonut progress={visibleSaveStatus.progress} active={saving || autosaving || visibleSaveStatus.active} />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[color:var(--color-text)]">{visibleSaveStatus.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--color-text-muted)]">{visibleSaveStatus.detail}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          <div className="space-y-4">
            {questions.map((question, index) => (
              <QuestionEditor
                key={question.client_id}
                question={question}
                index={index}
                total={questions.length}
                onChange={(patch) => updateQuestion(index, patch)}
                onChoiceChange={(choiceIndex, value) => updateChoice(index, choiceIndex, value)}
                onMove={(direction) => moveQuestion(index, direction)}
                onDelete={() => deleteQuestion(index)}
              />
            ))}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
              <div className="flex items-center gap-2">
                <Settings2 className="text-[color:var(--color-accent)]" size={19} role="img" aria-label="Builder summary icon" />
                <h2 className="font-black text-[color:var(--color-text)]">Builder summary</h2>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <SummaryPill label="Questions" value={questions.length} />
                <SummaryPill label="Ready" value={validQuestionCount} />
                <SummaryPill label="MCQ" value={questions.filter((item) => item.type === 'multiple_choice').length} />
                <SummaryPill label="ID" value={questions.filter((item) => item.type === 'identification').length} />
              </dl>
            </section>

            <button
              type="button"
              onClick={() => setQuestions((current) => [...current, createBlankQuestion('multiple_choice')])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-black text-[color:var(--color-accent-text)]"
              aria-label="Add multiple choice question"
              title="Add multiple choice question"
            >
              <Plus size={18} role="img" aria-label="Add multiple choice icon" />
              Add multiple choice
            </button>
            <button
              type="button"
              onClick={() => setQuestions((current) => [...current, createBlankQuestion('identification')])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-black text-[color:var(--color-text)]"
              aria-label="Add identification question"
              title="Add identification question"
            >
              <Plus size={18} role="img" aria-label="Add identification icon" />
              Add identification
            </button>
          </aside>
        </section>
      </main>

      <Modal
        isOpen={saving || autosaving || saveStatus.active}
        onClose={() => {}}
        title={visibleSaveStatus.title}
        size="md"
        closeOnBackdrop={false}
        closeOnEscape={false}
        showCloseButton={false}
      >
        <div className="space-y-5 text-center" aria-live="assertive">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <SaveProgressDonut progress={visibleSaveStatus.progress} active size="lg" />
          </div>
          <div>
            <p className="text-xl font-black text-[color:var(--color-text)]">{visibleSaveStatus.title}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
              {visibleSaveStatus.detail}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]" role="progressbar" aria-valuenow={visibleSaveStatus.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-300" style={{ width: `${visibleSaveStatus.progress}%` }} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
            Please keep this page open
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={leaveModal.open}
        onClose={() => setLeaveModal({ open: false, action: null })}
        title="Leave builder?"
        size="md"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <div className="flex gap-3 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-1 shrink-0 text-amber-500" size={20} aria-hidden="true" />
            <p>You have changes that are not fully saved yet. If you leave now, your latest edits may not be available later.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardAndLeave}
              className="rounded-2xl border border-rose-500/40 px-5 py-3 font-bold text-rose-500"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={() => setLeaveModal({ open: false, action: null })}
              className="rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]"
            >
              Stay on page
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function QuestionEditor({ question, index, total, onChange, onChoiceChange, onMove, onDelete }) {
  return (
    <article className="quiz-fade-up rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_14px_42px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--color-surface-2)] font-black text-[color:var(--color-text)]">{index + 1}</span>
          <label className="flex items-center gap-2 text-sm font-black text-[color:var(--color-text)]">
            Type
            <select
              value={question.type}
              onChange={(event) => onChange({
                type: event.target.value,
                correct_answer: event.target.value === 'identification' ? question.correct_answer : '',
              })}
              className="h-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-sm font-bold outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="identification">Identification</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded-xl border border-[color:var(--color-border)] p-2 text-[color:var(--color-text-muted)] disabled:opacity-40" aria-label="Move question up" title="Move question up">
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded-xl border border-[color:var(--color-border)] p-2 text-[color:var(--color-text-muted)] disabled:opacity-40" aria-label="Move question down" title="Move question down">
            <ChevronDown size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} className="rounded-xl border border-rose-500/30 p-2 text-rose-500" aria-label="Delete question" title="Delete question">
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <QuizDifficultyPicker
        value={question.difficulty}
        onChange={(difficulty) => onChange({ difficulty })}
      />

      <label className="mt-4 block">
        <span className="text-sm font-black text-[color:var(--color-text)]">Question or definition</span>
        <textarea
          value={question.question}
          onChange={(event) => onChange({ question: event.target.value })}
          rows={3}
          maxLength={800}
          className="mt-2 w-full resize-y rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 font-semibold leading-7 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
          placeholder={question.type === 'identification' ? 'Write the definition or clue. The answer should be the keyword.' : 'Write the question.'}
        />
      </label>

      {question.type === 'multiple_choice' ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-black text-[color:var(--color-text)]">Answer choices</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {question.choices.map((choice, choiceIndex) => (
              <label key={choiceIndex} className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2">
                <input
                  type="radio"
                  name={`correct-${question.client_id}`}
                  checked={question.correct_index === choiceIndex}
                  onChange={() => onChange({ correct_index: choiceIndex })}
                  className="h-4 w-4 accent-[color:var(--color-accent)]"
                  aria-label={`Mark choice ${choiceIndex + 1} as correct`}
                />
                <input
                  value={choice}
                  onChange={(event) => onChoiceChange(choiceIndex, event.target.value)}
                  maxLength={240}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] focus:bg-[color:var(--color-surface)]"
                  aria-label={`Choice ${choiceIndex + 1}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-[color:var(--color-text)]">Keyword answer</span>
            <input
              value={question.correct_answer}
              onChange={(event) => onChange({ correct_answer: event.target.value })}
              maxLength={160}
              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              placeholder="Example: Survivability"
            />
          </label>
          <label className="block">
            <span className="text-sm font-black text-[color:var(--color-text)]">Accepted answers</span>
            <input
              value={question.accepted_answers.join(', ')}
              onChange={(event) => onChange({
                accepted_answers: event.target.value.split(',').map((entry) => cleanText(entry, 160)).filter(Boolean),
              })}
              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              placeholder="Optional aliases separated by commas"
            />
          </label>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-[color:var(--color-text)]">Explanation</span>
          <textarea
            value={question.explanation}
            onChange={(event) => onChange({ explanation: event.target.value })}
            rows={3}
            maxLength={1200}
            className="mt-2 w-full resize-y rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 font-semibold leading-7 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            placeholder="Explain why the answer is correct."
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-[color:var(--color-text)]">Source clue</span>
          <textarea
            value={question.support_snippet}
            onChange={(event) => onChange({ support_snippet: event.target.value })}
            rows={3}
            maxLength={500}
            className="mt-2 w-full resize-y rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 font-semibold leading-7 text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            placeholder="Optional lesson sentence or clue."
          />
        </label>
      </div>
    </article>
  );
}

function QuizDifficultyPicker({ value, onChange }) {
  const selected = getQuizDifficulty(value);

  return (
    <fieldset className="mt-4 rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
      <legend className="px-1 text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
        Question difficulty
      </legend>
      <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-[color:var(--color-text-muted)]">
          Controls which quiz challenge this question appears in.
        </p>
        <p className="text-xs font-bold text-[color:var(--color-text-muted)]">
          Current: <span className="text-[color:var(--color-text)]">{selected.label}</span>
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {QUIZ_DIFFICULTIES.map((option) => {
          const Icon = option.icon;
          const active = option.value === selected.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`min-h-[4.25rem] rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50 ${
                active
                  ? 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-[0_12px_30px_rgba(15,23,42,0.1)]'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface)]'
              }`}
              style={{ borderColor: active ? option.color : undefined }}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${option.color}22`, color: option.color }}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{option.label}</span>
                  <span className="block truncate text-[0.68rem] font-bold uppercase tracking-[0.1em]">{option.helper}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-center">
      <dt className="text-xs font-black uppercase tracking-[0.13em] text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-xl font-black text-[color:var(--color-text)]">{value}</dd>
    </div>
  );
}

function SaveProgressDonut({ progress = 0, active = false, size = 'md' }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  const degrees = Math.round((safeProgress / 100) * 360);
  const dimensions = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
  const innerDimensions = size === 'sm' ? 'inset-[4px]' : size === 'lg' ? 'inset-[10px]' : 'inset-[7px]';
  const textSize = size === 'lg' ? 'text-sm' : 'text-[0.62rem]';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${dimensions} ${active ? 'quiz-save-donut-active' : ''}`}
      style={{
        background: `conic-gradient(var(--color-accent) ${degrees}deg, rgba(148, 163, 184, 0.24) 0deg)`,
      }}
      role="img"
      aria-label={`Save progress ${safeProgress}%`}
      title={`Save progress ${safeProgress}%`}
    >
      <span className={`absolute rounded-full bg-[color:var(--color-surface)] ${innerDimensions}`} />
      {size === 'sm' ? null : (
        <span className={`relative font-black text-[color:var(--color-text)] ${textSize}`}>{safeProgress}</span>
      )}
    </span>
  );
}
