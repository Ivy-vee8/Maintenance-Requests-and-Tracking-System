import type { MaintenanceRequest, ReportSummary } from '../types/mrtmis';

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, rows: Array<Array<unknown>>): void {
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRequestsToCsv(requests: MaintenanceRequest[]): void {
  const headers = [
    'Request ID',
    'Title',
    'Category',
    'Location',
    'Priority',
    'Status',
    'Submitted By',
    'Department',
    'Assigned To',
    'Submitted Date',
    'Last Updated',
    'Resolution Notes',
    'Rejection Reason',
  ];
  const rows: Array<Array<unknown>> = [
    headers,
    ...requests.map((r) => [
      r.requestId,
      r.title,
      r.categoryName,
      r.location,
      r.priority,
      r.status,
      r.submittedByName,
      r.submittedByDepartment,
      r.assignedToName || 'Unassigned',
      formatDateTime(r.createdAt),
      formatDateTime(r.updatedAt),
      r.resolutionNotes,
      r.rejectionReason,
    ]),
  ];
  downloadCsvFile(`mrtmis-requests-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export function exportReportToCsv(report: ReportSummary): void {
  const rows: Array<Array<unknown>> = [
    ['MRTMIS Management Information Report'],
    ['Generated At', formatDateTime(report.generatedAt)],
    ['From Date', report.dateRange.fromDate || 'All Time'],
    ['To Date', report.dateRange.toDate || 'Present'],
    [],
    ['Summary Metrics'],
    ['Total Requests', report.totals.total],
    ['Resolved Requests', report.totals.resolved],
    ['Unresolved Requests', report.totals.unresolved],
    ['Pending', report.totals.pending],
    ['Assigned', report.totals.assigned],
    ['In Progress', report.totals.inProgress],
    ['Rejected', report.totals.rejected],
    ['Resolution Rate (%)', `${report.totals.resolutionRatePct}%`],
    [],
    ['Requests by Category', 'Total', 'Resolved', 'Unresolved'],
    ...report.byCategory.map((c) => [c.name, c.count, c.resolved, c.unresolved]),
    [],
    ['Requests by Priority', 'Count'],
    ...report.byPriority.map((p) => [p.name, p.count]),
    [],
    ['Requests by Department', 'Total', 'Resolved'],
    ...report.byDepartment.map((d) => [d.department, d.count, d.resolved]),
    [],
    ['Maintenance Personnel Workload', 'Department', 'Total Assigned', 'Pending Start', 'In Progress', 'Resolved', 'Resolution Rate (%)'],
    ...report.workload.map((w) => [
      w.fullName,
      w.department,
      w.totalAssigned,
      w.pendingStart,
      w.inProgress,
      w.resolved,
      `${w.resolutionRatePct}%`,
    ]),
    [],
    ['Monthly Activity', 'Submitted', 'Resolved'],
    ...report.monthlyTrends.map((m) => [m.month, m.submitted, m.resolved]),
  ];
  downloadCsvFile(`mrtmis-management-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
