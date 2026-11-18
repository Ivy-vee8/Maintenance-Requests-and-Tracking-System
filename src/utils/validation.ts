export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  USER_ID_MAX: 128,
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 100,
  EMAIL_MIN: 3,
  EMAIL_MAX: 150,
  DEPARTMENT_MIN: 2,
  DEPARTMENT_MAX: 100,
  CATEGORY_ID_MIN: 2,
  CATEGORY_ID_MAX: 64,
  CATEGORY_NAME_MIN: 2,
  CATEGORY_NAME_MAX: 80,
  CATEGORY_DESC_MAX: 300,
  REQUEST_ID_MIN: 4,
  REQUEST_ID_MAX: 64,
  TITLE_MIN: 3,
  TITLE_MAX: 150,
  DESCRIPTION_MIN: 5,
  DESCRIPTION_MAX: 2000,
  LOCATION_MIN: 2,
  LOCATION_MAX: 120,
  NOTES_MAX: 2000,
  COMMENT_MAX: 1000,
  ATTACHMENT_URL_MAX: 500,
} as const;

export const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const VALID_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'] as const;
export const VALID_ROLES = ['admin', 'staff', 'maintenance'] as const;

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function isValidEntityId(id: string, min = 1, max = 128): boolean {
  return typeof id === 'string' && id.length >= min && id.length <= max && BLUEPRINT_LIMITS.ID_PATTERN.test(id);
}

export function validateProfileInput(input: { fullName: string; department: string }): string | null {
  const fullName = sanitizeText(input.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX);
  const department = sanitizeText(input.department, BLUEPRINT_LIMITS.DEPARTMENT_MAX);

  if (fullName.length < BLUEPRINT_LIMITS.FULL_NAME_MIN) {
    return `Full name must be at least ${BLUEPRINT_LIMITS.FULL_NAME_MIN} characters.`;
  }
  if (department.length < BLUEPRINT_LIMITS.DEPARTMENT_MIN) {
    return `Department must be at least ${BLUEPRINT_LIMITS.DEPARTMENT_MIN} characters.`;
  }
  return null;
}

export function validateRequestInput(input: {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  priority: string;
}): string | null {
  const title = sanitizeText(input.title, BLUEPRINT_LIMITS.TITLE_MAX);
  const description = sanitizeText(input.description, BLUEPRINT_LIMITS.DESCRIPTION_MAX);
  const location = sanitizeText(input.location, BLUEPRINT_LIMITS.LOCATION_MAX);

  if (title.length < BLUEPRINT_LIMITS.TITLE_MIN) {
    return `Request title must be at least ${BLUEPRINT_LIMITS.TITLE_MIN} characters.`;
  }
  if (description.length < BLUEPRINT_LIMITS.DESCRIPTION_MIN) {
    return `Detailed description must be at least ${BLUEPRINT_LIMITS.DESCRIPTION_MIN} characters.`;
  }
  if (!isValidEntityId(input.categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MIN, BLUEPRINT_LIMITS.CATEGORY_ID_MAX)) {
    return 'Please select a valid maintenance category.';
  }
  if (location.length < BLUEPRINT_LIMITS.LOCATION_MIN) {
    return `Location or department must be at least ${BLUEPRINT_LIMITS.LOCATION_MIN} characters.`;
  }
  if (!VALID_PRIORITIES.includes(input.priority as (typeof VALID_PRIORITIES)[number])) {
    return 'Please select a valid priority level.';
  }
  return null;
}

export function validateCategoryInput(input: { name: string; description: string }): string | null {
  const name = sanitizeText(input.name, BLUEPRINT_LIMITS.CATEGORY_NAME_MAX);
  if (name.length < BLUEPRINT_LIMITS.CATEGORY_NAME_MIN) {
    return `Category name must be at least ${BLUEPRINT_LIMITS.CATEGORY_NAME_MIN} characters.`;
  }
  return null;
}
