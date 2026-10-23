import fs from 'node:fs'

export interface DataFiles {
  readFileSync(file: string, encoding: 'utf-8'): string
  existsSync(file: string): boolean
  readdirSync(dir: string): string[]
}

export const diskFiles: DataFiles = {
  readFileSync: (file, encoding) => fs.readFileSync(file, encoding),
  existsSync: (file) => fs.existsSync(file),
  readdirSync: (dir) => fs.readdirSync(dir),
}
