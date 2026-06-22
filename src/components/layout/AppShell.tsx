import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <ThemeSync />
      <Sidebar />
      <main className="min-h-screen bg-background lg:ml-60">
        {/* Mobile spacer: top bar height + notch safe area */}
        <div
          className="lg:hidden"
          style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
        />
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
          <PageTransition>{children}</PageTransition>
        </div>
        {/* Mobile spacer: floating glass tab bar + home indicator safe area */}
        <div
          className="lg:hidden"
          style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        />
      </main>

    </div>
  )
}
