import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, Search, Filter, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { getStatusPinColor } from '../../utils/map';
import { parseReportFeedResponse } from '../../utils/reports';

const STATUSES = ['All', 'UnderReview', 'Dispatched', 'ReSolved', 'Rejected'];
const SORTS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'urgent', label: 'Most Urgent' },
];

export default function AuthorityFeed() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [sort,         setSort]         = useState('newest');
  const [specFilter,   setSpecFilter]   = useState('All');

  const { data: profile } = useQuery({
    queryKey: ['authorities', 'me'],
    queryFn:  async () => (await apiClient.get('/api/authorities/me')).data,
  });

  const { data: feed, isLoading } = useQuery({
    queryKey: ['reports', 'authority-feed', statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/api/reports/authority-feed', {
        params: {
          status: statusFilter === 'All' ? undefined : statusFilter,
        },
      });
      return parseReportFeedResponse(res.data);
    },
  });

  const reports = feed?.reports ?? [];
  const callerAuthorityName = feed?.callerAuthorityName ?? null;

  const processed = useMemo(() => {
    let list = [...reports];

    if (search) {
      const query = search.toLowerCase();
      list = list.filter((r) =>
        r.title?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query),
      );
    }

    if (dateFrom) {
      const [year, month, day] = dateFrom.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      list = list.filter((r) => new Date(r.createdAt).getTime() >= startDate.getTime());
    }
    if (dateTo) {
      const [year, month, day] = dateTo.split('-').map(Number);
      const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      list = list.filter((r) => new Date(r.createdAt).getTime() <= endDate.getTime());
    }

    if (specFilter !== 'All') {
      const spec = specFilter.toLowerCase().trim();
      list = list.filter((r) =>
        r.categoryLabel?.toLowerCase().includes(spec),
      );
    }

    switch (sort) {
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'urgent':
        list.sort((a, b) => {
          const aOver = a.status === 'UnderReview' && Date.now() - new Date(a.createdAt).getTime() > 86_400_000;
          const bOver = b.status === 'UnderReview' && Date.now() - new Date(b.createdAt).getTime() > 86_400_000;
          return (bOver ? 1 : 0) - (aOver ? 1 : 0);
        });
        break;
      default:
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [reports, search, dateFrom, dateTo, sort, specFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Case Feed / Workqueue</h1>
          {callerAuthorityName ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 bg-blue-900/30 border border-blue-800/40 px-3 py-1 rounded-full">
              <Building2 className="w-4 h-4" />
              {callerAuthorityName}
            </span>
          ) : null}
        </div>
        <span className="text-sm text-gray-500">
          {processed.length} case{processed.length !== 1 ? 's' : ''}
          {feed?.totalCount != null && feed.totalCount !== processed.length
            ? ` · ${feed.totalCount} total`
            : ''}
        </span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All Statuses' : s === 'ReSolved' ? 'Resolved' : s}
              </option>
            ))}
          </select>
        </div>

        {profile?.specializations?.length > 0 && (
          <select
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="All">All Specializations</option>
            {profile.specializations.map((sp: any) => (
              <option key={sp.id} value={sp.name}>{sp.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <span className="text-gray-600 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {(search || statusFilter !== 'All' || dateFrom || dateTo || specFilter !== 'All') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('All'); setDateFrom(''); setDateTo(''); setSpecFilter('All'); }}
            className="text-xs text-gray-400 hover:text-white underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} type="table-row" className="bg-gray-900 rounded-xl h-28" />)}
        </div>
      ) : processed.length === 0 ? (
        <EmptyState title="Queue is empty" message="No cases match your current filters." />
      ) : (
        <div className="flex flex-col gap-3">
          {processed.map((report) => {
            const isOverdue =
              report.status === 'UnderReview' &&
              Date.now() - new Date(report.createdAt).getTime() > 86_400_000;

            return (
              <Link key={report.id} to={`/authority/report/${report.id}`} className="block group">
                <div
                  className="bg-gray-900 rounded-xl p-5 flex flex-col md:flex-row justify-between gap-4
                              border border-gray-800 border-l-4 hover:bg-gray-800/60 transition-colors"
                  style={{ borderLeftColor: getStatusPinColor(report.status) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                        {report.title}
                      </h3>
                      {isOverdue && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2 mb-3">{report.description}</p>
                    {report.categoryLabel && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded-full border border-gray-700">
                          {report.categoryLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-2">
                    <span
                      className="px-3 py-1 text-xs font-bold rounded-full text-white"
                      style={{ backgroundColor: getStatusPinColor(report.status) }}
                    >
                      {report.status === 'ReSolved' ? 'Resolved' : report.status}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {report.createdAt
                        ? formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })
                        : '—'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
