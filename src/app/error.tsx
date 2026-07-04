'use client'

import { ErrorFallback } from '@/components/ui/ErrorFallback'

// Catches render/data errors on every route below the root layout, so the
// user keeps the app chrome (sidebar/top bar) and gets a retry button
// instead of the bare Next.js error screen.
export default function RouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback {...props} />
}
