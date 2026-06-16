/**
 * AuthorityPerformanceTable — Sortable table for system-level authority analytics.
 * Columns: Authority, Assigned, Resolved, Resolution Rate (mini bar), Avg Response
 */
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface AuthorityPerformanceRow {
  authorityId:         string;
  authorityName:       string;
  totalAssigned:       number;
  totalResolved:       number;
  resolutionRate:      number; // 0–100
  avgResponseTimeHours: number;
}

type SortKey = keyof AuthorityPerformanceRow;
type SortDir = 'asc' | 'desc';

interface Props {
  data: AuthorityPerformanceRow[];
}

function rateColor(rate: number): string {
  if (rate >= 75) return '#10b981';
  if (rate >= 50) return '#f59e0b';
  if (rate >= 25) return '#f97316';
  return '#ef4444';
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-gray-600" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-400" />
    : <ChevronDown className="w-3 h-3 text-blue-400" />;
}

export default function AuthorityPerformanceTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('resolutionRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    if (typeof av === 'string') {
      return sortDir === 'asc'
        ? (av as string).localeCompare(bv as string)
        : (bv as string).localeCompare(av as string);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        No authority performance data available.
      </div>
    );
  }

  const cols: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'authorityName',        label: 'Authority' },
    { key: 'totalAssigned',        label: 'Assigned',      align: 'right' },
    { key: 'totalResolved',        label: 'Resolved',      align: 'right' },
    { key: 'resolutionRate',       label: 'Resolution Rate' },
    { key: 'avgResponseTimeHours', label: 'Avg Response',  align: 'right' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-800">
            {cols.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {sorted.map((row, idx) => {
            const rate  = Math.min(Math.max(row.resolutionRate, 0), 100);
            const color = rateColor(rate);
            return (
              <tr
                key={row.authorityId}
                className={`transition-colors hover:bg-gray-800/40 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-900/30'}`}
              >
                {/* Authority name */}
                <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                  {row.authorityName}
                </td>

                {/* Assigned */}
                <td className="px-4 py-3 text-right text-gray-300 tabular-nums">
                  {row.totalAssigned.toLocaleString()}
                </td>

                {/* Resolved */}
                <td className="px-4 py-3 text-right text-emerald-400 font-semibold tabular-nums">
                  {row.totalResolved.toLocaleString()}
                </td>

                {/* Resolution Rate — mini progress bar */}
                <td className="px-4 py-3 min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${rate}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color }}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Avg Response */}
                <td className="px-4 py-3 text-right text-gray-400 tabular-nums">
                  {row.avgResponseTimeHours.toFixed(1)}h
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
