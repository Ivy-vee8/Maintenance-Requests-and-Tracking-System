import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Percent,
  Printer,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {
  BTN_ACCENT_CLS,
  BTN_PRIMARY_CLS,
  BTN_SECONDARY_CLS,
  KpiCard,
} from '../components/FormControls';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import type { ReportSummary } from '../types/mrtmis';
import { exportReportToCsv, formatDateTime } from '../utils/format';

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E2E8F0',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.08)',
};

export function ReportsPage() {
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getReportSummary({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setReport(res.report);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate management report.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, showToast]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Management Information Reports
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational maintenance analytics aggregated from live database records for decision support.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 bg-white border border-slate-200 rounded-lg p-2.5">
          <div className="flex items-center gap-2 text-xs px-1">
            <label htmlFor="rep-from" className="font-medium text-slate-600">From</label>
            <input
              id="rep-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs text-slate-800 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
            />
          </div>
          <div className="flex items-center gap-2 text-xs px-1">
            <label htmlFor="rep-to" className="font-medium text-slate-600">To</label>
            <input
              id="rep-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-xs text-slate-800 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
            />
          </div>
          <div className="h-5 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className={BTN_SECONDARY_CLS}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            disabled={!report}
            onClick={() => report && exportReportToCsv(report)}
            className={BTN_ACCENT_CLS}
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            disabled={!report}
            onClick={() => window.print()}
            className={BTN_PRIMARY_CLS}
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h1 className="font-display text-xl font-bold text-slate-900">
          MRTMIS — Maintenance Operations Management Report
        </h1>
        {report && (
          <p className="text-xs text-slate-600 mt-1">
            Generated: {formatDateTime(report.generatedAt)} · Period:{' '}
            {report.dateRange.fromDate || 'Beginning'} to {report.dateRange.toDate || 'Present'}
          </p>
        )}
      </div>

      {loading && !report ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 h-[108px] animate-pulse">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="mt-5 h-7 w-12 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : !report ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
          No report data available.
        </div>
      ) : (
        <>
          {/* Executive Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Total Requests"
              value={report.totals.total}
              Icon={ClipboardList}
              iconClassName="text-slate-700 bg-slate-100"
            />
            <KpiCard
              label="Resolved"
              value={report.totals.resolved}
              Icon={CheckCircle2}
              valueClassName="text-emerald-700"
              iconClassName="text-emerald-700 bg-emerald-50"
            />
            <KpiCard
              label="Unresolved (Open)"
              value={report.totals.unresolved}
              Icon={Clock}
              valueClassName="text-amber-700"
              iconClassName="text-amber-700 bg-amber-50"
            />
            <KpiCard
              label="Rejected"
              value={report.totals.rejected}
              Icon={XCircle}
              valueClassName="text-red-700"
              iconClassName="text-red-700 bg-red-50"
            />
            <KpiCard
              label="Resolution Rate"
              value={`${report.totals.resolutionRatePct}%`}
              Icon={Percent}
              valueClassName="text-[#0F172A]"
              iconClassName="text-teal-700 bg-teal-50"
            />
          </div>

          {/* Monthly Activity & Category Comparison Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Monthly Maintenance Activity
                </h3>
                <span className="text-xs text-slate-500">Submitted vs. resolved</span>
              </div>
              {report.monthlyTrends.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No requests found within selected date range.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.monthlyTrends} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="submitted" name="Submitted" fill="#0F172A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="#0D9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Category Resolution Breakdown
                </h3>
                <span className="text-xs text-slate-500">Open vs. completed</span>
              </div>
              {report.byCategory.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No category activity found.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.byCategory} margin={{ top: 8, right: 16, left: -12, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#16A34A" />
                      <Bar dataKey="unresolved" name="Unresolved" stackId="a" fill="#D97706" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Workload Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Maintenance Personnel Workload
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Task allocation and completion performance across active technicians.
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums shrink-0">
                {report.workload.length} personnel
              </span>
            </div>
            {report.workload.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">
                No active maintenance personnel accounts configured.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Technician</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Assigned</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Pending Start</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">In Progress</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Resolved</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {report.workload.map((w) => (
                      <tr key={w.userId} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">{w.fullName}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{w.department}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">{w.totalAssigned}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{w.pendingStart}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-700">{w.inProgress}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {w.resolved}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                          {w.resolutionRatePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Department, Priority, and Location Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900">Requests by Department</h3>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4 text-right">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.byDepartment.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 px-4 text-xs text-slate-400">
                        No records.
                      </td>
                    </tr>
                  ) : (
                    report.byDepartment.map((d) => (
                      <tr key={d.department} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 text-slate-800">{d.department}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">{d.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">{d.resolved}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900">Requests by Priority</h3>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Priority Level</th>
                    <th className="py-2.5 px-4 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.byPriority.map((p) => (
                    <tr key={p.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-slate-800">{p.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900">Top Locations</h3>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Location</th>
                    <th className="py-2.5 px-4 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.byLocation.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-4 px-4 text-xs text-slate-400">
                        No records.
                      </td>
                    </tr>
                  ) : (
                    report.byLocation.map((l) => (
                      <tr key={l.location} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 text-slate-800 truncate max-w-[180px]" title={l.location}>
                          {l.location}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">{l.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
