import { useState } from 'react';

import { Link } from 'react-router-dom';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { format } from 'date-fns';

import {

  Search, ChevronLeft, ChevronRight, X, Eye,

  Trash2, Flag, ShieldAlert, ExternalLink, AlertTriangle, Paperclip, Building2,

} from 'lucide-react';

import apiClient from '../../api/client';

import Skeleton from '../../components/Skeleton';

import ConfirmDialog from '../../components/ConfirmDialog';

import { getStatusPinColor } from '../../utils/map';

import { useNotificationStore } from '../../store/notificationStore';

import { getMediaUrl } from '../../utils/media';

import {

  normalizeReportDetail,

  parseReportFeedResponse,

  type NormalizedReportListItem,

} from '../../utils/reports';

import type { Report } from '../../types';



const STATUSES   = ['All', 'UnderReview', 'Dispatched', 'ReSolved', 'Rejected'];

const VISIBILITY = ['All', 'Public', 'Confidential', 'Anonymous'];



function StatusBadge({ status }: { status: string }) {

  return (

    <span

      className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full text-white"

      style={{ backgroundColor: getStatusPinColor(status) }}

    >

      {status === 'ReSolved' ? 'Resolved' : status}

    </span>

  );

}



function VisibilityBadge({ visibility }: { visibility: string }) {

  const colors: Record<string, string> = {

    Public:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',

    Confidential: 'bg-amber-500/15 text-amber-400 border-amber-500/30',

    Anonymous:    'bg-purple-500/15 text-purple-400 border-purple-500/30',

  };

  return (

    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${colors[visibility] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>

      {visibility}

    </span>

  );

}



function authorityCellLabel(status: string, authorityName: string | null): string {

  if (authorityName) return authorityName;

  if (status === 'UnderReview') return 'Unassigned';

  return '—';

}



function isImageAttachment(contentType: string | null, fileName: string): boolean {

  if (contentType?.startsWith('image/')) return true;

  return /\.(jpe?g|png|gif|webp)$/i.test(fileName);

}



/* ── Detail slide-over ── */

function ReportDetailSlideOver({

  reportId,

  listItem,

  onClose,

}: {

  reportId: string;

  listItem: NormalizedReportListItem | null;

  onClose: () => void;

}) {

  const { data: rawDetail, isLoading, isError } = useQuery({

    queryKey: ['reports', reportId, 'admin-detail'],

    queryFn:  () => apiClient.get(`/api/reports/${reportId}`).then((r) => r.data),

    enabled:  !!reportId,

  });



  const detail: Report | null = rawDetail ? normalizeReportDetail(rawDetail) : null;

  const reporter = detail?.reporter ?? listItem?.reporter ?? null;

  const visibility = detail?.visibility ?? listItem?.visibility ?? 'Public';

  const categoryLabel =

    detail?.category

      ? [detail.category, detail.subCategory].filter(Boolean).join(' · ')

      : listItem?.categoryLabel;

  const attachments = detail?.attachments ?? [];



  return (

    <div className="fixed inset-0 z-50 flex justify-end">

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-gray-900 border-l border-gray-700 h-full overflow-y-auto shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">

          <h2 className="text-base font-bold text-white">Report Detail</h2>

          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>

        </div>



        {isLoading && !listItem ? (

          <div className="p-6 space-y-3"><Skeleton type="card" className="h-40" /><Skeleton type="card" className="h-40" /></div>

        ) : detail || listItem ? (

          <div className="p-6 space-y-6">

            {isError && listItem && (

              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">

                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />

                Full detail failed to load — showing list data until refresh.

              </div>

            )}



            <div>

              <div className="flex items-start gap-3 mb-3">

                <StatusBadge status={detail?.status ?? listItem?.status ?? 'Unknown'} />

                <VisibilityBadge visibility={visibility} />

              </div>

              <h3 className="text-lg font-bold text-white">{detail?.title ?? listItem?.title}</h3>

              <p className="text-sm text-gray-400 mt-1">{detail?.description ?? listItem?.description}</p>

              <p className="text-xs text-gray-600 mt-2">

                {categoryLabel ?? 'Category unavailable'} ·{' '}

                {(detail?.createdAt ?? listItem?.createdAt)

                  ? format(new Date(detail?.createdAt ?? listItem!.createdAt), 'MMM d, yyyy HH:mm')

                  : ''}

              </p>

            </div>



            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">

                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> Reporter Identity (Admin View)

              </p>



              <div className="grid grid-cols-2 gap-3 text-sm">

                <div>

                  <p className="text-gray-500 text-xs">Name</p>

                  <p className="text-white font-medium">{reporter?.name ?? '—'}</p>

                </div>

                <div>

                  <p className="text-gray-500 text-xs">National ID</p>

                  <p className="text-white font-mono">{reporter?.nationalId ?? '—'}</p>

                </div>

                <div>

                  <p className="text-gray-500 text-xs">Email</p>

                  <p className="text-white truncate">{reporter?.email ?? '—'}</p>

                </div>

                <div>

                  <p className="text-gray-500 text-xs">Phone</p>

                  <p className="text-white">{reporter?.phone ?? '—'}</p>

                </div>

              </div>



              {(reporter?.idCardUrl || reporter?.idCardBackUrl) && (

                <div className="grid grid-cols-2 gap-3 mt-2">

                  {reporter.idCardUrl && (

                    <div>

                      <p className="text-xs text-gray-500 mb-1">ID Front</p>

                      <a href={getMediaUrl(reporter.idCardUrl)} target="_blank" rel="noopener noreferrer">

                        <img src={getMediaUrl(reporter.idCardUrl)} alt="ID Front" className="w-full rounded-lg border border-gray-700 object-cover h-28 cursor-zoom-in hover:opacity-80 transition-opacity" />

                      </a>

                    </div>

                  )}

                  {reporter.idCardBackUrl && (

                    <div>

                      <p className="text-xs text-gray-500 mb-1">ID Back</p>

                      <a href={getMediaUrl(reporter.idCardBackUrl)} target="_blank" rel="noopener noreferrer">

                        <img src={getMediaUrl(reporter.idCardBackUrl)} alt="ID Back" className="w-full rounded-lg border border-gray-700 object-cover h-28 cursor-zoom-in hover:opacity-80 transition-opacity" />

                      </a>

                    </div>

                  )}

                </div>

              )}

            </div>



            <div>

              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Attachments</p>

              {attachments.length > 0 ? (

                <div className="grid grid-cols-3 gap-2">

                  {attachments.map((att) => {

                    const url = getMediaUrl(att.filePath);

                    const isImage = isImageAttachment(att.contentType, att.fileName);

                    return (

                      <a key={att.id} href={url} target="_blank" rel="noopener noreferrer"

                        className="block rounded-lg overflow-hidden border border-gray-700 hover:opacity-80 transition-opacity">

                        {isImage ? (

                          <img src={url} alt={att.fileName} className="w-full h-20 object-cover" />

                        ) : (

                          <div className="flex flex-col items-center justify-center h-20 bg-gray-800 text-gray-400 px-2">

                            <Paperclip className="w-4 h-4 mb-1" />

                            <span className="text-[10px] truncate w-full text-center">{att.fileName}</span>

                          </div>

                        )}

                      </a>

                    );

                  })}

                </div>

              ) : (

                <p className="text-sm text-gray-500 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-6 text-center">

                  No attachments

                </p>

              )}

            </div>



            <Link to={`/admin/reports/${reportId}`}

              className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">

              <ExternalLink className="w-4 h-4" /> Open full report page

            </Link>

          </div>

        ) : (

          <p className="p-6 text-gray-500 text-sm">Report not found.</p>

        )}

      </div>

    </div>

  );

}



export default function AdminReports() {

  const qc = useQueryClient();

  const addToast = useNotificationStore((s) => s.addToast);



  const [search,     setSearch]     = useState('');

  const [status,     setStatus]     = useState('All');

  const [visibility, setVisibility] = useState('All');

  const [page,       setPage]       = useState(1);

  const [viewId,     setViewId]     = useState<string | null>(null);

  const [viewListItem, setViewListItem] = useState<NormalizedReportListItem | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; title: string } | null>(null);

  const [flagModal,   setFlagModal]   = useState<{ open: boolean; id: string } | null>(null);

  const [flagReason,  setFlagReason]  = useState('');



  const { data, isLoading } = useQuery({

    queryKey: ['admin', 'reports', { search, status, visibility, page }],

    queryFn: async () => {

      const res = await apiClient.get('/api/reports/authority-feed', {

        params: {

          status: status === 'All' ? undefined : status,

          page,

          pageSize: 20,

        },

      });

      const parsed = parseReportFeedResponse(res.data);

      let reports = parsed.reports;



      if (visibility !== 'All') {

        reports = reports.filter((r) => r.visibility === visibility);

      }

      if (search.trim()) {

        const q = search.trim().toLowerCase();

        reports = reports.filter((r) =>

          r.title.toLowerCase().includes(q) ||

          r.description.toLowerCase().includes(q) ||

          r.reporter?.name?.toLowerCase().includes(q),

        );

      }



      return {

        reports,

        callerAuthorityName: parsed.callerAuthorityName,

        totalCount: search.trim() || visibility !== 'All'

          ? reports.length

          : parsed.totalCount,

        totalPages: parsed.totalPages,

      };

    },

  });



  const reports    = data?.reports ?? [];

  const totalPages = data?.totalPages ?? 1;

  const displayCount = data?.totalCount ?? reports.length;



  const mutateAction = (fn: () => Promise<any>, msg: string) =>

    fn()

      .then(() => {

        addToast({ type: 'success', title: 'Done', description: msg });

        qc.invalidateQueries({ queryKey: ['admin', 'reports'] });

        setDeleteModal(null);

        setFlagModal(null);

      })

      .catch((e: any) =>

        addToast({ type: 'error', title: 'Error', description: e?.response?.data?.message ?? 'Action failed.' })

      );



  const openDetail = (item: NormalizedReportListItem) => {

    setViewId(item.id);

    setViewListItem(item);

  };



  const closeDetail = () => {

    setViewId(null);

    setViewListItem(null);

  };



  return (

    <div className="p-6 max-w-7xl mx-auto space-y-5">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">

        <div className="space-y-2">

          <h1 className="text-2xl font-bold text-white">Report Management</h1>

          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-300 bg-purple-900/30 border border-purple-800/40 px-3 py-1 rounded-full">

            <Building2 className="w-4 h-4" />

            {data?.callerAuthorityName ?? 'All Stations — System-wide View'}

          </span>

        </div>

        <p className="text-sm text-gray-400">{displayCount} report{displayCount !== 1 ? 's' : ''}</p>

      </div>



      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">

        <div className="relative flex-1 min-w-52">

          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />

          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}

            placeholder="Search reports…"

            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500" />

        </div>



        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">

          {STATUSES.map((s) => (

            <button key={s} onClick={() => { setStatus(s); setPage(1); }}

              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${status === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>

              {s === 'All' ? 'All' : s === 'ReSolved' ? 'Resolved' : s}

            </button>

          ))}

        </div>



        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">

          {VISIBILITY.map((v) => (

            <button key={v} onClick={() => { setVisibility(v); setPage(1); }}

              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${visibility === v ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>

              {v}

            </button>

          ))}

        </div>

      </div>



      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

        {isLoading ? (

          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="bg-gray-800/60 border-b border-gray-800">

                  {['Title', 'Category', 'Status', 'Visibility', 'Reporter', 'Authority', 'Date', ''].map((h) => (

                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>

                  ))}

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-800/60">

                {reports.map((r) => {

                  const authorityLabel = authorityCellLabel(r.status, r.authorityName);

                  return (

                    <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">

                      <td className="px-4 py-3 max-w-[180px]">

                        <p className="text-white font-medium truncate">{r.title}</p>

                      </td>

                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px]">

                        <span className="line-clamp-2">{r.categoryLabel ?? '—'}</span>

                      </td>

                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>

                      <td className="px-4 py-3"><VisibilityBadge visibility={r.visibility} /></td>

                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">

                        {r.reporter?.name ?? '—'}

                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">

                        {authorityLabel}

                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">

                        {r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : '—'}

                      </td>

                      <td className="px-4 py-3">

                        <div className="flex items-center gap-1">

                          <button onClick={() => openDetail(r)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="View">

                            <Eye className="w-4 h-4" />

                          </button>

                          <button onClick={() => setFlagModal({ open: true, id: r.id })} className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors" title="Flag">

                            <Flag className="w-4 h-4" />

                          </button>

                          <button onClick={() => setDeleteModal({ open: true, id: r.id, title: r.title })} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete">

                            <Trash2 className="w-4 h-4" />

                          </button>

                        </div>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

            {reports.length === 0 && <p className="text-center py-12 text-gray-500 text-sm">No reports found.</p>}

          </div>

        )}

      </div>



      {totalPages > 1 && (

        <div className="flex items-center justify-between">

          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>

          <div className="flex gap-2">

            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}

              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">

              <ChevronLeft className="w-4 h-4" />

            </button>

            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}

              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 transition-colors">

              <ChevronRight className="w-4 h-4" />

            </button>

          </div>

        </div>

      )}



      {viewId && (

        <ReportDetailSlideOver

          reportId={viewId}

          listItem={viewListItem}

          onClose={closeDetail}

        />

      )}



      <ConfirmDialog

        open={!!deleteModal?.open}

        title="Delete Report"

        message={<>Permanently delete <strong className="text-white">"{deleteModal?.title}"</strong>? This cannot be undone.</>}

        confirmText="Delete"

        onConfirm={() => deleteModal && mutateAction(() => apiClient.delete(`/api/admin/reports/${deleteModal.id}`), 'Report deleted.')}

        onCancel={() => setDeleteModal(null)}

      />



      {flagModal?.open && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setFlagModal(null)} />

          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">

            <h3 className="text-base font-bold text-white mb-4">Flag Report</h3>

            <textarea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} rows={3}

              placeholder="Reason for flagging…"

              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 resize-none mb-4" />

            <div className="flex justify-end gap-3">

              <button onClick={() => setFlagModal(null)} className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>

              <button disabled={!flagReason.trim()}

                onClick={() => mutateAction(() => apiClient.post(`/api/admin/reports/${flagModal.id}/flag`, { reason: flagReason }), 'Report flagged.')}

                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-40">

                Flag

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


