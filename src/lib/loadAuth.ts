/** The auth SDK on demand: a page that only shows who is signed in keeps it out of its first load. */
export async function loadAuth(options?: { forSignIn?: boolean }) {
  const [sdk, { getClientAuth }] = await Promise.all([import('firebase/auth'), import('@/lib/firebaseAuth')])
  return { ...sdk, auth: getClientAuth(options) }
}
