import { createIdbCache } from './idb'
import { createWorkerState, handleMessage, type WorkerDeps } from './workerCore'
import type { ExploreRequest, ExploreResponse } from './workerProtocol'

/**
 * Turbopack bundles this file as a classic worker (it drops `type: 'module'` and loads the chunks with `importScripts`),
 * so it uses plain static imports and nothing at the top level that would need a module worker.
 *
 * `self` is typed through a cast rather than the `webworker` lib, which would apply to the whole program and clash with the DOM types.
 */

interface WorkerScope {
  onmessage: ((event: MessageEvent<ExploreRequest>) => void) | null
  postMessage(message: ExploreResponse): void
  fetch: typeof fetch
  indexedDB?: IDBFactory
}

const scope = self as unknown as WorkerScope

/** Some browsers throw on merely reading `indexedDB` (private modes, blocked storage). */
function indexedDbFactory(): IDBFactory | undefined {
  try {
    return scope.indexedDB
  } catch {
    return undefined
  }
}

const state = createWorkerState()
const deps: WorkerDeps = {
  // Same-origin paths: the session cookie goes with them, so a private
  // site's gate lets them through.
  fetch: (url) => scope.fetch(url, { credentials: 'same-origin' }),
  cache: createIdbCache(indexedDbFactory()),
}

scope.onmessage = (event) => {
  void handleMessage(state, event.data, deps).then((response) => scope.postMessage(response))
}
