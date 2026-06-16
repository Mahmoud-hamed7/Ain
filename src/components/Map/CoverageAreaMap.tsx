/**
 * CoverageAreaMap — display-only map showing authority coverage circles.
 * Used in Authority Profile and Admin Authorities views.
 * No interaction — just shows the jurisdiction ring and named coverage areas.
 */
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import { createCustomIcon, TILE_URL, CAIRO } from '../../utils/map';
import type { Authority } from '../../types';

interface CoverageAreaMapProps {
  authority: Authority;
  height?: string;
}

export default function CoverageAreaMap({
  authority,
  height = '320px',
}: CoverageAreaMapProps) {
  const center: [number, number] =
    authority.latitude && authority.longitude
      ? [authority.latitude, authority.longitude]
      : CAIRO;

  return (
    <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-700">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />

        {/* Jurisdiction radius (outer dashed ring) */}
        {authority.latitude && authority.longitude && authority.jurisdictionRadiusKm && (
          <>
            <Circle
              center={[authority.latitude, authority.longitude]}
              radius={authority.jurisdictionRadiusKm * 1000}
              pathOptions={{
                color:        '#6366f1',
                fillColor:    '#6366f1',
                fillOpacity:   0.06,
                weight:        2,
                dashArray:    '8 6',
              }}
            />
            <Marker
              position={[authority.latitude, authority.longitude]}
              icon={createCustomIcon('#6366f1', 18)}
            >
              <Popup>
                <strong>{authority.name}</strong>
                <br />
                <span className="text-xs text-gray-500">
                  Jurisdiction: {authority.jurisdictionRadiusKm} km
                </span>
              </Popup>
            </Marker>
          </>
        )}

        {/* Named coverage area circles (solid ring) */}
        {authority.coverageAreas?.map((area) => (
          <Circle
            key={area.id}
            center={[area.centerLatitude, area.centerLongitude]}
            radius={area.radiusKm * 1000}
            pathOptions={{
              color:       '#3b82f6',
              fillColor:   '#3b82f6',
              fillOpacity:  0.10,
              weight:       1.5,
            }}
          >
            <Popup>
              <strong>{area.areaName}</strong>
              <br />
              <span className="text-xs text-gray-500">{area.radiusKm} km radius</span>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
