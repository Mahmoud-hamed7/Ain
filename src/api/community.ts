import apiClient from './client';
import type { QueryClient } from '@tanstack/react-query';
import type { CommunityMemberDto, RegenerateCodeResponse } from '../types';

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== '') return val as T;
  }
  return undefined;
}

function normalizeMember(raw: unknown): CommunityMemberDto {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const loc = obj.userLocation ?? obj.UserLocation;
  const locationObj =
    loc && typeof loc === 'object' ? (loc as Record<string, unknown>) : null;

  return {
    userId:
      pick<string>(obj, 'userId', 'UserId', 'usrId', 'UsrId') ?? '',
    userName: pick<string>(obj, 'userName', 'UserName') ?? '—',
    role: pick<string>(obj, 'role', 'Role') ?? 'Member',
    memberStatus: pick(obj, 'memberStatus', 'MemberStatus') as CommunityMemberDto['memberStatus'],
    usrId: pick<string>(obj, 'usrId', 'UsrId'),
    userLocation: locationObj
      ? {
          latitude: Number(pick(locationObj, 'latitude', 'Latitude') ?? 0),
          longitude: Number(pick(locationObj, 'longitude', 'Longitude') ?? 0),
          city: pick<string>(locationObj, 'city', 'City'),
          town: pick<string>(locationObj, 'town', 'Town'),
          street: pick<string>(locationObj, 'street', 'Street'),
        }
      : null,
    lastLocationUpdatedAt:
      pick<string>(obj, 'lastLocationUpdatedAt', 'LastLocationUpdatedAt') ?? null,
  };
}

export function parseCommunityMembersResponse(data: unknown): CommunityMemberDto[] {
  if (Array.isArray(data)) return data.map(normalizeMember);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const list =
      obj.members ??
      obj.Members ??
      obj.items ??
      obj.Items ??
      obj.data ??
      obj.Data;
    if (Array.isArray(list)) return list.map(normalizeMember);
  }
  return [];
}

function normalizeCommunityId(id: string): string {
  return id.trim().toLowerCase();
}

function asResponseObject(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* plain-text or malformed body */
    }
  }
  return {};
}

export function parseRegenerateCodeResponse(
  data: unknown,
  fallbackCommunityId?: string,
): RegenerateCodeResponse {
  const obj = asResponseObject(data);
  const code =
    pick<string>(obj, 'newInviteCode', 'NewInviteCode', 'inviteCode', 'InviteCode') ?? '';
  const communityId =
    pick<string>(obj, 'communityId', 'CommunityId') ?? fallbackCommunityId ?? '';
  return {
    communityId,
    newInviteCode: code,
    inviteCode: code,
    inviteCodeExpiresAt:
      pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
  };
}

/** Codes generated this session — list endpoints may omit inviteCode until backend includes it. */
const knownInviteCodes = new Map<
  string,
  { inviteCode: string; inviteCodeExpiresAt: string | null }
>();

export function rememberCommunityInviteCode(
  communityId: string,
  inviteCode: string,
  inviteCodeExpiresAt?: string | null,
) {
  const id = normalizeCommunityId(communityId);
  if (!id || !inviteCode) return;
  knownInviteCodes.set(id, {
    inviteCode,
    inviteCodeExpiresAt: inviteCodeExpiresAt ?? null,
  });
}

export function forgetCommunityInviteCode(communityId: string) {
  knownInviteCodes.delete(normalizeCommunityId(communityId));
}

export function resolveCommunityInviteCode(
  communityId: string,
  fromApi?: string | null,
): string | null {
  const id = normalizeCommunityId(communityId);
  if (fromApi) {
    rememberCommunityInviteCode(id, fromApi);
    return fromApi;
  }
  return knownInviteCodes.get(id)?.inviteCode ?? null;
}

export function resolveCommunityInviteCodeExpiresAt(
  communityId: string,
  fromApi?: string | null,
): string | null {
  const id = normalizeCommunityId(communityId);
  if (fromApi) return fromApi;
  return knownInviteCodes.get(id)?.inviteCodeExpiresAt ?? null;
}

export function patchCommunityInviteCodeInCache(
  qc: QueryClient,
  communityId: string,
  inviteCode: string,
  inviteCodeExpiresAt?: string | null,
) {
  rememberCommunityInviteCode(communityId, inviteCode, inviteCodeExpiresAt);

  const targetId = normalizeCommunityId(communityId);
  const patchList = (list: Array<{ id: string; inviteCode?: string | null; inviteCodeExpiresAt?: string | null }>) =>
    list.map((c) =>
      normalizeCommunityId(c.id) === targetId
        ? {
            ...c,
            inviteCode,
            inviteCodeExpiresAt: inviteCodeExpiresAt ?? c.inviteCodeExpiresAt ?? null,
          }
        : c,
    );

  qc.setQueriesData({ queryKey: ['admin', 'communities'] }, (old: unknown) => {
    if (!old || typeof old !== 'object') return old;
    const parsed = old as { communities?: Array<{ id: string }> };
    if (!parsed.communities) return old;
    return { ...parsed, communities: patchList(parsed.communities) };
  });

  qc.setQueriesData({ queryKey: ['communities', 'my'] }, (old: unknown) => {
    if (Array.isArray(old)) return patchList(old);
    if (old && typeof old === 'object') {
      const parsed = old as { communities?: Array<{ id: string }> };
      if (parsed.communities) {
        return { ...parsed, communities: patchList(parsed.communities) };
      }
    }
    return old;
  });
}

export const communityApi = {
  getMembers: (communityId: string) =>
    apiClient
      .get('/api/CommunityMember/members', { params: { communityId } })
      .then((r) => parseCommunityMembersResponse(r.data)),

  regenerateInviteCode: (communityId: string) =>
    apiClient
      .post(`/api/Community/${communityId}/regenerate-code`)
      .then((r) => parseRegenerateCodeResponse(r.data, communityId)),
};
