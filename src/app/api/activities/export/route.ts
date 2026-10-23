import { type NextRequest } from 'next/server'
import {
  ACTIVITIES_CSV_MIME,
  buildActivitiesCsv,
  loadTrainingWorkbookData,
  TRAINING_WORKBOOK_MIME,
  writeTrainingWorkbook,
} from '@/application/usecases/GetTrainingWorkbook'
import { NOTES_UNAVAILABLE_HEADER } from '@/lib/exportHeaders'
import { requireOwner } from '@/lib/ownerRoute'
import { loadData } from '@/application/usecases/LoadData'

export const runtime = 'nodejs'

/**
 * Owner-only, unlike the rest of the site: the workbook's Athlete sheet carries
 * weight, BMI, resting and max heart rate, age and sex.
 *
 * `?format=xlsx` (default) is the whole workbook; `?format=csv` is the
 * Activities sheet alone, for an LLM.
 */
export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied
  await loadData()

  const format = req.nextUrl?.searchParams.get('format') ?? 'xlsx'
  if (format !== 'xlsx' && format !== 'csv') return new Response('Unknown format', { status: 400 })

  const data = await loadTrainingWorkbookData()
  const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' }
  if (!data.notesAvailable) headers[NOTES_UNAVAILABLE_HEADER] = 'true'

  if (format === 'csv') {
    return new Response(buildActivitiesCsv(data), {
      headers: {
        ...headers,
        'Content-Type': ACTIVITIES_CSV_MIME,
        'Content-Disposition': 'attachment; filename="runomics-activities.csv"',
      },
    })
  }

  const workbook = await writeTrainingWorkbook(data)
  return new Response(new Uint8Array(workbook), {
    headers: {
      ...headers,
      'Content-Type': TRAINING_WORKBOOK_MIME,
      'Content-Disposition': 'attachment; filename="runomics-training-data.xlsx"',
    },
  })
}
