import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, FileText, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import Skeleton from '../../components/Skeleton';
import StatCard from '../../components/Charts/StatCard';
import DailyTrendChart from '../../components/Charts/DailyTrendChart';
import { getStatusPinColor } from '../../utils/map';

const STATUS_LABELS: Record<string, string> = {
  UnderReview: 'Under Review',
  Dispatched:  'Dispatched',
  ReSolved:    'Resolved',
  Resolved:    'Resolved',
  Rejected:    'Rejected',
};

export default function AuthorityDashboard() {
  const user = useAuthStore((state) => state.user);

  // 1. استرجاع الـ API الخاص بالـ Analytics (لتغذية الشارت والـ Overdue)
  const { data: analyticsData } = useQuery({
    queryKey: ['reports', 'analytics', 'authority', user?.authorityId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/reports/analytics/authority/${user?.authorityId}`);
      return res.data;
    },
    enabled: !!user?.authorityId,
  });

  // 2. الـ API الخاص بالـ Feed (لتغذية الكروت والجدول)
  const { data: feedData, isLoading: loadingCases } = useQuery({
    queryKey: ['reports', 'authority-feed', 'recent'],
    queryFn: async () => {
      const res = await apiClient.get('/api/reports/authority-feed', { params: { pageSize: 10 } });
      return res.data; 
    },
  });

  if (loadingCases) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} type="card" className="h-32" />)}
        </div>
        <Skeleton type="chart" />
      </div>
    );
  }

  // حساب الإحصائيات من الـ Feed للكروت العلوية
  const recentCases = feedData?.reports || [];
  const totalAssigned = feedData?.totalCount || 0;

  const totalResolved = recentCases.filter(
    (report: any) => report.status === 'Resolved' || report.status === 'ReSolved'
  ).length;

  const totalPending = recentCases.filter(
    (report: any) => report.status === 'UnderReview' || report.status === 'Dispatched'
  ).length;

  const resolutionRate =
    totalAssigned > 0
      ? ((totalResolved / totalAssigned) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Overdue alert banner (تعتمد على الـ Analytics) */}
      {(analyticsData?.overdueCases ?? 0) > 0 && (
        <div className="bg-red-950/60 border border-red-600/50 text-red-200 p-4 rounded-xl flex items-center gap-3 shadow-lg shadow-red-900/20">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="font-semibold">
            ⚠ {analyticsData?.overdueCases} overdue {analyticsData?.overdueCases === 1 ? 'case' : 'cases'} require immediate attention.
          </span>
          <Link to="/authority/feed?status=UnderReview" className="ml-auto text-sm text-red-400 underline hover:text-red-300">
            View Overdue
          </Link>
        </div>
      )}

      {/* KPI row (تعتمد على الـ Feed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Assigned" value={totalAssigned} icon={<FileText />} color="#3b82f6" />
        <StatCard title="Resolved" value={totalResolved} icon={<CheckCircle />} color="#10b981" />
        <StatCard 
          title="Pending / Overdue"
          value={`${totalPending} / ${analyticsData?.overdueCases ?? 0}`} 
          icon={<Clock />} 
          color="#f59e0b"
        />
        <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon={<TrendingUp />} color="#8b5cf6" />
      </div>

      {/* Chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 7-day trend (تعتمد على الـ Analytics) */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-4">7-Day Activity Trend</h2>
          <DailyTrendChart data={analyticsData?.dailyTrend || []} /> 
        </div>

        {/* Recent cases table (تعتمد على الـ Feed) */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Recent Cases</h2>
            <Link to="/authority/feed" className="text-xs text-blue-400 hover:text-blue-300 underline">
              View All →
            </Link>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 border-b border-gray-800 bg-gray-800/50">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title / Category</span>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Status</span>
            </div>

            <div className="divide-y divide-gray-800/60">
              {recentCases.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No recent cases assigned.</div>
              ) : (
                recentCases.map((report: any) => (
                  <div
                    key={report.id}
                    className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 hover:bg-gray-800/40 transition-colors items-center"
                  >
                    <div className="overflow-hidden">
                      <p className="font-medium text-white text-sm truncate">{report.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 truncate">{report.categoryName || report.category}</span>
                        <span className="text-[11px] text-gray-600">•</span>
                        <span className="text-[11px] text-gray-600">
                          {report.createdAt
                            ? formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: getStatusPinColor(report.status) }}
                      >
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                      <Link
                        to={`/authority/report/${report.id}`}
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}