'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GuestProfile } from '@/components/guest/GuestProfile';
import { getUserContextFromCookies, clearAuthToken, GHOST_USERNAME } from '@chess960/utils';

export default function GuestProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userContext, setUserContext] = useState<{ isAuth: boolean; username?: string; type?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for session to load before checking
    if (status === 'loading') {
      return;
    }
    checkUserStatus();
  }, [status, session]);

  const checkUserStatus = async () => {
    try {
      // Get user context from cookies
      const context = getUserContextFromCookies();

      // If NextAuth session exists, user is authenticated - redirect to their profile
      if (session?.user) {
        const sessionUser = session.user as any;
        if (sessionUser.handle) {
          router.push(`/profile/${sessionUser.handle}`);
          return;
        }
      }

      // If cookie says user is authenticated but NextAuth says no session,
      // the token is stale - clear it and create guest token
      if (context.isAuth && !session?.user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Stale auth token detected (cookie says auth but no NextAuth session), clearing and creating guest token');
        }
        clearAuthToken();
        // Create a new guest token
        try {
          const response = await fetch('/api/auth/guest-simple', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Guest token created after clearing stale auth token');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            const newContext = getUserContextFromCookies();
            setUserContext(newContext);
            setLoading(false);
            return;
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to create guest token after clearing stale auth token');
            }
            setUserContext({ isAuth: false, type: 'guest' });
            setLoading(false);
            return;
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating guest token after clearing stale auth token:', error);
          }
          setUserContext({ isAuth: false, type: 'guest' });
          setLoading(false);
          return;
        }
      }

      // If user is authenticated (has a real account), redirect to user profile
      if (context.isAuth) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Authenticated user detected, redirecting to user profile');
          console.log('User context:', context);
        }
        if (context.username) {
          // First check if the user actually exists in the database
          try {
            const response = await fetch(`/api/user/stats/${context.username}`);
            if (response.ok) {
              router.push(`/profile/${context.username}`);
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('User not found in database, clearing token and staying as guest');
              }
              clearAuthToken();
              // Create a new guest token and stay on guest profile page
              try {
                const response = await fetch('/api/auth/guest-simple', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });

                if (response.ok) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Guest token created after clearing invalid user token');
                  }
                  // Wait a moment for the cookie to be set, then re-check
                  await new Promise(resolve => setTimeout(resolve, 100));
                  const newContext = getUserContextFromCookies();
                  setUserContext(newContext);
                } else {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Failed to create guest token after clearing invalid user token');
                  }
                  setUserContext({ isAuth: false, type: 'guest' });
                }
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Error creating guest token after clearing invalid user token:', error);
                }
                setUserContext({ isAuth: false, type: 'guest' });
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Error checking user existence, clearing token and staying as guest');
            }
            clearAuthToken();
            // Create a new guest token and stay on guest profile page
            try {
              const response = await fetch('/api/auth/guest-simple', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('Guest token created after error clearing invalid user token');
                }
                // Wait a moment for the cookie to be set, then re-check
                await new Promise(resolve => setTimeout(resolve, 100));
                const newContext = getUserContextFromCookies();
                setUserContext(newContext);
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.error('Failed to create guest token after error clearing invalid user token');
                }
                setUserContext({ isAuth: false, type: 'guest' });
              }
            } catch (guestError) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Error creating guest token after error clearing invalid user token:', guestError);
              }
              setUserContext({ isAuth: false, type: 'guest' });
            }
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('No username found, redirecting to home');
          }
          router.push('/');
        }
        return;
      }

      // If no token exists, create a guest token
      if (!context.userId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('No token found, creating guest token...');
        }
        try {
          const response = await fetch('/api/auth/guest-simple', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            if (process.env.NODE_ENV === 'development') {
              console.log('Guest token created');
            }
            // Wait a moment for the cookie to be set, then re-check
            await new Promise(resolve => setTimeout(resolve, 100));
            const newContext = getUserContextFromCookies();
            setUserContext(newContext);
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to create guest token');
            }
            router.push('/');
            return;
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating guest token:', error);
          }
          router.push('/');
          return;
        }
      } else {
        setUserContext(context);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking user status:', error);
      }
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-[#b6aea2] light:text-[#5a5449]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userContext) {
    return null; // Will redirect
  }

          return (
            <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white light:text-black mb-2">Guest Profile</h1>
                    <p className="text-sm sm:text-base text-[#a0958a] light:text-[#5a5449]">
                      Your guest session progress and statistics
                    </p>
                    {userContext.username && (
                      <p className="text-xs sm:text-sm text-[#8a7f73] light:text-[#6b6358] mt-2">
                        Playing as: {userContext.username}
                      </p>
                    )}
                  </div>

                  <GuestProfile />
                </div>
              </div>
            </div>
          );
}
