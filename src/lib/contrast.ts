// WCAG 2.x contrast maths and a reader for the theme tokens in styles.css (spec 12 stage 5: AA contrast).
// Used by styles.contrast.test.ts, which fails if any token pair drops below its threshold.

export type Rgb = [number, number, number]

/** Parses #rgb or #rrggbb. */
export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export type ThemeName = 'dark' | 'light'
export type Tokens = Record<string, string>

function declarations(block: string): Tokens {
  const out: Tokens = {}
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim()
  return out
}

/** Reads the custom properties of `:root` (dark, the default) and `:root[data-theme='light']` (overrides dark). */
export function readThemeTokens(css: string): Record<ThemeName, Tokens> {
  const root = css.match(/:root\s*\{([^}]*)\}/)
  const light = css.match(/:root\[data-theme=['"]light['"]\]\s*\{([^}]*)\}/)
  if (!root || !light) throw new Error('styles.css must define :root and :root[data-theme="light"]')
  const dark = declarations(root[1])
  return { dark, light: { ...dark, ...declarations(light[1]) } }
}
