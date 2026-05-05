const { randomUUID } = require('crypto');

const MAX_QUEUE_SIZE = 5;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

const jobs = new Map();
const queuedJobIds = [];
let activeJobId = null;
let processor = null;

function nowIso() {
  return new Date().toISOString();
}

function setProcessor(nextProcessor) {
  processor = nextProcessor;
}

function buildSnapshot(job) {
  if (!job) return null;

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    message: job.message,
    detail: job.detail,
    progressValue: job.progressValue,
    createdAt: job.createdAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    positionAhead: job.status === 'queued' ? Math.max(queuedJobIds.indexOf(job.id), 0) : 0,
    canCancel: job.status === 'queued' || job.status === 'processing',
    result: job.status === 'completed' ? job.result : null,
    error: job.status === 'failed' ? job.error : null,
  };
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function getUserActiveJob(userId) {
  for (const job of jobs.values()) {
    if (job.userId === userId && (job.status === 'queued' || job.status === 'processing')) {
      return job;
    }
  }
  return null;
}

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

function scheduleCleanup(jobId, delayMs = 30 * 60 * 1000) {
  const job = jobs.get(jobId);
  if (!job) return;

  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }

  job.cleanupTimer = setTimeout(() => {
    const latest = jobs.get(jobId);
    if (!latest) return;
    if (!TERMINAL_STATUSES.has(latest.status)) return;
    jobs.delete(jobId);
  }, delayMs);
}

async function processNext() {
  if (activeJobId || !queuedJobIds.length || typeof processor !== 'function') return;

  const nextJobId = queuedJobIds.shift();
  const job = jobs.get(nextJobId);
  if (!job || job.status !== 'queued') {
    processNext();
    return;
  }

  activeJobId = nextJobId;
  updateJob(nextJobId, {
    status: 'processing',
    startedAt: nowIso(),
    message: 'Generation started',
    detail: 'Your request reached the front of the line and is now being processed.',
    progressValue: 18,
  });

  try {
    const result = await processor(job);
    updateJob(nextJobId, {
      status: 'completed',
      finishedAt: nowIso(),
      message: 'Generation complete',
      detail: 'Your study material is ready.',
      progressValue: 100,
      result,
    });
  } catch (error) {
    const wasCancelled = job.abortController?.signal?.aborted || error?.message === 'Generation aborted.';
    updateJob(nextJobId, {
      status: wasCancelled ? 'cancelled' : 'failed',
      finishedAt: nowIso(),
      message: wasCancelled ? 'Generation cancelled' : 'Generation failed',
      detail: wasCancelled
        ? 'This generation request was cancelled before completion.'
        : 'The AI service could not finish this request.',
      error: wasCancelled ? null : (error?.message || 'Generation failed.'),
    });
  } finally {
    activeJobId = null;
    scheduleCleanup(nextJobId);
    processNext();
  }
}

function enqueueJob({ userId, type, payload }) {
  const existingJob = getUserActiveJob(userId);
  if (existingJob) {
    const error = new Error('You already have an AI generation request in progress.');
    error.statusCode = 409;
    error.job = buildSnapshot(existingJob);
    throw error;
  }

  if (queuedJobIds.length + (activeJobId ? 1 : 0) >= MAX_QUEUE_SIZE) {
    const error = new Error('The AI queue is full right now. Please try again in a moment.');
    error.statusCode = 429;
    throw error;
  }

  const id = randomUUID();
  const job = {
    id,
    userId,
    type,
    payload,
    status: 'queued',
    message: 'Queued for generation',
    detail: activeJobId
      ? 'Another request is currently using Gemini AI. Your file is waiting in line.'
      : 'Your file is ready and will start in a moment.',
    progressValue: activeJobId ? 8 : 12,
    createdAt: nowIso(),
    queuedAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
    abortController: payload.abortController,
    cleanupTimer: null,
  };

  jobs.set(id, job);
  queuedJobIds.push(id);
  processNext();
  return buildSnapshot(job);
}

function cancelJob(jobId, userId) {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) return null;

  if (job.status === 'queued') {
    const queueIndex = queuedJobIds.indexOf(jobId);
    if (queueIndex >= 0) queuedJobIds.splice(queueIndex, 1);
    updateJob(jobId, {
      status: 'cancelled',
      finishedAt: nowIso(),
      message: 'Queue request cancelled',
      detail: 'Your request was removed from the queue.',
    });
    scheduleCleanup(jobId);
    return buildSnapshot(job);
  }

  if (job.status === 'processing') {
    job.abortController?.abort();
    updateJob(jobId, {
      message: 'Cancelling generation',
      detail: 'Stopping your active generation request safely.',
    });
    return buildSnapshot(job);
  }

  return buildSnapshot(job);
}

module.exports = {
  buildSnapshot,
  cancelJob,
  enqueueJob,
  getJob,
  getUserActiveJob,
  setProcessor,
  updateJob,
};
