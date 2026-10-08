import { describe, expect, it } from 'vitest'
import { describeStorage, formatBytes, readStorageStatus, requestPersistentStorage } from './storage'

describe('storage helpers', () => {
  it('fail quietly when the Storage API is missing (node has no navigator.storage)', async () => {
    expect((await readStorageStatus()).persistence).toBe('unsupported')
    expect(await requestPersistentStorage()).toBe('unsupported')
  })
  it('formats sizes and descriptions', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(describeStorage({ persistence: 'granted', usageBytes: 2048 }).used).toContain('2 KB')
    expect(describeStorage({ persistence: 'not-granted' }).persistence).toContain('not granted')
  })
})
