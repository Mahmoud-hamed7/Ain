import type { CommunitySystemListDto } from '../types';
import {
  resolveCommunityInviteCode,
  resolveCommunityInviteCodeExpiresAt,
} from '../api/community';

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && val !== '') return val as T;
  }
  return undefined;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function normalizeCommunityListItem(raw: unknown): CommunitySystemListDto {
  const obj = asRecord(raw);
  const lat = pick<number | null>(obj, 'centroidLatitude', 'CentroidLatitude');
  const lng = pick<number | null>(obj, 'centroidLongitude', 'CentroidLongitude');

  return {
    id: pick<string>(obj, 'id', 'Id') ?? '',
    name: pick<string>(obj, 'name', 'Name') ?? '—',
    description: pick<string>(obj, 'description', 'Description') ?? null,
    communityType: (pick<number>(obj, 'communityType', 'CommunityType') ?? 0) as CommunitySystemListDto['communityType'],
    memberCount: Number(pick(obj, 'memberCount', 'MemberCount') ?? 0),
    createdById: pick<string>(obj, 'createdById', 'CreatedById') ?? null,
    createdByName:
      pick<string>(obj, 'createdByName', 'CreatedByName', 'creatorName', 'CreatorName') ?? '—',
    createdAt: pick<string>(obj, 'createdAt', 'CreatedAt') ?? '',
    lastModifiedAt: pick<string>(obj, 'lastModifiedAt', 'LastModifiedAt') ?? null,
    centroidLatitude: lat ?? null,
    centroidLongitude: lng ?? null,
    isWithinCallerJurisdiction: Boolean(
      pick(obj, 'isWithinCallerJurisdiction', 'IsWithinCallerJurisdiction') ?? false,
    ),
    inviteCode: pick<string>(obj, 'inviteCode', 'InviteCode') ?? null,
    inviteCodeExpiresAt: pick<string>(obj, 'inviteCodeExpiresAt', 'InviteCodeExpiresAt') ?? null,
    inviteCodeUsedCount: Number(pick(obj, 'inviteCodeUsedCount', 'InviteCodeUsedCount') ?? 0),
    inviteCodeMaxUses: Number(pick(obj, 'inviteCodeMaxUses', 'InviteCodeMaxUses') ?? 0),
  };
}

function mergeKnownInviteCodes(communities: CommunitySystemListDto[]): CommunitySystemListDto[] {
  return communities.map((c) => ({
    ...c,
    inviteCode: resolveCommunityInviteCode(c.id, c.inviteCode),
    inviteCodeExpiresAt: resolveCommunityInviteCodeExpiresAt(c.id, c.inviteCodeExpiresAt),
  }));
}

export function parseCommunityAdminResponse(data: unknown): {
  communities: CommunitySystemListDto[];
  totalCount: number;
  totalPages: number;
} {
  const body = asRecord(data);
  const rawList =
    body.communities ??
    body.Communities ??
    body.items ??
    body.Items ??
    body.data ??
    body.Data ??
    (Array.isArray(data) ? data : []);

  const communities = mergeKnownInviteCodes(
    Array.isArray(rawList) ? rawList.map(normalizeCommunityListItem) : [],
  );

  const apiTotal = Number(
    pick(body, 'totalCount', 'TotalCount', 'count', 'Count') ?? NaN,
  );
  const totalCount =
    Number.isFinite(apiTotal) && apiTotal > 0 ? apiTotal : communities.length;
  const apiPages = Number(pick(body, 'totalPages', 'TotalPages') ?? NaN);
  const totalPages = Number.isFinite(apiPages) && apiPages > 0 ? apiPages : 1;

  return { communities, totalCount, totalPages };
}

export function shortCommunityId(id: string): string {
  return id ? id.slice(-8) : '';
}
