import { t } from '@/i18n'

export const EFFORTS = [
  { key: '1k',       km: 1        },
  { key: '1mile',    km: 1.60934  },
  { key: '5k',       km: 5        },
  { key: '10k',      km: 10       },
  { key: 'half',     km: 21.0975  },
  { key: 'marathon', km: 42.195   },
].map((e) => ({ ...e, label: t.records.distances[e.key]! }))

export const DISTANCE_KEY: Record<string, string> = {
  '1K': '1k',
  '5K': '5k',
  '10K': '10k',
  'Half-Marathon': 'half',
  'Marathon': 'marathon',
}
