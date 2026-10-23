import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveFileWithFallback } from '@/lib/fileExport'

const FILE = new File(['a,b\n1,2'], 'export.csv', { type: 'text/csv' })

function mockIosPwa() {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    standalone: true,
    share: vi.fn().mockResolvedValue(undefined),
    canShare: vi.fn().mockReturnValue(true),
  })
}

function mockDesktop() {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    share: vi.fn().mockResolvedValue(undefined),
    canShare: vi.fn().mockReturnValue(true),
  })
}

describe('saveFileWithFallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the native share sheet in an iOS PWA', async () => {
    mockIosPwa()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    await saveFileWithFallback(FILE)

    expect(navigator.share).toHaveBeenCalledWith({ files: [FILE] })
    expect(click).not.toHaveBeenCalled()
  })

  it('does not double up with a download when the user closes the share sheet', async () => {
    mockIosPwa()
    ;(navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('abort'), { name: 'AbortError' })
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    await saveFileWithFallback(FILE)

    expect(click).not.toHaveBeenCalled()
  })

  it('downloads via an anchor everywhere else, even when share is available', async () => {
    mockDesktop()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await saveFileWithFallback(FILE)

    expect(navigator.share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
  })

  describe('says how the save ended', () => {
    it('shared: the share sheet took the file', async () => {
      mockIosPwa()
      await expect(saveFileWithFallback(FILE)).resolves.toBe('shared')
    })

    it('cancelled: the share sheet was closed, and nothing was downloaded', async () => {
      mockIosPwa()
      ;(navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(
        Object.assign(new Error('abort'), { name: 'AbortError' })
      )
      await expect(saveFileWithFallback(FILE)).resolves.toBe('cancelled')
    })

    it('downloaded: no share sheet here', async () => {
      mockDesktop()
      vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() })
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      await expect(saveFileWithFallback(FILE)).resolves.toBe('downloaded')
    })

    it('downloaded: the share sheet failed, so the file was downloaded instead', async () => {
      mockIosPwa()
      ;(navigator.share as ReturnType<typeof vi.fn>).mockRejectedValue(
        Object.assign(new Error('nope'), { name: 'NotAllowedError' })
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() })
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      await expect(saveFileWithFallback(FILE)).resolves.toBe('downloaded')
      expect(click).toHaveBeenCalledOnce()
    })
  })
})
