import { liveSnapshot } from '@/infrastructure/dataFs'
import { loadData as loadSnapshot, rejectedData } from '@/infrastructure/loadData'

export const loadData = loadSnapshot

export const dataVersion = () => ({ dataCommit: liveSnapshot()?.commit ?? null, rejectedData: rejectedData() })
