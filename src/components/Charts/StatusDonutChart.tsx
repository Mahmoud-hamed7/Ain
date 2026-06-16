/**
 * StatusDonutChart — Donut chart for report status distribution.
 * Center shows total count. Legend below with status labels.
 */
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import EmptyState from '../EmptyState';

const STATUS_COLORS: Record<string, string> = {
  UnderReview: '#f59e0b',
  Dispatched:  '#3b82f6',
  ReSolved:    '#10b981',
  Resolved:    '#10b981',
  Rejected:    '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  UnderReview: 'Under Review',
  Dispatched:  'Dispatched',
  ReSolved:    'Resolved',
  Resolved:    'Resolved',
  Rejected:    'Rejected',
};

interface Props {
  data: { name: string; value: number }[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <span style={{ color: STATUS_COLORS[name] ?? '#94a3b8' }} className="font-bold">
        {STATUS_LABELS[name] ?? name}
      </span>
      <span className="text-white ml-2 font-semibold">{value}</span>
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
      {payload?.map((p: any) => (
        <span key={p.value} className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {STATUS_LABELS[p.value] ?? p.value}
        </span>
      ))}
    </div>
  );
}

export default function StatusDonutChart({ data, height = 260 }: Props) {
  if (!data || data.length === 0)
    return <EmptyState title="No status data" message="No status data available for this period." />;

  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="relative" style={{ height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="42%"
            outerRadius="62%"
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={450}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div
        className="absolute flex flex-col items-center justify-center pointer-events-none"
        style={{ inset: 0, top: '-8%' }}
      >
        <span className="text-3xl font-black text-white tabular-nums">{total}</span>
        <span className="text-xs text-gray-500 mt-0.5">Total</span>
      </div>
    </div>
  );
}