/**
 * DrawableMap — Admin coverage area editor using Leaflet.Draw.
 * Draws circular coverage areas and outputs their center lat/lng + radius.
 * 
 * Props:
 *   onSave(circles: DrawnCircle[]) — called when user clicks Save
 *   initialCircles?                — pre-populate from existing coverage areas
 */
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import { TILE_URL, CAIRO } from '../../utils/map';
import { Trash2, Save, Info } from 'lucide-react';

export interface DrawnCircle {
  centerLatitude:  number;
  centerLongitude: number;
  radiusKm:        number;
  /** Optional label supplied before saving */
  areaName?: string;
}

interface DrawableMapProps {
  onSave: (circles: DrawnCircle[]) => void;
  initialCircles?: DrawnCircle[];
  height?: string;
}

/* ─── Inner component that gets access to the Leaflet map ─── */
function DrawControls({
  onLayersChange,
}: {
  onLayersChange: (layers: L.Layer[]) => void;
}) {
  const map      = useMap();
  const drawnRef = useRef<L.FeatureGroup>(new L.FeatureGroup());

  useEffect(() => {
    const drawnItems = drawnRef.current;
    map.addLayer(drawnItems);

    // @ts-ignore — leaflet-draw augments L.Control at runtime
    const drawControl = new (L as any).Control.Draw({
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
      draw: {
        polygon:   false,
        polyline:  false,
        rectangle: false,
        marker:    false,
        circlemarker: false,
        circle: {
          shapeOptions: {
            color:       '#6366f1',
            fillColor:   '#6366f1',
            fillOpacity: 0.15,
            weight:      2,
          },
        },
      },
    });

    map.addControl(drawControl);

    const onCreated = (e: any) => {
      drawnItems.addLayer(e.layer);
      onLayersChange(Object.values(drawnItems.getLayers()));
    };
    const onChange = () => {
      onLayersChange(Object.values(drawnItems.getLayers()));
    };

    map.on((L as any).Draw.Event.CREATED, onCreated);
    map.on((L as any).Draw.Event.DELETED, onChange);
    map.on((L as any).Draw.Event.EDITED,  onChange);

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      map.off((L as any).Draw.Event.CREATED, onCreated);
      map.off((L as any).Draw.Event.DELETED, onChange);
      map.off((L as any).Draw.Event.EDITED,  onChange);
    };
  }, [map, onLayersChange]);

  return null;
}

export default function DrawableMap({
  onSave,
  height = '480px',
}: DrawableMapProps) {
  const [layers,    setLayers]    = useState<L.Layer[]>([]);
  const [areaNames, setAreaNames] = useState<Record<number, string>>({});

  const handleSave = () => {
    const circles: DrawnCircle[] = layers
      .filter((l): l is L.Circle => l instanceof L.Circle)
      .map((circle, idx) => {
        const { lat, lng } = circle.getLatLng();
        return {
          centerLatitude:  lat,
          centerLongitude: lng,
          radiusKm:        parseFloat((circle.getRadius() / 1000).toFixed(3)),
          areaName:        areaNames[idx] ?? `Area ${idx + 1}`,
        };
      });

    onSave(circles);
  };

  const handleClear = () => {
    setLayers([]);
    // Force re-render by resetting drawn items via key (handled in parent if needed)
    window.location.reload(); // fallback: reload clears Leaflet.Draw state
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Info banner */}
      <div className="flex items-start gap-2 text-xs text-blue-300 bg-blue-950/30 border border-blue-800/30 rounded-xl p-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
        <span>
          Use the <strong>circle tool</strong> (toolbar, top-left on map) to draw a coverage area.
          You can draw multiple circles. Edit or delete them before saving.
        </span>
      </div>

      {/* Map */}
      <div style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-700">
        <MapContainer center={CAIRO} zoom={10} className="h-full w-full z-0">
          <TileLayer url={TILE_URL} attribution="© OpenStreetMap" />
          <DrawControls onLayersChange={setLayers} />
        </MapContainer>
      </div>

      {/* Name inputs for each drawn circle */}
      {layers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {layers
            .filter((l) => l instanceof L.Circle)
            .map((_, idx) => (
              <input
                key={idx}
                type="text"
                placeholder={`Area ${idx + 1} name…`}
                value={areaNames[idx] ?? ''}
                onChange={(e) =>
                  setAreaNames((prev) => ({ ...prev, [idx]: e.target.value }))
                }
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
            ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 justify-end">
        <span className="text-xs text-gray-500 mr-auto">
          {layers.filter((l) => l instanceof L.Circle).length} circle(s) drawn
        </span>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
        <button
          onClick={handleSave}
          disabled={layers.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Coverage
        </button>
      </div>
    </div>
  );
}
