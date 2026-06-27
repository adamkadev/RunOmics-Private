import { NextResponse } from 'next/server'
import { getActivitiesCsv } from '@/application/usecases/GetActivitiesCsv'

export async function GET() {
  const csv = getActivitiesCsv()
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="runomics-activities.csv"',
    },
  })
}
