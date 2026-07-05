/** Hands a generated file to the user.
 *
 * iOS PWAs (standalone mode) have no downloads UI - a blob download either
 * fails silently or opens an awkward preview - so there the native share
 * sheet is used instead (Save to Files, AirDrop, Mail...). Everywhere else
 * a regular download is triggered.
 */
export async function saveFileWithFallback(file: File): Promise<void> {
  const isIosPwa =
    /iPhone|iPad/.test(navigator.userAgent) &&
    'standalone' in navigator &&
    (navigator as unknown as { standalone: boolean }).standalone === true
  if (isIosPwa && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
      else return // user closed the share sheet: don't also download
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
}
