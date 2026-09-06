'use client'

import { ErrorFallback } from '@/components/ui/ErrorFallback'

export default function RouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback {...props} />
}
