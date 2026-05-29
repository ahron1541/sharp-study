import { apiRequest } from '../../../config/api';

function toQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export function fetchAdminOverview(params) {
  return apiRequest(`/api/admin/overview${toQuery(params)}`);
}

export function fetchAdminLearningInsights() {
  return apiRequest('/api/admin/learning-insights');
}

export function fetchAdminUsers(params) {
  return apiRequest(`/api/admin/users${toQuery(params)}`);
}

export function createAdminUser(payload) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(id, payload) {
  return apiRequest(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUser(id) {
  return apiRequest(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminContent(params) {
  return apiRequest(`/api/admin/content${toQuery(params)}`);
}

export function fetchAdminContentItem(type, id) {
  return apiRequest(`/api/admin/content/${type}/${id}`);
}

export function updateAdminContent(type, id, payload) {
  return apiRequest(`/api/admin/content/${type}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminContent(type, id) {
  return apiRequest(`/api/admin/content/${type}/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminFeedback(params) {
  return apiRequest(`/api/admin/feedback${toQuery(params)}`);
}

export function fetchAdminFeedbackReport(id) {
  return apiRequest(`/api/admin/feedback/${id}`);
}

export function updateAdminFeedbackReport(id, payload) {
  return apiRequest(`/api/admin/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminFeedbackReport(id) {
  return apiRequest(`/api/admin/feedback/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminAnnouncements(params) {
  return apiRequest(`/api/admin/announcements${toQuery(params)}`);
}

export function createAdminAnnouncement(payload) {
  return apiRequest('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminAnnouncement(id, payload) {
  return apiRequest(`/api/admin/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminAnnouncement(id) {
  return apiRequest(`/api/admin/announcements/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminAiControls(params) {
  return apiRequest(`/api/admin/ai-controls${toQuery(params)}`);
}

export function updateAdminAiRateLimit(payload) {
  return apiRequest('/api/admin/ai-controls/rate-limit', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function upsertAdminAiRateLimitOverride(payload) {
  return apiRequest('/api/admin/ai-controls/rate-limit-overrides', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminAiRateLimitOverride(userId) {
  return apiRequest(`/api/admin/ai-controls/rate-limit-overrides/${userId}`, {
    method: 'DELETE',
  });
}

export function createAdminPromptTemplate(payload) {
  return apiRequest('/api/admin/ai-controls/prompt-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminPromptTemplate(id, payload) {
  return apiRequest(`/api/admin/ai-controls/prompt-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPromptTemplate(id) {
  return apiRequest(`/api/admin/ai-controls/prompt-templates/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminHealth(params) {
  return apiRequest(`/api/admin/health${toQuery(params)}`);
}

export function deleteAdminSystemLog(id) {
  return apiRequest(`/api/admin/health/logs/${id}`, {
    method: 'DELETE',
  });
}

export function clearAdminOldSystemLogs(days = 30) {
  return apiRequest(`/api/admin/health/logs?older_than_days=${days}`, {
    method: 'DELETE',
  });
}
