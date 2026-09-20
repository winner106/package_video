import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

/**
 * Tech-style Tauri icon generator (theme: #004ea2)
 * - Generates app-icon.png (1024x1024) with a "cool tech" look
 * - Runs: pnpm tauri icon app-icon.png  -> fills src-tauri/icons/*
 * - Generates tray icons:
 *    src-tauri/icons/SystemTray1.png + .ico
 *    src-tauri/icons/SystemTray2.png + .ico
 *
 * Usage:
 *   pnpm icons
 *   pnpm icons -- T
 *   pnpm icons -- "VM\nAgent"
 *   pnpm icons -- "B9"
 */
const root = process.cwd()
const iconsDir = path.join(root, 'src-tauri', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

const basePng = path.join(root, 'app-icon.png')

// ------------------------- Helpers -------------------------
const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1))
const pick = arrOrStr => arrOrStr[Math.floor(Math.random() * arrOrStr.length)]

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function parseArgs(argv) {
  // 支持：
  // pnpm icons:gen -- "刘\n振" --tray1 "#004ea2" --tray2 "#ff5a3c"
  // 只传文本也行
  const out = { text: null, tray1: null, tray2: null }

  const args = [...argv]
  // 提取 --tray1 / --tray2
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--tray1' && args[i + 1]) {
      out.tray1 = args[i + 1]
      args.splice(i, 2)
      i--
      continue
    }
    if (a === '--tray2' && args[i + 1]) {
      out.tray2 = args[i + 1]
      args.splice(i, 2)
      i--
      continue
    }
  }

  out.text = args.join(' ').trim() || null
  return out
}

function normalizeHexColor(s) {
  if (!s) return null
  let c = String(s).trim()
  if (!c) return null

  // allow "004ea2"
  if (/^[0-9a-fA-F]{6}$/.test(c)) c = '#' + c

  // #RGB -> #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    c =
      '#' +
      c
        .slice(1)
        .split('')
        .map(ch => ch + ch)
        .join('')
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return null
  return c.toLowerCase()
}

function charLen(str) {
  return Array.from(str).length
}

function isMostlyAscii(str) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]+$/.test(str)
}

function defaultLabel() {
  const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return `${pick(pool)}${pick(pool)}`
}

/** Convert literal "\n" in CLI argument into real newline. */
function normalizeTextArg(raw) {
  if (!raw) return null

  // 1️⃣ 把字面量 \n → 真正换行
  let s = String(raw).replace(/\\n/g, '\n')

  // 2️⃣ 移除任何残留的单独反斜杠（防御性处理）
  //    （正常情况下到这一步已经没有 \ 了）
  s = s.replace(/\\/g, '')

  return s.trim()
}

/** Split label into lines (max 2 lines recommended for icon). */
function splitLines(label) {
  const lines = String(label)
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  if (lines.length <= 1) return [label.trim()]
  // Keep at most 2 lines for aesthetics; merge the rest into line2
  if (lines.length > 2) {
    return [lines[0], lines.slice(1).join(' ')]
  }
  return lines
}

/** Auto size based on lines and length. */
function autoFontSizeForLines(lines) {
  // Heuristic tuned for 1024 canvas:
  // - one line: big
  // - two lines: smaller, balanced
  const maxLen = Math.max(...lines.map(charLen))
  if (lines.length === 1) {
    if (maxLen <= 1) return 560
    if (maxLen === 2) return 420
    if (maxLen === 3) return 340
    if (maxLen === 4) return 290
    return 250
  }
  // two lines
  if (maxLen <= 1) return 420
  if (maxLen === 2) return 320
  if (maxLen === 3) return 260
  return 220
}

function autoLetterSpacing(line) {
  const len = charLen(line)
  // English abbreviations look nicer slightly tight; Chinese usually 0
  if (!isMostlyAscii(line)) return '0'
  if (len <= 1) return '0'
  if (len === 2) return '-10'
  if (len === 3) return '-12'
  return '-14'
}

function textDyForLines(lines) {
  if (!lines.every(isMostlyAscii)) return '0.00em'
  if (lines.length === 1 && charLen(lines[0]) <= 1) return '0.00em'
  return '0.08em'
}

