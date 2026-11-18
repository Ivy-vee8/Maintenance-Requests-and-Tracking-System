import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
} from '../../src/types/mrtmis.ts';
import { DEFAULT_CATEGORIES } from '../../src/types/mrtmis.ts';
import {
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  INITIAL_ADMIN_EMAIL,
  requireAuth,
  type AuthenticatedRequest,
} from '../authMiddleware.ts';
import {
  commitWrites,
  FirestoreRestError,
  getDoc,
  listCollection,
  runFieldQuery,
  type BatchWriteOp,
} from '../firestoreRest.ts';
import {
  BLUEPRINT_LIMITS,
  canTransitionStatus,
  isValidEntityId,
  isValidRole,
  sanitizeText,
  VALID_PRIORITIES,
  validateCreateRequestPayload,
} from '../validation.ts';

export const apiRouter = express.Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function makeShortCode(len = 4): string {
  return crypto.randomBytes(len).toString('hex').toUpperCase().slice(0, len);
}

function makeDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function handleApiError(res: express.Response, error: unknown): void {
  if (error instanceof FirestoreRestError) {
    console.error(`[MRTMIS API] Firestore error (${error.status}): ${error.message}`);
    const status = error.status === 403 ? 403 : error.status === 404 ? 404 : error.status >= 400 && error.status < 500 ? 400 : 500;
    res.status(status).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error(`[MRTMIS API] Error: ${message}`);
  res.status(500).json({ error: message });
}

async function getCallerProfile(req: AuthenticatedRequest): Promise<UserProfile | null> {
  if (!req.authUser || !req.idToken) return null;
  return getDoc<UserProfile>(req.idToken, 'users', req.authUser.uid);
}

function isCallerAdmin(req: AuthenticatedRequest, profile: UserProfile | null): boolean {
  if (!req.authUser) return false;
  if (req.authUser.email.toLowerCase() === INITIAL_ADMIN_EMAIL && req.authUser.emailVerified) {
    return true;
  }
  return profile?.role === 'admin' && profile?.accountStatus === 'active';
}

// 1. Health Check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mrtmis-api',
    configReady: Boolean(FIREBASE_PROJECT_ID && FIRESTORE_DATABASE_ID),
    timestamp: new Date().toISOString(),
  });
});

