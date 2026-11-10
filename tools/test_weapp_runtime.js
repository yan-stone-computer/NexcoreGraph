const fs = require('fs')
const path = require('path')
const automator = require(path.resolve(
  __dirname,
  '../wxminiapp/NexcoreGraph_wxminiapp/node_modules/miniprogram-automator'
))

const ENDPOINT = process.env.WEAPP_AUTOMATOR_WS || 'ws://127.0.0.1:9420'
const SHOT_DIR = path.resolve(__dirname, '../docs/qa/weapp-runtime')
const results = []
const logs = []
const exceptions = []
let miniProgram = null

function trace(step) {
  console.error('[runtime] ' + step)
}

function check(name, condition, detail = '') {
  results.push({ name, passed: Boolean(condition), detail })
  if (!condition) throw new Error(name + (detail ? ': ' + detail : ''))
}

async function bodyText(page) {
  const nodes = await page.$$('text')
  const values = []
  for (const node of nodes.slice(0, 160)) {
    try { values.push(String(await node.text() || '')) } catch (_e) { /* detached text node */ }
  }
  return values.join('\n')
}

async function findText(page, needle) {
  const items = await page.$$('text')
  for (const item of items) {
    const value = await item.text()
    if (String(value || '').includes(needle)) return item
  }
  return null
}

async function tapText(page, needle) {
  const target = await findText(page, needle)
  if (!target) throw new Error('找不到可点击文本: ' + needle)
  await target.tap()
  await page.waitFor(500)
}

async function shot(miniProgram, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const file = path.join(SHOT_DIR, name + '.png')
  await miniProgram.screenshot({ path: file })
  return file
}

;(async () => {
  trace('connect')
  miniProgram = await automator.connect({ wsEndpoint: ENDPOINT })
  miniProgram.on('console', (entry) => logs.push(entry))
  miniProgram.on('exception', (entry) => exceptions.push(entry))

  trace('current page')
  let page = await miniProgram.currentPage()
  await page.waitFor(800)
  check('AI 工作台路由', page.path === 'pages/workbench/index', page.path)
  let text = await bodyText(page)
  check('AI 工作台主内容', text.includes('AI 工作台') && text.includes('今日待确认'), text.slice(0, 160))
  trace('screenshot workbench')
  await shot(miniProgram, '01-workbench')

  trace('switch mine')
  await miniProgram.callWxMethod('switchTab', { url: '/pages/mine/index' })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  page = await miniProgram.currentPage()
  text = await bodyText(page)
  check('我的页面', page.path === 'pages/mine/index', page.path)
  check('实验台入口', text.includes('可信 AI 实验台'))

  trace('navigate lab')
  await miniProgram.callWxMethod('navigateTo', { url: '/pages/lab/index' })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  page = await miniProgram.currentPage()
  text = await bodyText(page)
  check('实验台路由', page.path === 'pages/lab/index', page.path)
  check('实验台总览', text.includes('模型负责理解，代码负责事实'))
  check('实验台标签', text.includes('What-if') && text.includes('审计链') && text.includes('策略'))
  trace('screenshot lab')
  await shot(miniProgram, '02-lab-overview')

  trace('tour start')
  await tapText(page, '开始')
  text = await bodyText(page)
  check('导览启动', text.includes('今天先做什么') && text.includes('退出导览'))
  await tapText(page, '退出导览')

  trace('what-if tab')
  await tapText(page, 'What-if')
  text = await bodyText(page)
  check('What-if 场景', text.includes('再买 2 份') && text.includes('预算收缩 20%'))
  trace('what-if scenario')
  await tapText(page, '再买 2 份')
  text = await bodyText(page)
  check('推演结果', text.includes('推演结果') && text.includes('仅推演'))
  check('推演前后对比', text.includes('库存单位') && text.includes('预算占用'))
  await shot(miniProgram, '03-lab-what-if')

  trace('policy tab')
  await tapText(page, '策略')
  await tapText(page, '运行样例')
  text = await bodyText(page)
  check('策略沙箱结果', text.includes('审批要求') && (text.includes('管理员确认') || text.includes('可进入确认')))
  await shot(miniProgram, '04-lab-policy')

  trace('audit tab')
  await tapText(page, '审计链')
  text = await bodyText(page)
  check('审计链页面', text.includes('追加式事件日志') && text.includes('校验 SHA-256 哈希链'))
  await shot(miniProgram, '05-lab-audit')

  const summary = {
    endpoint: ENDPOINT,
    checks: results,
    consoleEntries: logs.length,
    exceptions: exceptions.length,
    screenshots: fs.readdirSync(SHOT_DIR).filter((name) => name.endsWith('.png')).sort()
  }
  console.log(JSON.stringify(summary, null, 2))
})().catch(async (error) => {
  console.error(JSON.stringify({
    error: error.message,
    checks: results,
    consoleEntries: logs.slice(-20),
    exceptions: exceptions.slice(-10)
  }, null, 2))
  process.exitCode = 1
}).finally(async () => {
  if (miniProgram) {
    await Promise.race([
      miniProgram.disconnect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ])
  }
})
