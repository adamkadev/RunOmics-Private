import ExcelJS from 'exceljs'
import type { WorkbookSheet, WorkbookSpec } from '@/application/ports/Workbook'

const HEADER_FILL = '17324D'
const HEADER_TEXT = 'FFFFFF'
const ACCENT = '37B6A5'

function tableName(sheetName: string): string {
  return `Export${sheetName.replace(/[^A-Za-z0-9]/g, '')}`
}

function addDataSheet(workbook: ExcelJS.Workbook, { name, columns, rows }: WorkbookSheet): void {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 19 },
  })
  sheet.properties.tabColor = { argb: ACCENT }
  sheet.pageSetup = { orientation: columns.length > 10 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1 }

  const values = rows.map((row) => columns.map((column) => row[column.key] ?? null))
  sheet.addTable({
    name: tableName(name),
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: columns.map((column) => ({ name: column.key, filterButton: true })),
    rows: values,
  })

  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1)
    excelColumn.width = Math.min(column.width ?? Math.max(12, column.key.length + 2), 42)
    if (column.numberFormat) excelColumn.numFmt = column.numberFormat
    if (column.wrap) excelColumn.alignment = { vertical: 'top', wrapText: true }
  })

  const header = sheet.getRow(1)
  header.height = 28
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: ACCENT } } }
  })
}

export function xlsxWorkbook(spec: WorkbookSpec): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = spec.author
  workbook.company = spec.author
  workbook.created = spec.createdAt
  workbook.modified = spec.createdAt
  workbook.subject = spec.subject
  workbook.title = spec.title
  for (const sheet of spec.sheets) addDataSheet(workbook, sheet)
  return workbook
}

export async function writeXlsx(spec: WorkbookSpec): Promise<Buffer> {
  return Buffer.from(await xlsxWorkbook(spec).xlsx.writeBuffer())
}
