const fs = require('fs')
const path = require('path')
const automator = require(path.resolve(
  __dirname,
  '../wxminiapp/NexcoreGraph_wxminiapp/node_modules/miniprogram-automator'
))

const PROJECT_PATH = path.resolve(
  __dirname,
  '../wxminiapp/NexcoreGraph_wxminiapp'
)
const CLI_PATH =
  'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
const OUT_DIR = path.resolve(__dirname, '../docs/qa/weapp-brand-header')
const ROUTES = [
  ['home', '/pages/home/index'],
  ['workbench', '/pages/workbench/index'],
  ['library', '/pages/library/index'],
  ['mine', '/pages/mine/index']
]

let miniProgram = null

async function capture(route, name) {
  await miniProgram.callWxMethod('reLaunch', { url: route })
  await new Promise((resolve) => setTimeout(resolve, 1200))

  const page = await miniProgram.currentPage()
  const file = path.join(OUT_DIR, `${name}.png`)
  await miniProgram.screenshot({ path: file })
  return {
    name,
    expected: route.replace(/^\//, ''),
    actual: String(page.path || '').replace(/^\//, ''),
    screenshot: file
  }
}

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  miniProgram = await automator.launch({
    cliPath: CLI_PATH,
    projectPath: PROJECT_PATH,
    port: 9430,
    trustProject: true,
    timeout: 45000
  })

  const systemInfo = await miniProgram.evaluate(() => {
    const info = wx.getWindowInfo()
    const menu = wx.getMenuButtonBoundingClientRect()
    return {
      windowWidth: info.windowWidth,
      windowHeight: info.windowHeight,
      statusBarHeight: info.statusBarHeight,
      pixelRatio: info.pixelRatio,
      menu
    }
  })

  const routes = []
  for (const [name, route] of ROUTES) {
    routes.push(await capture(route, name))
  }

  const passed = routes.every(
    (item) => item.actual === item.expected
  )
  console.log(JSON.stringify({ passed, systemInfo, routes }, null, 2))
  if (!passed) process.exitCode = 1
})().catch((error) => {
  console.error(JSON.stringify({ error: error.message, stack: error.stack }, null, 2))
  process.exitCode = 1
}).finally(async () => {
  if (miniProgram) {
    await Promise.race([
      miniProgram.disconnect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ])
  }
})
