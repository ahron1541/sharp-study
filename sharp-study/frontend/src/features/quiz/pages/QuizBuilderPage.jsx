import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  FileQuestion,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../../config/api';
import Modal from '../../../shared/components/Modal';
import { sanitizePlainText } from '../../../shared/utils/sanitize';

const DRAFT_PREFIX = 'sharp-study-quiz-builder-draft';
const DEFAULT_CHOICES = ['Option A', 'Option B', 'Option C', 'Option D'];

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
  const autosaveTimerRef = useRef(null);

  const currentSnapshot = useMemo(() => snapshotOf(title, questions, autosaveRemote), [autosaveRemote, questions, title]);
  const dirty = loaded && currentSnapshot !== lastSavedSnapshot;
  const validQuestionCount = questions.filter((question) => cleanText(question.question)).length;

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
    if (saving || autosaving) return null;

    try {
      const payload = buildPayload(title, questions);
      if (silent) setAutosaving(true);
      else setSaving(true);

      const response = await apiRequest(quizId ? `/api/quizzes/${quizId}` : '/api/quizzes', {
        method: quizId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
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

      if (!silent) toast.success('Quiz saved.');
      return response;
    } catch (error) {
      toast.error(error.message || 'Failed to save quiz.');
      return null;
    } finally {
      setSaving(false);
      setAutosaving(false);
    }
  }

  async function saveAndPreview() {
    const response = await saveQuiz();
    const nextId = response?.quiz?.id || quizId;
    if (nextId) navigate(`/quiz/${nextId}`);
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
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="quiz-donut" aria-hidden="true" />
          <p className="text-sm font-black text-[color:var(--color-text-muted)]">Loading quiz builder...</p>
        </div>
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 pb-24 sm:px-6 lg:px-8">
        <section className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => guardedNavigate(() => navigate('/library?tab=quiz'))}
                className="mb-3 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)]"
              >
                <ArrowLeft size={16} />
                Library
              </button>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent)]">
                  <FileQuestion size={23} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">{quizId ? 'Edit quiz' : 'Create quiz'}</p>
                  <h1 className="truncate text-2xl font-black text-[color:var(--color-text)] sm:text-3xl">Quiz Builder</h1>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <button
                type="button"
                onClick={() => saveQuiz()}
                disabled={saving || autosaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 font-black text-[color:var(--color-text)] disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save
              </button>
              <button
                type="button"
                onClick={saveAndPreview}
                disabled={saving || autosaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-black text-[color:var(--color-accent-text)] disabled:opacity-60"
              >
                <Eye size={18} />
                Preview quiz
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
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[color:var(--color-text)]">Autosave to database</p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                    Local draft is always saved. Database autosave starts after the first manual save.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutosaveRemote((value) => !value)}
                  aria-pressed={autosaveRemote}
                  className={`relative h-8 w-14 rounded-full border transition ${autosaveRemote ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}`}
                  title="Toggle database autosave"
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${autosaveRemote ? 'left-7' : 'left-1'}`} />
                  <span className="sr-only">Toggle database autosave</span>
                </button>
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                {autosaving ? 'Autosaving...' : dirty ? 'Unsaved local changes' : 'Saved'}
              </p>
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
                <Settings2 className="text-[color:var(--color-accent)]" size={19} aria-hidden="true" />
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
            >
              <Plus size={18} />
              Add multiple choice
            </button>
            <button
              type="button"
              onClick={() => setQuestions((current) => [...current, createBlankQuestion('identification')])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 font-black text-[color:var(--color-text)]"
            >
              <Plus size={18} />
              Add identification
            </button>
          </aside>
        </section>
      </main>

      <Modal
        isOpen={leaveModal.open}
        onClose={() => setLeaveModal({ open: false, action: null })}
        title="Leave builder?"
        size="md"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <div className="flex gap-3 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-1 shrink-0 text-amber-500" size={20} aria-hidden="true" />
            <p>Your draft is saved in this browser, but unsaved database changes will not appear on other devices until you save.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardAndLeave}
              className="rounded-2xl border border-rose-500/40 px-5 py-3 font-bold text-rose-500"
            >
              Discard local draft
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
            <ChevronUp size={17} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded-xl border border-[color:var(--color-border)] p-2 text-[color:var(--color-text-muted)] disabled:opacity-40" aria-label="Move question down" title="Move question down">
            <ChevronDown size={17} />
          </button>
          <button type="button" onClick={onDelete} className="rounded-xl border border-rose-500/30 p-2 text-rose-500" aria-label="Delete question" title="Delete question">
            <Trash2 size={17} />
          </button>
        </div>
      </div>

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

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-center">
      <dt className="text-xs font-black uppercase tracking-[0.13em] text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-xl font-black text-[color:var(--color-text)]">{value}</dd>
    </div>
  );
}
