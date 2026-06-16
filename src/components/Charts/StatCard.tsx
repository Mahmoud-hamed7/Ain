/**
 * StatCard — Glassmorphism KPI card with animated count-up on mount.
 * Props: title, value, subtitle, icon, color, trend?
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StatCardProps {
  title:     string;
  value:     number | string;
  subtitle?: string;
  icon:      ReactNode;
  color:     string;
  trend?:    string; // e.g. "+12%" or "-5%"
}

function useCountUp(target: number, duration = 900) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const start     = performance.now();
    const startVal  = 0;

    const tick = (now: number) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease     = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal + ease * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

export default function StatCard({ title, value, subtitle, icon, color, trend }: StatCardProps) {
  const isNumber  = typeof value === 'number';
  const animated  = useCountUp(isNumber ? (value as number) : 0);
  const displayed = isNumber ? animated : value;

  const trendPositive = trend?.startsWith('+');

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gray-900/80 backdrop-blur border border-gray-800 shadow-lg p-5 flex flex-col gap-3"
      style={{ borderTopWidth: 3, borderTopColor: color }}
    >
      {/* Subtle glow behind icon */}
      <div
        className="absolute top-3 right-3 w-12 h-12 rounded-full opacity-10 blur-lg"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">
            {title}
          </p>
          <p
            className="text-3xl font-black text-white mt-1.5 tabular-nums leading-none tracking-tight"
          >
            {displayed}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 leading-tight">{subtitle}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3"
          style={{ backgroundColor: `${color}20` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              trendPositive
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {trend}
          </span>
          <span className="text-xs text-gray-600">vs last period</span>
        </div>
      )}
    </div>
  );
}