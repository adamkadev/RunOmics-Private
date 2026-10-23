import { describe, expect, it } from 'vitest'
import { integrationStatus } from '../integrations'

const FIREBASE = { FIREBASE_PROJECT_ID: 'demo', FIREBASE_CLIENT_EMAIL: 'sa@demo.iam', FIREBASE_PRIVATE_KEY: 'pem' }

describe('integrationStatus', () => {
  it('reports each integration whose every variable is set', () => {
    expect(
      integrationStatus({ ...FIREBASE, GEMINI_API_KEY: 'g', GITHUB_SYNC_TOKEN: 't', GITHUB_SYNC_REPO: 'o/r', RUNOMICS_PRIVATE: '1', ORS_API_KEY: 'k' })
    ).toEqual({ firebaseAdmin: true, gemini: true, syncButton: true, privateSite: true, routing: true })
  })

  it('counts a half-configured or blank integration as missing', () => {
    expect(
      integrationStatus({
        FIREBASE_PROJECT_ID: 'demo',
        FIREBASE_CLIENT_EMAIL: 'sa@demo.iam',
        GEMINI_API_KEY: '  ',
        GITHUB_SYNC_TOKEN: 't',
        ORS_API_KEY: ' ',
      })
    ).toEqual({ firebaseAdmin: false, gemini: false, syncButton: false, privateSite: false, routing: false })
  })

  it('needs only the project id against the Firestore emulator', () => {
    const env = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo' }
    expect(integrationStatus(env).firebaseAdmin).toBe(true)
  })

  it('never echoes a value', () => {
    const report = JSON.stringify(
      integrationStatus({ ...FIREBASE, FIREBASE_PRIVATE_KEY: 'private-value', GEMINI_API_KEY: 'gemini-value', ORS_API_KEY: 'ors-value' })
    )
    expect(report).not.toMatch(/private-value|gemini-value|ors-value|sa@demo/)
  })
})
