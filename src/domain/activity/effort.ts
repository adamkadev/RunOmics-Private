import { t } from '@/i18n'

// Distances are domain constants; their display names come from i18n so the
// record labels follow the app locale instead of being pinned to English.
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
