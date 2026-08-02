'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || 'Invalid email or password');
      } else {
        router.push('/dashboard');
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
          <h1 className="text-2xl font-bold text-[#F0ECE5]">Welcome to StandLens</h1>
          <p className="text-sm text-[#9B9BA3]">Sign in to access your team standups and digests</p>
        </div>

        {error && (
          <div className="p-3 bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl text-[#F87171] text-sm text-center">
            {error}
          </div>
        )}

        {/* Credentials Form */}
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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3]">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-[#E5A320] hover:underline font-medium">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1C1C22] border border-[#2A2A32] rounded-xl px-4 py-3 text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer Link */}
        <p className="text-center text-sm text-[#9B9BA3]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#E5A320] hover:underline font-medium">
            Sign up
          </Link>
        </p>
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
