import { type NextRequest } from 'next/server'
import { getTrainingWorkbook, TRAINING_WORKBOOK_MIME } from '@/application/usecases/GetTrainingWorkbook'
import { requireOwner } from '@/lib/ownerRoute'

export const runtime = 'nodejs'

/**
 * Owner-only, unlike the rest of the site: the workbook's Athlete sheet carries
 * weight, BMI, resting and max heart rate, age and sex.
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
