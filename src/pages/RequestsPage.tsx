import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, Plus, RotateCcw, Search } from 'lucide-react';
import {
  BTN_ACCENT_CLS,
  BTN_PRIMARY_CLS,
  BTN_SECONDARY_CLS,
  INPUT_CLS,
  SelectControl,
} from '../components/FormControls';
import { RequestDetailModal } from '../components/RequestDetailModal';
import { PriorityIndicator, StatusIndicator } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useAdminUsers, useCategories, useMaintenanceRequests } from '../hooks/useMrtmisData';
import { exportRequestsToCsv, formatDateShort } from '../utils/format';
import { VALID_PRIORITIES, VALID_STATUSES } from '../utils/validation';

export function RequestsPage() {
  const { profile } = useAuth();
  const { requests, loading } = useMaintenanceRequests();
  const { categories } = useCategories();
  const { users } = useAdminUsers();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedRequest = useMemo(
    () => requests.find((r) => r.requestId === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (q) {
        const hit =
          r.requestId.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.submittedByName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (categoryId && r.categoryId !== categoryId) return false;
      if (priority && r.priority !== priority) return false;
      if (status && r.status !== status) return false;
      if (fromDate) {
        const fromTs = new Date(fromDate + 'T00:00:00.000Z').getTime();
        if (!Number.isNaN(fromTs) && new Date(r.createdAt).getTime() < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate + 'T23:59:59.999Z').getTime();
        if (!Number.isNaN(toTs) && new Date(r.createdAt).getTime() > toTs) return false;
      }
      return true;
    });
  }, [requests, search, categoryId, priority, status, fromDate, toDate]);

  const maintenanceStaff = useMemo(
    () => users.filter((u) => (u.role === 'maintenance' || u.role === 'admin') && u.accountStatus === 'active'),
    [users]
  );

  const hasActiveFilters = Boolean(search || categoryId || priority || status || fromDate || toDate);

  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
    setPriority('');
    setStatus('');
    setFromDate('');
    setToDate('');
  };

  if (!profile) return null;

  return (
    <div className="space-y-5">
      {/* Page Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {profile.role === 'admin'
              ? 'All Organizational Maintenance Requests'
              : profile.role === 'maintenance'
                ? 'My Assigned Maintenance Tasks'
                : 'My Submitted Maintenance Requests'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Showing {filteredRequests.length} of {requests.length} work orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={filteredRequests.length === 0}
            onClick={() => exportRequestsToCsv(filteredRequests)}
            className={BTN_SECONDARY_CLS}
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          {(profile.role === 'staff' || profile.role === 'admin') && (
            <button
              type="button"
              onClick={() => navigate('/submit')}
              className={BTN_ACCENT_CLS}
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>New Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Request ID, title, or location..."
              aria-label="Search maintenance requests"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>

          <SelectControl
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </SelectControl>

          <SelectControl
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            {VALID_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectControl>

          <SelectControl
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectControl>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="req-from-date" className="font-medium text-slate-600">From</label>
              <input
                id="req-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs text-slate-800 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="req-to-date" className="font-medium text-slate-600">To</label>
              <input
                id="req-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs text-slate-800 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <span className="text-xs text-[#0F766E] font-medium">
              Filters active · {filteredRequests.length} matching
            </span>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-3.5 w-24 bg-slate-200 rounded" />
                <div className="h-3.5 flex-1 bg-slate-200 rounded" />
                <div className="h-5 w-20 bg-slate-200 rounded" />
                <div className="h-6 w-14 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <ClipboardList className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No matching maintenance requests found.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Adjust your search terms, status, category, or date range to view other work orders.'
                : 'No maintenance work orders have been recorded for your workspace yet.'}
            </p>
            <div className="pt-1 flex items-center justify-center gap-2.5">
              {hasActiveFilters ? (
                <button type="button" onClick={resetFilters} className={BTN_SECONDARY_CLS}>
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear All Filters</span>
                </button>
              ) : (
                (profile.role === 'staff' || profile.role === 'admin') && (
                  <button type="button" onClick={() => navigate('/submit')} className={BTN_PRIMARY_CLS}>
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Submit First Request</span>
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Request ID</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 whitespace-nowrap">Location</th>
                  <th className="py-3 px-4 whitespace-nowrap">Requester</th>
                  <th className="py-3 px-4 whitespace-nowrap">Assigned To</th>
                  <th className="py-3 px-4 whitespace-nowrap">Priority</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Submitted</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.requestId}
                    onClick={() => setSelectedRequestId(req.requestId)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {req.requestId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-[220px] truncate" title={req.title}>
                      {req.title}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{req.categoryName}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{req.location}</td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {req.submittedByName}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {req.assignedToName || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PriorityIndicator priority={req.priority} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusIndicator status={req.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateShort(req.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequestId(req.requestId);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                      >
                        {profile.role === 'admin' && !req.assignedTo ? 'Assign' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RequestDetailModal
        request={selectedRequest}
        maintenanceStaff={maintenanceStaff}
        onClose={() => setSelectedRequestId(null)}
      />
    </div>
  );
}
