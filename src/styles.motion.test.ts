// Reduced motion (spec stage 5): the stylesheet must switch off every transition, animation and smooth scroll
// when the phone asks for less motion, and and no script may ask for smooth scrolling.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

describe('reduced motion', () => {
  it('has a prefers-reduced-motion block that disables transitions, animations and smooth scrolling for everything', () => {
    expect(block).toContain('*, *::before, *::after')
    expect(block).toMatch(/transition:\s*none\s*!important/)
    expect(block).toMatch(/animation:\s*none\s*!important/)
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })

  it('the stylesheet never asks for smooth scrolling itself', () => {
    expect(css).not.toMatch(/scroll-behavior\s*:\s*smooth/)
  })

  it('no source file asks for smooth scrolling in script', () => {
    const files = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const offenders = Object.entries(files).filter(([name, text]) => !name.includes('.test.') && /behavior:\s*['"]smooth['"]/.test(text)).map(([n]) => n)
    expect(offenders).toEqual([])
  })
})
