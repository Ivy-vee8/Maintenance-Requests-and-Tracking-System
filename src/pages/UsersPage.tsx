import { useMemo, useState } from 'react';
import { Check, Pencil, Search, Shield, Users as UsersIcon, X } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { INPUT_CLS, SelectControl } from '../components/FormControls';
import { ActiveStatusIndicator, RoleLabel } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAdminUsers } from '../hooks/useMrtmisData';
import { apiClient } from '../services/apiClient';
import type { AccountStatus, UserProfile, UserRole } from '../types/mrtmis';
import { formatDateShort } from '../utils/format';
import { validateProfileInput } from '../utils/validation';

export function UsersPage() {
  const { profile } = useAuth();
  const { users, loading } = useAdminUsers();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<{
    user: UserProfile;
    role?: UserRole;
    accountStatus?: AccountStatus;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [savingProfileEdit, setSavingProfileEdit] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (q) {
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const startEditUser = (u: UserProfile) => {
    setEditingUserId(u.userId);
    setEditFullName(u.fullName);
    setEditDepartment(u.department);
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditFullName('');
    setEditDepartment('');
  };

  const saveEditUser = async (userId: string) => {
    const err = validateProfileInput({ fullName: editFullName, department: editDepartment });
    if (err) {
      showToast('error', err);
      return;
    }
    setSavingProfileEdit(true);
    try {
      await apiClient.updateUser(userId, {
        fullName: editFullName,
        department: editDepartment,
      });
      showToast('success', 'User details updated.');
      cancelEditUser();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update user details.');
    } finally {
      setSavingProfileEdit(false);
    }
  };

  const executeUpdate = async () => {
    if (!pendingUpdate) return;
    setSaving(true);
    try {
      await apiClient.updateUser(pendingUpdate.user.userId, {
        ...(pendingUpdate.role ? { role: pendingUpdate.role } : {}),
        ...(pendingUpdate.accountStatus ? { accountStatus: pendingUpdate.accountStatus } : {}),
      });
      showToast('success', `Updated ${pendingUpdate.user.fullName}'s account.`);
      setPendingUpdate(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">User &amp; Role Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Assign Maintenance Personnel or Administrator roles, update departments, and manage account status. Users register via the sign-in portal and cannot self-assign privileged roles.
          </p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
          {filtered.length} of {users.length} accounts
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or department..."
            aria-label="Search users"
            className={`${INPUT_CLS} pl-9`}
          />
        </div>
        <SelectControl
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter users by role"
          wrapperClassName="sm:w-56"
        >
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="maintenance">Maintenance Personnel</option>
          <option value="staff">Staff / Requester</option>
        </SelectControl>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-3.5 w-36 bg-slate-200 rounded" />
                <div className="h-3.5 flex-1 bg-slate-200 rounded" />
                <div className="h-6 w-24 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <UsersIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-700">No matching users found.</p>
            <p className="text-xs text-slate-500">Adjust the search query or role filter to view other accounts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Registered</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((u) => {
                  const isSelf = u.userId === profile.userId;
                  const isEditing = editingUserId === u.userId;
                  return (
                    <tr key={u.userId} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={100}
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            aria-label={`Edit name for ${u.fullName}`}
                            className="w-full min-w-[150px] px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {u.role === 'admin' && (
                              <Shield className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-label="Administrator" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono whitespace-nowrap">{u.email}</td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={100}
                            value={editDepartment}
                            onChange={(e) => setEditDepartment(e.target.value)}
                            aria-label={`Edit department for ${u.fullName}`}
                            className="w-full min-w-[140px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
                          />
                        ) : (
                          u.department
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SelectControl
                          compact
                          aria-label={`Change role for ${u.fullName}`}
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) =>
                            setPendingUpdate({ user: u, role: e.target.value as UserRole })
                          }
                          wrapperClassName="w-44"
                        >
                          <option value="staff">Staff / Requester</option>
                          <option value="maintenance">Maintenance Personnel</option>
                          <option value="admin">Administrator</option>
                        </SelectControl>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ActiveStatusIndicator active={u.accountStatus === 'active'} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateShort(u.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingProfileEdit}
                                onClick={() => saveEditUser(u.userId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-md transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{savingProfileEdit ? 'Saving...' : 'Save'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditUser}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Pencil className="w-3 h-3" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          )}
                          {!isSelf && !isEditing ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingUpdate({
                                  user: u,
                                  accountStatus: u.accountStatus === 'active' ? 'inactive' : 'active',
                                })
                              }
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                u.accountStatus === 'active'
                                  ? 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100'
                                  : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {u.accountStatus === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          ) : isSelf && !isEditing ? (
                            <span className="text-xs text-slate-400 pl-1">
                              <RoleLabel role={u.role} /> (You)
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingUpdate)}
        title="Confirm Account Update"
        description={
          pendingUpdate?.role
            ? `Change ${pendingUpdate.user.fullName}'s system role to "${pendingUpdate.role}"? This immediately updates their access permissions.`
            : `${pendingUpdate?.accountStatus === 'inactive' ? 'Deactivate' : 'Activate'} ${pendingUpdate?.user.fullName}'s account?`
        }
        confirmLabel="Confirm Update"
        variant={pendingUpdate?.accountStatus === 'inactive' ? 'danger' : 'primary'}
        loading={saving}
        onConfirm={executeUpdate}
        onCancel={() => setPendingUpdate(null)}
      />
    </div>
  );
}