// 2. Attachment Upload & Retrieval
apiRouter.post('/uploads', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { dataUrl } = (req.body || {}) as { dataUrl?: unknown };
    if (typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Image dataUrl is required.' });
      return;
    }

    const match = /^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPEG, and WebP images are supported.' });
      return;
    }

    const mime = match[1];
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const buffer = Buffer.from(match[3], 'base64');

    if (buffer.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must not exceed 2 MB.' });
      return;
    }

    const filename = `att_${makeDateStamp()}_${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

    res.status(201).json({ attachmentUrl: `/api/uploads/${filename}` });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!/^att_[0-9]{8}_[a-f0-9-]+\.(png|jpg|webp)$/.test(filename)) {
    res.status(400).json({ error: 'Invalid attachment filename.' });
    return;
  }
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Attachment not found.' });
    return;
  }
  res.sendFile(fullPath);
});

// 3. Auth Profile Registration & First-Admin Bootstrap
apiRouter.post('/auth/register-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const idToken = req.idToken!;
    const body = (req.body || {}) as { fullName?: unknown; department?: unknown };

    const existing = await getDoc<UserProfile>(idToken, 'users', authUser.uid);
    if (existing) {
      res.json({ user: existing, created: false });
      return;
    }

    const fullName = sanitizeText(body.fullName || authUser.name || authUser.email.split('@')[0], BLUEPRINT_LIMITS.FULL_NAME_MAX);
    const department = sanitizeText(body.department || 'General Operations', BLUEPRINT_LIMITS.DEPARTMENT_MAX);

    if (fullName.length < BLUEPRINT_LIMITS.FULL_NAME_MIN) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (department.length < BLUEPRINT_LIMITS.DEPARTMENT_MIN) {
      res.status(400).json({ error: 'Department must be at least 2 characters.' });
      return;
    }

    const isBootstrapEmail = authUser.email.toLowerCase() === INITIAL_ADMIN_EMAIL && authUser.emailVerified;
    const assignedRole: UserRole = isBootstrapEmail ? 'admin' : 'staff';

    const ops: BatchWriteOp[] = [
      {
        type: 'create',
        collection: 'users',
        docId: authUser.uid,
        fields: {
          userId: authUser.uid,
          fullName,
          email: authUser.email,
          role: assignedRole,
          department,
          accountStatus: 'active',
        },
        serverTimestamps: ['createdAt', 'updatedAt'],
      },
    ];

    if (isBootstrapEmail) {
      const existingAdminMarker = await getDoc(idToken, 'admins', authUser.uid);
      if (!existingAdminMarker) {
        ops.push({
          type: 'create',
          collection: 'admins',
          docId: authUser.uid,
          fields: {
            userId: authUser.uid,
            grantedBy: authUser.uid,
          },
          serverTimestamps: ['createdAt'],
        });
      }

      const bootstrapDoc = await getDoc(idToken, 'system_config', 'bootstrap');
      if (!bootstrapDoc) {
        ops.push({
          type: 'create',
          collection: 'system_config',
          docId: 'bootstrap',
          fields: {
            initialized: true,
            adminUserId: authUser.uid,
          },
          serverTimestamps: ['createdAt'],
        });
      }

      const catChecks = await Promise.all(
        DEFAULT_CATEGORIES.map((cat) => getDoc<Category>(idToken, 'categories', cat.categoryId))
      );
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i += 1) {
        if (!catChecks[i]) {
          const cat = DEFAULT_CATEGORIES[i];
          ops.push({
            type: 'create',
            collection: 'categories',
            docId: cat.categoryId,
            fields: {
              categoryId: cat.categoryId,
              name: cat.name,
              description: cat.description,
              isActive: true,
            },
            serverTimestamps: ['createdAt', 'updatedAt'],
          });
        }
      }
    }

    await commitWrites(idToken, ops);
    const createdUser = await getDoc<UserProfile>(idToken, 'users', authUser.uid);
    res.status(201).json({ user: createdUser, created: true });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/auth/initialize-admin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.authUser!;
    const idToken = req.idToken!;
    const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET || '';
    const suppliedSecret = sanitizeText((req.body || {}).secret, 128);

    if (configuredSecret && suppliedSecret !== configuredSecret) {
      res.status(403).json({ error: 'Invalid administrator bootstrap secret.' });
      return;
    }

    if (authUser.email.toLowerCase() !== INITIAL_ADMIN_EMAIL) {
      res.status(403).json({
        error: `Only the designated initial administrator (${INITIAL_ADMIN_EMAIL}) can initialize the first administrator account.`,
      });
      return;
    }

    const bootstrapDoc = await getDoc<{ initialized: boolean }>(idToken, 'system_config', 'bootstrap');
    const ops: BatchWriteOp[] = [];
    const existingUser = await getDoc<UserProfile>(idToken, 'users', authUser.uid);

    if (!existingUser) {
      ops.push({
        type: 'create',
        collection: 'users',
        docId: authUser.uid,
        fields: {
          userId: authUser.uid,
          fullName: sanitizeText(authUser.name || 'System Administrator', BLUEPRINT_LIMITS.FULL_NAME_MAX),
          email: authUser.email,
          role: 'admin',
          department: 'Administration',
          accountStatus: 'active',
        },
        serverTimestamps: ['createdAt', 'updatedAt'],
      });
    } else if (existingUser.role !== 'admin') {
      ops.push({
        type: 'update',
        collection: 'users',
        docId: authUser.uid,
        fields: { role: 'admin', accountStatus: 'active' },
        updateMaskFields: ['role', 'accountStatus'],
        serverTimestamps: ['updatedAt'],
      });
    }

    const adminMarker = await getDoc(idToken, 'admins', authUser.uid);
    if (!adminMarker) {
      ops.push({
        type: 'create',
        collection: 'admins',
        docId: authUser.uid,
        fields: { userId: authUser.uid, grantedBy: authUser.uid },
        serverTimestamps: ['createdAt'],
      });
    }

    if (!bootstrapDoc) {
      ops.push({
        type: 'create',
        collection: 'system_config',
        docId: 'bootstrap',
        fields: { initialized: true, adminUserId: authUser.uid },
        serverTimestamps: ['createdAt'],
      });
    }

    const catChecks = await Promise.all(
      DEFAULT_CATEGORIES.map((cat) => getDoc<Category>(idToken, 'categories', cat.categoryId))
    );
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i += 1) {
      if (!catChecks[i]) {
        const cat = DEFAULT_CATEGORIES[i];
        ops.push({
          type: 'create',
          collection: 'categories',
          docId: cat.categoryId,
          fields: {
            categoryId: cat.categoryId,
            name: cat.name,
            description: cat.description,
            isActive: true,
          },
          serverTimestamps: ['createdAt', 'updatedAt'],
        });
      }
    }

    if (ops.length > 0) {
      await commitWrites(idToken, ops);
    }
    const updatedUser = await getDoc<UserProfile>(idToken, 'users', authUser.uid);
    res.json({ initialized: true, user: updatedUser });
  } catch (error) {
    handleApiError(res, error);
  }
});

// 4. User Management
apiRouter.get('/users', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Administrator privileges are required to list users.' });
      return;
    }

    let users = await listCollection<UserProfile>(idToken, 'users');
    const roleFilter = sanitizeText(req.query.role, 20);
    const statusFilter = sanitizeText(req.query.accountStatus, 20);

    if (roleFilter && isValidRole(roleFilter)) {
      users = users.filter((u) => u.role === roleFilter);
    }
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      users = users.filter((u) => u.accountStatus === statusFilter);
    }

    users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ users });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.patch('/users/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = sanitizeText(req.params.userId, BLUEPRINT_LIMITS.USER_ID_MAX);
    if (!isValidEntityId(userId)) {
      res.status(400).json({ error: 'Invalid userId.' });
      return;
    }

    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    const admin = isCallerAdmin(req, caller);

    if (!admin && req.authUser!.uid !== userId) {
      res.status(403).json({ error: 'You can only update your own profile.' });
      return;
    }

    const target = await getDoc<UserProfile>(idToken, 'users', userId);
    if (!target) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    const mask: string[] = [];

    if (typeof body.fullName === 'string') {
      const fullName = sanitizeText(body.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX);
      if (fullName.length < BLUEPRINT_LIMITS.FULL_NAME_MIN) {
        res.status(400).json({ error: 'Full name must be at least 2 characters.' });
        return;
      }
      updates.fullName = fullName;
      mask.push('fullName');
    }

    if (typeof body.department === 'string') {
      const department = sanitizeText(body.department, BLUEPRINT_LIMITS.DEPARTMENT_MAX);
      if (department.length < BLUEPRINT_LIMITS.DEPARTMENT_MIN) {
        res.status(400).json({ error: 'Department must be at least 2 characters.' });
        return;
      }
      updates.department = department;
      mask.push('department');
    }

    const ops: BatchWriteOp[] = [];

    if (admin) {
      if (typeof body.role === 'string') {
        if (!isValidRole(body.role)) {
          res.status(400).json({ error: 'Invalid role. Must be admin, staff, or maintenance.' });
          return;
        }
        if (userId === req.authUser!.uid && body.role !== 'admin') {
          res.status(400).json({ error: 'Administrators cannot demote their own active administrator role.' });
          return;
        }
        updates.role = body.role;
        mask.push('role');

        if (body.role !== target.role) {
          const [existingAdminMarker, existingMaintMarker] = await Promise.all([
            getDoc(idToken, 'admins', userId),
            getDoc(idToken, 'maintenance_staff', userId),
          ]);

          if (body.role === 'admin') {
            if (!existingAdminMarker) {
              ops.push({
                type: 'create',
                collection: 'admins',
                docId: userId,
                fields: { userId, grantedBy: req.authUser!.uid },
                serverTimestamps: ['createdAt'],
              });
            }
          } else if (existingAdminMarker && userId !== req.authUser!.uid) {
            ops.push({ type: 'delete', collection: 'admins', docId: userId });
          }

          if (body.role === 'maintenance') {
            if (!existingMaintMarker) {
              ops.push({
                type: 'create',
                collection: 'maintenance_staff',
                docId: userId,
                fields: { userId, grantedBy: req.authUser!.uid },
                serverTimestamps: ['createdAt'],
              });
            }
          } else if (existingMaintMarker) {
            ops.push({ type: 'delete', collection: 'maintenance_staff', docId: userId });
          }
        }
      }

      if (typeof body.accountStatus === 'string') {
        if (body.accountStatus !== 'active' && body.accountStatus !== 'inactive') {
          res.status(400).json({ error: 'accountStatus must be active or inactive.' });
          return;
        }
        if (userId === req.authUser!.uid && body.accountStatus === 'inactive') {
          res.status(400).json({ error: 'Administrators cannot deactivate their own account.' });
          return;
        }
        updates.accountStatus = body.accountStatus;
        mask.push('accountStatus');
      }
    } else if ('role' in body || 'accountStatus' in body) {
      res.status(403).json({ error: 'Only administrators can modify roles or account status.' });
      return;
    }

    if (mask.length === 0) {
      res.status(400).json({ error: 'No valid update fields provided.' });
      return;
    }

    ops.unshift({
      type: 'update',
      collection: 'users',
      docId: userId,
      fields: updates,
      updateMaskFields: mask,
      serverTimestamps: ['updatedAt'],
    });

    await commitWrites(idToken, ops);
    const updated = await getDoc<UserProfile>(idToken, 'users', userId);
    res.json({ user: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

// 5. Maintenance Categories
apiRouter.get('/categories', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const categories = await runFieldQuery<Category>(
      req.idToken!,
      'categories',
      'isActive',
      'IN',
      [true, false]
    );
    categories.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ categories });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/categories', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Only administrators can manage categories.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name = sanitizeText(body.name, BLUEPRINT_LIMITS.CATEGORY_NAME_MAX);
    const description = sanitizeText(body.description || '', BLUEPRINT_LIMITS.CATEGORY_DESC_MAX);
    const categoryId = sanitizeText(body.categoryId || slugifyCategory(name), BLUEPRINT_LIMITS.CATEGORY_ID_MAX);

    if (name.length < BLUEPRINT_LIMITS.CATEGORY_NAME_MIN) {
      res.status(400).json({ error: 'Category name must be at least 2 characters.' });
      return;
    }
    if (!isValidEntityId(categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MIN, BLUEPRINT_LIMITS.CATEGORY_ID_MAX)) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    const existing = await getDoc<Category>(idToken, 'categories', categoryId);
    if (existing) {
      res.status(409).json({ error: 'A category with this identifier already exists.' });
      return;
    }

    await commitWrites(idToken, [
      {
        type: 'create',
        collection: 'categories',
        docId: categoryId,
        fields: {
          categoryId,
          name,
          description,
          isActive: true,
        },
        serverTimestamps: ['createdAt', 'updatedAt'],
      },
    ]);

    const created = await getDoc<Category>(idToken, 'categories', categoryId);
    res.status(201).json({ category: created });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.patch('/categories/:categoryId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Only administrators can update categories.' });
      return;
    }

    const categoryId = sanitizeText(req.params.categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MAX);
    if (!isValidEntityId(categoryId, BLUEPRINT_LIMITS.CATEGORY_ID_MIN, BLUEPRINT_LIMITS.CATEGORY_ID_MAX)) {
      res.status(400).json({ error: 'Invalid categoryId.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    const mask: string[] = [];

    if (typeof body.name === 'string') {
      const name = sanitizeText(body.name, BLUEPRINT_LIMITS.CATEGORY_NAME_MAX);
      if (name.length < BLUEPRINT_LIMITS.CATEGORY_NAME_MIN) {
        res.status(400).json({ error: 'Category name must be at least 2 characters.' });
        return;
      }
      updates.name = name;
      mask.push('name');
    }
    if (typeof body.description === 'string') {
      updates.description = sanitizeText(body.description, BLUEPRINT_LIMITS.CATEGORY_DESC_MAX);
      mask.push('description');
    }
    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
      mask.push('isActive');
    }

    if (mask.length === 0) {
      res.status(400).json({ error: 'No valid category updates provided.' });
      return;
    }

    await commitWrites(idToken, [
      {
        type: 'update',
        collection: 'categories',
        docId: categoryId,
        fields: updates,
        updateMaskFields: mask,
        serverTimestamps: ['updatedAt'],
      },
    ]);

    const updated = await getDoc<Category>(idToken, 'categories', categoryId);
    res.json({ category: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

// 6. Maintenance Requests (CRUD + Search/Filtering + Assignment + Status Tracking)
apiRouter.get('/requests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const uid = req.authUser!.uid;
    const caller = await getCallerProfile(req);
    const admin = isCallerAdmin(req, caller);

    let requests: MaintenanceRequest[];
    if (admin) {
      requests = await listCollection<MaintenanceRequest>(idToken, 'maintenance_requests');
    } else if (caller?.role === 'maintenance') {
      requests = await runFieldQuery<MaintenanceRequest>(idToken, 'maintenance_requests', 'assignedTo', 'EQUAL', uid);
    } else {
      requests = await runFieldQuery<MaintenanceRequest>(idToken, 'maintenance_requests', 'submittedBy', 'EQUAL', uid);
    }

    const search = sanitizeText(req.query.search, 120).toLowerCase();
    const categoryId = sanitizeText(req.query.categoryId, 64);
    const priority = sanitizeText(req.query.priority, 20);
    const status = sanitizeText(req.query.status, 30);
    const fromDate = sanitizeText(req.query.fromDate, 30);
    const toDate = sanitizeText(req.query.toDate, 30);

    if (search) {
      requests = requests.filter(
        (r) =>
          r.requestId.toLowerCase().includes(search) ||
          r.title.toLowerCase().includes(search) ||
          r.location.toLowerCase().includes(search) ||
          r.submittedByName.toLowerCase().includes(search)
      );
    }
    if (categoryId) {
      requests = requests.filter((r) => r.categoryId === categoryId);
    }
    if (priority) {
      requests = requests.filter((r) => r.priority === priority);
    }
    if (status) {
      requests = requests.filter((r) => r.status === status);
    }
    if (fromDate) {
      const fromTs = new Date(fromDate + 'T00:00:00.000Z').getTime();
      if (!Number.isNaN(fromTs)) {
        requests = requests.filter((r) => new Date(r.createdAt).getTime() >= fromTs);
      }
    }
    if (toDate) {
      const toTs = new Date(toDate + 'T23:59:59.999Z').getTime();
      if (!Number.isNaN(toTs)) {
        requests = requests.filter((r) => new Date(r.createdAt).getTime() <= toTs);
      }
    }

    requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json({ requests });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/requests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const authUser = req.authUser!;
    const caller = await getCallerProfile(req);
    if (!caller || caller.accountStatus !== 'active') {
      res.status(403).json({ error: 'Active user profile required before submitting requests.' });
      return;
    }

    const parsed = validateCreateRequestPayload((req.body || {}) as Record<string, unknown>);
    if (parsed.error || !parsed.data) {
      res.status(400).json({ error: parsed.error || 'Invalid request payload.' });
      return;
    }

    const category = await getDoc<Category>(idToken, 'categories', parsed.data.categoryId);
    if (!category || !category.isActive) {
      res.status(400).json({ error: 'Selected maintenance category is unavailable.' });
      return;
    }

    const requestId = `REQ-${makeDateStamp()}-${makeShortCode(4)}`;
    const historyId = `HIST-${makeDateStamp()}-${makeShortCode(6)}`;

    await commitWrites(idToken, [
      {
        type: 'create',
        collection: 'maintenance_requests',
        docId: requestId,
        fields: {
          requestId,
          title: parsed.data.title,
          description: parsed.data.description,
          categoryId: category.categoryId,
          categoryName: category.name,
          location: parsed.data.location,
          priority: parsed.data.priority,
          status: 'Pending',
          submittedBy: authUser.uid,
          submittedByName: caller.fullName,
          submittedByDepartment: caller.department,
          assignedTo: '',
          assignedToName: '',
          resolutionNotes: '',
          rejectionReason: '',
          attachmentUrl: parsed.data.attachmentUrl,
        },
        serverTimestamps: ['createdAt', 'updatedAt'],
      },
      {
        type: 'create',
        collection: 'status_history',
        docId: historyId,
        fields: {
          historyId,
          requestId,
          previousStatus: 'None',
          newStatus: 'Pending',
          changedBy: authUser.uid,
          changedByName: caller.fullName,
          changedByRole: caller.role,
          requestOwnerId: authUser.uid,
          requestAssigneeId: '',
          comments: 'Maintenance request submitted by requester.',
        },
        serverTimestamps: ['changedAt'],
      },
    ]);

    const created = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    res.status(201).json({ request: created });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.patch('/requests/:requestId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const requestId = sanitizeText(req.params.requestId, BLUEPRINT_LIMITS.REQUEST_ID_MAX);
    if (!isValidEntityId(requestId, 4, BLUEPRINT_LIMITS.REQUEST_ID_MAX)) {
      res.status(400).json({ error: 'Invalid requestId.' });
      return;
    }

    const existing = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found.' });
      return;
    }

    const caller = await getCallerProfile(req);
    const admin = isCallerAdmin(req, caller);

    if (!admin && existing.submittedBy !== req.authUser!.uid) {
      res.status(403).json({ error: 'You do not have permission to edit this request.' });
      return;
    }
    if (!admin && existing.status !== 'Pending') {
      res.status(400).json({ error: 'Requesters can only edit requests while status is Pending.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    const mask: string[] = [];

    if (typeof body.title === 'string') {
      const title = sanitizeText(body.title, BLUEPRINT_LIMITS.TITLE_MAX);
      if (title.length < BLUEPRINT_LIMITS.TITLE_MIN) {
        res.status(400).json({ error: 'Title must be at least 3 characters.' });
        return;
      }
      updates.title = title;
      mask.push('title');
    }
    if (typeof body.description === 'string') {
      const description = sanitizeText(body.description, BLUEPRINT_LIMITS.DESCRIPTION_MAX);
      if (description.length < BLUEPRINT_LIMITS.DESCRIPTION_MIN) {
        res.status(400).json({ error: 'Description must be at least 5 characters.' });
        return;
      }
      updates.description = description;
      mask.push('description');
    }
    if (typeof body.location === 'string') {
      const location = sanitizeText(body.location, BLUEPRINT_LIMITS.LOCATION_MAX);
      if (location.length < BLUEPRINT_LIMITS.LOCATION_MIN) {
        res.status(400).json({ error: 'Location must be at least 2 characters.' });
        return;
      }
      updates.location = location;
      mask.push('location');
    }
    if (typeof body.priority === 'string') {
      if (!VALID_PRIORITIES.includes(body.priority as RequestPriority)) {
        res.status(400).json({ error: 'Invalid priority level.' });
        return;
      }
      updates.priority = body.priority;
      mask.push('priority');
    }

    if (mask.length === 0) {
      res.status(400).json({ error: 'No valid fields provided for update.' });
      return;
    }

    const ops: BatchWriteOp[] = [
      {
        type: 'update',
        collection: 'maintenance_requests',
        docId: requestId,
        fields: updates,
        updateMaskFields: mask,
        serverTimestamps: ['updatedAt'],
      },
    ];

    if (admin && updates.priority && updates.priority !== existing.priority) {
      const historyId = `HIST-${makeDateStamp()}-${makeShortCode(6)}`;
      const adminName = caller?.fullName || req.authUser!.name || 'Administrator';
      ops.push({
        type: 'create',
        collection: 'status_history',
        docId: historyId,
        fields: {
          historyId,
          requestId,
          previousStatus: existing.status,
          newStatus: existing.status,
          changedBy: req.authUser!.uid,
          changedByName: adminName,
          changedByRole: 'admin',
          requestOwnerId: existing.submittedBy,
          requestAssigneeId: existing.assignedTo,
          comments: `Priority updated from ${existing.priority} to ${String(updates.priority)}.`,
        },
        serverTimestamps: ['changedAt'],
      });
    }

    await commitWrites(idToken, ops);

    const updated = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    res.json({ request: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/requests/:requestId/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Only administrators can assign maintenance requests.' });
      return;
    }

    const requestId = sanitizeText(req.params.requestId, BLUEPRINT_LIMITS.REQUEST_ID_MAX);
    if (!isValidEntityId(requestId, 4, BLUEPRINT_LIMITS.REQUEST_ID_MAX)) {
      res.status(400).json({ error: 'Invalid requestId.' });
      return;
    }

    const existing = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found.' });
      return;
    }
    if (existing.status === 'Resolved' || existing.status === 'Rejected') {
      res.status(400).json({ error: `Cannot assign a request that is already ${existing.status}.` });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const assignedTo = sanitizeText(body.assignedTo, BLUEPRINT_LIMITS.USER_ID_MAX);
    const assignmentNotes = sanitizeText(body.assignmentNotes || '', BLUEPRINT_LIMITS.COMMENT_MAX);
    const requestedPriority = sanitizeText(body.priority || existing.priority, 20) as RequestPriority;

    if (!isValidEntityId(assignedTo)) {
      res.status(400).json({ error: 'Please select a valid maintenance employee.' });
      return;
    }
    if (!VALID_PRIORITIES.includes(requestedPriority)) {
      res.status(400).json({ error: 'Invalid priority level.' });
      return;
    }

    const assignee = await getDoc<UserProfile>(idToken, 'users', assignedTo);
    if (!assignee || assignee.accountStatus !== 'active') {
      res.status(404).json({ error: 'Selected maintenance employee was not found or is inactive.' });
      return;
    }
    if (assignee.role !== 'maintenance' && assignee.role !== 'admin') {
      res.status(400).json({ error: 'Selected user does not have Maintenance Personnel role.' });
      return;
    }

    const assignmentId = `ASN-${makeDateStamp()}-${makeShortCode(6)}`;
    const historyId = `HIST-${makeDateStamp()}-${makeShortCode(6)}`;
    const adminName = caller?.fullName || req.authUser!.name || 'Administrator';
    const nextStatus: RequestStatus = existing.status === 'In Progress' ? 'In Progress' : 'Assigned';

    await commitWrites(idToken, [
      {
        type: 'update',
        collection: 'maintenance_requests',
        docId: requestId,
        fields: {
          status: nextStatus,
          priority: requestedPriority,
          assignedTo: assignee.userId,
          assignedToName: assignee.fullName,
        },
        updateMaskFields: ['status', 'priority', 'assignedTo', 'assignedToName'],
        serverTimestamps: ['assignedAt', 'updatedAt'],
      },
      {
        type: 'create',
        collection: 'assignments',
        docId: assignmentId,
        fields: {
          assignmentId,
          requestId,
          assignedTo: assignee.userId,
          assignedToName: assignee.fullName,
          assignedBy: req.authUser!.uid,
          assignedByName: adminName,
          assignmentNotes,
        },
        serverTimestamps: ['assignedAt'],
      },
      {
        type: 'create',
        collection: 'status_history',
        docId: historyId,
        fields: {
          historyId,
          requestId,
          previousStatus: existing.status,
          newStatus: nextStatus,
          changedBy: req.authUser!.uid,
          changedByName: adminName,
          changedByRole: 'admin',
          requestOwnerId: existing.submittedBy,
          requestAssigneeId: assignee.userId,
          comments: assignmentNotes
            ? `Assigned to ${assignee.fullName} (Priority: ${requestedPriority}). Note: ${assignmentNotes}`
            : `Assigned to ${assignee.fullName} (Priority: ${requestedPriority}).`,
        },
        serverTimestamps: ['changedAt'],
      },
    ]);

    const updated = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    res.json({ request: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/requests/:requestId/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Only administrators can reject maintenance requests.' });
      return;
    }

    const requestId = sanitizeText(req.params.requestId, BLUEPRINT_LIMITS.REQUEST_ID_MAX);
    if (!isValidEntityId(requestId, 4, BLUEPRINT_LIMITS.REQUEST_ID_MAX)) {
      res.status(400).json({ error: 'Invalid requestId.' });
      return;
    }

    const existing = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found.' });
      return;
    }
    if (existing.status === 'Resolved' || existing.status === 'Rejected') {
      res.status(400).json({ error: `Request is already ${existing.status}.` });
      return;
    }

    const rejectionReason = sanitizeText((req.body || {}).rejectionReason, BLUEPRINT_LIMITS.COMMENT_MAX);
    if (rejectionReason.length < 5) {
      res.status(400).json({ error: 'Please provide a clear rejection reason (at least 5 characters).' });
      return;
    }

    const historyId = `HIST-${makeDateStamp()}-${makeShortCode(6)}`;
    const adminName = caller?.fullName || req.authUser!.name || 'Administrator';

    await commitWrites(idToken, [
      {
        type: 'update',
        collection: 'maintenance_requests',
        docId: requestId,
        fields: {
          status: 'Rejected',
          rejectionReason,
        },
        updateMaskFields: ['status', 'rejectionReason'],
        serverTimestamps: ['updatedAt'],
      },
      {
        type: 'create',
        collection: 'status_history',
        docId: historyId,
        fields: {
          historyId,
          requestId,
          previousStatus: existing.status,
          newStatus: 'Rejected',
          changedBy: req.authUser!.uid,
          changedByName: adminName,
          changedByRole: 'admin',
          requestOwnerId: existing.submittedBy,
          requestAssigneeId: existing.assignedTo,
          comments: `Request rejected: ${rejectionReason}`,
        },
        serverTimestamps: ['changedAt'],
      },
    ]);

    const updated = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    res.json({ request: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.post('/requests/:requestId/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const uid = req.authUser!.uid;
    const caller = await getCallerProfile(req);
    if (!caller || caller.accountStatus !== 'active') {
      res.status(403).json({ error: 'Active user profile required.' });
      return;
    }

    const effectiveRole: UserRole = isCallerAdmin(req, caller) ? 'admin' : caller.role;
    const requestId = sanitizeText(req.params.requestId, BLUEPRINT_LIMITS.REQUEST_ID_MAX);
    if (!isValidEntityId(requestId, 4, BLUEPRINT_LIMITS.REQUEST_ID_MAX)) {
      res.status(400).json({ error: 'Invalid requestId.' });
      return;
    }

    const existing = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    if (!existing) {
      res.status(404).json({ error: 'Maintenance request not found.' });
      return;
    }

    if (effectiveRole === 'staff') {
      res.status(403).json({ error: 'Only administrators or assigned maintenance personnel can update request status.' });
      return;
    }

    if (effectiveRole === 'maintenance' && existing.assignedTo !== uid) {
      res.status(403).json({ error: 'You can only update maintenance requests assigned to you.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const newStatus = sanitizeText(body.status, 30) as RequestStatus;
    const resolutionNotes = sanitizeText(
      body.resolutionNotes !== undefined ? body.resolutionNotes : existing.resolutionNotes,
      BLUEPRINT_LIMITS.NOTES_MAX
    );
    const comments = sanitizeText(body.comments || '', BLUEPRINT_LIMITS.COMMENT_MAX);

    const check = canTransitionStatus(effectiveRole, existing.status, newStatus);
    if (!check.allowed) {
      res.status(400).json({ error: check.reason || 'Status transition not permitted.' });
      return;
    }

    if (newStatus === 'Resolved' && resolutionNotes.length < 5) {
      res.status(400).json({ error: 'Resolution notes (at least 5 characters) are required when marking a request Resolved.' });
      return;
    }

    const historyId = `HIST-${makeDateStamp()}-${makeShortCode(6)}`;
    const auditComment =
      comments ||
      (newStatus === 'Resolved'
        ? `Work completed. Resolution: ${resolutionNotes}`
        : `Status updated from ${existing.status} to ${newStatus}.`);

    await commitWrites(idToken, [
      {
        type: 'update',
        collection: 'maintenance_requests',
        docId: requestId,
        fields: {
          status: newStatus,
          resolutionNotes,
        },
        updateMaskFields: ['status', 'resolutionNotes'],
        serverTimestamps: ['updatedAt'],
      },
      {
        type: 'create',
        collection: 'status_history',
        docId: historyId,
        fields: {
          historyId,
          requestId,
          previousStatus: existing.status,
          newStatus,
          changedBy: uid,
          changedByName: caller.fullName,
          changedByRole: effectiveRole,
          requestOwnerId: existing.submittedBy,
          requestAssigneeId: existing.assignedTo,
          comments: auditComment,
        },
        serverTimestamps: ['changedAt'],
      },
    ]);

    const updated = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    res.json({ request: updated });
  } catch (error) {
    handleApiError(res, error);
  }
});

apiRouter.get('/requests/:requestId/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const requestId = sanitizeText(req.params.requestId, BLUEPRINT_LIMITS.REQUEST_ID_MAX);
    if (!isValidEntityId(requestId, 4, BLUEPRINT_LIMITS.REQUEST_ID_MAX)) {
      res.status(400).json({ error: 'Invalid requestId.' });
      return;
    }

    const requestDoc = await getDoc<MaintenanceRequest>(idToken, 'maintenance_requests', requestId);
    if (!requestDoc) {
      res.status(404).json({ error: 'Maintenance request not found.' });
      return;
    }

    const caller = await getCallerProfile(req);
    const admin = isCallerAdmin(req, caller);
    const uid = req.authUser!.uid;

    if (!admin && requestDoc.submittedBy !== uid && requestDoc.assignedTo !== uid) {
      res.status(403).json({ error: 'You do not have permission to view history for this request.' });
      return;
    }

    let history: StatusHistoryEntry[];
    let assignments: Assignment[] = [];

    if (admin) {
      [history, assignments] = await Promise.all([
        runFieldQuery<StatusHistoryEntry>(idToken, 'status_history', 'requestId', 'EQUAL', requestId),
        runFieldQuery<Assignment>(idToken, 'assignments', 'requestId', 'EQUAL', requestId).catch(() => [] as Assignment[]),
      ]);
    } else if (caller?.role === 'maintenance') {
      const [allMaintHistory, allMaintAssignments] = await Promise.all([
        runFieldQuery<StatusHistoryEntry>(idToken, 'status_history', 'requestAssigneeId', 'EQUAL', uid),
        runFieldQuery<Assignment>(idToken, 'assignments', 'assignedTo', 'EQUAL', uid).catch(() => [] as Assignment[]),
      ]);
      history = allMaintHistory.filter((h) => h.requestId === requestId);
      assignments = allMaintAssignments.filter((a) => a.requestId === requestId);
    } else {
      const ownHistory = await runFieldQuery<StatusHistoryEntry>(
        idToken,
        'status_history',
        'requestOwnerId',
        'EQUAL',
        uid
      );
      history = ownHistory.filter((h) => h.requestId === requestId);
    }

    history.sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1));
    assignments.sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1));

    res.json({ history, assignments });
  } catch (error) {
    handleApiError(res, error);
  }
});

// 7. Management Information Reports & Analytics (Admin Only)
apiRouter.get('/reports/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idToken = req.idToken!;
    const caller = await getCallerProfile(req);
    if (!isCallerAdmin(req, caller)) {
      res.status(403).json({ error: 'Administrator privileges are required to access management reports.' });
      return;
    }

    const fromDate = sanitizeText(req.query.fromDate, 30) || null;
    const toDate = sanitizeText(req.query.toDate, 30) || null;

    const [allRequests, allUsers] = await Promise.all([
      listCollection<MaintenanceRequest>(idToken, 'maintenance_requests'),
      listCollection<UserProfile>(idToken, 'users'),
    ]);

    let requests = allRequests;
    if (fromDate) {
      const fromTs = new Date(fromDate + 'T00:00:00.000Z').getTime();
      if (!Number.isNaN(fromTs)) {
        requests = requests.filter((r) => new Date(r.createdAt).getTime() >= fromTs);
      }
    }
    if (toDate) {
      const toTs = new Date(toDate + 'T23:59:59.999Z').getTime();
      if (!Number.isNaN(toTs)) {
        requests = requests.filter((r) => new Date(r.createdAt).getTime() <= toTs);
      }
    }

    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'Pending').length;
    const assigned = requests.filter((r) => r.status === 'Assigned').length;
    const inProgress = requests.filter((r) => r.status === 'In Progress').length;
    const resolved = requests.filter((r) => r.status === 'Resolved').length;
    const rejected = requests.filter((r) => r.status === 'Rejected').length;
    const unresolved = pending + assigned + inProgress;
    const resolutionRatePct = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // By Category
    const catMap = new Map<string, { name: string; count: number; resolved: number; unresolved: number }>();
    for (const r of requests) {
      const entry = catMap.get(r.categoryName) || { name: r.categoryName, count: 0, resolved: 0, unresolved: 0 };
      entry.count += 1;
      if (r.status === 'Resolved') entry.resolved += 1;
      else if (r.status !== 'Rejected') entry.unresolved += 1;
      catMap.set(r.categoryName, entry);
    }

    // By Priority
    const byPriority: Array<{ name: RequestPriority; count: number }> = VALID_PRIORITIES.map((p) => ({
      name: p,
      count: requests.filter((r) => r.priority === p).length,
    }));

    // By Status
    const statuses: RequestStatus[] = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
    const byStatus = statuses.map((s) => ({
      name: s,
      count: requests.filter((r) => r.status === s).length,
    }));

    // By Department
    const deptMap = new Map<string, { department: string; count: number; resolved: number }>();
    for (const r of requests) {
      const dept = r.submittedByDepartment || 'Unassigned';
      const entry = deptMap.get(dept) || { department: dept, count: 0, resolved: 0 };
      entry.count += 1;
      if (r.status === 'Resolved') entry.resolved += 1;
      deptMap.set(dept, entry);
    }

    // By Location
    const locMap = new Map<string, number>();
    for (const r of requests) {
      locMap.set(r.location, (locMap.get(r.location) || 0) + 1);
    }

    // Maintenance Personnel Workload (include maintenance role users and any user actively assigned tasks)
    const maintenanceUsers = allUsers.filter(
      (u) => u.role === 'maintenance' || requests.some((r) => r.assignedTo === u.userId)
    );
    const workload = maintenanceUsers.map((tech) => {
      const assignedReqs = requests.filter((r) => r.assignedTo === tech.userId);
      const techResolved = assignedReqs.filter((r) => r.status === 'Resolved').length;
      const techInProgress = assignedReqs.filter((r) => r.status === 'In Progress').length;
      const techPendingStart = assignedReqs.filter((r) => r.status === 'Assigned').length;
      return {
        userId: tech.userId,
        fullName: tech.fullName,
        department: tech.department,
        totalAssigned: assignedReqs.length,
        inProgress: techInProgress,
        pendingStart: techPendingStart,
        resolved: techResolved,
        resolutionRatePct: assignedReqs.length > 0 ? Math.round((techResolved / assignedReqs.length) * 100) : 0,
      };
    });

    // Monthly Trends
    const monthMap = new Map<string, { month: string; submitted: number; resolved: number }>();
    for (const r of requests) {
      const monthKey = (r.createdAt || '').slice(0, 7);
      if (!monthKey) continue;
      const entry = monthMap.get(monthKey) || { month: monthKey, submitted: 0, resolved: 0 };
      entry.submitted += 1;
      if (r.status === 'Resolved') entry.resolved += 1;
      monthMap.set(monthKey, entry);
    }
    const monthlyTrends = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const summary: ReportSummary = {
      generatedAt: new Date().toISOString(),
      dateRange: { fromDate, toDate },
      totals: {
        total,
        pending,
        assigned,
        inProgress,
        resolved,
        rejected,
        unresolved,
        resolutionRatePct,
      },
      byCategory: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
      byPriority,
      byStatus,
      byDepartment: Array.from(deptMap.values()).sort((a, b) => b.count - a.count),
      byLocation: Array.from(locMap.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
      workload: workload.sort((a, b) => b.totalAssigned - a.totalAssigned),
      monthlyTrends,
    };

    res.json({ report: summary });
  } catch (error) {
    handleApiError(res, error);
  }
});
