import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { apiClient } from '../services/apiClient';
import type { UserProfile } from '../types/mrtmis';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  needsOnboarding: boolean;
  needsEmailVerification: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (input: {
    email: string;
    password: string;
    fullName: string;
    department: string;
  }) => Promise<void>;
  completeOnboarding: (fullName: string, department: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeTimestamp(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    const s = Number((val as { seconds: number }).seconds);
    return new Date(s * 1000).toISOString();
  }
  return new Date().toISOString();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const pendingProfileInputRef = useRef<{ fullName: string; department: string } | null>(null);
  const [authRefreshTick, setAuthRefreshTick] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setProfileLoading(true);
      } else {
        setProfile(null);
        setNeedsOnboarding(false);
        setProfileLoading(false);
      }
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    if (!firebaseUser.emailVerified) {
      setProfile(null);
      setNeedsOnboarding(false);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const userPath = `users/${firebaseUser.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      async (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.data() as Record<string, unknown>;
          setProfile({
            userId: String(raw.userId || firebaseUser.uid),
            fullName: String(raw.fullName || ''),
            email: String(raw.email || firebaseUser.email || ''),
            role: (raw.role as UserProfile['role']) || 'staff',
            department: String(raw.department || ''),
            accountStatus: (raw.accountStatus as UserProfile['accountStatus']) || 'active',
            createdAt: normalizeTimestamp(raw.createdAt),
            updatedAt: normalizeTimestamp(raw.updatedAt),
          });
          setNeedsOnboarding(false);
          setProfileLoading(false);
        } else {
          // If signed up with email/password with pending profile metadata, auto-create profile
          const pendingInput = pendingProfileInputRef.current;
          if (pendingInput) {
            try {
              pendingProfileInputRef.current = null;
              await apiClient.registerProfile(pendingInput);
              return;
            } catch {
              // fallback to onboarding form
            }
          }
          setProfile(null);
          setNeedsOnboarding(true);
          setProfileLoading(false);
        }
      },
      (error) => {
        setProfileLoading(false);
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser, authRefreshTick]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const registerWithEmail = useCallback(
    async (input: { email: string; password: string; fullName: string; department: string }) => {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      await updateProfile(cred.user, { displayName: input.fullName.trim() });
      pendingProfileInputRef.current = {
        fullName: input.fullName.trim(),
        department: input.department.trim(),
      };
      await sendEmailVerification(cred.user);
    },
    []
  );

  const completeOnboarding = useCallback(async (fullName: string, department: string) => {
    const res = await apiClient.registerProfile({ fullName, department });
    setProfile(res.user);
    setNeedsOnboarding(false);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshAuthState = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    await auth.currentUser.getIdToken(true);
    setFirebaseUser(auth.currentUser);
    setAuthRefreshTick((tick) => tick + 1);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setNeedsOnboarding(false);
    pendingProfileInputRef.current = null;
  }, []);

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authReady,
        profileLoading,
        needsOnboarding,
        needsEmailVerification,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        completeOnboarding,
        resendVerificationEmail,
        refreshAuthState,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
