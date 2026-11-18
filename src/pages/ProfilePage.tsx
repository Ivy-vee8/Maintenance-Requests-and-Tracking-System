import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { BTN_PRIMARY_CLS, INPUT_CLS } from '../components/FormControls';
import { ActiveStatusIndicator, RoleLabel } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import { formatDateTime } from '../utils/format';
import { validateProfileInput } from '../utils/validation';

export function ProfilePage() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setDepartment(profile.department);
    }
  }, [profile]);

  if (!profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateProfileInput({ fullName, department });
    if (err) {
      showToast('error', err);
      return;
    }

    setSaving(true);
    try {
      await apiClient.updateUser(profile.userId, { fullName, department });
      showToast('success', 'Profile updated successfully.');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">Account Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your display name and departmental affiliation.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-6 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">Email Address</p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-900">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Assigned Role</p>
            <p className="mt-1 font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0" aria-hidden="true" />
              <RoleLabel role={profile.role} />
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Account Status</p>
            <div className="mt-1">
              <ActiveStatusIndicator active={profile.accountStatus === 'active'} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Member Since</p>
            <p className="mt-1 text-xs text-slate-700 tabular-nums">{formatDateTime(profile.createdAt)}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="prof-dept" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Department / Unit
            </label>
            <input
              id="prof-dept"
              type="text"
              required
              maxLength={100}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={BTN_PRIMARY_CLS}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
