import { auth } from '../firebase';
import type {
  Assignment,
  Category,
  MaintenanceRequest,
  ReportSummary,
  RequestPriority,
  RequestStatus,
  StatusHistoryEntry,
  UserProfile,
  UserRole,
} from '../types/mrtmis';

async function getAuthHeaders(hasBody: boolean): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken();
  return {
    'X-Firebase-Auth': `Bearer ${token}`,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders(options.body !== undefined);
  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const rawText = await res.text();
  let payload: ({ error?: string } & T) | null = null;
  try {
    payload = rawText ? (JSON.parse(rawText) as { error?: string } & T) : ({} as { error?: string } & T);
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const fallbackDetail = rawText && !rawText.trim().startsWith('<') ? rawText.slice(0, 200) : '';
    throw new Error(payload?.error || fallbackDetail || `Request failed with status ${res.status}`);
  }
  return (payload || {}) as T;
}

export const apiClient = {
  async registerProfile(data: { fullName: string; department: string }): Promise<{ user: UserProfile; created: boolean }> {
    return apiFetch('/api/auth/register-profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async initializeAdmin(secret?: string): Promise<{ initialized: boolean; user: UserProfile }> {
    return apiFetch('/api/auth/initialize-admin', {
      method: 'POST',
      body: JSON.stringify({ secret: secret || '' }),
    });
  },

  async uploadImage(dataUrl: string): Promise<{ attachmentUrl: string }> {
    return apiFetch('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
  },

  async getUsers(params?: { role?: UserRole | ''; accountStatus?: string }): Promise<{ users: UserProfile[] }> {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.accountStatus) qs.set('accountStatus', params.accountStatus);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch(`/api/users${suffix}`);
  },

  async updateUser(
    userId: string,
    updates: Partial<Pick<UserProfile, 'fullName' | 'department' | 'role' | 'accountStatus'>>
  ): Promise<{ user: UserProfile }> {
    return apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getCategories(): Promise<{ categories: Category[] }> {
    return apiFetch('/api/categories');
  },

  async createCategory(data: { name: string; description: string }): Promise<{ category: Category }> {
    return apiFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCategory(
    categoryId: string,
    updates: Partial<Pick<Category, 'name' | 'description' | 'isActive'>>
  ): Promise<{ category: Category }> {
    return apiFetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getRequests(params?: {
    search?: string;
    categoryId?: string;
    priority?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{ requests: MaintenanceRequest[] }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.categoryId) qs.set('categoryId', params.categoryId);
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.status) qs.set('status', params.status);
    if (params?.fromDate) qs.set('fromDate', params.fromDate);
    if (params?.toDate) qs.set('toDate', params.toDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch(`/api/requests${suffix}`);
  },

  async createRequest(data: {
    title: string;
    description: string;
    categoryId: string;
    location: string;
    priority: RequestPriority;
    attachmentUrl?: string;
  }): Promise<{ request: MaintenanceRequest }> {
    return apiFetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRequest(
    requestId: string,
    updates: Partial<Pick<MaintenanceRequest, 'title' | 'description' | 'location' | 'priority'>>
  ): Promise<{ request: MaintenanceRequest }> {
    return apiFetch(`/api/requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async assignRequest(
    requestId: string,
    data: { assignedTo: string; priority: RequestPriority; assignmentNotes: string }
  ): Promise<{ request: MaintenanceRequest }> {
    return apiFetch(`/api/requests/${encodeURIComponent(requestId)}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async rejectRequest(requestId: string, rejectionReason: string): Promise<{ request: MaintenanceRequest }> {
    return apiFetch(`/api/requests/${encodeURIComponent(requestId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  },

  async updateRequestStatus(
    requestId: string,
    data: { status: RequestStatus; resolutionNotes?: string; comments?: string }
  ): Promise<{ request: MaintenanceRequest }> {
    return apiFetch(`/api/requests/${encodeURIComponent(requestId)}/status`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRequestHistory(
    requestId: string
  ): Promise<{ history: StatusHistoryEntry[]; assignments: Assignment[] }> {
    return apiFetch(`/api/requests/${encodeURIComponent(requestId)}/history`);
  },

  async getReportSummary(params?: { fromDate?: string; toDate?: string }): Promise<{ report: ReportSummary }> {
    const qs = new URLSearchParams();
    if (params?.fromDate) qs.set('fromDate', params.fromDate);
    if (params?.toDate) qs.set('toDate', params.toDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch(`/api/reports/summary${suffix}`);
  },
};
