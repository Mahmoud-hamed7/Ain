import { useQuery } from '@tanstack/react-query';
import apiClient from './client';
import type { SOSAlertListResponse, SOSAlertsListFilters } from '../types';

/**
 * Fetch paginated SOS alerts list (GET /api/sosalerts).
 *
 * Authority callers: backend auto-filters to Active only when no ?status supplied.
 * Admin/SuperAdmin: all statuses unless ?status is provided.
 *
 * Query key convention:
 *   ['sos', 'list', filters]   — list page
 *   ['sos', id]                — single alert detail
 *   ['sos', id, 'live-state']  — live snapshot
 */
export const useSOSAlerts = (filters: SOSAlertsListFilters = {}) =>
  useQuery<SOSAlertListResponse>({
    queryKey: ['sos', 'list', filters],
    queryFn: () =>
      apiClient
        .get<SOSAlertListResponse>('/api/sosalerts', { params: filters })
        .then((r) => r.data),
    refetchInterval: 15_000,   // real-time gap-filler between SignalR events
    staleTime: 0,
  });
