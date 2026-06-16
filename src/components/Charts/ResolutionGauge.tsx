/**
 * ResolutionGauge — Half-donut radial bar showing resolution rate %.
 * Color transitions: red (0%) → amber (50%) → green (100%)
 */
import { RadialBarChart, RadialBar } from 'recharts';

interface Props {
  rate: number; // 0–100
  size?: number;
}

function gaugeColor(rate: number): string {
  if (rate >= 75) return '#10b981'; // green
  if (rate >= 50) return '#f59e0b'; // amber
  if (rate >= 25) return '#f97316'; // orange
  return '#ef4444';                 // red
}

export default function ResolutionGauge({ rate, size = 200 }: Props) {
  const pct   = Math.min(Math.max(rate, 0), 100);
  const color = gaugeColor(pct);

  // Two bars: background track (gray) + foreground value
  const chartData = [
    { value: 100, fill: '#1f2937' },
    { value: pct, fill: color },
  ];

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size * 0.6 }}>
      <RadialBarChart
        width={size}
        height={size * 0.65}
        cx={size / 2}
        cy={size * 0.6}
        innerRadius={size * 0.38}
        outerRadius={size * 0.52}
        startAngle={180}
        endAngle={0}
        data={chartData}
        barSize={size * 0.14}
      >
        <RadialBar dataKey="value" cornerRadius={6} background={false} />
      </RadialBarChart>

      {/* Center overlay */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-1">
        <p className="font-black tabular-nums leading-none" style={{ color, fontSize: size * 0.18 }}>
          {pct.toFixed(1)}%
        </p>
        <p className="text-gray-500 mt-0.5" style={{ fontSize: size * 0.065 }}>resolution rate</p>
      </div>
    </div>
  );
}
