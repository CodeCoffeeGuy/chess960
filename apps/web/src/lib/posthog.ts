import posthog from 'posthog-js'

// Client-side PostHog initialization
export const initPosthog = () => {
  if (typeof window === 'undefined') return;
  
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('PostHog key not found - analytics disabled');
    }
    return;
  }

  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We handle pageviews manually
      capture_pageleave: true,
      // Session recording - completely disabled to prevent connection errors
      // Using disable_session_recording instead of session_recording.enabled for proper disabling
      disable_session_recording: true,
      loaded: (_posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog loaded');
        }
      },
      // Catch errors during initialization
      _capture_metrics: false, // Disable internal metrics to reduce errors
    });
  } catch (error) {
    console.error('PostHog initialization failed:', error);
    // Don't crash the app if PostHog fails to initialize
  }
}

// User identification
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  try {
    if (posthog.__loaded) {
      posthog.identify(userId, properties);
    }
  } catch (error) {
    console.error('PostHog identify error:', error);
    // Don't crash the app if PostHog fails
  }
}

// Track events
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  try {
    if (posthog.__loaded) {
      posthog.capture(eventName, properties);
    }
  } catch (error) {
    console.error('PostHog capture error:', error);
    // Don't crash the app if PostHog fails
  }
}

// Auth events
export const trackMagicLinkRequest = (email: string) => {
  trackEvent('magic_link_requested', { email })
}

export const trackMagicLinkClick = (email: string) => {
  trackEvent('magic_link_clicked', { email })
}

export const trackUserSignIn = (userId: string, handle: string, isNewUser: boolean) => {
  identifyUser(userId, {
    handle,
    email: undefined, // Don't store email in properties for privacy
    signed_up_at: isNewUser ? new Date().toISOString() : undefined
  })

  trackEvent(isNewUser ? 'user_signed_up' : 'user_signed_in', {
    user_id: userId,
    handle
  })
}

export const trackUserSignOut = () => {
  trackEvent('user_signed_out');
  if (typeof window !== 'undefined') {
    try {
      if (posthog.__loaded) {
        posthog.reset();
      }
    } catch (error) {
      console.error('PostHog reset error:', error);
      // Don't crash the app if PostHog fails
    }
  }
}

// Game events
export const trackGameStart = (timeControl: string, isRated: boolean, gameId: string) => {
  trackEvent('game_started', {
    time_control: timeControl,
    is_rated: isRated,
    game_id: gameId
  })
}

export const trackGameEnd = (gameId: string, result: string, duration: number) => {
  trackEvent('game_ended', {
    game_id: gameId,
    result, // 'win', 'loss', 'draw', 'abort'
    duration_seconds: Math.round(duration / 1000)
  })
}

export const trackQueueJoin = (timeControl: string, isRated: boolean) => {
  trackEvent('queue_joined', {
    time_control: timeControl,
    is_rated: isRated
  })
}

export const trackQueueLeave = (timeControl: string, waitTime: number) => {
  trackEvent('queue_left', {
    time_control: timeControl,
    wait_time_seconds: Math.round(waitTime / 1000)
  })
}

export default posthog
