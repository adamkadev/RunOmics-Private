import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportSheet, type ExportOption } from '@/components/settings/ExportSheet'
import { t } from '@/i18n'

const s = t.settings

function formats(onWorkbook: () => void, onCsv: () => void): ExportOption[] {
  return [
    { key: 'workbook', title: 'Workbook', extension: '.xlsx', hint: 'All runs.', onSelect: onWorkbook },
    { key: 'csv', title: 'Raw data', extension: '.csv', hint: 'A light file.', onSelect: onCsv },
  ]
}

describe('Export sheet', () => {
  it('lists every format and runs the one that is picked', async () => {
    const onWorkbook = vi.fn()
    const onCsv = vi.fn()
    render(<ExportSheet options={formats(onWorkbook, onCsv)} onClose={() => {}} />)

    expect(screen.getByRole('dialog', { name: s.dataExport.sheetTitle })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Raw data/ }))
    expect(onCsv).toHaveBeenCalledTimes(1)
    expect(onWorkbook).not.toHaveBeenCalled()
  })

  it('closes on Cancel without exporting anything', async () => {
    const onWorkbook = vi.fn()
    const onClose = vi.fn()
    render(<ExportSheet options={formats(onWorkbook, vi.fn())} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: s.actions.confirmCancel }))
    expect(onWorkbook).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
