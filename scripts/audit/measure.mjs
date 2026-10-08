// Page-side measurements used by the audits. These functions run INSIDE the page (via page.evaluate).

/** Every interactive element on screen with its effective tap-target size. */
export function measureTargets(page) {
  return page.evaluate(() => {
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=link], [role=menuitem], [role=spinbutton], [tabindex]:not([tabindex="-1"])'
    const out = []
    for (const el of document.querySelectorAll(SEL)) {
      if (el.closest('[inert]') || el.closest('.sr-only')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el.getClientRects().length === 0) continue
      let box = el
      let via = ''
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        const label = el.closest('label')
        if (label) { box = label; via = 'its label' }
      }
      const r = box.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim().slice(0, 50)
      const exempt = el.classList.contains('chart-hit') ? 'chart bar with a full-size alternative (the selected-week picker below the chart)' : ''
      out.push({
        desc: `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''}${el.type && el.tagName === 'INPUT' ? `[type=${el.type}]` : ''} "${name}"${via ? ` (measured via ${via})` : ''}`,
        w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, exempt,
      })
    }
    return out
  })
}

/** Text size of every field, and whether anything is cut off, overlapping or scrolling sideways. */
export function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = []
    const vw = window.innerWidth
    const visible = (el) => {
      if (el.closest('[inert]') || el.closest('.sr-only')) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0
    }
    // Fixed or sticky bars (tab bar, headers) sit above content that scrolls underneath: that is not an overlap at rest.
    const pinnedRoot = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const pos = getComputedStyle(a).position
        if (pos === 'fixed' || pos === 'sticky') return a
      }
      return null
    }
    // Part of a text box that is actually visible: cut by every scrolling or clipping parent. Null if none of it shows.
    const clipToScrollers = (rect, el) => {
      let l = rect.left, t = rect.top, r = rect.right, b = rect.bottom
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue
        const ar = a.getBoundingClientRect()
        if (cs.overflowY !== 'visible') { t = Math.max(t, ar.top); b = Math.min(b, ar.bottom) }
        if (cs.overflowX !== 'visible' && a.scrollWidth <= a.clientWidth + 1) { l = Math.max(l, ar.left); r = Math.min(r, ar.right) }
      }
      if (r - l < 1 || b - t < 1) return null
      return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }
    }
    const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`

    if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls sideways: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`)
    for (const el of document.querySelectorAll('.screen, .overlay-screen, .runner-body, .runner, .dialog, .dialog-backdrop')) {
      if (visible(el) && el.scrollWidth > el.clientWidth + 1) problems.push(`${label(el)} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`)
    }
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (!visible(el) || el.closest('.sr-only')) continue
      const px = parseFloat(getComputedStyle(el).fontSize)
      if (px < 16) problems.push(`field text is ${px}px (under 16): ${label(el)}`)
    }

    // A one-word button label that has been broken across lines ("Clos" / "e").
    for (const el of document.querySelectorAll('button, [role=button], a[href], summary')) {
      if (!visible(el)) continue
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text || text.includes(' ')) continue
      const lines = new Set()
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let t = tw.nextNode(); t; t = tw.nextNode()) {
        if (t.parentElement.closest('svg') || !t.textContent.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(t)
        for (const r of range.getClientRects()) if (r.width > 1) lines.add(Math.round(r.top / 4))
      }
      if (lines.size > 1) problems.push(`one-word label broken over lines: ${label(el)}`)
    }

    // Text boxes: off screen, clipped, or overlapping another text box.
    const boxes = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.replace(/\s+/g, ' ').trim()
      const parent = n.parentElement
      if (!text || !parent || parent.closest('svg, script, style, [inert]') || !visible(parent)) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const closed = parent.closest('details:not([open])')
      if (closed && !parent.closest('summary')) continue // folded away: not on screen
      for (const raw of range.getClientRects()) {
        if (raw.width < 1 || raw.height < 1) continue
        const r = clipToScrollers(raw, parent)
        if (!r) continue // scrolled out of view inside its own scroll area
        boxes.push({ r, parent, text, pinned: pinnedRoot(parent) })
        if (r.right > vw + 1 || r.left < -1) problems.push(`text off screen: ${label(parent)} (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`)
      }
      for (let a = parent; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && a.scrollWidth > a.clientWidth + 1) { problems.push(`text cut off by ${label(a)} (${a.scrollWidth} > ${a.clientWidth})`); break }
      }
    }
    // Overlap: two different elements whose text rectangles intersect clearly.
    const seen = new Set()
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.pinned !== b.pinned) continue
        if (a.parent === b.parent || a.parent.contains(b.parent) || b.parent.contains(a.parent)) continue
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (w > 2 && h > 3) {
          const key = a.text.slice(0, 20) + '|' + b.text.slice(0, 20)
          if (!seen.has(key)) { seen.add(key); problems.push(`text overlaps: "${a.text.slice(0, 30)}" and "${b.text.slice(0, 30)}" (${Math.round(w)}x${Math.round(h)}px)`) }
        }
      }
    }
    return problems
  })
}
