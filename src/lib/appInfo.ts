// App identity written into backups. Keep APP_VERSION equal to "version" in package.json (a test checks this).
export const APP_VERSION = '0.4.0'

/** A restore file larger than this is refused without being read (spec 6). */
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024
