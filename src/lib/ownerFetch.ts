import type { User } from 'firebase/auth'

/** The browser side of `requireOwner`. */
export async function authorizedFetch(user: User, path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${await user.getIdToken()}` },
  })
}
