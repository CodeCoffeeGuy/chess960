'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPosthog } from '@/lib/posthog'
import posthog from 'posthog-js'

function PosthogTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track pageviews with error handling
    if (pathname && typeof window !== 'undefined') {
      try {
        let url = window.origin + pathname
        if (searchParams.toString()) {
          url = url + `?${searchParams.toString()}`
        }
        
        // Only track if PostHog is loaded
        if (posthog.__loaded) {
          posthog.capture('$pageview', {
            $current_url: url
          })
        }
      } catch (error) {
        console.error('PostHog pageview tracking error:', error);
        // Don't crash the app if PostHog fails
      }
    }
  }, [pathname, searchParams])

  return null
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize PostHog with error handling
    try {
      initPosthog()
    } catch (error) {
      console.error('PostHog provider initialization error:', error);
      // Don't crash the app if PostHog fails to initialize
    }
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PosthogTracker />
      </Suspense>
      {children}
    </>
  )
}