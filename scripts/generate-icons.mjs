// Generates the app icons (original design: orange ball with a curved loop arc on near-black).
// Run automatically by `npm run build`; output goes to public/icons/.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// scale = how large the ball is relative to the canvas (maskable needs a larger safe margin).
function svg(scale) {
  const s = scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0c"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <circle cx="256" cy="256" r="170" fill="#ff7a1a"/>
    <circle cx="256" cy="256" r="170" fill="none" stroke="#ffb27a" stroke-width="6" opacity="0.5"/>
    <path d="M 120 330 C 150 150, 360 120, 392 250" fill="none" stroke="#0b0b0c" stroke-width="26" stroke-linecap="round"/>
    <path d="M 364 222 L 394 254 L 350 270" fill="none" stroke="#0b0b0c" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}

const anyIcon = svg(1.0)
const maskable = svg(0.78)
writeFileSync(join(outDir, 'icon.svg'), anyIcon)
await sharp(Buffer.from(anyIcon)).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'))
await sharp(Buffer.from(anyIcon)).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'))
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(join(outDir, 'maskable-512.png'))
console.log('icons written to', outDir)
