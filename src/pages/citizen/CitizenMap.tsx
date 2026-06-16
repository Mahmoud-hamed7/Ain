import ReportPinsMap from '../../components/Map/ReportPinsMap';

export default function CitizenMap() {
  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col gap-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Interactive Map</h1>
          <p className="text-sm text-gray-400 mt-0.5">Browse public reports in your area</p>
        </div>
      </div>
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-700">
        <ReportPinsMap viewerRole="citizen" height="100%" />
      </div>
    </div>
  );
}