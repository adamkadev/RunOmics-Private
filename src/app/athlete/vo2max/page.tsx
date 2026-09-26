import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVo2Grade } from '@/application/usecases/GetVo2Grade'
import { Vo2GradeDetail } from '@/components/profile/Vo2GradeDetail'
import { t } from '@/i18n'

export const metadata: Metadata = { title: t.vo2Grade.title }

export const revalidate = 3600

export default function Vo2GradePage() {
  const view = getVo2Grade()
  if (!view) notFound()
  return <Vo2GradeDetail view={view} />
}
