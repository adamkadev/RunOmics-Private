import { SignInClient } from '@/components/auth/SignInClient'
import { t } from '@/i18n'

export const metadata = {
  title: t.signIn.title,
}

/** The private site's way in (src/proxy.ts): static, and with none of the athlete's data. */
export default function SignInPage() {
  return <SignInClient />
}
