import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Category, MaintenanceRequest, UserProfile } from '../types/mrtmis';

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Date(Number((val as { seconds: number }).seconds) * 1000).toISOString();
  }
  return '';
}

export function useMaintenanceRequests() {
  const { authReady, firebaseUser, profile } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const profileUserId = profile?.userId;
  const profileRole = profile?.role;
  const firebaseUid = firebaseUser?.uid;
  const firebaseVerified = firebaseUser?.emailVerified;

  useEffect(() => {
    if (!authReady || !firebaseUid || !firebaseVerified || !profileUserId || !profileRole) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(db, 'maintenance_requests');
    const q =
      profileRole === 'admin'
        ? colRef
        : profileRole === 'maintenance'
          ? query(colRef, where('assignedTo', '==', profileUserId))
          : query(colRef, where('submittedBy', '==', profileUserId));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: MaintenanceRequest[] = snapshot.docs.map((d) => {
          const r = d.data() as Record<string, unknown>;
          return {
            requestId: String(r.requestId || d.id),
            title: String(r.title || ''),
            description: String(r.description || ''),
            categoryId: String(r.categoryId || ''),
            categoryName: String(r.categoryName || ''),
            location: String(r.location || ''),
            priority: (r.priority as MaintenanceRequest['priority']) || 'Medium',
            status: (r.status as MaintenanceRequest['status']) || 'Pending',
            submittedBy: String(r.submittedBy || ''),
            submittedByName: String(r.submittedByName || ''),
            submittedByDepartment: String(r.submittedByDepartment || ''),
            assignedTo: String(r.assignedTo || ''),
            assignedToName: String(r.assignedToName || ''),
            assignedAt: r.assignedAt ? toIso(r.assignedAt) : undefined,
            resolutionNotes: String(r.resolutionNotes || ''),
            rejectionReason: String(r.rejectionReason || ''),
            attachmentUrl: String(r.attachmentUrl || ''),
            createdAt: toIso(r.createdAt),
            updatedAt: toIso(r.updatedAt),
          };
        });
        items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setRequests(items);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'maintenance_requests');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUid, firebaseVerified, profileUserId, profileRole]);

  return { requests, loading };
}

export function useCategories() {
  const { authReady, firebaseUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('isActive', 'in', [true, false])
    );
    const unsub = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const items: Category[] = snapshot.docs.map((d) => {
          const r = d.data() as Record<string, unknown>;
          return {
            categoryId: String(r.categoryId || d.id),
            name: String(r.name || ''),
            description: String(r.description || ''),
            isActive: Boolean(r.isActive),
            createdAt: toIso(r.createdAt),
            updatedAt: toIso(r.updatedAt),
          };
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(items);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser]);

  return { categories, loading };
}

export function useAdminUsers() {
  const { authReady, firebaseUser, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified || profile?.role !== 'admin') {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const items: UserProfile[] = snapshot.docs.map((d) => {
          const r = d.data() as Record<string, unknown>;
          return {
            userId: String(r.userId || d.id),
            fullName: String(r.fullName || ''),
            email: String(r.email || ''),
            role: (r.role as UserProfile['role']) || 'staff',
            department: String(r.department || ''),
            accountStatus: (r.accountStatus as UserProfile['accountStatus']) || 'active',
            createdAt: toIso(r.createdAt),
            updatedAt: toIso(r.updatedAt),
          };
        });
        items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setUsers(items);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser, profile]);

  return { users, loading };
}
