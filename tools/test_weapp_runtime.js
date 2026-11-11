const fs = require('fs')
const path = require('path')
const automator = require(path.resolve(
  __dirname,
  '../wxminiapp/NexcoreGraph_wxminiapp/node_modules/miniprogram-automator'
))

const ENDPOINT = process.env.WEAPP_AUTOMATOR_WS || 'ws://127.0.0.1:9420'
const SHOT_DIR = path.resolve(__dirname, '../docs/qa/weapp-runtime')
let miniProgram = null

function route(page) {
  return String(page?.path || '').replace(/^\//, '')
}

async function screenshot(name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const file = path.join(SHOT_DIR, name + '.png')
  await miniProgram.screenshot({ path: file })
  return file
}

;(async () => {
  miniProgram = await automator.connect({ wsEndpoint: ENDPOINT })

  const initial = await miniProgram.currentPage()
  const initialPath = route(initial)
  const initialShot = await screenshot('runtime-initial')

  await miniProgram.callWxMethod('navigateTo', { url: '/pages/lab/index' })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const lab = await miniProgram.currentPage()
  const labPath = route(lab)
  const labShot = await screenshot('runtime-lab')

  await miniProgram.callWxMethod('navigateTo', { url: '/pages/library-detail/index?id=fridge' })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const library = await miniProgram.currentPage()
  const libraryPath = route(library)
  const libraryShot = await screenshot('runtime-library')

  const result = {
    endpoint: ENDPOINT,
    initialPath,
    labPath,
    libraryPath,
    passed: Boolean(initialPath && labPath === 'pages/lab/index' && libraryPath === 'pages/library-detail/index'),
    screenshots: [initialShot, labShot, libraryShot]
  }
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
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
