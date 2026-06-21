import apiClient from '../api/client';

/** Resolve a relative upload path or partial URL to a full browser-loadable URL. */
export function getMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = apiClient.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '';
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
