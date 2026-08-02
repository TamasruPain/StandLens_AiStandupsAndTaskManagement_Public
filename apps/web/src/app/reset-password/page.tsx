'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Reset token is missing from the URL. Please request a new link.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token: token,
      });

      if (res.error) {
        setError(res.error.message || 'Failed to reset password. The link may have expired.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="p-3 bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl text-[#F87171] text-sm text-center">
          Invalid or missing reset token. Please request a new password reset link.
        </div>
        <Link
          href="/forgot-password"
          className="w-full block text-center bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-semibold py-3 rounded-xl transition-all duration-200"
        >
          Request Reset Link
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="p-3 bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl text-[#F87171] text-sm text-center">
          {error}
        </div>
      )}

      {success ? (
        <div className="space-y-6">
          <div className="p-4 bg-[#34A853]/10 border border-[#34A853]/20 rounded-xl text-[#34A853] text-sm text-center space-y-2">
            <p className="font-semibold text-base text-[#34A853]">Password Reset Successful</p>
            <p className="text-[#9B9BA3] text-xs">
              Your password has been updated. Redirecting you to the sign in page...
            </p>
          </div>
          <Link
            href="/login"
            className="w-full block text-center bg-[#1C1C22] hover:bg-[#2A2A32] border border-[#2A2A32] text-[#F0ECE5] font-medium py-3 rounded-xl transition-colors cursor-pointer"
          >
            Go to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1C1C22] border border-[#2A2A32] rounded-xl px-4 py-3 text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1C1C22] border border-[#2A2A32] rounded-xl px-4 py-3 text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Resetting password...' : 'Reset Password'}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] text-[#F0ECE5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141418] border border-[#2A2A32] rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141418] border border-[#2A2A32] p-2.5 shadow-xl mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/standlens-icon-512.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#F0ECE5]">Reset Password</h1>
          <p className="text-sm text-[#9B9BA3]">Enter and confirm your new account password</p>
        </div>

        <Suspense fallback={
          <div className="text-center py-6 text-sm text-[#9B9BA3]">
            Loading reset form...
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>

        <div className="text-center text-[10px] text-[#71717A] mt-6 pt-4 border-t border-[#23232C]/60">
          Designed & Built by{' '}
          <a
            href="https://github.com/TamasruPain"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#E5A320] hover:underline"
          >
            @TamasruPain
          </a>
        </div>
      </div>
    </main>
  );
}
