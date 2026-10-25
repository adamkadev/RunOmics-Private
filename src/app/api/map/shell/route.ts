import type { NextRequest } from 'next/server'
import { getAllRoutes, getMapShellData, getMapVersion } from '@/application/usecases/GetAllRoutes'
import { loadData } from '@/application/usecases/LoadData'
import { build, versionedAnswer, type Built } from '../versionedAnswer'

const built = new WeakMap<object, Built>()

/** The map's runs and areas, fetched when the map opens rather than with every load of the list. */
export async function GET(req: NextRequest) {
  await loadData()
  const data = getAllRoutes()
  let answer = built.get(data)
  if (!answer) built.set(data, (answer = build(getMapShellData())))
  return versionedAnswer(req, getMapVersion(), answer)
}
