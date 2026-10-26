import fs from 'fs'
import os from 'os'
import path from 'path'
import { interopImport } from './interopImport'

export interface DataWorkspace {
  root: string
  temporaryRoot?: string
  shouldPush: boolean
}

/** An explicit directory is the operator's own checkout; otherwise an apply works on a fresh clone it pushes back. */
export async function dataWorkspace(dataDir: string | undefined, applying: boolean): Promise<DataWorkspace> {
  const explicit = dataDir ?? process.env.RUNOMICS_DATA_DIR?.trim()
  if (explicit) return { root: path.resolve(explicit), shouldPush: false }

  if (process.env.RUNOMICS_DATA_REPO_URL) {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coach-'))
    const root = path.join(temporaryRoot, 'data')
    const { fetchPrivateData } = await interopImport(import('./fetch_private_data.mjs'))
    fetchPrivateData(root)
    return { root, temporaryRoot, shouldPush: applying }
  }

  if (applying) throw new Error('--apply requires private data repository credentials or an explicit --data-dir workspace')
  return { root: path.join(process.cwd(), 'data'), shouldPush: false }
}

export async function pushWorkspace(workspace: DataWorkspace): Promise<void> {
  const { pushPrivateData } = await interopImport(import('./push_private_data.mjs'))
  pushPrivateData(workspace.root)
}

export function removeWorkspace(workspace: DataWorkspace): void {
  if (workspace.temporaryRoot) fs.rmSync(workspace.temporaryRoot, { recursive: true, force: true })
}
