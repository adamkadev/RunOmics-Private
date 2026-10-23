import { t } from '@/i18n'

export function shortDist(distance: string): string {
  return distance === 'Half-Marathon' ? t.goals.half : distance
}
