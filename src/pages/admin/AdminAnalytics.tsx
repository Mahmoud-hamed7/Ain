import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  FileText, CheckCircle, Clock, Timer, TrendingUp, Users,
  Download, AlertTriangle,
} from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import {
  StatCard,
  DailyTrendChart,
  StatusDonutChart,
  CategoryBarChart,
  VisibilityChart,
  ResolutionGauge,
  AuthorityPerformanceTable,
  type AuthorityPerformanceRow,
} from '../../components/Charts';

export default function AdminAnalytics() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  /* ── System analytics ── */
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'analytics', 'system', dateFrom, dateTo],
    queryFn:  async () => {
      const res = await apiClient.get('/api/reports/analytics/system', {
        params: {
          startDate: new Date(dateFrom).toISOString(),
          endDate:   new Date(dateTo + 'T23:59:59').toISOString(),
        },
      });
      return res.data;
    },
  });

  /* ── Admin dashboard summary (for KPI) ── */
  const { data: summary } = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn:  async () => (await apiClient.get('/api/admin/dashboard-summary')).data,
  });

  /* ── Derived data ── */
  const resolutionPct = (() => {
    const r = data?.overallResolutionRate ?? 0;
    return r <= 1 ? +(r * 100).toFixed(1) : +r.toFixed(1);
  })();

  const statusData = Object.entries(data?.reportsByStatus ?? {}).map(([name, value]) => ({
    name: name === 'ReSolved' ? 'Resolved' : name,
    value: value as number,
  }));

  const categoryData = Object.entries(data?.reportsByCategory ?? {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  const visibilityData = Object.entries(data?.reportsByVisibility ?? {}).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  /* authorityPerformance is a dict keyed by authority name */
  const perfRows: AuthorityPerformanceRow[] = Object.entries(data?.authorityPerformance ?? {}).map(
    ([, perf]: [string, any]) => ({
      authorityId:          perf.authorityName ?? Math.random().toString(),
      authorityName:        perf.authorityName ?? '—',
      totalAssigned:        perf.reportsAssigned  ?? 0,
      totalResolved:        perf.reportsResolved  ?? 0,
      resolutionRate:       perf.resolutionRate != null
        ? (perf.resolutionRate <= 1 ? perf.resolutionRate * 100 : perf.resolutionRate)
        : 0,
      avgResponseTimeHours: perf.avgResolutionTimeHours ?? 0,
    }),
  );

  const exportData = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `system_analytics_${dateFrom}_to_${dateTo}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="card" className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton type="chart" className="h-72" />
          <Skeleton type="chart" className="h-72" />
        </div>
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Platform-wide performance overview</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <span className="text-gray-600 font-medium">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Reports"
          value={data?.totalReports ?? summary?.totalReports ?? 0}
          icon={<FileText className="w-5 h-5" />}
          color="#3b82f6"
          subtitle="Period total"
        />
        <StatCard
          title="Total Resolved"
          value={data?.totalResolved ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="#10b981"
          subtitle="Cases closed"
        />
        <StatCard
          title="Pending"
          value={data?.totalPending ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="#f59e0b"
          subtitle="Awaiting action"
        />
        <StatCard
          title="Active Users"
          value={summary?.totalUsers ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="#8b5cf6"
          subtitle="Registered users"
        />
        <StatCard
          title="Avg Response"
          value={`${(data?.avgResponseTimeHours ?? 0).toFixed(1)}h`}
          icon={<Timer className="w-5 h-5" />}
          color="#06b6d4"
          subtitle="Mean response time"
        />
        <StatCard
          title="Active SOS"
          value={summary?.activeSOS ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#ef4444"
          subtitle="Live alerts"
        />
      </div>

      {/* ── Row 2: Resolution gauge + Status donut + Visibility pie ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center gap-2">
          <h3 className="text-base font-bold text-white self-start">Resolution Rate</h3>
          <ResolutionGauge rate={resolutionPct} size={200} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4">Status Distribution</h3>
          <StatusDonutChart data={statusData} height={220} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4">Visibility Breakdown</h3>
          <VisibilityChart data={visibilityData} height={220} />
        </div>
      </div>

      {/* ── Row 3: Daily trend (full width) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Daily Volume &amp; Resolution Trend</h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            <TrendingUp className="w-3.5 h-3.5 inline mr-1" />
            {data?.dailyTrend?.length ?? 0} days
          </span>
        </div>
        <DailyTrendChart data={data?.dailyTrend ?? []} height={260} />
      </div>

      {/* ── Row 4: Category bar + Avg time card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4">Reports by Category</h3>
          <CategoryBarChart data={categoryData} height={280} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center gap-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Response</p>
            <p className="text-5xl font-black tabular-nums text-cyan-400">
              {(data?.avgResponseTimeHours ?? 0).toFixed(1)}
              <span className="text-2xl font-bold text-gray-500 ml-1">h</span>
            </p>
          </div>
          <div className="w-px h-8 bg-gray-800 mx-auto" />
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Resolution</p>
            <p className="text-5xl font-black tabular-nums text-purple-400">
              {(data?.avgResolutionTimeHours ?? 0).toFixed(1)}
              <span className="text-2xl font-bold text-gray-500 ml-1">h</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 5: Authority performance table ── */}
      {perfRows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4">Authority Performance</h3>
          <AuthorityPerformanceTable data={perfRows} />
        </div>
      )}
    </div>
  );
}