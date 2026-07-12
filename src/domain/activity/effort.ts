export const EFFORTS = [
  { key: '1k',       label: '1K',       km: 1        },
  { key: '1mile',    label: '1 Mile',   km: 1.60934  },
  { key: '5k',       label: '5K',       km: 5        },
  { key: '10k',      label: '10K',      km: 10       },
  { key: 'half',     label: 'Half',     km: 21.0975  },
  { key: 'marathon', label: 'Marathon', km: 42.195   },
]

export const DISTANCE_KEY: Record<string, string> = {
  '1K': '1k',
  '5K': '5k',
  '10K': '10k',
  'Half-Marathon': 'half',
  'Marathon': 'marathon',
}
