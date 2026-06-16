/**
 * CategoryBarChart — Horizontal bar chart, sorted descending by count.
 * Each bar gets a distinct color. Long category names are truncated on Y-axis.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import EmptyState from '../EmptyState';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#ec4899'];

interface Props {
  data: { name: string; value: number }[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-300 font-medium">{label}</p>
      <p className="text-white font-bold">{payload[0].value} reports</p>
    </div>
  );
}

function truncate(str: string, max = 18) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function CategoryBarChart({ data, height = 260 }: Props) {
  if (!data || data.length === 0)
    return <EmptyState title="No category data" message="No category breakdown available." />;

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          width={100}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => truncate(v, 16)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" name="Reports" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {sorted.map((_, idx) => (
            <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}