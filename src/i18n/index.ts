import { en } from './en'

// Shape every locale must satisfy. Derive a `Strings` type from English so a
// future `fr.ts` (etc.) is checked against it with `satisfies Strings`.
export type Strings = typeof en

// Active locale. Swap this (or make it dynamic) when adding more languages.
export const t = en
