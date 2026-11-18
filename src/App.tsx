import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShieldAlert, UserX } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BTN_PRIMARY_CLS } from './components/FormControls';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AuthPage } from './pages/AuthPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { RequestsPage } from './pages/RequestsPage';
import { SubmitRequestPage } from './pages/SubmitRequestPage';
import { UsersPage } from './pages/UsersPage';
import type { UserRole } from './types/mrtmis';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
      <div className="text-center space-y-2.5">
        <div className="w-8 h-8 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-600">Loading MRTMIS workspace...</p>
      </div>
    </div>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { authReady, firebaseUser, profile, profileLoading, needsOnboarding, needsEmailVerification, signOut } =
    useAuth();

  if (!authReady || profileLoading) {
    return <FullScreenSpinner />;
  }

  if (!firebaseUser || needsEmailVerification || needsOnboarding || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.accountStatus === 'inactive') {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center space-y-4">
          <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <UserX className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="font-display text-lg font-semibold text-slate-900">Account Deactivated</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your organizational account is currently marked inactive. Contact your System Administrator for reactivation.
          </p>
          <button
            type="button"
            onClick={signOut}
            className={BTN_PRIMARY_CLS}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
}

function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
        <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Your current role does not have permission to access this module.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function PublicAuthRoute() {
  const { authReady, firebaseUser, profile, profileLoading, needsOnboarding, needsEmailVerification } = useAuth();
  if (!authReady || (firebaseUser && profileLoading)) {
    return <FullScreenSpinner />;
  }
  if (firebaseUser && !needsOnboarding && !needsEmailVerification && profile) {
    return <Navigate to="/dashboard" replace />;
  }
  return <AuthPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicAuthRoute />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedShell>
                    <DashboardPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/requests"
                element={
                  <ProtectedShell>
                    <RequestsPage />
                  </ProtectedShell>
                }
              />
              <Route
                path="/submit"
                element={
                  <ProtectedShell>
                    <RequireRole roles={['admin', 'staff']}>
                      <SubmitRequestPage />
                    </RequireRole>
                  </ProtectedShell>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedShell>
                    <RequireRole roles={['admin']}>
                      <ReportsPage />
                    </RequireRole>
                  </ProtectedShell>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedShell>
                    <RequireRole roles={['admin']}>
                      <UsersPage />
                    </RequireRole>
                  </ProtectedShell>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedShell>
                    <RequireRole roles={['admin']}>
                      <CategoriesPage />
                    </RequireRole>
                  </ProtectedShell>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedShell>
                    <ProfilePage />
                  </ProtectedShell>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
