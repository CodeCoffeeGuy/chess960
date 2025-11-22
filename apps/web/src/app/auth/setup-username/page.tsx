'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function SetupUsernamePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if user already has a username
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const user = session.user as any;
      if (user.handle) {
        router.push('/');
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/setup-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to set username');
        setLoading(false);
        return;
      }

      // Sync auth token first (this ensures WebSocket auth works)
      try {
        await fetch('/api/auth/sync-token', { method: 'POST' });
      } catch (err) {
        console.error('Failed to sync auth token:', err);
      }

      // Update the session to get the new handle
      // Call update multiple times to ensure it refreshes
      await update();
      await new Promise(resolve => setTimeout(resolve, 500));
      await update();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the session was updated by checking the current session
      const currentSession = await fetch('/api/auth/session').then(r => r.json());
      if (currentSession?.user && (currentSession.user as any).handle) {
        console.log('Session updated successfully with handle:', (currentSession.user as any).handle);
      } else {
        console.warn('Session may not have handle yet, forcing refresh');
      }

      // Force a hard refresh to ensure session is fully updated
      // This ensures the session callback runs again and fetches the new handle
      window.location.href = '/';
        } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
    setUsername(value);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden">
      {/* Background effects - Grid only, no orange circle */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          {/* Dark mode grid - white lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
          {/* Light mode grid - black lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
        </div>
      </div>

      <div className="relative max-w-md w-full space-y-8 p-8 bg-[#35322e]/50 backdrop-blur-sm rounded-2xl border border-[#474239] shadow-[0_12px_34px_rgba(0,0,0,0.45)]">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-2">
            Choose Your Username
          </h1>
          <p className="text-[#b6aea2]">
            Pick a unique username for Chess960
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[#c1b9ad] mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              placeholder="yourname"
              value={username}
              onChange={handleUsernameChange}
              minLength={3}
              maxLength={20}
              className="w-full px-4 py-3 bg-[#2a2723] border border-[#474239] rounded-lg text-white placeholder-[#6b6460] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-[#a0958a]">
              3-20 characters, letters, numbers, hyphens and underscores
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || username.length < 3}
            className="w-full bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Setting username...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
