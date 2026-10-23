import { SignInClient } from '@/components/auth/SignInClient'
import { t } from '@/i18n'

export const metadata = {
  title: t.signIn.title,
}

/** Reachable signed out (src/proxy.ts): keep it static, with none of the athlete's data. */
export default function SignInPage() {
  return <SignInClient />
}
