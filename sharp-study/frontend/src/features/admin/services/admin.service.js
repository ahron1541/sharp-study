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

export function fetchAdminOverview() {
  return apiRequest('/api/admin/overview');
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
