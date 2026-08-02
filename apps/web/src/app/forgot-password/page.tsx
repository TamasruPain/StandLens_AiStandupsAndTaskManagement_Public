'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (res.error) {
        setError(res.error.message || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0B0F] text-[#F0ECE5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141418] border border-[#2A2A32] rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141418] border border-[#2A2A32] p-2.5 shadow-xl mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/standlens-icon-512.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#F0ECE5]">Forgot Password</h1>
          <p className="text-sm text-[#9B9BA3]">Enter your email to receive a password reset link</p>
        </div>

        {error && (
          <div className="p-3 bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl text-[#F87171] text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="p-4 bg-[#34A853]/10 border border-[#34A853]/20 rounded-xl text-[#34A853] text-sm text-center space-y-2">
              <p className="font-semibold text-base text-[#34A853]">Check your email</p>
              <p className="text-[#9B9BA3] text-xs">
                We have sent a password reset link to <strong className="text-[#F0ECE5]">{email}</strong>. Please check your inbox.
              </p>
            </div>
            <Link
              href="/login"
              className="w-full block text-center bg-[#1C1C22] hover:bg-[#2A2A32] border border-[#2A2A32] text-[#F0ECE5] font-medium py-3 rounded-xl transition-colors cursor-pointer"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full bg-[#1C1C22] border border-[#2A2A32] rounded-xl px-4 py-3 text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>

            <p className="text-center text-sm text-[#9B9BA3]">
              Remembered your password?{' '}
              <Link href="/login" className="text-[#E5A320] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </form>
        )}

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
