/**
 * ReportMap — single-report non-interactive location pin.
 * Usage: <ReportMap lat={30.0} lng={31.0} status="UnderReview" />
 */
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { createCustomIcon, getStatusPinColor, TILE_URL, formatCoordinates } from '../../utils/map';

interface ReportMapProps {
  lat: number;
  lng: number;
  status: string;
  title?: string;
}

export default function ReportMap({ lat, lng, status, title }: ReportMapProps) {
  const position: [number, number] = [lat, lng];
  const color = getStatusPinColor(status);
  const icon  = createCustomIcon(color, 28);

  return (
    <div className="h-[350px] w-full rounded-xl overflow-hidden border border-gray-700 shadow-inner">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
        <Marker position={position} icon={icon}>
          <Popup>
            <div className="min-w-[160px]">
              {title && <strong className="block text-sm mb-1">{title}</strong>}
              <span
                className="inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white mb-1"
                style={{ backgroundColor: color }}
              >
                {status}
              </span>
              <p className="text-xs text-gray-500 mt-1 font-mono">{formatCoordinates(lat, lng)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}