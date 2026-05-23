import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileQuestion,
  Flame,
  HelpCircle,
  History,
  Keyboard,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiRequest } from '../../../config/api';
import Breadcrumb from '../../../shared/components/Breadcrumb';
import Modal from '../../../shared/components/Modal';
import { sanitizePlainText } from '../../../shared/utils/sanitize';
import StudyNotice from '../../gamification/components/StudyNotice';

const SESSION_STORAGE_PREFIX = 'sharp-study-quiz-session';
const CONTENT_STORAGE_PREFIX = 'sharp-study-quiz-content';
const PENDING_STORAGE_KEY = 'sharp-study-quiz-pending-attempts';
const TUTORIAL_KEY = 'sharp-study-quiz-tutorial-seen';
const PAGE_SIZE = 5;
const DEFAULT_SETTINGS = {
  sessionType: 'practice',
  questionType: 'mixed',
  layout: 'single',
  itemCount: 10,
  timeMinutes: 15,
  difficulty: 'normal',
};
const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: 'Easy', timerMultiplier: 1.25, timerLabel: 'More time', description: 'More timer room for a calmer first pass.', color: '#22c55e', icon: Sparkles },
  { value: 'normal', label: 'Normal', timerMultiplier: 1, timerLabel: 'Standard', description: 'Balanced timer pressure for regular review.', color: '#8b3dff', icon: Target },
  { value: 'hard', label: 'Hard', timerMultiplier: 0.8, timerLabel: 'Faster', description: 'Less time, better for confident review.', color: '#f97316', icon: Flame },
  { value: 'expert', label: 'Expert', timerMultiplier: 0.6, timerLabel: 'Strict', description: 'Strict timer pressure for your strongest recall checks.', color: '#facc15', icon: Trophy },
];
const WRONG_FEEDBACK_MESSAGES = [
  'No problem. You are still learning.',
  'Good attempt. This is part of locking it in.',
  'Keep going. Missed items are useful review signals.',
  'You are building recall. Review this one once more.',
  'Not yet, but this is exactly how practice helps.',
];
const STREAK_MESSAGES = [
  'Three correct answers in a row starts a streak.',
  'Good rhythm. Stay steady and keep reading carefully.',
  'Nice streak. Keep the focus on accuracy.',
  'You are on a roll. Keep the pace calm.',
  'Strong run. One question at a time.',
];

function contentCacheKey(quizId) {
  return `${CONTENT_STORAGE_PREFIX}:${quizId}`;
}

function sessionCacheKey(quizId) {
  return `${SESSION_STORAGE_PREFIX}:${quizId}`;
}

function readContentCache(quizId) {
  try {
    const raw = localStorage.getItem(contentCacheKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.quiz?.id || !Array.isArray(parsed?.questions)) return null;
    return {
      quiz: {
        ...parsed.quiz,
        title: sanitizePlainText(parsed.quiz.title || ''),
      },
      questions: parsed.questions.map(normalizeClientQuestion).filter(Boolean),
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts.map(normalizeAttemptSummary) : [],
    };
  } catch {
    localStorage.removeItem(contentCacheKey(quizId));
    return null;
  }
}

function writeContentCache(quizId, payload) {
  try {
    localStorage.setItem(contentCacheKey(quizId), JSON.stringify({
      ...payload,
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[QuizCache] Failed to write quiz content cache.', error);
  }
}

function readSavedSession(quizId) {
  try {
    const raw = localStorage.getItem(sessionCacheKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.questionIds) || !parsed.questionIds.length) return null;
    return parsed;
  } catch {
    localStorage.removeItem(sessionCacheKey(quizId));
    return null;
  }
}

function writeSavedSession(quizId, payload) {
  try {
    localStorage.setItem(sessionCacheKey(quizId), JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[QuizSession] Failed to save local session.', error);
  }
}

function clearSavedSession(quizId) {
  try {
    localStorage.removeItem(sessionCacheKey(quizId));
  } catch {
    // Local cache cleanup is best effort only.
  }
}

function readPendingAttempts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(PENDING_STORAGE_KEY);
    return [];
  }
}

function writePendingAttempts(attempts) {
  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(attempts.slice(-20)));
  } catch (error) {
    console.warn('[QuizAttempts] Failed to write pending attempts.', error);
  }
}

function normalizeClientQuestion(question) {
  if (!question?.id) return null;
  const type = question.type === 'identification' ? 'identification' : 'multiple_choice';
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice) => sanitizePlainText(choice)).filter(Boolean).slice(0, 4)
    : [];

  return {
    id: question.id,
    question: sanitizePlainText(question.question || ''),
    type,
    choices,
    correct_index: Number.isInteger(question.correct_index) ? question.correct_index : 0,
    correct_answer: sanitizePlainText(question.correct_answer || choices[question.correct_index] || ''),
    accepted_answers: Array.isArray(question.accepted_answers)
      ? question.accepted_answers.map((answer) => sanitizePlainText(answer)).filter(Boolean).slice(0, 8)
      : [],
    explanation: sanitizePlainText(question.explanation || ''),
    wrong_explanations: Array.isArray(question.wrong_explanations)
      ? question.wrong_explanations.map((entry) => sanitizePlainText(entry)).slice(0, 4)
      : [],
    support_snippet: sanitizePlainText(question.support_snippet || ''),
    difficulty: getQuizDifficulty(question.difficulty).value,
  };
}

function normalizeAttemptSummary(attempt) {
  return {
    id: attempt?.id || `local-${Date.now()}`,
    created_at: attempt?.created_at || new Date().toISOString(),
    session_type: attempt?.session_type === 'practice' ? 'practice' : 'test',
    score: Number(attempt?.score || 0),
    total: Number(attempt?.total || 0),
    percent: Number(attempt?.percent || 0),
    duration_seconds: Number(attempt?.duration_seconds || 0),
    timed_out: Boolean(attempt?.timed_out),
    difficulty: getQuizDifficulty(attempt?.difficulty || attempt?.settings?.difficulty).value,
    pending: Boolean(attempt?.pending),
  };
}

function formatDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  if (minutes < 1) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatTimer(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getQuizDifficulty(value = 'normal') {
  return QUIZ_DIFFICULTIES.find((item) => item.value === value) || QUIZ_DIFFICULTIES[1];
}

function getQuizTimeLimitSeconds(settings = DEFAULT_SETTINGS) {
  const minutes = Math.max(1, Math.min(Number(settings.timeMinutes) || DEFAULT_SETTINGS.timeMinutes, 240));
  const difficulty = getQuizDifficulty(settings.difficulty);
  return Math.max(30, Math.round(minutes * 60 * difficulty.timerMultiplier));
}

function normalizeAnswer(value = '') {
  return sanitizePlainText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isClientCorrect(question, answer) {
  if (!question) return false;
  if (question.type === 'multiple_choice') {
    return Number(answer) === question.correct_index;
  }

  const normalized = normalizeAnswer(answer || '');
  if (!normalized) return false;
  const accepted = (question.accepted_answers?.length ? question.accepted_answers : [question.correct_answer])
    .map((entry) => normalizeAnswer(entry))
    .filter(Boolean);
  return accepted.some((entry) => normalized === entry);
}

function buildLocalAttempt({ quiz, questions, answers, settings, startedAt, timedOut }) {
  const checked = questions.map((question, index) => {
    const answer = answers[question.id];
    const selectedIndex = question.type === 'multiple_choice' && Number.isInteger(answer) ? answer : null;
    const answerText = question.type === 'identification' ? sanitizePlainText(String(answer || '')) : '';
    const isCorrect = isClientCorrect(question, answer);

    return {
      order: index + 1,
      question_id: question.id,
      question: question.question,
      type: question.type,
      choices: question.choices,
      selected_index: selectedIndex,
      answer_text: answerText,
      user_answer: question.type === 'multiple_choice' ? question.choices[selectedIndex] || '' : answerText,
      is_correct: isCorrect,
      correct_index: question.correct_index,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      wrong_explanation: selectedIndex === null ? '' : question.wrong_explanations?.[selectedIndex] || '',
      support_snippet: question.support_snippet,
    };
  });
  const score = checked.filter((answer) => answer.is_correct).length;
  const total = checked.length;

  return {
    id: `local-${Date.now()}`,
    created_at: new Date().toISOString(),
    quiz_id: quiz.id,
    quiz_title: quiz.title,
    session_type: settings.sessionType,
    difficulty: getQuizDifficulty(settings.difficulty).value,
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
    timed_out: timedOut,
    settings,
    answers: checked,
    pending: true,
  };
}

function shuffleQuestions(questions = []) {
  const copy = [...questions];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getResultMessage(percent, sessionType) {
  if (percent >= 90) return sessionType === 'practice' ? 'That was sharp. Keep this lesson warm with one quick retake later.' : 'Excellent work. Your recall is looking strong.';
  if (percent >= 75) return 'Nice progress. Review the missed items once and you are close to locking this in.';
  if (percent >= 50) return 'You have a working base. The review below points to the exact spots to strengthen next.';
  return 'This is still workable. Start with the missed items, then try a shorter practice round.';
}

function getWrongFeedbackMessage(questionId = '') {
  const seed = String(questionId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return WRONG_FEEDBACK_MESSAGES[seed % WRONG_FEEDBACK_MESSAGES.length];
}

function getStreakMessage(streak) {
  if (streak < 3) return STREAK_MESSAGES[0];
  return STREAK_MESSAGES[Math.min(STREAK_MESSAGES.length - 1, streak - 2)];
}

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cached = useMemo(() => readContentCache(id), [id]);

  const [quiz, setQuiz] = useState(() => cached?.quiz || null);
  const [questions, setQuestions] = useState(() => cached?.questions || []);
  const [attempts, setAttempts] = useState(() => cached?.attempts || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState('preview');
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(getQuizTimeLimitSeconds(DEFAULT_SETTINGS));
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [savedSession, setSavedSession] = useState(() => readSavedSession(id));
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem(TUTORIAL_KEY));
  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const [startCountdown, setStartCountdown] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [exitConfirm, setExitConfirm] = useState({ open: false, target: 'preview' });
  const [expandedExplanations, setExpandedExplanations] = useState({});

  const submitLockRef = useRef(false);
  const warningToastRef = useRef(false);

  const difficultyCounts = useMemo(() => (
    QUIZ_DIFFICULTIES.reduce((acc, option) => {
      acc[option.value] = questions.filter((question) => getQuizDifficulty(question.difficulty).value === option.value).length;
      return acc;
    }, {})
  ), [questions]);
  const questionsForDifficulty = useMemo(
    () => questions.filter((question) => getQuizDifficulty(question.difficulty).value === getQuizDifficulty(settings.difficulty).value),
    [questions, settings.difficulty]
  );
  const questionCounts = useMemo(() => ({
    all: questionsForDifficulty.length,
    multiple_choice: questionsForDifficulty.filter((question) => question.type === 'multiple_choice').length,
    identification: questionsForDifficulty.filter((question) => question.type === 'identification').length,
  }), [questionsForDifficulty]);

  const availableQuestions = useMemo(() => {
    if (settings.questionType === 'mixed') return questionsForDifficulty;
    return questionsForDifficulty.filter((question) => question.type === settings.questionType);
  }, [questionsForDifficulty, settings.questionType]);

  const maxItemCount = Math.max(1, availableQuestions.length || questions.length || 1);
  const answeredCount = useMemo(
    () => activeQuestions.filter((question) => {
      const answer = answers[question.id];
      return question.type === 'multiple_choice'
        ? Number.isInteger(answer)
        : Boolean(sanitizePlainText(String(answer || '')));
    }).length,
    [activeQuestions, answers]
  );
  const totalPages = Math.max(1, Math.ceil(activeQuestions.length / PAGE_SIZE));
  const visibleQuestions = settings.layout === 'page'
    ? activeQuestions.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
    : activeQuestions.slice(currentPage, currentPage + 1);
  const progressPercent = activeQuestions.length ? Math.round((answeredCount / activeQuestions.length) * 100) : 0;
  const sessionLimitSeconds = useMemo(() => getQuizTimeLimitSeconds(settings), [settings]);
  const urgentTime = timeLeft <= Math.max(60, Math.round(sessionLimitSeconds * 0.1));

  const loadQuiz = useCallback(async () => {
    setError('');
    if (!cached) setLoading(true);

    try {
      const response = await apiRequest(`/api/quizzes/${id}`);
      const nextQuiz = {
        ...response.quiz,
        title: sanitizePlainText(response.quiz?.title || 'Quiz'),
      };
      const nextQuestions = (response.questions || []).map(normalizeClientQuestion).filter(Boolean);
      const nextAttempts = (response.attempts || []).map(normalizeAttemptSummary);

      setQuiz(nextQuiz);
      setQuestions(nextQuestions);
      setAttempts(nextAttempts);
      setSettings((current) => ({
        ...current,
        itemCount: Math.min(Math.max(1, current.itemCount), Math.max(1, nextQuestions.length || 1)),
        difficulty: getQuizDifficulty(nextQuiz.difficulty || nextQuestions[0]?.difficulty || current.difficulty).value,
      }));
      writeContentCache(id, {
        quiz: nextQuiz,
        questions: nextQuestions,
        attempts: nextAttempts,
      });
      setSavedSession(readSavedSession(id));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load this quiz.');
      if (!cached) {
        setQuiz(null);
        setQuestions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [cached, id]);

  const syncPendingAttempts = useCallback(async () => {
    const pending = readPendingAttempts().filter((entry) => entry.quizId === id);
    if (!pending.length) return;

    const remaining = readPendingAttempts().filter((entry) => entry.quizId !== id);
    const syncedSummaries = [];

    for (const entry of pending) {
      try {
        const response = await apiRequest(`/api/quizzes/${id}/attempts`, {
          method: 'POST',
          body: JSON.stringify(entry.payload),
        });
        if (response?.attempt) {
          syncedSummaries.push(normalizeAttemptSummary(response.attempt));
        }
      } catch {
        remaining.push(entry);
      }
    }

    writePendingAttempts(remaining);
    if (syncedSummaries.length) {
      setAttempts((current) => [...syncedSummaries, ...current].slice(0, 20));
      toast.success('Saved a pending quiz attempt to your history.');
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadQuiz();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuiz]);

  useEffect(() => {
    if (quiz?.id) {
      const timer = window.setTimeout(() => {
        syncPendingAttempts();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [quiz?.id, syncPendingAttempts]);

  useEffect(() => {
    if (phase !== 'taking' || !activeQuestions.length) return;

    writeSavedSession(id, {
      settings,
      questionIds: activeQuestions.map((question) => question.id),
      answers,
      feedback,
      expandedExplanations,
      currentPage,
      startedAt,
      timeLeft,
      streak,
      bestStreak,
    });
  }, [activeQuestions, answers, bestStreak, currentPage, expandedExplanations, feedback, id, phase, settings, startedAt, streak, timeLeft]);

  useEffect(() => {
    if (phase !== 'taking') return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'taking') return undefined;

    window.history.pushState({ sharpStudyQuizGuard: true }, '', window.location.href);
    const handlePopState = () => {
      setExitConfirm({ open: true, target: 'library' });
      window.history.pushState({ sharpStudyQuizGuard: true }, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [phase]);

  const submitAttempt = useCallback(async (timedOut = false) => {
    if (!quiz || !activeQuestions.length || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);

    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const payload = {
      session_type: settings.sessionType,
      difficulty: getQuizDifficulty(settings.difficulty).value,
      question_ids: activeQuestions.map((question) => question.id),
      answers: activeQuestions.map((question) => {
        const answer = answers[question.id];
        return {
          question_id: question.id,
          selected_index: question.type === 'multiple_choice' && Number.isInteger(answer) ? answer : null,
          answer_text: question.type === 'identification' ? sanitizePlainText(String(answer || '')) : '',
        };
      }),
      duration_seconds: durationSeconds,
      timed_out: Boolean(timedOut),
      settings: {
        question_type: settings.questionType,
        layout: settings.layout,
        item_count: activeQuestions.length,
        time_minutes: settings.timeMinutes,
        difficulty: getQuizDifficulty(settings.difficulty).value,
      },
    };

    try {
      const response = await apiRequest(`/api/quizzes/${id}/attempts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextAttempt = response.attempt;
      setResult(nextAttempt);
      setAttempts((current) => [normalizeAttemptSummary(nextAttempt), ...current].slice(0, 20));
      clearSavedSession(id);
      setSavedSession(null);
      setPhase('results');
      if (timedOut) toast('Time is up. Your quiz was submitted.');
    } catch (submitError) {
      const localAttempt = buildLocalAttempt({
        quiz,
        questions: activeQuestions,
        answers,
        settings,
        startedAt,
        timedOut: Boolean(timedOut),
      });
      setResult(localAttempt);
      setAttempts((current) => [normalizeAttemptSummary(localAttempt), ...current].slice(0, 20));
      writePendingAttempts([...readPendingAttempts(), {
        id: localAttempt.id,
        quizId: id,
        payload,
        createdAt: new Date().toISOString(),
      }]);
      clearSavedSession(id);
      setSavedSession(null);
      setPhase('results');
      toast.error(submitError.message || 'Your attempt is saved locally and will sync later.');
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }, [activeQuestions, answers, id, quiz, settings, startedAt]);

  useEffect(() => {
    if (phase !== 'taking' || submitting || timeLeft === null) return undefined;

    if (timeLeft <= 0) {
      const timer = window.setTimeout(() => {
        submitAttempt(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (urgentTime && !warningToastRef.current) {
      warningToastRef.current = true;
      toast('Time is almost up. Answer what you can and submit when ready.');
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, submitting, submitAttempt, timeLeft, urgentTime]);

  const updateSetting = (key, value) => {
    setSettings((current) => {
      if (key === 'itemCount') {
        return { ...current, itemCount: Math.max(1, Math.min(Number(value) || 1, maxItemCount)) };
      }
      if (key === 'timeMinutes') {
        return { ...current, timeMinutes: Math.max(1, Math.min(Number(value) || 1, 240)) };
      }
      if (key === 'questionType') {
        const currentDifficulty = getQuizDifficulty(current.difficulty).value;
        const difficultyPool = questions.filter((question) => getQuizDifficulty(question.difficulty).value === currentDifficulty);
        const nextAvailable = value === 'mixed'
          ? difficultyPool.length
          : difficultyPool.filter((question) => question.type === value).length;
        return {
          ...current,
          questionType: value,
          itemCount: Math.min(current.itemCount, Math.max(1, nextAvailable || 1)),
        };
      }
      if (key === 'difficulty') {
        const nextDifficulty = getQuizDifficulty(value).value;
        const difficultyPool = questions.filter((question) => getQuizDifficulty(question.difficulty).value === nextDifficulty);
        const nextAvailable = current.questionType === 'mixed'
          ? difficultyPool.length
          : difficultyPool.filter((question) => question.type === current.questionType).length;
        return {
          ...current,
          difficulty: nextDifficulty,
          itemCount: Math.min(current.itemCount, Math.max(1, nextAvailable || 1)),
        };
      }
      return { ...current, [key]: value };
    });
  };

  const startSession = useCallback((questionIds = null, overrideSettings = null) => {
    const effectiveSettings = overrideSettings || settings;
    const pool = questionIds
      ? questionIds.map((questionId) => questions.find((question) => question.id === questionId)).filter(Boolean)
      : availableQuestions;

    if (!pool.length) {
      toast.error('No questions match that setup yet.');
      return;
    }

    const selected = shuffleQuestions(pool).slice(0, Math.min(effectiveSettings.itemCount, pool.length));
    const startTime = Date.now();

    if (overrideSettings) {
      setSettings(overrideSettings);
    }
    setActiveQuestions(selected);
    setAnswers({});
    setFeedback({});
    setExpandedExplanations({});
    setCurrentPage(0);
    setStartedAt(startTime);
    setTimeLeft(getQuizTimeLimitSeconds(effectiveSettings));
    setResult(null);
    setStreak(0);
    setBestStreak(0);
    warningToastRef.current = false;
    setPhase('taking');
    clearSavedSession(id);
    setSavedSession(null);
  }, [availableQuestions, id, questions, settings]);

  useEffect(() => {
    if (startCountdown === null) return undefined;

    if (startCountdown <= 0) {
      const timer = window.setTimeout(() => {
        setStartPromptOpen(false);
        setStartCountdown(null);
        startSession();
      }, 280);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setStartCountdown((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [startCountdown, startSession]);

  const requestStartSession = () => {
    setShowTutorial(false);
    setStartCountdown(null);
    setStartPromptOpen(true);
  };

  const closeStartPrompt = () => {
    if (startCountdown !== null) return;
    setStartPromptOpen(false);
  };

  const beginStartCountdown = () => {
    setStartCountdown(3);
  };

  const resumeSession = () => {
    if (!savedSession) return;
    const byId = new Map(questions.map((question) => [question.id, question]));
    const selected = savedSession.questionIds.map((questionId) => byId.get(questionId)).filter(Boolean);
    if (!selected.length) {
      clearSavedSession(id);
      setSavedSession(null);
      toast.error('That saved quiz session could not be restored.');
      return;
    }

    setSettings({ ...DEFAULT_SETTINGS, ...savedSession.settings });
    setActiveQuestions(selected);
    setAnswers(savedSession.answers || {});
    setFeedback(savedSession.feedback || {});
    setExpandedExplanations(savedSession.expandedExplanations || {});
    setCurrentPage(Number(savedSession.currentPage || 0));
    setStartedAt(Number(savedSession.startedAt || Date.now()));
    setTimeLeft(Number(savedSession.timeLeft || getQuizTimeLimitSeconds({ ...DEFAULT_SETTINGS, ...savedSession.settings })));
    setStreak(Number(savedSession.streak || 0));
    setBestStreak(Number(savedSession.bestStreak || 0));
    setPhase('taking');
  };

  const setAnswer = (question, answer) => {
    if (feedback[question.id] && settings.sessionType === 'practice') return;

    setAnswers((current) => ({ ...current, [question.id]: answer }));
    if (settings.sessionType === 'practice' && question.type === 'multiple_choice') {
      revealFeedback(question, answer);
    }
  };

  const revealFeedback = (question, rawAnswer = answers[question.id]) => {
    if (!question) return;
    const isCorrect = isClientCorrect(question, rawAnswer);

    setFeedback((current) => ({
      ...current,
      [question.id]: {
        isCorrect,
        selectedIndex: question.type === 'multiple_choice' && Number.isInteger(rawAnswer) ? rawAnswer : null,
        message: isCorrect ? 'Brilliant work.' : getWrongFeedbackMessage(question.id),
      },
    }));

    setExpandedExplanations((current) => ({ ...current, [question.id]: false }));

    setStreak((current) => {
      const next = isCorrect ? current + 1 : 0;
      setBestStreak((best) => Math.max(best, next));
      return next;
    });
  };

  const nextPage = () => {
    setCurrentPage((current) => Math.min(current + 1, settings.layout === 'page' ? totalPages - 1 : activeQuestions.length - 1));
  };

  const previousPage = () => {
    setCurrentPage((current) => Math.max(0, current - 1));
  };

  const requestSubmit = () => {
    setShowSubmitConfirm(true);
  };

  const requestExit = (target = 'preview') => {
    if (phase === 'taking') {
      setExitConfirm({ open: true, target });
      return;
    }
    if (target === 'library') {
      navigate('/library?tab=quiz');
    } else {
      setPhase('preview');
    }
  };

  const discardAndExit = () => {
    clearSavedSession(id);
    setSavedSession(null);
    setExitConfirm({ open: false, target: 'preview' });
    setPhase('preview');
    if (exitConfirm.target === 'library') {
      navigate('/library?tab=quiz');
    }
  };

  const toggleExplanation = (questionId) => {
    setExpandedExplanations((current) => ({ ...current, [questionId]: !current[questionId] }));
  };

  const retakeMissed = () => {
    const missedIds = (result?.answers || [])
      .filter((answer) => !answer.is_correct)
      .map((answer) => answer.question_id);

    if (!missedIds.length) {
      toast.success('No missed questions in this attempt. A fresh round is ready instead.');
      startSession();
      return;
    }

    const nextSettings = {
      ...settings,
      sessionType: 'practice',
      itemCount: missedIds.length,
    };
    setSettings(nextSettings);
    startSession(missedIds, nextSettings);
  };

  if (loading) {
    return <QuizSkeleton />;
  }

  if (error && !quiz) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <button onClick={() => navigate('/library?tab=quiz')} className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)]">
          <ArrowLeft size={16} />
          Library
        </button>
        <section className="mt-5 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <h1 className="text-2xl font-black text-[color:var(--color-text)]">Quiz not found</h1>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">{error}</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'Library', href: '/library?tab=quiz' }, { label: quiz?.title || 'Quiz' }]} />

        {phase === 'preview' ? (
          <PreviewScreen
            quiz={quiz}
            questions={questionsForDifficulty}
            attempts={attempts}
            settings={settings}
            questionCounts={questionCounts}
            difficultyCounts={difficultyCounts}
            availableCount={availableQuestions.length}
            maxItemCount={maxItemCount}
            savedSession={savedSession}
            onBack={() => navigate('/library?tab=quiz')}
            onEdit={() => navigate(`/quiz/${quiz.id}/edit`)}
            onUpdateSetting={updateSetting}
            onStart={requestStartSession}
            onResume={resumeSession}
          />
        ) : null}

        {phase === 'taking' ? (
          <TakingScreen
            quiz={quiz}
            settings={settings}
            questions={activeQuestions}
            visibleQuestions={visibleQuestions}
            answers={answers}
            feedback={feedback}
            currentPage={currentPage}
            totalPages={totalPages}
            answeredCount={answeredCount}
            progressPercent={progressPercent}
            timeLeft={timeLeft}
            urgentTime={urgentTime}
            streak={streak}
            bestStreak={bestStreak}
            expandedExplanations={expandedExplanations}
            submitting={submitting}
            onExit={() => requestExit('preview')}
            onAnswer={setAnswer}
            onRevealFeedback={revealFeedback}
            onToggleExplanation={toggleExplanation}
            onPrevious={previousPage}
            onNext={nextPage}
            onSubmit={requestSubmit}
          />
        ) : null}

        {phase === 'results' && result ? (
          <ResultsScreen
            quiz={quiz}
            result={result}
            attempts={attempts}
            onBackToPreview={() => setPhase('preview')}
            onRetake={() => startSession()}
            onRetakeMissed={retakeMissed}
            onLibrary={() => navigate('/library?tab=quiz')}
          />
        ) : null}
      </main>

      <Modal
        isOpen={showTutorial && phase === 'preview'}
        onClose={() => setShowTutorial(false)}
        title="Quiz tutorial"
        size="lg"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <p>Choose practice for instant feedback and explanations, or test for a stricter flow where results appear at the end.</p>
          <p>Your answers are cached locally while you take the quiz. Final scoring is checked by the server before it goes into your history.</p>
          <p>AI-generated questions can still be imperfect, so review explanations and report issues to yourself by retaking missed items.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowTutorial(false)}
              className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)]"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(TUTORIAL_KEY, '1');
                setShowTutorial(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]"
            >
              <Sparkles size={18} />
              Got it
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={startPromptOpen && phase === 'preview'}
        onClose={closeStartPrompt}
        title={startCountdown === null ? 'Ready to start?' : 'Starting quiz'}
        size="lg"
        closeOnBackdrop={startCountdown === null}
        closeOnEscape={startCountdown === null}
        showCloseButton={startCountdown === null}
      >
        <StartQuizModalContent
          countdown={startCountdown}
          settings={settings}
          itemCount={Math.min(settings.itemCount, availableQuestions.length)}
          availableCount={availableQuestions.length}
          onCancel={closeStartPrompt}
          onBegin={beginStartCountdown}
        />
      </Modal>

      <Modal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Submit quiz?"
        size="md"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <div className="flex gap-3 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-1 shrink-0 text-amber-500" size={20} aria-hidden="true" />
            <p>
              You answered <strong className="text-[color:var(--color-text)]">{answeredCount}</strong> of <strong className="text-[color:var(--color-text)]">{activeQuestions.length}</strong> questions.
              Once submitted, this attempt will be scored and added to your history.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowSubmitConfirm(false)}
              className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)]"
            >
              Keep answering
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSubmitConfirm(false);
                submitAttempt(false);
              }}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Submit now
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={exitConfirm.open}
        onClose={() => setExitConfirm({ open: false, target: 'preview' })}
        title="Leave this quiz?"
        size="md"
      >
        <div className="space-y-4 text-sm leading-7 text-[color:var(--color-text-muted)]">
          <p>Your progress is saved in this browser, but discarding will clear the current attempt and return you to the quiz preview.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardAndExit}
              className="rounded-2xl border border-rose-500/40 px-5 py-3 font-bold text-rose-500"
            >
              Discard progress
            </button>
            <button
              type="button"
              onClick={() => setExitConfirm({ open: false, target: 'preview' })}
              className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-bold text-[color:var(--color-accent-text)]"
            >
              Stay on page
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function StartQuizModalContent({ countdown, settings, itemCount, availableCount, onCancel, onBegin }) {
  const countingDown = countdown !== null;
  const countdownLabel = countdown === 0 ? 'Go' : countdown;
  const modeLabel = settings.sessionType === 'practice' ? 'Practice' : 'Test';
  const difficulty = getQuizDifficulty(settings.difficulty);
  const timeLimit = getQuizTimeLimitSeconds(settings);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center sm:mx-0">
            <div className={`absolute inset-0 rounded-full border border-[color:var(--color-accent)]/25 ${countingDown ? 'quiz-countdown-ring' : ''}`} />
            <div className="absolute inset-2 rounded-full bg-[color:var(--color-accent)]/10" />
            <div
              key={countdownLabel || 'ready'}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] shadow-[0_18px_42px_color-mix(in_srgb,var(--color-accent)_24%,transparent)] ${countingDown ? 'quiz-countdown-pop' : ''}`}
              aria-live="polite"
            >
              {countingDown ? (
                <span className="text-3xl font-black">{countdownLabel}</span>
              ) : (
                <Clock size={34} aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
              {countingDown ? 'Timer starts after countdown' : 'Before you begin'}
            </p>
            <h3 className="mt-2 text-2xl font-black leading-tight text-[color:var(--color-text)]">
              {countingDown ? 'Get ready.' : 'The quiz timer starts immediately.'}
            </h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
              {countingDown
                ? 'Focus on the first question. Your countdown is preparing the session now.'
                : 'Once you continue, a short countdown appears, then the timed quiz begins right away.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StartSummary label="Mode" value={modeLabel} />
        <StartSummary label="Difficulty" value={difficulty.label} />
        <StartSummary label="Items" value={`${Math.max(0, itemCount)}/${availableCount}`} />
        <StartSummary label="Timer" value={formatTimer(timeLimit)} />
      </div>

      {!countingDown ? (
        <div className="rounded-[1.25rem] border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-amber-500" size={20} aria-hidden="true" />
            <p className="text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">
              Make sure you are ready before starting. Difficulty changes timer pressure, and the timer will not pause once the quiz begins.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {!countingDown ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)]"
          >
            Not yet
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBegin}
          disabled={countingDown}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-90"
        >
          <Sparkles size={18} aria-hidden="true" />
          {countingDown ? 'Starting...' : 'Start countdown'}
        </button>
      </div>
    </div>
  );
}

function StartSummary({ label, value }) {
  return (
    <div className="flex min-h-[5.25rem] flex-col justify-center rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-center">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-black leading-tight text-[color:var(--color-text)]">{value}</p>
    </div>
  );
}

function QuizDifficultyChooser({ value, onChange, compact = false, counts = {} }) {
  return (
    <fieldset className={`rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] ${compact ? 'p-3' : 'p-3 sm:p-4'}`}>
      <legend className="px-1 text-sm font-black text-[color:var(--color-text)]">Difficulty</legend>
      <div className={`mt-3 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {QUIZ_DIFFICULTIES.map((option) => {
          const Icon = option.icon;
          const active = option.value === value;
          const count = Number(counts[option.value] || 0);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`min-h-[4.25rem] rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[color:var(--color-accent)]/50 ${
                active
                  ? 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-[0_12px_32px_rgba(15,23,42,0.12)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70 text-[color:var(--color-text-muted)]'
              }`}
              style={{ borderColor: active ? option.color : undefined }}
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${option.color}22`, color: option.color }}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="block text-xs font-bold">{count ? `${count} ready` : option.timerLabel}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PreviewScreen({
  quiz,
  questions,
  attempts,
  settings,
  questionCounts,
  difficultyCounts,
  availableCount,
  maxItemCount,
  savedSession,
  onBack,
  onEdit,
  onUpdateSetting,
  onStart,
  onResume,
}) {
  const sampleQuestions = questions.slice(0, 3);
  const difficulty = getQuizDifficulty(settings.difficulty);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[0_20px_65px_rgba(15,23,42,0.1)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)]">
                <ArrowLeft size={16} />
                Library
              </button>
              <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)]">
                <Edit3 size={16} />
                Edit quiz
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                <FileQuestion size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">Quiz preview</p>
                <h1 className="mt-1 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">{quiz?.title}</h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--color-text-muted)]">
              Set the quiz shape first, read the rules, then start when you are ready. The score log below keeps your retakes visible.
            </p>
          </div>

          <div className="flex shrink-0 items-start justify-end gap-3">
            <StudyNotice
              className="mt-1"
              eyebrow="Difficulty notice"
              ariaLabel="Show quiz difficulty notice"
              buttonTitle="Show quiz difficulty notice"
              title="Difficulty changes timer pressure."
            >
              Easy gives more time. Normal is balanced. Hard and Expert shorten the timer for stricter challenge runs.
            </StudyNotice>
            <div className="grid min-w-[min(100%,22rem)] grid-cols-3 gap-2 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
              <Stat label="Pool" value={questionCounts.all} tone="accent" />
              <Stat label="MCQ" value={questionCounts.multiple_choice} tone="success" />
              <Stat label="ID" value={questionCounts.identification} tone="warning" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,28rem)]">
        <div className="space-y-5">
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="text-[color:var(--color-accent)]" size={20} />
                <h2 className="text-2xl font-black text-[color:var(--color-text)]">Setup</h2>
              </div>
              <StudyNotice
                eyebrow="Quiz rules"
                ariaLabel="Show quiz rules"
                buttonTitle="Show quiz rules"
                title="Know the quiz flow before starting."
              >
                Answer before the timer reaches zero. Practice mode checks answers immediately, test mode hides feedback until results, and your attempt syncs to score history after submission.
              </StudyNotice>
            </div>

            <div className="mt-4 space-y-3">
              <QuizDifficultyChooser
                value={settings.difficulty}
                counts={difficultyCounts}
                onChange={(value) => onUpdateSetting('difficulty', value)}
              />

              <div className="grid items-start gap-3 md:grid-cols-2">
                <SegmentedSetting
                  label="Quiz mode"
                  value={settings.sessionType}
                  options={[
                    { value: 'practice', label: 'Practice', icon: <Sparkles size={16} /> },
                    { value: 'test', label: 'Test', icon: <ShieldCheck size={16} /> },
                  ]}
                  onChange={(value) => onUpdateSetting('sessionType', value)}
                />
                <SegmentedSetting
                  label="Question layout"
                  value={settings.layout}
                  options={[
                    { value: 'single', label: 'One at a time', icon: <FileQuestion size={16} /> },
                    { value: 'page', label: 'Five per page', icon: <BookOpen size={16} /> },
                  ]}
                  onChange={(value) => onUpdateSetting('layout', value)}
                />
                <label className="block rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 sm:p-4">
                  <span className="text-sm font-black text-[color:var(--color-text)]">Question type</span>
                  <select
                    value={settings.questionType}
                    onChange={(event) => onUpdateSetting('questionType', event.target.value)}
                    className="mt-3 h-11 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                  >
                    <option value="mixed">Mixed ({questionCounts.all})</option>
                    <option value="multiple_choice">Multiple choice ({questionCounts.multiple_choice})</option>
                    <option value="identification">Identification ({questionCounts.identification})</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
                  <label className="block rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 sm:p-4">
                    <span className="text-sm font-black text-[color:var(--color-text)]">Items</span>
                    <input
                      type="number"
                      min="1"
                      max={maxItemCount}
                      value={settings.itemCount}
                      onChange={(event) => onUpdateSetting('itemCount', event.target.value)}
                      className="mt-3 h-11 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                    />
                    <span className="mt-2 block text-xs font-semibold text-[color:var(--color-text-muted)]">{availableCount} available</span>
                  </label>
                  <label className="block rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 sm:p-4">
                    <span className="text-sm font-black text-[color:var(--color-text)]">Minutes</span>
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={settings.timeMinutes}
                      onChange={(event) => onUpdateSetting('timeMinutes', event.target.value)}
                      className="mt-3 h-11 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                    />
                    <span className="mt-2 block text-xs font-semibold text-[color:var(--color-text-muted)]">Auto-submit at 0:00</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h2 className="text-2xl font-black text-[color:var(--color-text)]">Example questions</h2>
            <div className="mt-4 space-y-3">
              {sampleQuestions.map((question, index) => (
                <article key={question.id} className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">Question {index + 1} · {question.type === 'identification' ? 'Identification' : 'Multiple choice'}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--color-text)]">{question.question}</p>
                </article>
              ))}
              {!sampleQuestions.length ? (
                <div className="rounded-[1.25rem] border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-text-muted)]">
                  No questions exist in this quiz yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center gap-2">
              <Trophy className="text-amber-500" size={22} />
              <h2 className="text-xl font-black text-[color:var(--color-text)]">Ready check</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--color-text-muted)]">
              {difficulty.label} mode starts with a {formatTimer(getQuizTimeLimitSeconds(settings))} timer. Take a breath, scan the rules, then go.
            </p>
            <div className="mt-5 space-y-3">
              {savedSession ? (
                <button type="button" onClick={onResume} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-5 py-4 font-black text-[color:var(--color-text)]">
                  <TimerReset size={20} />
                  Resume saved session
                </button>
              ) : null}
              <button type="button" onClick={onStart} disabled={!questions.length || !availableCount} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-4 font-black text-[color:var(--color-accent-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                <Sparkles size={20} />
                Start quiz
              </button>
            </div>
          </section>

          <AttemptLog attempts={attempts} />
        </aside>
      </section>
    </div>
  );
}

function TakingScreen({
  quiz,
  settings,
  questions,
  visibleQuestions,
  answers,
  feedback,
  currentPage,
  totalPages,
  answeredCount,
  progressPercent,
  timeLeft,
  urgentTime,
  streak,
  bestStreak,
  expandedExplanations,
  submitting,
  onExit,
  onAnswer,
  onRevealFeedback,
  onToggleExplanation,
  onPrevious,
  onNext,
  onSubmit,
}) {
  const isLastPage = settings.layout === 'page'
    ? currentPage >= totalPages - 1
    : currentPage >= questions.length - 1;
  const pageLabel = settings.layout === 'page'
    ? `Page ${currentPage + 1} of ${totalPages}`
    : `Question ${currentPage + 1} of ${questions.length}`;
  const difficulty = getQuizDifficulty(settings.difficulty);

  return (
    <div className="space-y-4">
      <section className="sticky top-0 z-20 -mx-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/94 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{settings.sessionType === 'practice' ? 'Practice quiz' : 'Test mode'} · {difficulty.label}</p>
              <h1 className="truncate text-lg font-black text-[color:var(--color-text)] sm:text-xl">{quiz?.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black ${urgentTime ? 'border-rose-500/40 bg-rose-500/10 text-rose-500' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]'}`} aria-live="polite">
                <Clock size={17} />
                {formatTimer(timeLeft)}
              </div>
              <button type="button" onClick={onExit} disabled={submitting} className="rounded-2xl border border-[color:var(--color-border)] px-3 py-2 text-sm font-bold text-[color:var(--color-text-muted)] disabled:opacity-50">
                Exit
              </button>
              <button type="button" onClick={onSubmit} disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-3 py-2 text-sm font-black text-[color:var(--color-accent-text)] disabled:opacity-50">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                Submit
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
              <span>{pageLabel}</span>
              <span>{answeredCount}/{questions.length} answered</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-2)]" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {settings.sessionType === 'practice' ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StreakBadge streak={streak} bestStreak={bestStreak} />
              <span className="text-[color:var(--color-text-muted)]">{getStreakMessage(streak)}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={settings.layout === 'page' ? 'space-y-4' : 'mx-auto max-w-4xl'}>
        {visibleQuestions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={settings.layout === 'page' ? currentPage * PAGE_SIZE + index : currentPage}
            answer={answers[question.id]}
            feedback={feedback[question.id]}
            explanationOpen={Boolean(expandedExplanations[question.id])}
            practice={settings.sessionType === 'practice'}
            onAnswer={(answer) => onAnswer(question, answer)}
            onReveal={() => onRevealFeedback(question)}
            onToggleExplanation={() => onToggleExplanation(question.id)}
          />
        ))}
      </section>

      <nav className="flex flex-col gap-3 rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onPrevious} disabled={currentPage === 0 || submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-2.5 font-bold text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50">
          <ChevronLeft size={18} />
          Previous
        </button>
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-[color:var(--color-text-muted)]">
          <Keyboard size={16} />
          Progress saves in this browser while you answer.
        </div>
        {isLastPage ? (
          <button type="button" onClick={onSubmit} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-black text-[color:var(--color-accent-text)] disabled:opacity-50">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
            Finish
          </button>
        ) : (
          <button type="button" onClick={onNext} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-black text-[color:var(--color-accent-text)] disabled:opacity-50">
            Next
            <ChevronRight size={18} />
          </button>
        )}
      </nav>
    </div>
  );
}

function QuestionCard({ question, index, answer, feedback, explanationOpen, practice, onAnswer, onReveal, onToggleExplanation }) {
  const locked = practice && Boolean(feedback);

  return (
    <article className="quiz-fade-up rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-[0_12px_38px_rgba(15,23,42,0.08)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black text-[color:var(--color-text-muted)] sm:text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:var(--color-surface-2)] text-[color:var(--color-text)]">{index + 1}</span>
          <span>{question.type === 'identification' ? 'Identification' : 'Multiple choice'}</span>
        </div>
        {feedback ? (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black sm:text-sm ${feedback.isCorrect ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {feedback.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {feedback.isCorrect ? 'Correct' : 'Review this'}
          </span>
        ) : null}
      </div>

      <h2 className="mt-4 text-lg font-black leading-snug text-[color:var(--color-text)] sm:text-xl">{question.question}</h2>

      {question.type === 'multiple_choice' ? (
        <fieldset className="mt-4">
          <legend className="sr-only">Choose one answer</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {question.choices.map((choice, choiceIndex) => {
              const selected = answer === choiceIndex;
              const isCorrectChoice = feedback && question.correct_index === choiceIndex;
              const isWrongChoice = feedback && selected && !feedback.isCorrect;

              return (
                <button
                  key={`${question.id}-${choice}`}
                  type="button"
                  onClick={() => onAnswer(choiceIndex)}
                  disabled={locked}
                  aria-pressed={selected}
                  className={`min-h-12 rounded-[1rem] border px-3 py-2.5 text-left transition-all duration-200 disabled:cursor-default ${
                    isCorrectChoice
                      ? 'border-emerald-500 bg-emerald-500/10 text-[color:var(--color-text)]'
                      : isWrongChoice
                        ? 'border-rose-500 bg-rose-500/10 text-[color:var(--color-text)]'
                        : selected
                          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-text)]'
                          : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]'
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-black">{choiceIndex + 1}</span>
                    <span className="text-sm font-bold leading-6 sm:text-base">{choice}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="mt-4">
          <label className="block">
            <span className="sr-only">Type your answer</span>
            <input
              value={typeof answer === 'string' ? answer : ''}
              onChange={(event) => onAnswer(event.target.value)}
              disabled={locked}
              placeholder="Type your answer"
              className="h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 font-bold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] disabled:opacity-70"
            />
          </label>
          {practice && !feedback ? (
            <button type="button" onClick={onReveal} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-4 py-2.5 font-black text-[color:var(--color-accent-text)]">
              <Check size={18} />
              Check answer
            </button>
          ) : null}
        </div>
      )}

      {feedback ? (
        <FeedbackPanel
          question={question}
          selectedIndex={feedback.selectedIndex}
          isCorrect={feedback.isCorrect}
          message={feedback.message}
          expanded={explanationOpen}
          onToggle={onToggleExplanation}
        />
      ) : null}
    </article>
  );
}

function FeedbackPanel({ question, selectedIndex, isCorrect, message, expanded, onToggle }) {
  const pickedWrong = selectedIndex !== null && selectedIndex !== undefined && selectedIndex !== question.correct_index;
  const wrongExplanation = pickedWrong ? question.wrong_explanations?.[selectedIndex] : '';

  return (
    <div className={`mt-4 rounded-[1.25rem] border p-3 ${isCorrect ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
      <p className={`font-black ${isCorrect ? 'text-emerald-500' : 'text-amber-500'}`}>
        {isCorrect ? 'Brilliant work.' : message || 'No problem. You are still learning.'}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">
        <strong className="text-[color:var(--color-text)]">Correct answer:</strong> {question.correct_answer}
      </p>

      {!isCorrect ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="quiz-attention-glow inline-flex items-center gap-2 rounded-2xl border border-amber-400/70 bg-amber-400/15 px-4 py-2 text-sm font-black text-amber-500"
          >
            <HelpCircle size={17} />
            {expanded ? 'Hide explanation' : 'View explanation'}
          </button>
        </div>
      ) : null}

      {!isCorrect && expanded ? (
        <div className="mt-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <p className="text-sm leading-7 text-[color:var(--color-text-muted)]">{question.explanation}</p>
          {wrongExplanation ? (
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">{wrongExplanation}</p>
          ) : null}
          {question.support_snippet ? (
            <p className="mt-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-xs font-semibold leading-6 text-[color:var(--color-text-muted)]">
              Lesson support: {question.support_snippet}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultsScreen({ quiz, result, attempts, onBackToPreview, onRetake, onRetakeMissed, onLibrary }) {
  const percent = Number(result.percent || 0);
  const missed = (result.answers || []).filter((answer) => !answer.is_correct).length;
  const difficulty = getQuizDifficulty(result.difficulty || result.settings?.difficulty);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[0_20px_65px_rgba(15,23,42,0.1)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">Results</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-[color:var(--color-text)] sm:text-4xl">{getResultMessage(percent, result.session_type)}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--color-text-muted)]">
              {quiz?.title} · {difficulty.label} difficulty · {result.pending ? 'This attempt is saved locally and will sync when the server is reachable.' : 'This attempt is saved in your score history.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
            <Stat label="Score" value={`${percent}%`} tone={percent >= 75 ? 'success' : percent >= 50 ? 'warning' : 'danger'} />
            <Stat label="Results" value={`${result.score}/${result.total}`} tone="accent" />
            <Stat label="Time" value={formatDuration(result.duration_seconds)} tone="warning" />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onRetakeMissed} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-accent)] px-5 py-3 font-black text-[color:var(--color-accent-text)]">
            <Target size={18} />
            Retake missed ({missed})
          </button>
          <button type="button" onClick={onRetake} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-black text-[color:var(--color-text)]">
            <RotateCcw size={18} />
            Take a new quiz
          </button>
          <button type="button" onClick={onBackToPreview} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-black text-[color:var(--color-text-muted)]">
            <BookOpen size={18} />
            Preview
          </button>
          <button type="button" onClick={onLibrary} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-5 py-3 font-black text-[color:var(--color-text-muted)]">
            <ArrowLeft size={18} />
            Library
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
        <div className="space-y-4">
          {(result.answers || []).map((answer) => (
            <article key={answer.question_id} className={`rounded-[1.5rem] border p-4 ${answer.is_correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
              <div className="flex items-start gap-3">
                {answer.is_correct ? <CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={20} /> : <XCircle className="mt-1 shrink-0 text-rose-500" size={20} />}
                <div className="min-w-0">
                  <p className="text-sm font-black text-[color:var(--color-text-muted)]">Question {answer.order}</p>
                  <h2 className="mt-1 text-lg font-black leading-7 text-[color:var(--color-text)]">{answer.question}</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <AnswerPill label="Your answer" value={answer.user_answer || 'Unanswered'} tone={answer.is_correct ? 'success' : 'danger'} />
                    <AnswerPill label="Correct answer" value={answer.correct_answer} tone="success" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--color-text-muted)]">{answer.explanation}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <AttemptLog attempts={attempts} />
      </section>
    </div>
  );
}

function AttemptLog({ attempts }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(attempts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAttempts = attempts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="text-[color:var(--color-accent)]" size={20} />
          <h2 className="text-xl font-black text-[color:var(--color-text)]">Past performance</h2>
        </div>
        <span className="rounded-full bg-[color:var(--color-surface-2)] px-2.5 py-1 text-xs font-black text-[color:var(--color-text-muted)]">
          {attempts.length} total
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {visibleAttempts.length ? visibleAttempts.map((attempt) => {
          const difficulty = getQuizDifficulty(attempt.difficulty);
          return (
            <div key={attempt.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[color:var(--color-text)]">
                  {new Date(attempt.created_at).toLocaleDateString()} · {attempt.session_type === 'practice' ? 'Practice' : 'Test'}
                </p>
                <p className="mt-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
                  {attempt.score}/{attempt.total} · {formatDuration(attempt.duration_seconds)}{attempt.pending ? ' · pending sync' : ''}
                </p>
                <span className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black" style={{ background: `${difficulty.color}20`, color: difficulty.color }}>
                  {difficulty.label}
                </span>
              </div>
              <span className="rounded-full bg-[color:var(--color-surface)] px-3 py-2 text-sm font-black text-[color:var(--color-text)]">{attempt.percent}%</span>
            </div>
          );
        }) : (
          <div className="rounded-[1.25rem] border border-dashed border-[color:var(--color-border)] p-4 text-sm leading-6 text-[color:var(--color-text-muted)]">
            Your retakes and scores will show here after the first attempt.
          </div>
        )}
      </div>
      {totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Quiz score log pagination">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous quiz score page"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text)] transition hover:bg-[color:var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next quiz score page"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function SegmentedSetting({ label, value, options, onChange }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 sm:p-4">
      <p className="text-sm font-black text-[color:var(--color-text)]">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-black leading-tight transition ${
              value === option.value
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]'
            }`}
          >
            <span className="inline-flex min-w-0 items-center justify-center gap-2">
              {option.icon}
              <span className="min-w-0">{option.label}</span>
            </span>
            {option.caption ? (
              <span className={`text-[0.68rem] font-bold ${value === option.value ? 'opacity-80' : 'text-[color:var(--color-text-muted)]'}`}>
                {option.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const colors = {
    accent: 'text-[color:var(--color-accent)]',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-rose-500',
  };
  return (
    <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-3 text-center">
      <p className={`text-2xl font-black leading-tight ${colors[tone] || colors.accent}`}>{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function StreakBadge({ streak, bestStreak }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-black ${streak >= 3 ? 'border-amber-500/40 bg-amber-500/10 text-amber-500' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]'}`}>
      <Flame size={16} />
      {streak >= 3 ? `${streak} streak` : `Best ${bestStreak}`}
    </span>
  );
}

function AnswerPill({ label, value, tone }) {
  const color = tone === 'danger' ? 'text-rose-500' : 'text-emerald-500';
  return (
    <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-black leading-6 ${color}`}>{value}</p>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="quiz-donut" aria-hidden="true" />
        <p className="text-sm font-black text-[color:var(--color-text-muted)]">Loading quiz and restoring saved progress...</p>
      </div>
      <section className="mt-4 rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="h-5 w-32 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded-2xl bg-[color:var(--color-surface-2)]" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded-full bg-[color:var(--color-surface-2)]" />
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-[2rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" />
        ))}
      </div>
    </main>
  );
}
