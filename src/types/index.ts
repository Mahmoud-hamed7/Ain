// ─────────────────────────────────────────────────────────────
//  AIN Frontend — Shared TypeScript Types (v2)
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: string | string[];
  token: string;
  profilePhotoUrl?: string;
  trustPoints?: number;
  badge?: 'Newcomer' | 'Contributor' | 'Trusted' | 'Guardian';
  authorityId?: string;
}

export interface AuthResult {
  isSuccess: boolean;
  errors: Record<string, string[]>;
  user: {
    displayName: string;
    email: string;
    token: string;
    refreshToken: string;
  } | null;
  message: string | null;
  signupToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// ── Enums ──────────────────────────────────────────────────────
export type ReportStatus     = 'UnderReview' | 'Dispatched' | 'ReSolved' | 'Rejected';
export type ReportVisibility = 'Public' | 'Confidential' | 'Anonymous';
export type SOSStatus        = 'Active' | 'Resolved' | 'Cancelled' | 'FalseAlarm' | 'Expired';
export type SOSSeverity      = 'Standard' | 'High' | 'Critical';
export type TrustBadge       = 'Newcomer' | 'Contributor' | 'Trusted' | 'Guardian';
export type CommunityType    = 0 | 1 | 2;   // 0=Neighborhood, 1=Building, 2=PrivateGroup
export type MemberStatus     = 'Active' | 'LocationPending' | 'Inactive'; // ⭐ v2

// ── Report types ────────────────────────────────────────────────
export interface ReportLocation {
  latitude: number;
  longitude: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  contentType: string | null;
  fileSize: string;
  aiValidated: boolean;
}

export interface ReporterDetails {
  id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  nationalId: string | null;
  idCardUrl: string | null;
  idCardBackUrl: string | null;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  status: ReportStatus | 'Resolved'; // 'Resolved' alias kept for compat
  visibility: ReportVisibility;
  category: string;
  subCategory: string;
  authorityName: string | null;
  createdAt: string;
  attachments: Attachment[];
  location: ReportLocation;
  locationName: string | null;
  locationMapUrl: string | null;
  reporter: ReporterDetails | null;
}

export interface ReportMapPinDto {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  locationMapUrl: string;
  title: string;
  status: string;
  visibility: string;
  subcategoryName: string | null;
  categoryName: string | null;
  createdAt: string;
}

// ── Authority types ─────────────────────────────────────────────
export interface Authority {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  latitude: number;
  longitude: number;
  jurisdictionRadiusKm: number;
  status: number;
  createdAt: string;
  userId: string | null;
  specializations: { id: string; name: string; icon: string | null; description: string | null; categoryId: string }[];
  coverageAreas: { id: string; areaName: string; centerLatitude: number; centerLongitude: number; radiusKm: number }[];
}

// ── SOS types (v2) ─────────────────────────────────────────────
export interface SOSLocationDto {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  recordedAtUtc: string;
  locationName: string | null;
}

export interface SOSBatchLocationItem {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitudeMeters?: number;
  recordedAtUtc: string; // ISO 8601 UTC
}

export interface SOSBatchLocationRequest {
  locations: SOSBatchLocationItem[]; // max 50
}

/** ⭐ v2 — Full live snapshot returned by GET /api/sosalerts/{id}/live-state */
export interface SOSLiveStateDto {
  sosAlertId: string;
  status: SOSStatus;
  severity: SOSSeverity;
  communityId: string;
  initiatorUserId: string;
  isInitiatorLocationStale: boolean; // true if >60s since last ping
  initiatorLastPingAt: string | null;
  secondsSinceLastPing: number | null;
  latestLocation: SOSLocationDto | null;
  recentLocations: SOSLocationDto[];
  activeMemberCount: number;
  snapshotTakenAt: string;
}

export interface SOSAlert {
  id: string;
  status: SOSStatus;
  severity: SOSSeverity;
  message: string | null;
  initiatorUserId: string;
  communityId: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  resolvedAtUtc: string | null;
  recentLocations: SOSLocationDto[];
  totalLocationUpdates: number;
}

// ── SOS list types (v2 — paginated GET /api/sosalerts) ─────────────
/** Lightweight list item — no recentLocations[], use /{id}/live-state for full detail */
export interface SOSAlertListItem {
  id: string;
  status: SOSStatus;
  severity: SOSSeverity;
  message: string | null;
  initiatorUserId: string;
  communityId: string;
  createdAtUtc: string;
  expiresAtUtc: string | null;
  resolvedAtUtc: string | null;
  isLocationStale: boolean;        // true if no ping for 60+ seconds
  lastLocationPingAt: string | null;
  totalLocationUpdates: number;    // always 0 in list view
}

export interface SOSAlertListResponse {
  data: SOSAlertListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SOSAlertsListFilters {
  status?: string;       // 'Active' | 'Resolved' | 'Cancelled' | 'FalseAlarm' | 'Expired'
  severity?: string;     // 'Standard' | 'High' | 'Critical'
  communityId?: string;
  page?: number;
  pageSize?: number;
}

// ── Community types (v2) ────────────────────────────────────────
export interface LocationDto {
  latitude: number;
  longitude: number;
}

export interface UserDetailsDto {
  usrId: string;
  userName: string;
  role: string; // "Member" | "Admin"
  userLocation: LocationDto | null;
  lastLocationUpdatedAt: string;
}

/** ⭐ v2 */
export interface CommunityMemberDto {
  usrId: string;
  userName: string;
  role: string;
  memberStatus: MemberStatus;
  userLocation: LocationDto | null;
  lastLocationUpdatedAt: string;
}

export interface CreateCommunityRequest {
  name: string;
  description?: string;
  communityType: CommunityType; // 0=Neighborhood, 1=Building, 2=PrivateGroup
  coverageRadiusMeters?: number;
}

/** ⭐ v2 — POST /api/Community now returns inviteCode */
export interface CreateCommunityResponse {
  id: string;
  name: string;
  description: string | null;
  communityType: CommunityType;
  coverageRadiusMeters: number | null;
  createdById: string;
  userName: string;
  createdAt: string;
  inviteCode: string | null;
  inviteCodeExpiresAt: string | null;
  userDetails: UserDetailsDto;
}

/** ⭐ v2 — POST /api/Community/join */
export interface JoinCommunityRequest {
  inviteCode: string; // 6-char alphanumeric
}

export interface JoinCommunityResponse {
  communityId: string;
  communityName: string;
  memberStatus: MemberStatus; // "Active" | "LocationPending"
  message: string;
  requiresLocation: boolean; // true when memberStatus = LocationPending
}

/** ⭐ v2 — POST /api/Community/{id}/regenerate-code */
export interface RegenerateCodeResponse {
  communityId: string;
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
}

/** ⭐ v2 — GET /api/Community/nearby */
export interface NearbyCommunityDto {
  id: string;
  name: string;
  communityType: CommunityType;
  coverageRadiusMeters: number | null;
  distanceMeters: number;
  memberCount: number;
}

/** ⭐ v2 — GET /api/Community/all (enriched) */
export interface CommunitySystemListDto {
  id: string;
  name: string;
  description: string | null;
  communityType: CommunityType; // ⭐ NEW
  memberCount: number;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  lastModifiedAt: string | null;
  centroidLatitude: number | null;
  centroidLongitude: number | null;
  isWithinCallerJurisdiction: boolean;
  inviteCode: string | null; // ⭐ NEW (Admin only)
}