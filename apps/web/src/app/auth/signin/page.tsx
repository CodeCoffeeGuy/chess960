'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';


export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('email');
    setError(null);

    // For email provider, NextAuth will redirect to verify-request page
    // We don't need to handle the response - just let it redirect
    await signIn('email', { email, callbackUrl: '/' });
  };



  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Subtle grid */}
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          {/* Dark mode grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
          {/* Light mode grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
        </div>
      </div>

      <div className="relative max-w-md w-full space-y-6 sm:space-y-8 p-4 sm:p-6 md:p-8 bg-[#35322e]/50 light:bg-white/70 backdrop-blur-sm rounded-2xl border border-[#474239] light:border-[#d4caba] shadow-[0_12px_34px_rgba(0,0,0,0.45)] light:shadow-[0_12px_34px_rgba(0,0,0,0.1)] mx-4 sm:mx-0">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-2">
            Chess960
          </h1>
          <p className="text-sm sm:text-base text-[#b6aea2] light:text-[#5a5449]">
            Sign in to start playing lightning-fast chess
          </p>
        </div>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}



          {/* Google Sign In */}
          {mounted ? (
            <a
              href="/api/auth/signin/google?callbackUrl=/"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black bg-[#2a2723] light:bg-white hover:bg-[#35322e] light:hover:bg-[#f5f1ea] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </a>
          ) : (
            <div className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black bg-[#2a2723] light:bg-white">
              <div className="animate-spin h-5 w-5 border-2 border-white light:border-black border-t-transparent rounded-full" />
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#474239] light:border-[#d4caba]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#35322e]/50 light:bg-white/70 text-[#a0958a] light:text-[#5a5449]">Or continue with email</span>
            </div>
          </div>

          {/* Email Sign In */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#c1b9ad] light:text-[#5a5449] mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-[#2a2723] light:bg-[#faf7f2] border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#a0958a] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:py-4 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading === 'email' ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Magic Link
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#a0958a] light:text-[#5a5449] mt-4">
            We&apos;ll send you a magic link to sign in without a password
          </p>
        </div>
      </div>
    </div>
  );
}
