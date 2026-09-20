import { type NextRequest } from 'next/server'
import { getTrainingWorkbook, TRAINING_WORKBOOK_MIME } from '@/application/usecases/GetTrainingWorkbook'
import { requireOwner } from '@/lib/ownerRoute'

export const runtime = 'nodejs'

/**
 * Owner-only, unlike everything else the site serves.
 *
 * The rest of RunOmics is public by design - the runs, the routes, the records.
 * This workbook is not: its Athlete sheet carries the physiological profile
 * (weight, BMI, resting and max heart rate, age, sex, VO2max, fitness age) and
 * its history. Settings only ever shows the download behind `isOwner`, but the
 * route itself had no guard, so the whole file was one unauthenticated GET away.
 *
 * Building it is also the most expensive thing this app does - the entire
 * activity history through exceljs - which is not something an anonymous caller
 * should be able to ask for in a loop.
 */
export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied

  const workbook = await getTrainingWorkbook()
  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': TRAINING_WORKBOOK_MIME,
      'Content-Disposition': 'attachment; filename="runomics-training-data.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
