import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Download, TrendingUp, CheckCircle, Clock, AlertCircle, AlertTriangle, Timer } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import Skeleton from '../../components/Skeleton';
import Button from '../../components/Button';
import {
  StatCard, DailyTrendChart, CategoryBarChart, StatusDonutChart, ResolutionGauge,
} from '../../components/Charts';


export default function AuthorityAnalytics() {
  const user = useAuthStore((s) => s.user);

  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'analytics', 'authority', user?.authorityId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/reports/analytics/authority/${user?.authorityId}`,
        { params: { startDate: new Date(dateFrom).toISOString(), endDate: new Date(dateTo + 'T23:59:59').toISOString() } }
      );
      return res.data;
    },
    enabled: !!user?.authorityId,
  });

  const exportData = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `analytics_${dateFrom}_to_${dateTo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Derived data */
  const resolutionPct =
    typeof data?.resolutionRate === 'number'
      ? +(data.resolutionRate * (data.resolutionRate <= 1 ? 100 : 1)).toFixed(1)
      : 0;


  const statusChartData = Object.entries(data?.reportsByStatus ?? {}).map(([name, value]) => ({
    name: name === 'ReSolved' ? 'Resolved' : name,
    value: value as number,
  }));

  const categoryData = Object.entries(data?.reportsByCategory ?? {})
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map((n) => <Skeleton key={n} type="card" className="h-24" />)}
        </div>
        <Skeleton type="chart" className="h-64" />
        <Skeleton type="chart" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Performance Analytics</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <span className="text-gray-600">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <Button variant="outline" onClick={exportData} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Metrics cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Assigned"   value={data?.totalAssigned ?? 0}  icon={<TrendingUp className="w-5 h-5" />}  color="#3b82f6" />
        <StatCard title="Resolved"         value={data?.totalResolved ?? 0}  icon={<CheckCircle className="w-5 h-5" />} color="#10b981" />
        <StatCard title="Pending"          value={data?.totalPending  ?? 0}  icon={<Clock className="w-5 h-5" />}       color="#f59e0b" />
        <StatCard title="Overdue Cases"    value={data?.overdueCases  ?? 0}  icon={<AlertCircle className="w-5 h-5" />} color="#ef4444" />
        <StatCard
          title="SLA Missed"
          value={`${((data?.slaMissedRate ?? 0) * 100).toFixed(1)}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#f97316"
        />
        <StatCard
          title="Avg Response"
          value={`${(data?.avgResponseTimeHours ?? 0).toFixed(1)}h`}
          icon={<Timer className="w-5 h-5" />}
          color="#8b5cf6"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resolution Gauge */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-bold text-white mb-2 self-start">Resolution Rate</h3>
          <ResolutionGauge rate={resolutionPct} size={200} />
        </div>

        {/* Status distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Status Distribution</h3>
          <StatusDonutChart data={statusChartData} height={220} />
        </div>

        {/* Avg response time sparkline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Avg Response Time</h3>
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <p className="text-5xl font-black text-purple-400 tabular-nums">
                {(data?.avgResponseTimeHours ?? 0).toFixed(1)}
              </p>
              <p className="text-gray-500 text-sm mt-1">hours average</p>
              <p className="text-xs text-gray-600 mt-2">
                Resolution avg: {(data?.avgResolutionTimeHours ?? 0).toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily volume chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Daily Volume & Resolution Trend</h3>
        <DailyTrendChart data={data?.dailyTrend ?? []} height={240} />
      </div>

      {/* Reports by category */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Reports by Category</h3>
        <CategoryBarChart data={categoryData} height={220} />
      </div>
    </div>
  );
}