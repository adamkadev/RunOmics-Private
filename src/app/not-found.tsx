import Link from 'next/link'
import { HeartPulse, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <HeartPulse size={48} className="mb-4 text-emerald-500 opacity-60" />
      <h1 className="text-6xl font-black text-foreground">404</h1>
      <p className="mt-2 text-lg font-medium text-muted-foreground">
        This page went on a run and didn&apos;t come back.
      </p>
      <p className="mt-1 text-sm text-subtle">
        The route you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>
    </div>
  )
}
