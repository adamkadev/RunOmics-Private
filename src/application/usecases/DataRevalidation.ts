import { readsFromGitHub } from '@/infrastructure/dataSource'
import { dataTag } from '@/infrastructure/githubData'

/** The cache tag a sync expires, or null for a deployment that serves the data its build cloned. */
export const dataRevalidationTag = (): string | null => (readsFromGitHub() ? dataTag() : null)
