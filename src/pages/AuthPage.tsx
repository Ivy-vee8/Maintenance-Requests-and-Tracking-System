import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { BTN_ACCENT_CLS, BTN_PRIMARY_CLS, BTN_SECONDARY_CLS, INPUT_CLS } from '../components/FormControls';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateProfileInput } from '../utils/validation';

export function AuthPage() {
  const {
    firebaseUser,
    needsOnboarding,
    needsEmailVerification,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    completeOnboarding,
    resendVerificationEmail,
    refreshAuthState,
    signOut,
  } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(firebaseUser?.displayName || '');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (needsOnboarding && firebaseUser?.displayName && !fullName) {
      setFullName(firebaseUser.displayName);
    }
  }, [needsOnboarding, firebaseUser, fullName]);

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'register') {
      const profileErr = validateProfileInput({ fullName, department });
      if (profileErr) {
        setErrorMsg(profileErr);
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail({ email, password, fullName, department });
        showToast('success', 'Account created. Please verify your email address to continue.');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Authentication error.';
      if (raw.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in Firebase Authentication Console. Use "Continue with Google" below, or enable Email/Password under Firebase Console > Authentication > Sign-in method.'
        );
      } else if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        setErrorMsg('Invalid email address or password.');
      } else if (raw.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Please sign in instead.');
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const err = validateProfileInput({ fullName, department });
    if (err) {
      setErrorMsg(err);
      return;
    }
    setLoading(true);
    try {
      await completeOnboarding(fullName, department);
      showToast('success', 'User profile created successfully.');
    } catch (e2) {
      setErrorMsg(e2 instanceof Error ? e2.message : 'Failed to create profile.');
    } finally {
      setLoading(false);
    }
  };

  // Email Verification Gate
  if (firebaseUser && needsEmailVerification) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5">
          <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Mail className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900">Verify Your Email Address</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              A verification link was sent to <strong>{firebaseUser.email}</strong>. Verify your email to activate access to MRTMIS.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={async () => {
                await refreshAuthState();
                showToast('info', 'Checked email verification status.');
              }}
              className={`${BTN_PRIMARY_CLS} w-full py-2.5`}
            >
              I Have Verified My Email
            </button>
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail();
                showToast('success', 'Verification email re-sent.');
              }}
              className={`${BTN_SECONDARY_CLS} w-full py-2.5`}
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={signOut}
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Sign Out and Use Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-time Onboarding Profile Completion
  if (firebaseUser && needsOnboarding) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#0F172A] flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-slate-900">Complete Your Profile</h1>
              <p className="text-xs text-slate-500 font-mono truncate">{firebaseUser.email}</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Register your organizational profile to begin submitting or managing maintenance requests. New accounts default to the Staff / Requester role unless designated as the initial Administrator.
          </p>

          {errorMsg && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleOnboardingSubmit} className="space-y-4">
            <div>
              <label htmlFor="onb-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="onb-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Velma Okumu"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="onb-dept" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department / Unit
              </label>
              <input
                id="onb-dept"
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g., ICT Services, Facilities, Finance"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex items-center justify-between pt-2 gap-3">
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`${BTN_ACCENT_CLS} flex-1 py-2.5`}
              >
                {loading ? 'Saving Profile...' : 'Continue to Workspace'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col lg:flex-row">
      {/* Left Institutional Panel */}
      <div className="lg:w-[44%] bg-[#0F172A] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#0D9488] flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight block leading-none">
                MRTMIS
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">Enterprise Maintenance Portal</span>
            </div>
          </div>

          <h1 className="mt-10 font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-balance">
            Maintenance Request &amp; Tracking Management Information System
          </h1>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg">
            Centralized organizational work order intake, personnel dispatch, real-time progress auditing, and decision-support analytics.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 space-y-4 text-xs text-slate-400">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              Role-based access control enforces separate workspaces for Staff Requesters, Maintenance Personnel, and System Administrators. Self-registration defaults strictly to Staff.
            </p>
          </div>
        </div>
      </div>

      {/* Right Authentication Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {mode === 'login' ? 'Sign In to MRTMIS' : 'Create Staff Account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Access your organizational maintenance portal.'
                : 'Register an employee requester account.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Google Sign-In */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleAuth}
            className={`${BTN_PRIMARY_CLS} w-full py-2.5`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-xs text-slate-400">or use organizational credentials</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Samuel Mwangi"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label htmlFor="auth-dept" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Department
                  </label>
                  <input
                    id="auth-dept"
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Procurement, Library"
                    className={INPUT_CLS}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.org"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className={INPUT_CLS}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${BTN_ACCENT_CLS} w-full py-2.5`}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In with Email'
                  : 'Create Staff Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
