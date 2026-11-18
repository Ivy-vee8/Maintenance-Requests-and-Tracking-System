import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Plus,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { BTN_ACCENT_CLS, BTN_PRIMARY_CLS, KpiCard } from '../components/FormControls';
import { RequestDetailModal } from '../components/RequestDetailModal';
import { PriorityIndicator, StatusIndicator } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useAdminUsers, useMaintenanceRequests } from '../hooks/useMrtmisData';
import { formatDateShort } from '../utils/format';

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#64748B',
  Medium: '#1D4ED8',
  High: '#D97706',
  Critical: '#DC2626',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: '#D97706',
  Assigned: '#1D4ED8',
  'In Progress': '#0D9488',
  Resolved: '#16A34A',
  Rejected: '#DC2626',
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E2E8F0',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.08)',
};

export function DashboardPage() {
  const { profile } = useAuth();
  const { requests, loading } = useMaintenanceRequests();
  const { users } = useAdminUsers();
  const navigate = useNavigate();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedRequest = useMemo(
    () => requests.find((r) => r.requestId === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'Pending').length;
    const assigned = requests.filter((r) => r.status === 'Assigned').length;
    const inProgress = requests.filter((r) => r.status === 'In Progress').length;
    const resolved = requests.filter((r) => r.status === 'Resolved').length;
    const rejected = requests.filter((r) => r.status === 'Rejected').length;
    const maintenanceEmployees = users.filter((u) => u.role === 'maintenance' && u.accountStatus === 'active').length;

    const categoryMap = new Map<string, number>();
    for (const r of requests) {
      categoryMap.set(r.categoryName || 'Other', (categoryMap.get(r.categoryName || 'Other') || 0) + 1);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byPriority = ['Low', 'Medium', 'High', 'Critical'].map((p) => ({
      name: p,
      count: requests.filter((r) => r.priority === p).length,
    }));

    const byStatus = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'].map((s) => ({
      name: s,
      count: requests.filter((r) => r.status === s).length,
    }));

    const monthMap = new Map<string, { month: string; submitted: number; resolved: number }>();
    for (const r of requests) {
      const m = (r.createdAt || '').slice(0, 7);
      if (!m) continue;
      const entry = monthMap.get(m) || { month: m, submitted: 0, resolved: 0 };
      entry.submitted += 1;
      if (r.status === 'Resolved') entry.resolved += 1;
      monthMap.set(m, entry);
    }
    const monthlyTrends = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    return {
      total,
      pending,
      assigned,
      inProgress,
      resolved,
      rejected,
      maintenanceEmployees,
      byCategory,
      byPriority,
      byStatus,
      monthlyTrends,
    };
  }, [requests, users]);

  const maintenanceStaff = useMemo(
    () => users.filter((u) => (u.role === 'maintenance' || u.role === 'admin') && u.accountStatus === 'active'),
    [users]
  );

  if (!profile) return null;

  const recentRequests = requests.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 text-balance">
            Welcome back, {profile.fullName}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {profile.role === 'admin'
              ? 'System-wide maintenance operations overview and live work order metrics.'
              : profile.role === 'maintenance'
                ? 'Your assigned maintenance tasks, active repairs, and completion history.'
                : 'Overview of your submitted maintenance requests and repair progress.'}
          </p>
        </div>

        {(profile.role === 'staff' || profile.role === 'admin') && (
          <button
            type="button"
            onClick={() => navigate('/submit')}
            className={`${BTN_ACCENT_CLS} self-start sm:self-auto`}
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Submit Request</span>
          </button>
        )}
      </div>

      {/* Role-Specific KPI Cards */}
      {loading ? (
        <div
          className={`grid gap-4 ${
            profile.role === 'admin'
              ? 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-7'
              : 'grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {(profile.role === 'admin' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4]).map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 h-[108px] animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="mt-5 h-7 w-12 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : profile.role === 'admin' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3.5">
          <KpiCard
            label="Total Requests"
            value={metrics.total}
            Icon={ClipboardList}
            iconClassName="text-slate-700 bg-slate-100"
          />
          <KpiCard
            label="Pending"
            value={metrics.pending}
            Icon={Clock}
            valueClassName="text-amber-700"
            iconClassName="text-amber-700 bg-amber-50"
          />
          <KpiCard
            label="Assigned"
            value={metrics.assigned}
            Icon={UserCheck}
            valueClassName="text-blue-700"
            iconClassName="text-blue-700 bg-blue-50"
          />
          <KpiCard
            label="In Progress"
            value={metrics.inProgress}
            Icon={Wrench}
            valueClassName="text-teal-700"
            iconClassName="text-teal-700 bg-teal-50"
          />
          <KpiCard
            label="Resolved"
            value={metrics.resolved}
            Icon={CheckCircle2}
            valueClassName="text-emerald-700"
            iconClassName="text-emerald-700 bg-emerald-50"
          />
          <KpiCard
            label="Rejected"
            value={metrics.rejected}
            Icon={XCircle}
            valueClassName="text-red-700"
            iconClassName="text-red-700 bg-red-50"
          />
          <KpiCard
            label="Maintenance Staff"
            value={metrics.maintenanceEmployees}
            Icon={Users}
            iconClassName="text-slate-700 bg-slate-100"
          />
        </div>
      ) : profile.role === 'maintenance' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Assigned Tasks"
            value={metrics.total}
            Icon={ClipboardList}
            iconClassName="text-slate-700 bg-slate-100"
          />
          <KpiCard
            label="Pending Assignments"
            value={metrics.assigned}
            sub="Awaiting start"
            Icon={UserCheck}
            valueClassName="text-blue-700"
            iconClassName="text-blue-700 bg-blue-50"
          />
          <KpiCard
            label="Tasks In Progress"
            value={metrics.inProgress}
            Icon={Wrench}
            valueClassName="text-teal-700"
            iconClassName="text-teal-700 bg-teal-50"
          />
          <KpiCard
            label="Completed Tasks"
            value={metrics.resolved}
            Icon={CheckCircle2}
            valueClassName="text-emerald-700"
            iconClassName="text-emerald-700 bg-emerald-50"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Submitted"
            value={metrics.total}
            Icon={ClipboardList}
            iconClassName="text-slate-700 bg-slate-100"
          />
          <KpiCard
            label="Pending"
            value={metrics.pending}
            Icon={Clock}
            valueClassName="text-amber-700"
            iconClassName="text-amber-700 bg-amber-50"
          />
          <KpiCard
            label="In Progress"
            value={metrics.assigned + metrics.inProgress}
            sub="Assigned or active"
            Icon={Wrench}
            valueClassName="text-teal-700"
            iconClassName="text-teal-700 bg-teal-50"
          />
          <KpiCard
            label="Resolved"
            value={metrics.resolved}
            Icon={CheckCircle2}
            valueClassName="text-emerald-700"
            iconClassName="text-emerald-700 bg-emerald-50"
          />
        </div>
      )}

      {/* Admin Visual Analytics Charts */}
      {profile.role === 'admin' && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Requests by Category */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Requests by Category
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {metrics.byCategory.length} active categories
              </span>
            </div>
            {metrics.byCategory.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                No request data available yet.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byCategory} margin={{ top: 8, right: 16, left: -12, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Requests" fill="#0F172A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 2: Requests by Status */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Requests by Status
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {metrics.total} total orders
              </span>
            </div>
            {metrics.total === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                No request data available yet.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byStatus} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                      {metrics.byStatus.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#0D9488'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 3: Requests by Priority */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Requests by Priority
              </h3>
              <span className="text-xs text-slate-500">Severity distribution</span>
            </div>
            {metrics.total === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                No request data available yet.
              </div>
            ) : (
              <div className="h-64 flex flex-col sm:flex-row items-center">
                <div className="w-full sm:w-2/3 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.byPriority.filter((p) => p.count > 0)}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {metrics.byPriority
                          .filter((p) => p.count > 0)
                          .map((entry) => (
                            <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#64748B'} />
                          ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/3 space-y-2.5 text-xs">
                  {metrics.byPriority.map((p) => (
                    <div key={p.name} className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: PRIORITY_COLORS[p.name] }}
                        />
                        <span className="text-slate-700">{p.name}</span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart 4: Monthly Maintenance Trends */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Monthly Maintenance Request Trends
              </h3>
              <span className="text-xs text-slate-500">Submitted vs. resolved</span>
            </div>
            {metrics.monthlyTrends.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                Monthly trends will populate as requests are logged.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.monthlyTrends} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      name="Submitted"
                      stroke="#0F172A"
                      fill="#CBD5E1"
                      fillOpacity={0.45}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      name="Resolved"
                      stroke="#0D9488"
                      fill="#99F6E4"
                      fillOpacity={0.45}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              {profile.role === 'admin'
                ? 'Recent Maintenance Activities'
                : profile.role === 'maintenance'
                  ? 'Recently Assigned Tasks'
                  : 'Recently Submitted Requests'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any work order row to inspect progress, assignment notes, and audit history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/requests')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] hover:text-[#0F766E] whitespace-nowrap shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-3.5 w-24 bg-slate-200 rounded" />
                <div className="h-3.5 flex-1 bg-slate-200 rounded" />
                <div className="h-5 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {profile.role === 'maintenance'
                ? 'No maintenance tasks have been assigned to you yet.'
                : 'No maintenance requests have been submitted yet.'}
            </p>
            {(profile.role === 'staff' || profile.role === 'admin') && (
              <button
                type="button"
                onClick={() => navigate('/submit')}
                className={BTN_PRIMARY_CLS}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Submit First Request</span>
              </button>
            )}
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
                  <th className="py-3 px-4 whitespace-nowrap">Priority</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Submitted</th>
                  <th className="py-3 px-4 w-8" aria-label="Open" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {recentRequests.map((req) => (
                  <tr
                    key={req.requestId}
                    onClick={() => setSelectedRequestId(req.requestId)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                      {req.requestId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate" title={req.title}>
                      {req.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">{req.categoryName}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">{req.location}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PriorityIndicator priority={req.priority} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusIndicator status={req.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateShort(req.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 group-hover:text-slate-700 transition-colors">
                      <ChevronRight className="w-4 h-4 inline-block" aria-hidden="true" />
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
