import type { RequestPriority, RequestStatus, UserRole } from '../src/types/mrtmis.ts';
import {
  BLUEPRINT_LIMITS,
  isValidEntityId,
  sanitizeText,
  VALID_PRIORITIES,
  VALID_ROLES,
  VALID_STATUSES,
} from '../src/utils/validation.ts';

export { BLUEPRINT_LIMITS, isValidEntityId, sanitizeText, VALID_PRIORITIES, VALID_ROLES, VALID_STATUSES };

export function validateCreateRequestPayload(body: Record<string, unknown>): {
  error?: string;
  data?: {
    title: string;
    description: string;
    categoryId: string;
    location: string;
    priority: RequestPriority;
    attachmentUrl: string;
  };
} {
  const title = sanitizeText(body.title, BLUEPRINT_LIMITS.TITLE_MAX);
  const description = sanitizeText(body.description, BLUEPRINT_LIMITS.DESCRIPTION_MAX);
  const categoryId = sanitizeText(body.categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MAX);
  const location = sanitizeText(body.location, BLUEPRINT_LIMITS.LOCATION_MAX);
  const priority = sanitizeText(body.priority, 20) as RequestPriority;
  const attachmentUrl = sanitizeText(body.attachmentUrl, BLUEPRINT_LIMITS.ATTACHMENT_URL_MAX);

  if (title.length < BLUEPRINT_LIMITS.TITLE_MIN) {
    return { error: `Title must be at least ${BLUEPRINT_LIMITS.TITLE_MIN} characters.` };
  }
  if (description.length < BLUEPRINT_LIMITS.DESCRIPTION_MIN) {
    return { error: `Description must be at least ${BLUEPRINT_LIMITS.DESCRIPTION_MIN} characters.` };
  }
  if (!isValidEntityId(categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MIN, BLUEPRINT_LIMITS.CATEGORY_ID_MAX)) {
    return { error: 'Invalid categoryId format.' };
  }
  if (location.length < BLUEPRINT_LIMITS.LOCATION_MIN) {
    return { error: `Location must be at least ${BLUEPRINT_LIMITS.LOCATION_MIN} characters.` };
  }
  if (!VALID_PRIORITIES.includes(priority)) {
    return { error: 'Priority must be Low, Medium, High, or Critical.' };
  }
  if (attachmentUrl && !attachmentUrl.startsWith('/api/uploads/')) {
    return { error: 'Invalid attachment URL.' };
  }

  return {
    data: { title, description, categoryId, location, priority, attachmentUrl },
  };
}

export function canTransitionStatus(
  role: UserRole,
  currentStatus: RequestStatus,
  nextStatus: RequestStatus
): { allowed: boolean; reason?: string } {
  if (role === 'admin') {
    return { allowed: true };
  }
  if (role === 'maintenance') {
    if (currentStatus === 'Resolved' || currentStatus === 'Rejected') {
      return { allowed: false, reason: 'Completed or rejected requests cannot be modified by maintenance personnel.' };
    }
    if (currentStatus === 'Assigned' && nextStatus === 'In Progress') {
      return { allowed: true };
    }
    if (currentStatus === 'In Progress' && (nextStatus === 'In Progress' || nextStatus === 'Resolved')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Invalid workflow transition from ${currentStatus} to ${nextStatus}. Assigned tasks must be started (In Progress) before being marked Resolved.`,
    };
  }
  return { allowed: false, reason: 'Insufficient permissions to change request status.' };
}

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}