/** Theme palette built around #004ea2 */
function palette004ea2() {
  // Base: #004ea2 (0,78,162)
  // Add: deeper navy + cyan accent
  const base = '#004ea2'
  const deepNavy = '#001a3a' // very dark blue
  const deepBlue = '#002e6f' // darker blue
  const cyan = '#4fd4ff' // tech neon accent
  const cyan2 = '#9ae6ff' // soft glow
  // Slight randomness within tight range to keep "alive" while staying on brand
  const bg1 = `rgb(${rand(0, 6)},${rand(55, 88)},${rand(150, 185)})` // close to #004ea2
  const bg2 = `rgb(${rand(0, 12)},${rand(18, 55)},${rand(70, 125)})` // deep blue
  return { base, deepNavy, deepBlue, cyan, cyan2, bg1, bg2 }
}

// ------------------------- App Icon (Tech Style, #004ea2) -------------------------
async function genTechAppBasePng(outPng, labelRaw) {
  const labelNorm = normalizeTextArg(labelRaw) ?? defaultLabel()
  const lines = splitLines(labelNorm)
  const safeLines = lines.map(escapeXml)

  const size = 1024
  const r = Math.round(size * 0.225)

  const { base, deepNavy, deepBlue, cyan, cyan2, bg1, bg2 } = palette004ea2()

  const fontSize = autoFontSizeForLines(lines)

  // 行高：中文两行建议更紧凑一点，但不要挤
  const lineHeight = Math.round(fontSize * (lines.length >= 2 ? 1.08 : 1.0))

  // 让“整块文字”居中：第一行的 baseline 起点
  const cx = Math.round(size / 2)
  const cy = Math.round(size / 2)
  const startY = Math.round(cy - ((lines.length - 1) * lineHeight) / 2)

  // 光学微调：中文一般不需要太多 dy，英文略向下更舒服
  const dy = textDyForLines(lines)

  // 两行时用纯数字 y，避免 calc() 失效
  const lineGap = Math.round(fontSize * 0.95)
  const y1 = Math.round(cy - lineGap / 2)
  const y2 = Math.round(cy + lineGap / 2)

  // Neon ring / accents are now aligned to #004ea2 vibe
  const svg = `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bg1}"/>
        <stop offset="0.55" stop-color="${base}"/>
        <stop offset="1" stop-color="${bg2}"/>
      </linearGradient>

      <!-- Soft corner glow -->
      <radialGradient id="glow" cx="30%" cy="22%" r="72%">
        <stop offset="0" stop-color="${cyan2}" stop-opacity="0.35"/>
        <stop offset="0.45" stop-color="${cyan}" stop-opacity="0.16"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </radialGradient>

      <!-- Subtle noise -->
      <filter id="noise" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 .10 0"/>
      </filter>

      <!-- Inner shadow -->
      <filter id="innerShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feOffset dx="0" dy="16"/>
        <feGaussianBlur stdDeviation="16" result="b"/>
        <feComposite in="b" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="s"/>
        <feColorMatrix in="s" type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 .58 0"/>
        <feComposite in2="SourceGraphic" operator="over"/>
      </filter>

      <!-- Text glow: blue-cyan -->
      <filter id="textGlow" x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="11" result="blur"/>
        <feColorMatrix in="blur" type="matrix"
          values="0 0 0 0 0.20
                  0 0 0 0 0.78
                  0 0 0 0 1.00
                  0 0 0 .65 0" result="glow"/>
        <feComposite in="glow" in2="SourceGraphic" operator="over"/>
      </filter>

      <!-- Grid pattern -->
      <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M56 0H0V56" fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="2"/>
      </pattern>

      <!-- Scanlines -->
      <pattern id="scan" width="1" height="18" patternUnits="userSpaceOnUse">
        <rect width="1" height="18" fill="rgba(255,255,255,0.00)"/>
        <rect y="0" width="1" height="2" fill="rgba(255,255,255,0.035)"/>
      </pattern>

      <!-- Vignette (edges darker) -->
      <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
        <stop offset="0" stop-color="rgba(0,0,0,0)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.35)"/>
      </radialGradient>
    </defs>

    <!-- Base -->
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>

    <!-- Glow wash -->
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#glow)"/>

    <!-- Grid + scanlines -->
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#grid)" opacity="0.65"/>
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#scan)" opacity="0.35"/>

    <!-- Noise -->
    <rect width="${size}" height="${size}" rx="${r}" filter="url(#noise)" opacity="0.9"/>

    <!-- Vignette -->
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#vignette)" opacity="0.85"/>

    <!-- Inner shadow -->
    <rect width="${size}" height="${size}" rx="${r}" fill="transparent" filter="url(#innerShadow)"/>

    <!-- Neon ring -->
    <rect x="${Math.round(size * 0.035)}" y="${Math.round(size * 0.035)}"
          width="${Math.round(size * 0.93)}" height="${Math.round(size * 0.93)}"
          rx="${Math.round(size * 0.205)}"
          fill="transparent"
          stroke="rgba(79,212,255,0.20)"
          stroke-width="${Math.round(size * 0.012)}"/>
    <rect x="${Math.round(size * 0.06)}" y="${Math.round(size * 0.06)}"
          width="${Math.round(size * 0.88)}" height="${Math.round(size * 0.88)}"
          rx="${Math.round(size * 0.19)}"
          fill="transparent"
          stroke="rgba(255,255,255,0.085)"
          stroke-width="${Math.round(size * 0.006)}"/>

    <!-- Accent arc -->
    <path d="M120 270 C170 150 280 90 460 70"
          fill="none" stroke="rgba(79,212,255,0.24)" stroke-width="14" stroke-linecap="round"/>
    <circle cx="460" cy="70" r="10" fill="rgba(79,212,255,0.42)"/>

    <!-- Subtle tech hex mark -->
    <g opacity="0.15" transform="translate(${size / 2},${size / 2})">
      <path d="M0,-255 220,-128 220,128 0,255 -220,128 -220,-128 Z"
            fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="10"/>
      <path d="M0,-186 160,-93 160,93 0,186 -160,93 -160,-93 Z"
            fill="none" stroke="rgba(79,212,255,0.65)" stroke-width="8"/>
    </g>
    <!-- Text (tspan multiline, block-centered) -->
    <g filter="url(#textGlow)">
      <text x="${cx}" y="${startY}"
            text-anchor="middle"
            dominant-baseline="middle"
            dy="${dy}"
            font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans, sans-serif"
            font-size="${fontSize}"
            font-weight="850"
            fill="rgba(255,255,255,0.95)">
        ${safeLines
          .map((ln, i) => {
            // 每行单独的字距：中文 0，英文略收紧
            const ls = autoLetterSpacing(lines[i])
            const dyPx = i === 0 ? 0 : lineHeight
            return `<tspan x="${cx}" dy="${dyPx}" letter-spacing="${ls}">${ln}</tspan>`
          })
          .join('\n')}
      </text>
    </g>
  </svg>`

  const logoSvgPath = path.join(root, 'src', 'assets', 'logo.svg')
  fs.mkdirSync(path.dirname(logoSvgPath), { recursive: true })
  fs.writeFileSync(logoSvgPath, svg.trim() + '\n', 'utf8')

  await sharp(Buffer.from(svg)).png().toFile(outPng)
  return { label: lines.join('\n') }
}

