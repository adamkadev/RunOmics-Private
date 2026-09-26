export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0'

/** The commit this build was made from, short; "local" off Vercel. */
export const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'local'
