// Fails if any colour pair used by the app drops below its WCAG AA threshold in either theme.
// Tokens are read from styles.css itself, so changing a colour there is checked automatically.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, readThemeTokens, type ThemeName } from './lib/contrast'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const themes = readThemeTokens(css)

const SURFACES = ['--bg', '--surface', '--surface-2']

/** [foreground token, background tokens, minimum ratio, what it is] */
const PAIRS: Array<[string, string[], number, string]> = [
  // Normal text: 4.5
  ['--text', SURFACES, 4.5, 'body text'],
  ['--text-muted', SURFACES, 4.5, 'secondary text, chart labels, field labels'],
  ['--placeholder', ['--surface-2', '--surface'], 4.5, 'placeholder text inside inputs'],
  ['--accent', SURFACES, 4.5, 'accent used as text (current tab, link-style actions)'],
  ['--met', SURFACES, 4.5, '"met" badge text'],
  ['--not-yet', SURFACES, 4.5, '"not yet" badge text'],
  ['--danger', SURFACES, 4.5, 'error text and danger buttons'],
  ['--accent-text', ['--accent'], 4.5, 'text on accent buttons, selected chips and tabs'],
  ['--on-met', ['--met'], 4.5, 'text on the Hit button'],
  // Disabled controls are exempt from WCAG, but we still keep them readable.
  ['--disabled-text', ['--disabled-bg'], 3, 'disabled button text (exempt from WCAG; held to 3:1 anyway)'],
  // UI components and chart marks: 3
  ['--control-border', SURFACES, 3, 'borders of inputs, selects, text areas and option cards'],
  ['--accent', SURFACES, 3, 'focus ring, chart bars, trend line and dots, met/not-met markers'],
  ['--met', SURFACES, 3, 'met check icon'],
  ['--not-yet', SURFACES, 3, 'not-yet clock icon'],
  ['--text-muted', ['--surface', '--surface-2'], 3, 'hatching on rest-week bars, axis baseline, progress dots'],
  ['--text', ['--surface', '--surface-2'], 3, 'target and benchmark dashed lines'],
  ['--grid', ['--surface'], 3, 'chart gridlines (charts are always drawn on a card)'],
]

describe.each<ThemeName>(['dark', 'light'])('%s theme contrast', (theme) => {
  const tokens = themes[theme]
  const get = (name: string) => {
    const v = tokens[name]
    if (!v) throw new Error(`${name} is not defined for the ${theme} theme`)
    return v
  }

  for (const [fg, bgs, min, what] of PAIRS) {
    for (const bg of bgs) {
      it(`${fg} on ${bg} is at least ${min}:1 (${what})`, () => {
        const ratio = contrastRatio(get(fg), get(bg))
        expect(ratio, `${fg} ${get(fg)} on ${bg} ${get(bg)} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min)
      })
    }
  }

  it('prints the table when PRINT_CONTRAST is set', () => {
    if (!process.env.PRINT_CONTRAST) return
    for (const [fg, bgs, min, what] of PAIRS) {
      for (const bg of bgs) console.log(`${theme}\t${fg} on ${bg}\t${contrastRatio(get(fg), get(bg)).toFixed(2)}\tmin ${min}\t${what}`)
    }
  })
})

describe('contrast helpers', () => {
  it('black on white is 21:1 and identical colours are 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
  it('the light theme overrides the dark tokens it redefines and inherits the rest', () => {
    expect(themes.light['--bg']).not.toBe(themes.dark['--bg'])
    expect(themes.light['--nav-h']).toBe(themes.dark['--nav-h'])
  })
})
