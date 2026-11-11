const fs = require('fs')
const path = require('path')
const automator = require(path.resolve(
  __dirname,
  '../wxminiapp/NexcoreGraph_wxminiapp/node_modules/miniprogram-automator'
))

const ENDPOINT = process.env.WEAPP_AUTOMATOR_WS || 'ws://127.0.0.1:9420'
const OUT_DIR = path.resolve(__dirname, '../docs/qa/weapp-pages')
const ROUTES = [
  ['workbench', '/pages/workbench/index'],
  ['library', '/pages/library/index'],
  ['library-detail', '/pages/library-detail/index?id=fridge'],
  ['intake', '/pages/intake/index'],
  ['plans', '/pages/plans/index'],
  ['alerts', '/pages/alerts/index'],
  ['shopping', '/pages/shopping/index'],
  ['graph', '/pages/graph/index'],
  ['mine', '/pages/mine/index'],
  ['lab', '/pages/lab/index']
]

let miniProgram = null

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  miniProgram = await automator.connect({ wsEndpoint: ENDPOINT })
  const results = []

  for (const [name, url] of ROUTES) {
    await miniProgram.callWxMethod('reLaunch', { url })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    const page = await miniProgram.currentPage()
    const file = path.join(OUT_DIR, name + '.png')
    await miniProgram.screenshot({ path: file })
    results.push({
      name,
      expected: url.split('?')[0].replace(/^\//, ''),
      actual: String(page.path || '').replace(/^\//, ''),
      screenshot: file
    })
  }

  const passed = results.every((item) => item.actual === item.expected)
  console.log(JSON.stringify({ endpoint: ENDPOINT, passed, routes: results }, null, 2))
  if (!passed) process.exitCode = 1
})().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2))
  process.exitCode = 1
}).finally(async () => {
  if (miniProgram) {
    await Promise.race([
      miniProgram.disconnect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ])
  }
})
