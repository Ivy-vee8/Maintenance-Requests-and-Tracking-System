export type UserRole = 'admin' | 'staff' | 'maintenance';
export type AccountStatus = 'active' | 'inactive';
export type RequestPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type RequestStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected';
export type PreviousStatus = 'None' | RequestStatus;

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  categoryId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRequest {
  requestId: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  location: string;
  priority: RequestPriority;
  status: RequestStatus;
  submittedBy: string;
  submittedByName: string;
  submittedByDepartment: string;
  assignedTo: string;
  assignedToName: string;
  assignedAt?: string;
  resolutionNotes: string;
  rejectionReason: string;
  attachmentUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  assignmentId: string;
  requestId: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  assignedByName: string;
  assignmentNotes: string;
  assignedAt: string;
}

export interface StatusHistoryEntry {
  historyId: string;
  requestId: string;
  previousStatus: PreviousStatus;
  newStatus: RequestStatus;
  changedBy: string;
  changedByName: string;
  changedByRole: UserRole;
  requestOwnerId: string;
  requestAssigneeId: string;
  comments: string;
  changedAt: string;
}

export interface ReportSummary {
  generatedAt: string;
  dateRange: {
    fromDate: string | null;
    toDate: string | null;
  };
  totals: {
    total: number;
    pending: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    unresolved: number;
    resolutionRatePct: number;
  };
  byCategory: Array<{ name: string; count: number; resolved: number; unresolved: number }>;
  byPriority: Array<{ name: RequestPriority; count: number }>;
  byStatus: Array<{ name: RequestStatus; count: number }>;
  byDepartment: Array<{ department: string; count: number; resolved: number }>;
  byLocation: Array<{ location: string; count: number }>;
  workload: Array<{
    userId: string;
    fullName: string;
    department: string;
    totalAssigned: number;
    inProgress: number;
    pendingStart: number;
    resolved: number;
    resolutionRatePct: number;
  }>;
  monthlyTrends: Array<{ month: string; submitted: number; resolved: number }>;
}

export const DEFAULT_CATEGORIES: Array<{ categoryId: string; name: string; description: string }> = [
  {
    categoryId: 'electrical',
    name: 'Electrical',
    description: 'Power outlets, lighting fixtures, circuit breakers, and wiring faults.',
  },
  {
    categoryId: 'plumbing',
    name: 'Plumbing',
    description: 'Water supply pipes, restrooms, drains, leaks, and water heaters.',
  },
  {
    categoryId: 'ict-equipment',
    name: 'ICT and Computer Equipment',
    description: 'Workstations, printers, projectors, network ports, and AV hardware.',
  },
  {
    categoryId: 'furniture',
    name: 'Furniture',
    description: 'Desks, ergonomic chairs, filing cabinets, doors, and locks.',
  },
  {
    categoryId: 'buildings-facilities',
    name: 'Buildings and Facilities',
    description: 'HVAC, roofing, windows, flooring, painting, and structural repairs.',
  },
  {
    categoryId: 'other',
    name: 'Other',
    description: 'General maintenance requests not covered by standard categories.',
  },
];
