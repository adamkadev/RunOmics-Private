/** `cancelled`: the athlete closed the share sheet without saving. */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled'

export async function saveFileWithFallback(file: File): Promise<SaveOutcome> {
  const isIosPwa =
    /iPhone|iPad/.test(navigator.userAgent) &&
    'standalone' in navigator &&
    (navigator as unknown as { standalone: boolean }).standalone === true
  if (isIosPwa && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
      else return 'cancelled'
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