// ------------------------- Tray Icons (Tech Style, #004ea2) -------------------------
async function genTrayPng({ outPng, labelRaw, bgColor }) {
  const labelNorm = normalizeTextArg(labelRaw) ?? defaultLabel()
  const lines = splitLines(labelNorm)
  const text = lines[0] // tray 强制单行（更清晰）
  const safeText = escapeXml(text)

  // 输出规格：PNG 72x72
  const OUT = 72

  // 用更大的内部画布（256）绘制，再缩小到 72，边缘更干净
  const CANVAS = 256
  const cx = CANVAS / 2
  const cy = CANVAS / 2

  const len = charLen(text)

  // 字号：确保缩小后仍可读
  let fontSize = 160
  if (len === 1) fontSize = 176
  else if (len === 2) fontSize = 152
  else if (len === 3) fontSize = 132
  else fontSize = 116

  // 托盘：背景有色 + 白字 + 轻描边，提升对比
  const fill = 'rgba(255,255,255,0.96)'
  const stroke = 'rgba(0,0,0,0.22)'

  // 圆角矩形背景（更像系统托盘 badge/图标块）
  const r = 56 // 256 画布下的圆角
  const bg = bgColor

  const dy = textDyForLines([text])

  const svg = `
  <svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" rx="${r}" fill="${bg}"/>

    <!-- subtle inner highlight -->
    <rect x="10" y="10" width="${CANVAS - 20}" height="${CANVAS - 20}" rx="${r - 12}"
          fill="transparent" stroke="rgba(255,255,255,0.14)" stroke-width="10"/>

    <!-- Text -->
    <text x="${cx}" y="${cy}"
          text-anchor="middle"
          dominant-baseline="middle"
          dy="${dy}"
          font-family="Inter, Segoe UI, Arial, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          letter-spacing="${autoLetterSpacing(text)}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="10"
          paint-order="stroke fill">${safeText}</text>
  </svg>`

  await sharp(Buffer.from(svg)).png().resize(OUT, OUT, { fit: 'contain' }).toFile(outPng)
}

