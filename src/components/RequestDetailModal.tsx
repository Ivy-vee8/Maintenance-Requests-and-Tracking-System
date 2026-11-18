import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, FileText, MapPin, User, Wrench, X, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import type {
  Assignment,
  MaintenanceRequest,
  RequestPriority,
  StatusHistoryEntry,
  UserProfile,
} from '../types/mrtmis';
import { formatDateTime } from '../utils/format';
import { VALID_PRIORITIES } from '../utils/validation';
import { ConfirmDialog } from './ConfirmDialog';
import {
  BTN_ACCENT_CLS,
  BTN_DANGER_CLS,
  BTN_PRIMARY_CLS,
  BTN_SECONDARY_CLS,
  INPUT_CLS,
  SelectControl,
} from './FormControls';
import { PriorityIndicator, StatusIndicator } from './StatusBadge';

interface RequestDetailModalProps {
  request: MaintenanceRequest | null;
  maintenanceStaff?: UserProfile[];
  onClose: () => void;
  onUpdated?: () => void;
}

export function RequestDetailModal({
  request,
  maintenanceStaff = [],
  onClose,
  onUpdated,
}: RequestDetailModalProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Admin Assign state
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('Medium');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [submittingPriority, setSubmittingPriority] = useState(false);

  // Admin Reject state
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [submittingReject, setSubmittingReject] = useState(false);

  // Maintenance Update state
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [progressComment, setProgressComment] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Requester Edit Pending state
  const [isEditingPending, setIsEditingPending] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<RequestPriority>('Medium');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    if (!request) return;
    setAssigneeId(request.assignedTo || '');
    setPriority(request.priority);
    setAssignmentNotes('');
    setShowRejectBox(false);
    setRejectionReason('');
    setResolutionNotes(request.resolutionNotes || '');
    setProgressComment('');
    setIsEditingPending(false);
    setEditTitle(request.title);
    setEditLocation(request.location);
    setEditDescription(request.description);
    setEditPriority(request.priority);

    let active = true;
    setHistoryLoading(true);
    apiClient
      .getRequestHistory(request.requestId)
      .then((res) => {
        if (!active) return;
        setHistory(res.history);
        setAssignments(res.assignments);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmRejectOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, confirmRejectOpen, onClose]);

  if (!request || !profile) return null;

  const isAdmin = profile.role === 'admin';
  const isAssignedTech = profile.role === 'maintenance' && request.assignedTo === profile.userId;
  const isOwnerPending = request.submittedBy === profile.userId && request.status === 'Pending';
  const isTerminal = request.status === 'Resolved' || request.status === 'Rejected';

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId) {
      showToast('error', 'Please select a maintenance personnel member.');
      return;
    }
    setSubmittingAssign(true);
    try {
      await apiClient.assignRequest(request.requestId, {
        assignedTo: assigneeId,
        priority,
        assignmentNotes,
      });
      showToast('success', `Request ${request.requestId} assigned successfully.`);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to assign request.');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUpdatePriority = async () => {
    if (priority === request.priority) return;
    setSubmittingPriority(true);
    try {
      await apiClient.updateRequest(request.requestId, { priority });
      showToast('success', `Priority updated to ${priority}.`);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update priority.');
    } finally {
      setSubmittingPriority(false);
    }
  };

  const handleRejectConfirm = async () => {
    setSubmittingReject(true);
    try {
      await apiClient.rejectRequest(request.requestId, rejectionReason);
      showToast('success', `Request ${request.requestId} has been rejected.`);
      setConfirmRejectOpen(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to reject request.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleStatusChange = async (nextStatus: 'In Progress' | 'Resolved') => {
    setSubmittingStatus(true);
    try {
      await apiClient.updateRequestStatus(request.requestId, {
        status: nextStatus,
        resolutionNotes,
        comments: progressComment,
      });
      showToast('success', `Request updated to ${nextStatus}.`);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update task status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleEditPending = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      await apiClient.updateRequest(request.requestId, {
        title: editTitle,
        location: editLocation,
        description: editDescription,
        priority: editPriority,
      });
      showToast('success', 'Request details updated.');
      setIsEditingPending(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update request.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-modal-title"
        onClick={onClose}
      >
        <div
          className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-800 tabular-nums">{request.requestId}</span>
                <span aria-hidden="true">·</span>
                <span>{request.categoryName}</span>
                <span aria-hidden="true">·</span>
                <PriorityIndicator priority={request.priority} />
                <span aria-hidden="true">·</span>
                <StatusIndicator status={request.status} />
              </div>
              <h2 id="req-modal-title" className="mt-1.5 text-lg font-display font-semibold text-slate-900">
                {request.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/30"
              aria-label="Close request details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-slate-200 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Submitted By
                </p>
                <p className="mt-1 font-medium text-slate-900">{request.submittedByName}</p>
                <p className="text-xs text-slate-500">{request.submittedByDepartment}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Location
                </p>
                <p className="mt-1 font-medium text-slate-900">{request.location}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Assigned Personnel
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {request.assignedToName || <span className="text-slate-400 font-normal">Unassigned</span>}
                </p>
                {request.assignedAt && (
                  <p className="text-xs text-slate-500 tabular-nums">{formatDateTime(request.assignedAt)}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" /> Submitted On
                </p>
                <p className="mt-1 font-medium text-slate-900 tabular-nums">{formatDateTime(request.createdAt)}</p>
                <p className="text-xs text-slate-500 tabular-nums">Updated {formatDateTime(request.updatedAt)}</p>
              </div>
            </div>

            {/* Description & Optional Attachment */}
            {!isEditingPending ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-600">
                    Problem Description
                  </h3>
                  <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-md p-4">
                    {request.description}
                  </p>
                </div>

                {request.attachmentUrl && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-600 mb-2">
                      Attached Image
                    </h3>
                    <img
                      src={request.attachmentUrl}
                      alt={`Attachment for ${request.requestId}`}
                      referrerPolicy="no-referrer"
                      className="max-h-64 rounded-md border border-slate-200 object-contain bg-slate-50"
                    />
                  </div>
                )}

                {request.resolutionNotes && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                    <h3 className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> Resolution Details
                    </h3>
                    <p className="mt-1.5 text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">
                      {request.resolutionNotes}
                    </p>
                  </div>
                )}

                {request.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <h3 className="text-xs font-semibold text-red-900 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> Rejection Reason
                    </h3>
                    <p className="mt-1.5 text-sm text-red-900 whitespace-pre-wrap leading-relaxed">
                      {request.rejectionReason}
                    </p>
                  </div>
                )}

                {isOwnerPending && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsEditingPending(true)}
                      className={BTN_SECONDARY_CLS}
                    >
                      Edit Pending Request
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleEditPending} className="space-y-4 bg-slate-50 rounded-md p-5">
                <h3 className="font-display text-sm font-semibold text-slate-900">Edit Pending Request</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Title</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location</label>
                    <input
                      type="text"
                      required
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority</label>
                  <SelectControl
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as RequestPriority)}
                    wrapperClassName="w-full sm:w-48"
                  >
                    {VALID_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </SelectControl>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    required
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className={BTN_PRIMARY_CLS}
                  >
                    {submittingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPending(false)}
                    className={BTN_SECONDARY_CLS}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Admin Assignment & Rejection Controls */}
            {isAdmin && !isTerminal && (
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Administrator Dispatch &amp; Review
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowRejectBox((v) => !v)}
                    className="text-xs font-medium text-red-700 hover:text-red-800 hover:underline whitespace-nowrap"
                  >
                    {showRejectBox ? 'Back to Assignment' : 'Reject Request'}
                  </button>
                </div>

                {showRejectBox ? (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
                    <label className="block text-xs font-semibold text-red-900">
                      Rejection Reason (required)
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this maintenance request is being rejected..."
                      className="w-full px-3 py-2 text-sm border border-red-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/25"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={rejectionReason.trim().length < 5}
                        onClick={() => setConfirmRejectOpen(true)}
                        className={BTN_DANGER_CLS}
                      >
                        Reject Maintenance Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAssign} className="bg-slate-50 rounded-md p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Assign Maintenance Personnel
                        </label>
                        <SelectControl
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                          required
                        >
                          <option value="">Select technician...</option>
                          {maintenanceStaff.map((tech) => (
                            <option key={tech.userId} value={tech.userId}>
                              {tech.fullName} ({tech.department})
                            </option>
                          ))}
                        </SelectControl>
                        {maintenanceStaff.length === 0 && (
                          <p className="mt-1.5 text-xs text-amber-700">
                            No maintenance personnel found. Promote a user to Maintenance Personnel in User Management.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Priority Level
                        </label>
                        <SelectControl
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

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Assignment Notes / Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={assignmentNotes}
                        onChange={(e) => setAssignmentNotes(e.target.value)}
                        placeholder="Optional diagnostic notes or access instructions for the technician..."
                        className={INPUT_CLS}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                      {priority !== request.priority && (
                        <button
                          type="button"
                          disabled={submittingPriority || submittingAssign}
                          onClick={handleUpdatePriority}
                          className={BTN_SECONDARY_CLS}
                        >
                          {submittingPriority ? 'Updating Priority...' : 'Save Priority Only'}
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={submittingAssign || submittingPriority || !assigneeId}
                        className={BTN_ACCENT_CLS}
                      >
                        {submittingAssign ? 'Assigning...' : request.assignedTo ? 'Reassign Task' : 'Assign Request'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Maintenance Personnel Task Actions */}
            {(isAssignedTech || (isAdmin && request.assignedTo)) && !isTerminal && (
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Maintenance Task Progress
                </h3>
                <div className="bg-slate-50 rounded-md p-5 space-y-4">
                  {request.status === 'Assigned' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Initial Inspection / Start Note (optional)
                        </label>
                        <input
                          type="text"
                          value={progressComment}
                          onChange={(e) => setProgressComment(e.target.value)}
                          placeholder="e.g., Accepted task, heading to location to inspect."
                          className={INPUT_CLS}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={submittingStatus}
                        onClick={() => handleStatusChange('In Progress')}
                        className={BTN_ACCENT_CLS}
                      >
                        {submittingStatus ? 'Updating...' : 'Accept & Start Work'}
                      </button>
                    </div>
                  )}

                  {request.status === 'In Progress' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Resolution / Work Summary Notes (required to mark Resolved)
                        </label>
                        <textarea
                          rows={3}
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Document parts replaced, repairs performed, or ongoing progress..."
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Status Log Comment (optional)
                        </label>
                        <input
                          type="text"
                          value={progressComment}
                          onChange={(e) => setProgressComment(e.target.value)}
                          placeholder="Brief progress note for audit trail..."
                          className={INPUT_CLS}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          disabled={submittingStatus}
                          onClick={() => handleStatusChange('In Progress')}
                          className={BTN_SECONDARY_CLS}
                        >
                          Save Progress Update
                        </button>
                        <button
                          type="button"
                          disabled={submittingStatus || resolutionNotes.trim().length < 5}
                          onClick={() => handleStatusChange('Resolved')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                        >
                          {submittingStatus ? 'Completing...' : 'Mark as Resolved'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignment Notes & Status History Audit Trail */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" aria-hidden="true" />
                Status History &amp; Audit Trail
              </h3>

              {assignments.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-md p-3.5 text-xs text-blue-950 space-y-1">
                  <p className="font-semibold">Latest Assignment Record</p>
                  <p>
                    Assigned to <strong>{assignments[0].assignedToName}</strong> by{' '}
                    <strong>{assignments[0].assignedByName}</strong> on{' '}
                    <span className="tabular-nums">{formatDateTime(assignments[0].assignedAt)}</span>
                  </p>
                  {assignments[0].assignmentNotes && (
                    <p className="text-blue-900">Instructions: {assignments[0].assignmentNotes}</p>
                  )}
                </div>
              )}

              {historyLoading ? (
                <div className="text-xs text-slate-500 py-2">Loading status history...</div>
              ) : history.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">No status history entries recorded yet.</div>
              ) : (
                <div className="border border-slate-200 rounded-md divide-y divide-slate-200">
                  {history.map((entry) => (
                    <div key={entry.historyId} className="p-3.5 text-sm flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-800">
                          <span className="text-slate-500">{entry.previousStatus}</span>
                          <span aria-hidden="true">→</span>
                          <StatusIndicator status={entry.newStatus} />
                          <span className="text-slate-500">by {entry.changedByName}</span>
                        </div>
                        {entry.comments && (
                          <p className="text-xs text-slate-600 leading-relaxed">{entry.comments}</p>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 tabular-nums shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatDateTime(entry.changedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRejectOpen}
        title="Reject Maintenance Request?"
        description={`Are you sure you want to reject request ${request.requestId}? This will mark the request as Rejected and notify the requester in the audit trail.`}
        confirmLabel="Yes, Reject Request"
        variant="danger"
        loading={submittingReject}
        onConfirm={handleRejectConfirm}
        onCancel={() => setConfirmRejectOpen(false)}
      />
    </>
  );
}
