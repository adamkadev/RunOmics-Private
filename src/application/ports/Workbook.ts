export type WorkbookCell = string | number | boolean | Date | null
export type WorkbookRow = Record<string, WorkbookCell>

export interface WorkbookColumn {
  key: string
  width?: number
  numberFormat?: string
  wrap?: boolean
}

export interface WorkbookSheet {
  name: string
  columns: WorkbookColumn[]
  rows: WorkbookRow[]
}

export interface WorkbookSpec {
  title: string
  subject: string
  author: string
  createdAt: Date
  sheets: WorkbookSheet[]
}