async function trayToIco256({ labelRaw, bgColor, outIco }) {
  const tmpDir = path.join(root, '.tmp-icons')
  fs.mkdirSync(tmpDir, { recursive: true })

  const labelNorm = normalizeTextArg(labelRaw) ?? defaultLabel()
  const lines = splitLines(labelNorm)
  const text = lines[0]
  const safeText = escapeXml(text)

  const CANVAS = 256
  const cx = CANVAS / 2
  const cy = CANVAS / 2

  const len = charLen(text)
  let fontSize = 160
  if (len === 1) fontSize = 176
  else if (len === 2) fontSize = 152
  else if (len === 3) fontSize = 132
  else fontSize = 116

  const fill = 'rgba(255,255,255,0.96)'
  const stroke = 'rgba(0,0,0,0.22)'
  const r = 56
  const dy = textDyForLines([text])

  const svg = `
  <svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" rx="${r}" fill="${bgColor}"/>
    <rect x="10" y="10" width="${CANVAS - 20}" height="${CANVAS - 20}" rx="${r - 12}"
          fill="transparent" stroke="rgba(255,255,255,0.14)" stroke-width="10"/>
    <text x="${cx}" y="${cy}"
          text-anchor="middle"
          dominant-baseline="middle"
          dy="${dy}"
          font-family="Inter, Segoe UI, Arial, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          letter-spacing="${autoLetterSpacing(text)}"
          fill="${fill}"
          stroke="${stroke}"
          stroke-width="10"
          paint-order="stroke fill">${safeText}</text>
  </svg>`

  const png256 = path.join(tmpDir, `tray_${bgColor.replace('#', '')}_256.png`)
  await sharp(Buffer.from(svg)).png().toFile(png256)

  const icoBuf = await pngToIco([png256]) // 只包含 256 帧
  fs.writeFileSync(outIco, icoBuf)

  fs.unlinkSync(png256)
}

// ------------------------- Main -------------------------
async function main() {
  const { text: argText, tray1, tray2 } = parseArgs(process.argv.slice(2))
  const argTextNorm = normalizeTextArg(argText) || null

  const { label } = await genTechAppBasePng(basePng, argTextNorm)
  console.log(`✅ Generated base app icon: ${basePng} (text="${label.replaceAll('\n', '\\n')}")`)

  // Generate all platform icons into src-tauri/icons
  execSync(`pnpm tauri icon "${basePng}"`, { stdio: 'inherit' })

  // Tray icons (match text; tray uses first line only)
  const tray1Png = path.join(iconsDir, 'SystemTray1.png')
  const tray2Png = path.join(iconsDir, 'SystemTray2.png')
  const tray1Ico = path.join(iconsDir, 'SystemTray1.ico')
  const tray2Ico = path.join(iconsDir, 'SystemTray2.ico')

  // 默认两种 SystemTray 背景色（你可以随时换）
  // 1：主色 #004ea2
  // 2：状态色（比如“忙碌/警告”）#ff5a3c
  const trayBg1 = normalizeHexColor(tray1) || '#004ea2'
  const trayBg2 = normalizeHexColor(tray2) || '#ff5a3c'

  await genTrayPng({ outPng: tray1Png, labelRaw: label, bgColor: trayBg1 })
  await genTrayPng({ outPng: tray2Png, labelRaw: label, bgColor: trayBg2 })

  await trayToIco256({ labelRaw: label, bgColor: trayBg1, outIco: tray1Ico })
  await trayToIco256({ labelRaw: label, bgColor: trayBg2, outIco: tray2Ico })

  console.log('🎉 Done:')
  console.log(' - App icons updated under src-tauri/icons (via tauri icon)')
  console.log(' - Tray icons generated:')
  console.log(`   ${tray1Png}`)
  console.log(`   ${tray1Ico}`)
  console.log(`   ${tray2Png}`)
  console.log(`   ${tray2Ico}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
