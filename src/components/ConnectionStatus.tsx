/**
 * ConnectionStatus — Topbar indicator showing the real-time hub connection state.
 *
 * - Connected:     Green pill with wifi icon
 * - Reconnecting:  Amber pill with spinning loader
 * - Disconnected:  Red clickable button to trigger reconnect
 */
import { useSignalR } from '../providers/SignalRProvider';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export default function ConnectionStatus() {
  const { connectionState, connection } = useSignalR();

  const handleReconnect = () => {
    if (connectionState === 'Disconnected' && connection) {
      connection.start().catch(console.error);
    }
  };

  if (connectionState === 'Connected') {
    return (
      <div
        title="Real-time connected"
        className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full"
      >
        <Wifi className="w-3 h-3" />
        <span className="hidden sm:inline">Live</span>
      </div>
    );
  }

  if (connectionState === 'Reconnecting') {
    return (
      <div
        title="Reconnecting to real-time server…"
        className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="hidden sm:inline">Reconnecting…</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleReconnect}
      title="Real-time disconnected. Click to reconnect."
      className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 px-2.5 py-1 rounded-full hover:bg-red-400/20 transition-colors"
    >
      <WifiOff className="w-3 h-3" />
      <span className="hidden sm:inline">Offline</span>
    </button>
  );
}
