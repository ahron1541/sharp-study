import { apiRequest } from '../../../config/api';

export const RECENT_MATERIALS_CHANGED = 'sharp-study-recent-materials-changed';

export function notifyRecentMaterialsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RECENT_MATERIALS_CHANGED));
}

export async function fetchRecentMaterials(limit = 3) {
  return apiRequest(`/api/dashboard/recent-materials?limit=${limit}`);
}

export async function recordRecentMaterialOpen({ content_type, content_id, title }) {
  if (!content_type || !content_id) return null;

  const response = await apiRequest('/api/dashboard/recent-materials', {
    method: 'POST',
    body: JSON.stringify({ content_type, content_id, title }),
  });
  notifyRecentMaterialsChanged();
  return response;
}
