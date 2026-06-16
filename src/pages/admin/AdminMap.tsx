import CombinedMap from '../../components/Map/CombinedMap';

export default function AdminMap() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="shrink-0 px-6 py-4 bg-gray-950 border-b border-gray-800 flex items-center gap-3">
        <h1 className="text-xl font-bold text-white">Global System Map</h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
          All reports &amp; active SOS
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <CombinedMap viewerRole="admin" showFilterPanel height="100%" />
      </div>
    </div>
  );
}