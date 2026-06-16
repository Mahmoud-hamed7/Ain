/**
 * VisibilityChart — Pie chart for report visibility distribution.
 * Public=emerald, Confidential=amber, Anonymous=purple
 */
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import EmptyState from '../EmptyState';

const VISIBILITY_COLORS: Record<string, string> = {
  Public:       '#10b981',
  Confidential: '#f59e0b',
  Anonymous:    '#8b5cf6',
};

interface Props {
  data: { name: string; value: number }[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <span style={{ color: VISIBILITY_COLORS[payload[0].name] ?? '#94a3b8' }} className="font-bold">
        {payload[0].name}
      </span>
      <span className="text-white ml-2 font-semibold">{payload[0].value} reports</span>
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
      {payload?.map((p: any) => (
        <span key={p.value} className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {p.value}
        </span>
      ))}
    </div>
  );
}

export default function VisibilityChart({ data, height = 220 }: Props) {
  if (!data || data.length === 0)
    return <EmptyState title="No visibility data" message="No visibility breakdown available." />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="46%"
          outerRadius="52%"
          paddingAngle={4}
          dataKey="value"
          stroke="none"
          label={({ percent }: { percent?: number }) => percent != null ? `${(percent * 100).toFixed(0)}%` : ''}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={VISIBILITY_COLORS[entry.name] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
