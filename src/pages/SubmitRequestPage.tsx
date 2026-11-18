import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Upload, User, X } from 'lucide-react';
import {
  BTN_PRIMARY_CLS,
  BTN_SECONDARY_CLS,
  INPUT_CLS,
  SelectControl,
} from '../components/FormControls';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCategories } from '../hooks/useMrtmisData';
import { apiClient } from '../services/apiClient';
import type { RequestPriority } from '../types/mrtmis';
import { VALID_PRIORITIES, validateRequestInput } from '../utils/validation';

export function SubmitRequestPage() {
  const { profile } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('Medium');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activeCategories = categories.filter((c) => c.isActive);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMsg('Only PNG, JPEG, or WebP images are supported.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image attachment must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateRequestInput({
      title,
      description,
      categoryId,
      location,
      priority,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    try {
      let attachmentUrl = '';
      if (imagePreview) {
        const uploadRes = await apiClient.uploadImage(imagePreview);
        attachmentUrl = uploadRes.attachmentUrl;
      }

      const res = await apiClient.createRequest({
        title,
        description,
        categoryId,
        location,
        priority,
        attachmentUrl,
      });

      showToast('success', `Maintenance request ${res.request.requestId} submitted.`);
      navigate('/requests');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit maintenance request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">
          New Maintenance Request
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Report a facility, equipment, or infrastructure issue for dispatch and tracking.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Requester Context Strip */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Submitted by</span>
            <span className="font-semibold text-slate-900">{profile.fullName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Department</span>
            <span className="font-semibold text-slate-900">{profile.department}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!catsLoading && activeCategories.length === 0 && (
            <div className="p-3.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
              No active maintenance categories are configured yet. An Administrator must sign in to initialize default categories.
            </div>
          )}

          {/* Section 1: Issue Summary & Classification */}
          <div className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              01. Issue Summary &amp; Classification
            </h3>

            <div>
              <label htmlFor="req-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Request Title <span className="text-red-600">*</span>
              </label>
              <input
                id="req-title"
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Leaking sink pipe in Science Block Ground Floor Restroom"
                className={INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="req-cat" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Maintenance Category <span className="text-red-600">*</span>
                </label>
                <SelectControl
                  id="req-cat"
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select category...</option>
                  {activeCategories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </option>
                  ))}
                </SelectControl>
              </div>

              <div>
                <label htmlFor="req-location" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location / Room <span className="text-red-600">*</span>
                </label>
                <input
                  id="req-location"
                  type="text"
                  required
                  maxLength={120}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Admin Wing · Room 204"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label htmlFor="req-priority" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority Level <span className="text-red-600">*</span>
                </label>
                <SelectControl
                  id="req-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RequestPriority)}
                >
                  {VALID_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectControl>
              </div>
            </div>
          </div>

          {/* Section 2: Description & Evidence */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              02. Description &amp; Visual Evidence
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="req-desc" className="block text-xs font-semibold text-slate-700">
                  Detailed Description <span className="text-red-600">*</span>
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {description.length} / 2000
                </span>
              </div>
              <textarea
                id="req-desc"
                rows={4}
                required
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail, when it started, any safety concerns, and exact equipment or asset labels..."
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Image Attachment (Optional, PNG / JPEG / WebP up to 2 MB)
              </label>
              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-md p-6 cursor-pointer bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400 mb-1.5" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-700">Click to attach a photo of the issue</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Helps maintenance personnel inspect before dispatch</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative inline-block border border-slate-200 rounded-md p-2 bg-slate-50">
                  <img
                    src={imagePreview}
                    alt="Attachment preview"
                    className="max-h-48 rounded object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview('')}
                    aria-label="Remove attached image"
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-slate-900 text-white hover:bg-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-5 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/requests')}
              className={BTN_SECONDARY_CLS}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || activeCategories.length === 0}
              className={BTN_PRIMARY_CLS}
            >
              {submitting ? 'Submitting Request...' : 'Submit Maintenance Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
