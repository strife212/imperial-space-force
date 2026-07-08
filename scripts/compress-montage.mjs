// ─────────────────────────────────────────────────────────────────────────────
// Compress the /public/montage reel assets in place:
//   node scripts/compress-montage.mjs
//
// Any image over MAX_BYTES (2 MB) is re-encoded down to fit, and anything
// wider/taller than MAX_DIM (4K long edge) is first downscaled with a
// high-quality Lanczos resample. Formats are preserved (filenames are baked
// into the montage REEL). Quality is stepped down only as far as needed:
//   · JPEG → mozjpeg, quality 90 → 55 in steps of 5
//   · PNG  → lossless max-compression first; if still too big, palette
//            quantisation (256 colours, full dither) quality 95 → 60
// Files already at or under the cap are left untouched.
// ─────────────────────────────────────────────────────────────────────────────
import sharp from 'sharp'
import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = new URL('../public/montage', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const MAX_BYTES = 2 * 1024 * 1024
const MAX_DIM = 3840

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|jfif|png|webp)$/i.test(f))
let touched = 0
for (const f of files) {
  const path = join(DIR, f)
  const before = (await stat(path)).size
  if (before <= MAX_BYTES) continue

  const isPng = /\.png$/i.test(f)
  // operate on an in-memory buffer — sharp keeping the source file open blocks
  // overwriting it on Windows otherwise
  const input = await readFile(path)
  const meta = await sharp(input).metadata()
  const long = Math.max(meta.width || 0, meta.height || 0)
  const makeBase = () => {
    let p = sharp(input).rotate()   // bake EXIF orientation before re-encoding
    if (long > MAX_DIM) p = p.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    return p
  }

  let buf = null, how = ''
  if (isPng) {
    // pass 1 · lossless, max deflate — often enough once resized
    buf = await makeBase().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    how = 'png lossless'
    if (buf.length > MAX_BYTES) {
      // pass 2 · palette quantisation, easing quality only as far as needed
      for (let q = 95; q >= 60; q -= 5) {
        buf = await makeBase().png({ palette: true, quality: q, effort: 10, dither: 1.0, compressionLevel: 9 }).toBuffer()
        how = `png palette q${q}`
        if (buf.length <= MAX_BYTES) break
      }
    }
  } else {
    for (let q = 90; q >= 55; q -= 5) {
      buf = await makeBase().jpeg({ quality: q, mozjpeg: true }).toBuffer()
      how = `jpeg q${q}`
      if (buf.length <= MAX_BYTES) break
    }
  }

  await writeFile(path, buf)
  touched++
  const dims = long > MAX_DIM ? ` · ${meta.width}×${meta.height} → ≤${MAX_DIM}` : ''
  console.log(`${f}\n  ${fmt(before)} → ${fmt(buf.length)}  (${how}${dims})${buf.length > MAX_BYTES ? '  ⚠ still over cap' : ''}`)
}
console.log(`\n${touched} file(s) compressed; ${files.length - touched} already under ${fmt(MAX_BYTES)}.`)
