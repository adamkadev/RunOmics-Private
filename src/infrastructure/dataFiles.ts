import fs from 'node:fs'

export interface DataFiles {
  readFileSync(file: string, encoding: 'utf-8'): string
  existsSync(file: string): boolean
  readdirSync(dir: string): string[]
  /** The file parsed, shared by every reader of the same git blob; a plain parse on disk. */
  readJsonSync(file: string): unknown
  /** The git blob a snapshot file came from; undefined on disk. */
  blobSha(file: string): string | undefined
}

export const diskFiles: DataFiles = {
  readFileSync: (file, encoding) => fs.readFileSync(file, encoding),
  existsSync: (file) => fs.existsSync(file),
  readdirSync: (dir) => fs.readdirSync(dir),
  readJsonSync: (file) => JSON.parse(fs.readFileSync(file, 'utf-8')),
  blobSha: () => undefined,
}
