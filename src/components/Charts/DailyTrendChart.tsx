/**
 * DailyTrendChart — Bar (total reports) + Line (resolved) combo chart.
 * Props: data: { date: string; count: number; resolvedCount: number }[]
 */
import { format } from 'date-fns';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import EmptyState from '../EmptyState';

interface DailyTrendDto {
  date:          string;
  count:         number;
  resolvedCount: number;
}

interface Props {
  data: DailyTrendDto[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl text-xs">
      <p className="text-gray-400 font-medium mb-2">
        {label ? format(new Date(label), 'EEE, MMM d') : ''}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: <span className="text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DailyTrendChart({ data, height = 260 }: Props) {
  if (!data || data.length === 0)
    return <EmptyState title="No trend data" message="No daily trend data available for this period." />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => {
            try { return format(new Date(v), 'MMM d'); } catch { return v; }
          }}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="count"
          name="Total Reports"
          fill="url(#barGradient)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Line
          type="monotone"
          dataKey="resolvedCount"
          name="Resolved"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}