'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The verification link has expired or has already been used.',
  Callback: 'OAuth callback error. Please check that the redirect URI is configured correctly in your OAuth provider settings.',
  google: 'Google OAuth configuration error. Please check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly, and that the redirect URI is added to your Google OAuth settings.',
  Default: 'An error occurred during sign in.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#1f1d1a] text-white overflow-hidden">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Subtle grid */}
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>
      </div>

      <div className="relative max-w-md w-full p-8 bg-[#35322e]/50 backdrop-blur-sm rounded-2xl border border-[#474239] shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Authentication Error
          </h1>
          <p className="text-gray-400">
            {message}
          </p>
        </div>

        {error === 'Verification' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-300">
              Your verification link may have expired. Please try signing in again to receive a new link.
            </p>
          </div>
        )}

        {error === 'Callback' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              Make sure the following redirect URI is added to your Google OAuth settings:<br />
              <code className="bg-black/30 px-2 py-1 rounded mt-2 inline-block">
                https://chess960.game/api/auth/callback/google
              </code>
            </p>
          </div>
        )}

        {error === 'google' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-300 mb-2">
              Google OAuth configuration error. Please check:
            </p>
            <ul className="text-sm text-yellow-300 list-disc list-inside space-y-1">
              <li>GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your environment variables</li>
              <li>The redirect URI is added to your Google OAuth settings:</li>
            </ul>
            <code className="bg-black/30 px-2 py-1 rounded mt-2 inline-block text-xs">
              http://localhost:3000/api/auth/callback/google
            </code>
            <p className="text-xs text-yellow-400 mt-2">
              Check your server logs for more details.
            </p>
          </div>
        )}

        <a
          href="/auth/signin"
          className="inline-block px-6 py-3 bg-gradient-to-br from-[#35322e] to-[#2a2926] light:from-white light:to-[#faf7f2] border border-[#474239] light:border-[#d4caba] hover:border-orange-300 text-white light:text-black hover:bg-[#3a3632] light:hover:bg-[#f5f1ea] rounded-lg transition-all duration-200 font-medium"
        >
          Try Again
        </a>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#1f1d1a]">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
