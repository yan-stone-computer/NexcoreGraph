// 生成 tabBar 图标 PNG（微信小程序不支持 SVG tabBar 图标）
// 纯 Node 实现：RGBA 像素绘制 + zlib 压缩 + CRC32 校验，输出 81x81 PNG
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 81

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---------- 绘制 ----------
function makeCanvas() {
  return new Float64Array(SIZE * SIZE * 4)
}

function blend(img, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = a
}

// 4x 超采样绘制几何形状
function drawShape(img, color, test) {
  const [r, g, b] = color
  const step = 1 / 4
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let hits = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (test(px + (sx + 0.5) * step, py + (sy + 0.5) * step)) hits++
        }
      }
      if (hits > 0) blend(img, px, py, r, g, b, Math.round((hits / 16) * 255))
    }
  }
}

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1
const inCircle = (x, y, cx, cy, r) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + r, Math.min(x, x1 - r))
  const cy = Math.max(y0 + r, Math.min(y, y1 - r))
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r
}

// 房子
function shapeHome(x, y) {
  const roof = y >= 14 && y <= 36 && (() => {
    const t = (y - 14) / (36 - 14)
    const l = 14 + (40 - 14) * t
    const r = 66 - (66 - 40) * t
    return x >= l && x <= r
  })()
  if (roof) return true
  return inRect(x, y, 20, 34, 60, 64) || inRect(x, y, 35, 46, 45, 64)
}

// 资源库（盒子）
function shapeLibrary(x, y) {
  return inRect(x, y, 16, 22, 64, 60) || inRect(x, y, 14, 16, 66, 26) || inRect(x, y, 36, 22, 44, 30)
}

// 对话气泡
function shapeChat(x, y) {
  const bubble = inRoundedRect(x, y, 16, 20, 62, 54, 10)
  if (bubble) return true
  // 尾部
  return x >= 22 && x <= 38 && y >= 52 && y <= 64 && (y - 52) >= (x - 22) * 0.5 && (y - 52) <= (38 - x) * 0.5
}

// 人像
function shapeMine(x, y) {
  if (inCircle(x, y, 40, 30, 10)) return true
  if (inCircle(x, y, 40, 56, 19) && y >= 46) return true
  return false
}

// ---------- 输出 ----------
const GRAY = [153, 153, 153]
const GOLD = [201, 168, 106]

const OUT = path.join(__dirname, '..', 'src', 'assets', 'tabbar')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const icons = [
  ['home', shapeHome],
  ['library', shapeLibrary],
  ['chat', shapeChat],
  ['mine', shapeMine],
]

for (const [name, fn] of icons) {
  for (const [suffix, color] of [['', GRAY], ['-selected', GOLD]]) {
    const img = makeCanvas()
    drawShape(img, color, fn)
    const rgba = Buffer.alloc(SIZE * SIZE * 4)
    for (let i = 0; i < SIZE * SIZE; i++) {
      rgba[i * 4] = img[i * 4]
      rgba[i * 4 + 1] = img[i * 4 + 1]
      rgba[i * 4 + 2] = img[i * 4 + 2]
      rgba[i * 4 + 3] = img[i * 4 + 3]
    }
    const file = path.join(OUT, `${name}${suffix}.png`)
    fs.writeFileSync(file, encodePNG(SIZE, SIZE, rgba))
    console.log('generated', file)
  }
}
