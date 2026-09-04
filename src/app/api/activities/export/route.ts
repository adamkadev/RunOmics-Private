import { getTrainingWorkbook, TRAINING_WORKBOOK_MIME } from '@/application/usecases/GetTrainingWorkbook'

export const runtime = 'nodejs'

export async function GET() {
  const workbook = await getTrainingWorkbook()
  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': TRAINING_WORKBOOK_MIME,
      'Content-Disposition': 'attachment; filename="runomics-training-data.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
