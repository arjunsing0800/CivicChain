'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Check, Mail, ShieldCheck, User, Building2 } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const ROLE_OPTIONS = [
  {
    value: 'CITIZEN',
    label: 'Citizen',
    description: 'Report civic issues and track progress in your ward.',
    icon: User,
    privileged: false,
  },
  {
    value: 'AUTHORITY',
    label: 'Municipal Department',
    description: 'Operate a department and resolve assigned reports.',
    icon: Building2,
    privileged: true,
  },
] as const;

export function LoginForm({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  // Auth.js OAuth failures redirect to /login?error=... — surface them instead
  // of silently showing the form again (the reported "Google sends me back
  // where I start" loop).
  const authError = searchParams.get('error');
  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    Configuration:
      'Sign-in is misconfigured (missing secret or OAuth credentials). Please contact support.',
    AccessDenied: 'Access denied for this account. Please contact support.',
    OAuthSignin: 'Could not start Google sign-in. Please try again.',
    OAuthCallback:
      'Google sign-in failed during callback (often: missing AUTH_SECRET, unmigrated database, or redirect-URI mismatch). Please try again.',
    OAuthCreateAccount: 'Could not create your account with Google. Please try again.',
    Callback: 'Sign-in callback failed. Please try again.',
    OAuthAccountNotLinked:
      'This email already exists with another sign-in method. Sign in with the original method first.',
    SessionRequired: 'You must be signed in to view that page.',
  };
  // Email is only collected on /register when a privileged role is requested:
  // the request is recorded via /api/auth/register BEFORE the Google sign-in,
  // and the Google account links to that pre-created row by email.
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('CITIZEN');
  const [error, setError] = useState<string | null>(
    authError ? (AUTH_ERROR_MESSAGES[authError] ?? `Sign-in failed (${authError}). Please try again.`) : null,
  );
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  const enter = reduce
    ? undefined
    : { initial: { opacity: 0, y: 12, scale: 0.99 }, animate: { opacity: 1, y: 0, scale: 1 } };

  const handleRegisterContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Record an ADMIN-gated role request BEFORE the Google sign-in so the
      // account is created with roleStatus=PENDING.
      if (role !== 'CITIZEN') {
        const normalized = email.trim().toLowerCase();
        const reg = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalized, requestedRole: role }),
        });
        if (!reg.ok) {
          const body = await reg.json().catch(() => ({}));
          setError(body?.error?.message ?? 'Could not submit the role request.');
          setLoading(false);
          return;
        }
      }

      await signIn('google', { callbackUrl });
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.div {...enter} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <Card className="overflow-hidden border border-neutral-200 dark:border-dark-border shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 via-brand-400 to-emerald-400" />
        <CardContent className="p-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-md shadow-brand-600/25">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                  {mode === 'register' ? 'Get started' : 'Welcome back'}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {mode === 'register'
                    ? 'Create your CivicChain account with Google.'
                    : 'Sign in with your Google account.'}
                </p>
              </div>
            </div>
            <div className="h-px bg-neutral-100 dark:bg-dark-border" />
          </div>

          {mode === 'login' ? (
            <div className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => signIn('google', { callbackUrl })}
              >
                <GoogleIcon />
                <span className="ml-2">Sign in with Google</span>
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                Secure sign-in with Google. CivicChain never asks for or stores your password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegisterContinue} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <fieldset>
                <legend className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                  Account type
                </legend>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        aria-pressed={active}
                        className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                          active
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500/25'
                            : 'border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card hover:border-neutral-300 dark:hover:border-dark-border-hover'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            active
                              ? 'bg-brand-600 text-white'
                              : 'bg-neutral-100 dark:bg-dark-bg text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-white">
                            {opt.label}
                            {opt.privileged && (
                              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                approval required
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                            {opt.description}
                          </span>
                        </span>
                        <span
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                            active
                              ? 'border-brand-600 bg-brand-600'
                              : 'border-neutral-300 dark:border-dark-border-hover bg-transparent'
                          }`}
                        >
                          {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Department and Admin accounts are activated only after an
                  administrator approves your request.
                </p>
              </fieldset>
              {role !== 'CITIZEN' && (
                <Input
                  id="register-email"
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  helperText="Must match the Google account you will sign in with — your role request is recorded under this address."
                  leftIcon={<Mail className="w-4 h-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
              <Button type="submit" size="lg" fullWidth loading={loading}>
                <GoogleIcon />
                <span className="ml-2">
                  {loading
                    ? 'Continuing…'
                    : role !== 'CITIZEN'
                      ? 'Submit request — continue with Google'
                      : 'Continue with Google'}
                </span>
              </Button>
              {role !== 'CITIZEN' && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 text-left">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Approval required
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    You will sign in as a citizen now. Your requested role stays
                    pending until an administrator approves it.
                  </p>
                </div>
              )}
              <p className="text-center text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                Secure sign-in with Google. CivicChain never asks for or stores your password.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
