import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Minus,
  PauseCircle,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { RequestPriority, RequestStatus, UserRole } from '../types/mrtmis';

export function StatusIndicator({ status }: { status: RequestStatus }) {
  const styles: Record<RequestStatus, { cls: string; Icon: typeof Clock }> = {
    Pending: {
      cls: 'bg-amber-50 text-amber-800 border-amber-200/90',
      Icon: Clock,
    },
    Assigned: {
      cls: 'bg-blue-50 text-blue-800 border-blue-200/90',
      Icon: UserCheck,
    },
    'In Progress': {
      cls: 'bg-teal-50 text-teal-800 border-teal-200/90',
      Icon: Wrench,
    },
    Resolved: {
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
      Icon: CheckCircle2,
    },
    Rejected: {
      cls: 'bg-red-50 text-red-800 border-red-200/90',
      Icon: XCircle,
    },
  };

  const { cls, Icon } = styles[status] || styles.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${cls}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

export function PriorityIndicator({ priority }: { priority: RequestPriority }) {
  const styles: Record<RequestPriority, { cls: string; Icon: typeof Minus }> = {
    Low: { cls: 'text-slate-600', Icon: ArrowDown },
    Medium: { cls: 'text-blue-700 font-medium', Icon: Minus },
    High: { cls: 'text-amber-700 font-semibold', Icon: ArrowUp },
    Critical: { cls: 'text-red-700 font-semibold', Icon: AlertTriangle },
  };
  const { cls, Icon } = styles[priority] || styles.Medium;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{priority}</span>
    </span>
  );
}

export function ActiveStatusIndicator({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200/90 text-xs font-medium whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Active</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-300/90 text-xs font-medium whitespace-nowrap">
      <PauseCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Inactive</span>
    </span>
  );
}

export function RoleLabel({ role }: { role: UserRole }) {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    maintenance: 'Maintenance Personnel',
    staff: 'Staff / Requester',
  };
  return <span>{labels[role] || role}</span>;
}
