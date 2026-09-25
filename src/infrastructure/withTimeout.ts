/**
 * `promise`'s value, or `fallback` once `ms` have passed - whichever comes
 * first. The timer is cleared either way.
 *
 * The three copies this replaces each raced the read against a bare
 * setTimeout and never cleared it, so a read that answered in 50 ms still left
 * a timer holding the process open for the rest of its two or ten seconds.
 * That is harmless in a serverless function, but keeps the coaching CLI
 * running for ten seconds after it has printed its answer.
 */
export async function withTimeout<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<F>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
