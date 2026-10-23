export const readsFromGitHub = () =>
  process.env.RUNOMICS_DATA_SOURCE === 'github' &&
  process.env.VERCEL === '1' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
