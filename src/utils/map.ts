import L from 'leaflet';

export type ReportStatus = 'UnderReview' | 'Dispatched' | 'ReSolved' | 'Resolved' | 'Rejected';
export type SOSSeverity = 'Standard' | 'High' | 'Critical';

export function getStatusPinColor(status: string): string {
  const colors: Record<string, string> = {
    UnderReview: '#f59e0b',
    Dispatched:  '#3b82f6',
    ReSolved:    '#10b981',
    Resolved:    '#10b981',
    Rejected:    '#6b7280',
  };
  return colors[status] ?? '#94a3b8';
}

export function getSeverityPinColor(severity: string): string {
  const colors: Record<string, string> = {
    Standard: '#eab308',
    High:     '#f97316',
    Critical: '#ef4444',
  };
  return colors[severity] ?? '#ef4444';
}

/**
 * Teardrop-shaped custom DivIcon with an inner dot.
 */
export function createCustomIcon(
  color: string,
  size: number = 28,
  pulse: boolean = false,
): L.DivIcon {
  const pulseRing = pulse
    ? `<span style="
        position:absolute; inset:-6px; border-radius:50%;
        border:3px solid ${color}; opacity:.5;
        animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
      "></span>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <span style="
        position:relative; display:flex; align-items:center; justify-content:center;
        width:${size}px; height:${size}px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid rgba(255,255,255,0.8);
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      ">
        ${pulseRing}
        <span style="
          width:${Math.round(size * 0.35)}px; height:${Math.round(size * 0.35)}px;
          background:rgba(255,255,255,0.9); border-radius:50%;
        "></span>
      </span>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
}

export function elapsedTime(isoDate: string): string {
  const diffMs  = Date.now() - new Date(isoDate).getTime();
  const mins    = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ??
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const CAIRO: [number, number] = [30.0444, 31.2357];