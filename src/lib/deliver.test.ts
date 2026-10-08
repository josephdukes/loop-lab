// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSeededDb } from '../test/helpers'
import { addSession } from '../test/fixtures'
import { copyText, canShareFiles, shareFiles, textFile } from './deliver'
import { performBackup } from './backup/backupActions'
import { shareAllCsv } from './export/exportActions'
import { buildAllCsvFiles } from './export/exportCsv'
import { loadExportData } from './export/exportActions'

const h = useSeededDb()

function setNavigator(overrides: Record<string, unknown>) {
  for (const [k, v] of Object.entries(overrides)) Object.defineProperty(navigator, k, { value: v, configurable: true })
}
function clearNavigator(...keys: string[]) {
  for (const k of keys) delete (navigator as unknown as Record<string, unknown>)[k]
}
function mockDownloads() {
  const created: string[] = []
  const clicks: string[] = []
  ;(URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => { created.push('blob:x'); return 'blob:x' })
  ;(URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn()
  const original = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { clicks.push(this.download) }
  return { clicks, restore: () => { HTMLAnchorElement.prototype.click = original } }
}

afterEach(() => { clearNavigator('share', 'canShare', 'clipboard'); vi.useRealTimers() })

describe('clipboard', () => {
  it('copies when the Clipboard API works and reports blocked when it throws or is missing', async () => {
    const writeText = vi.fn(async () => {})
    setNavigator({ clipboard: { writeText } })
    expect(await copyText('hello')).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('hello')
    setNavigator({ clipboard: { writeText: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError') }) } })
    expect(await copyText('hello')).toBe('blocked')
    clearNavigator('clipboard')
    expect(await copyText('hello')).toBe('blocked')
  })
})

describe('share sheet', () => {
  const file = () => [textFile('x', 'a.json', 'application/json')]
  it('is unsupported without navigator.share/canShare, or when canShare says no', async () => {
    expect(canShareFiles(file())).toBe(false)
    expect(await shareFiles(file(), 't')).toBe('unsupported')
    setNavigator({ share: vi.fn(), canShare: () => false })
    expect(canShareFiles(file())).toBe(false)
  })
  it('reports shared, and cancelled when the person closes the sheet', async () => {
    setNavigator({ share: vi.fn(async () => {}), canShare: () => true })
    expect(await shareFiles(file(), 't')).toBe('shared')
    setNavigator({ share: vi.fn(async () => { throw new DOMException('closed', 'AbortError') }), canShare: () => true })
    expect(await shareFiles(file(), 't')).toBe('cancelled')
    setNavigator({ share: vi.fn(async () => { throw new Error('boom') }), canShare: () => true })
    await expect(shareFiles(file(), 't')).rejects.toThrow('boom')
  })
})

describe('recording a backup', () => {
  it('download: starts the download and records lastBackupAt', async () => {
    const db = await h.create()
    await addSession(db, { date: '2026-10-05' })
    const dl = mockDownloads()
    const out = await performBackup(db, 'download', new Date(2026, 9, 7, 12))
    dl.restore()
    expect(out).toEqual({ kind: 'downloaded', filename: 'loop-lab-backup-2026-10-07.json' })
    expect(dl.clicks).toEqual(['loop-lab-backup-2026-10-07.json'])
    expect((await db.settings.get('settings'))?.lastBackupAt).toBe(new Date(2026, 9, 7, 12).toISOString())
  })

  it('share completed: records lastBackupAt, no download', async () => {
    const db = await h.create()
    const share = vi.fn(async () => {})
    setNavigator({ share, canShare: () => true })
    const dl = mockDownloads()
    const out = await performBackup(db, 'share', new Date(2026, 9, 7, 12))
    dl.restore()
    expect(out.kind).toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    const arg = (share.mock.calls[0] as unknown as [{ files: File[] }])[0]
    expect(arg.files[0].name).toBe('loop-lab-backup-2026-10-07.json')
    expect(dl.clicks).toHaveLength(0)
    expect((await db.settings.get('settings'))?.lastBackupAt).toBe(new Date(2026, 9, 7, 12).toISOString())
  })

  it('share cancelled: lastBackupAt is NOT set and nothing is downloaded', async () => {
    const db = await h.create()
    setNavigator({ share: vi.fn(async () => { throw new DOMException('closed', 'AbortError') }), canShare: () => true })
    const dl = mockDownloads()
    const out = await performBackup(db, 'share')
    dl.restore()
    expect(out.kind).toBe('cancelled')
    expect(dl.clicks).toHaveLength(0)
    expect((await db.settings.get('settings'))?.lastBackupAt).toBeUndefined()
  })

  it('share not supported: falls back to a download and records it', async () => {
    const db = await h.create()
    const dl = mockDownloads()
    const out = await performBackup(db, 'share', new Date(2026, 9, 7, 12))
    dl.restore()
    expect(out.kind).toBe('downloaded')
    expect(dl.clicks).toHaveLength(1)
    expect((await db.settings.get('settings'))?.lastBackupAt).toBeTruthy()
  })

  it('a failing download does not record a backup', async () => {
    const db = await h.create()
    ;(URL as unknown as Record<string, unknown>).createObjectURL = undefined
    await expect(performBackup(db, 'download')).rejects.toThrow(/cannot save files/)
    expect((await db.settings.get('settings'))?.lastBackupAt).toBeUndefined()
  })
})

describe('Share all three', () => {
  it('uses one share sheet with three files where supported, otherwise three downloads', async () => {
    const db = await h.create()
    await addSession(db, { date: '2026-10-05' })
    const files = buildAllCsvFiles(await loadExportData(db), {}, '2026-10-07')

    const share = vi.fn(async () => {})
    setNavigator({ share, canShare: () => true })
    expect(await shareAllCsv(files)).toBe('shared')
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files.map((f) => f.name)).toEqual(files.map((f) => f.filename))
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].type).toBe('text/csv')

    setNavigator({ share: vi.fn(async () => { throw new DOMException('closed', 'AbortError') }), canShare: () => true })
    const dl0 = mockDownloads()
    expect(await shareAllCsv(files)).toBe('cancelled')
    expect(dl0.clicks).toHaveLength(0) // cancelling does not trigger downloads
    dl0.restore()

    clearNavigator('share', 'canShare')
    const dl = mockDownloads()
    expect(await shareAllCsv(files)).toBe('downloaded')
    dl.restore()
    expect(dl.clicks).toEqual(files.map((f) => f.filename))
  })
})
