// 启核图策 · 自然语言指令层（小程序端）
//
// 与鸿蒙端 common/Commands.ets、Web 端 js/commands.js 同一套规则：确定性解析（正则命中，
// 不调模型），命中即本地执行；写操作先弹原生确认（先预览后生效），确认后才落库。
// 命中不了的句子才交给 ai.ts 的意图路由 / 模型链路，所以规则必须"具体在前、宽泛在后"。
import Taro from '@tarojs/taro'
import { api } from '@/services/api'
import { createCoop, joinCoop } from '@/services/family'
import { download as syncDownload, upload as syncUpload } from '@/services/livesync'

export interface CmdMatch {
  id: string
  a: string
  b: string
  n: number
  raw: string
}

export interface CmdReply {
  text: string
  model: boolean
  src?: string
}

export const CMD_GROUPS: string[] = ['看一眼库存', '建库与改名', '物品增减与移动', '采购与方案', '多端与设置']

export const CMD_HELP: string[][] = [
  ['看一眼库存', '库存里都有什么', '列出每个库和件数，本地算，不调模型'],
  ['看一眼库存', '牛奶还剩多少', '原样回库存里的数量'],
  ['看一眼库存', '牛奶放在哪', '回库位（库 · 位置）'],
  ['看一眼库存', '牛奶还能放几天', '有保质期的回天数，衣物工具这类回“没有保质期”'],
  ['看一眼库存', '搜一下螺丝刀', '跨库搜名称与库位'],
  ['看一眼库存', '打开资源库', '也能说：打开首页 / 工作台 / 我的 / 数据看板 / 图谱 / 采购清单'],

  ['建库与改名', '帮我建一个工具箱库', '库名随你定，冰箱、衣柜、厨具柜一样建'],
  ['建库与改名', '把药盒改名叫急救箱', '改名后会问一次确认'],
  ['建库与改名', '删掉零食柜', '删库前先确认，删完还有撤销'],

  ['物品增减与移动', '往工具箱加一把螺丝刀', '数量单位都能带：两瓶、三袋、五盒'],
  ['物品增减与移动', '鸡蛋还剩 5 个', '直接改数量（消耗、补货都这么说）'],
  ['物品增减与移动', '把炒锅移到厨具柜', '跨库搬家，数量位置一起带走'],
  ['物品增减与移动', '删掉炒锅', '删物品前先确认，删完还有撤销'],

  ['采购与方案', '把牛奶加进采购清单', '缺什么一句话写进清单'],
  ['采购与方案', '生成方案', '按库存和临期重新排方案'],
  ['采购与方案', '执行清蒸鲈鱼', '按方案里的用料扣库存，可撤销'],
  ['采购与方案', '鸡蛋的提醒处理掉', '把这条临期提醒核销掉'],

  ['多端与设置', '创建协作池', '拿到 6 位邀请码，家人用码加入'],
  ['多端与设置', '加入协作池 ABC123', '换成实际邀请码'],
  ['多端与设置', '换成深色主题', '也能说：换回浅色主题'],
  ['多端与设置', '备份到本机后端', '把本机数据推到自建后端'],
  ['多端与设置', '从本机后端拉取', '用后端快照覆盖本机'],
]

function norm(q: string): string {
  return String(q || '').replace(/[\s，。！？、,.!?]/g, '').trim()
}

function mk(id: string, a = '', b = '', n = 0, raw = ''): CmdMatch {
  return { id: id, a: a, b: b, n: n, raw: raw }
}

export function matchCommand(q: string): CmdMatch | null {
  const s = norm(q)
  if (s === '') return null
  let m: RegExpExecArray | null = null

  if (/^(指令|指令手册|帮助|手册|怎么用|能做什么|能说什么|能干什么|help)$/.test(s)) return mk('help', '', '', 0, q)
  if (/^(库存|家里|柜子|库).{0,2}(都)?有(什么|啥|哪些)/.test(s) || /^(看看|查看)?(我的)?(全部)?库存$/.test(s)) return mk('list', '', '', 0, q)
  m = /^(?:打开|进入|切到|去|看看)(首页|资源库|工作台|我的|设置|数据看板|看板|数据分析|图谱|采购清单|购物清单|提醒|预警|方案|搜索)$/.exec(s)
  if (m) return mk('open', m[1], '', 0, q)
  m = /^(?:搜|搜索|搜一下|找|找一下|找找|查|查一下)(.+)$/.exec(s)
  if (m) return mk('search', m[1], '', 0, q)
  m = /^(?:帮我|请|给我)?(?:新建|创建|建|加)(?:一个|个)?(.{1,10}?)(?:库|柜)$/.exec(s)
  if (m) return mk('newlib', m[1], '', 0, q)
  m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)?(?:改名|重命名|改叫|改称|改为|改成)(.{1,10})$/.exec(s)
  if (m) return mk('renamelib', m[1], m[2], 0, q)
  m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s)
  if (m) return mk('dellib', m[1], '', 0, q)
  m = /^(?:删掉|删除|移除|去掉)(.{1,10}?)(?:库|柜)$/.exec(s)
  if (m) return mk('dellib', m[1], '', 0, q)
  // 「加进采购清单」比「往某库加东西」更具体，必须排在前面
  m = /^(?:把|给)?(.{1,12}?)(?:加|写|放)(?:进|到|入)(?:采购|购物|购买)?清单$/.exec(s)
  if (m) return mk('shopadd', m[1], '', 0, q)
  m = /^(?:把|给|往|向|在)(.{1,10}?)(?:库|柜)?(?:里|中)?(?:加|添加|新增|放|记)(?:上|一下)?(.{1,16})$/.exec(s)
  if (m) return mk('additem', m[1], m[2], 0, q)
  m = /^新增(.{1,16})到(.{1,10}?)(?:库|柜)?$/.exec(s)
  if (m) return mk('additem', m[2], m[1], 0, q)
  m = /^(?:把|帮我把)?(.{1,12}?)(?:移|挪|搬|换|放)(?:到|去)(.{1,10}?)(?:库|柜)?$/.exec(s)
  if (m) return mk('moveitem', m[1], m[2], 0, q)
  m = /^(.{1,12}?)(?:还能放几天|保质期多久|还有几天到期|什么时候过期)$/.exec(s)
  if (m) return mk('expiry', m[1], '', 0, q)
  m = /^(.{1,12}?)(?:放在哪|放哪|搁哪|在哪儿|位置在哪)$/.exec(s)
  if (m) return mk('where', m[1], '', 0, q)
  m = /^(.{1,12}?)(?:还剩|只剩|还有|剩|现有|改成|设为)(\d+)(.{0,3})$/.exec(s)
  if (m) return mk('qty', m[1], m[3], parseInt(m[2], 10), q)
  if (/^(重新)?生成(新)?方案$/.test(s)) return mk('plangen', '', '', 0, q)
  m = /^执行(?:方案)?(.{1,14})$/.exec(s)
  if (m) return mk('planrun', m[1], '', 0, q)
  m = /^(.{1,12}?)(?:的)?(?:提醒|预警|临期提醒)(?:我)?(?:处理|解决|核销|清)(?:掉|了)?$/.exec(s)
  if (m) return mk('alertdone', m[1], '', 0, q)
  if (/^(?:创建|新建|开|建)(?:一个)?(?:协作池|协作|拼菜池|拼菜|牌桌)$/.test(s)) return mk('coopcreate', '', '', 0, q)
  m = /^加入(?:协作池|拼菜池)?([A-Za-z0-9]{4,8})$/.exec(s)
  if (m) return mk('coopjoin', m[1].toUpperCase(), '', 0, q)
  m = /^用([A-Za-z0-9]{4,8})加入(?:协作池|拼菜池)?$/.exec(s)
  if (m) return mk('coopjoin', m[1].toUpperCase(), '', 0, q)
  m = /^(?:切换|换|改|调)(?:成|为|到|回|至)?(深色|暗色|夜间|深色模式|浅色|亮色|白天|浅色模式|日间)(?:主题|模式|色)?$/.exec(s)
  if (m) {
    const dark = ['深色', '暗色', '夜间', '深色模式'].indexOf(m[1]) > -1
    return mk('theme', dark ? 'dark' : 'light', m[1], 0, q)
  }
  if (/^(?:备份|上传)(?:到本机后端|到后端|数据|一下)?$/.test(s) || /^保存到后端$/.test(s)) return mk('backupup', '', '', 0, q)
  if (/^(?:从本机后端)?(?:拉取|恢复|下载)(?:备份|数据|快照|一下)?$/.test(s)) return mk('backupdown', '', '', 0, q)
  m = /^(?:把|帮我把)?(.{1,12}?)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s)
  if (m) return mk('delitem', m[1], '', 0, q)
  m = /^(?:删掉|删除|移除|去掉)(.{1,12})$/.exec(s)
  if (m) return mk('delitem', m[1], '', 0, q)
  return null
}

/* ---------- 数据查询辅助 ---------- */
interface Row { it: any; lib: any }

function snap(): any {
  try { return api.getState() || {} } catch (e) { return {} }
}
function libs(): any[] {
  return (snap().libraries || []) as any[]
}
function allItems(): Row[] {
  const out: Row[] = []
  libs().forEach((l: any) => (l.items || []).forEach((it: any) => out.push({ it: it, lib: l })))
  return out
}
function findItem(name: string): Row | null {
  const n = String(name || '').trim()
  if (!n) return null
  let exact: Row | null = null
  let loose: Row | null = null
  allItems().forEach((r) => {
    if (exact) return
    if (r.it.name === n) exact = r
    else if (!loose && (String(r.it.name).indexOf(n) > -1 || n.indexOf(r.it.name) > -1)) loose = r
  })
  return exact || loose
}
function findLib(name: string): any | null {
  const n = String(name || '').trim()
  if (!n) return null
  let exact: any = null
  let loose: any = null
  libs().forEach((l: any) => {
    if (exact) return
    if (l.id === n || l.name === n || l.name === n + '库' || l.name === n + '柜') exact = l
    else if (!loose && (String(l.name).indexOf(n) > -1 || n.indexOf(l.name) > -1)) loose = l
  })
  return exact || loose
}
function unitOf(text: string): string {
  const m = /(个|只|把|瓶|袋|盒|包|箱|件|根|条|张|块|斤|公斤|克|升|毫升|罐|份|台|副|双)/.exec(String(text || ''))
  return m ? m[1] : '个'
}

export function helpText(): string {
  const lines: string[] = ['我认识的指令（命中就本地执行，0 次模型调用）：']
  CMD_GROUPS.forEach((g) => {
    lines.push('【' + g + '】')
    CMD_HELP.filter((r) => r[0] === g).forEach((r) => lines.push('· ' + r[1] + '：' + r[2]))
  })
  return lines.join('\n')
}

/* ---------- 页面跳转（复用已有页面，不新增入口） ---------- */
const TAB_PAGES = ['/pages/home/index', '/pages/library/index', '/pages/workbench/index', '/pages/mine/index']

function goPage(word: string): boolean {
  const map: Record<string, string> = {
    首页: '/pages/home/index',
    资源库: '/pages/library/index',
    工作台: '/pages/workbench/index',
    我的: '/pages/mine/index',
    设置: '/pages/mine/index',
    数据看板: '/pages/home/index',
    看板: '/pages/home/index',
    数据分析: '/pages/home/index',
    图谱: '/pages/graph/index',
    采购清单: '/pages/shopping/index',
    购物清单: '/pages/shopping/index',
    提醒: '/pages/alerts/index',
    预警: '/pages/alerts/index',
    方案: '/pages/plans/index',
  }
  const target = map[word]
  if (!target) return false
  if (TAB_PAGES.indexOf(target) > -1) Taro.switchTab({ url: target })
  else Taro.navigateTo({ url: target })
  return true
}

/* ---------- 执行 ---------- */
function ok(text: string, note?: string): Promise<CmdReply> {
  return Promise.resolve({ text: text, model: false, src: note || '本地指令 · 0 次模型调用' })
}

/** 写操作：先弹原生确认（先预览后生效），确认后才落库 */
async function confirmThen(question: string, run: () => Promise<any>, done: string): Promise<CmdReply> {
  const r = await Taro.showModal({ title: '确认执行', content: question, confirmText: '执行', cancelText: '取消' })
  if (!r.confirm) {
    return { text: '已取消，什么都没改。', model: false, src: '本地指令 · 0 次模型调用' }
  }
  try {
    await run()
    return { text: done, model: false, src: '本地指令 · 0 次模型调用' }
  } catch (e: any) {
    return { text: '执行失败：' + ((e && e.message) || '请重试'), model: false, src: '本地指令' }
  }
}

export async function run(m: CmdMatch): Promise<CmdReply> {
  switch (m.id) {
    case 'help':
      return ok(helpText(), '本地指令手册 · 0 次模型调用')

    case 'list': {
      const ls = libs()
      if (ls.length === 0) return ok('还没有库。说一句「帮我建一个冰箱库」就能开始，或者直接拍照入库。')
      let total = 0
      let soon = 0
      const lines: string[] = []
      ls.forEach((l: any) => {
        const items = l.items || []
        total += items.length
        items.forEach((it: any) => { if (it.expDays > 0 && it.expDays <= 7) soon += 1 })
        const names = items.slice(0, 6).map((it: any) => it.name + ' ' + it.qty + (it.unit || '个'))
        lines.push(names.length === 0 ? l.name + '：空' : l.name + '（' + items.length + ' 件）：' + names.join('、'))
      })
      return ok('共 ' + ls.length + ' 个库、' + total + ' 件物品，其中临期 ' + soon + ' 件。\n' + lines.join('\n'))
    }

    case 'where': {
      const w = findItem(m.a)
      if (!w) return ok('没找到「' + m.a + '」。')
      return ok('「' + w.it.name + '」在「' + w.lib.name + '」的 ' + (w.it.pos || '未填位置') + '。')
    }

    case 'expiry': {
      const e = findItem(m.a)
      if (!e) return ok('没找到「' + m.a + '」。')
      if (!e.it.expDays || e.it.expDays <= 0) return ok('「' + e.it.name + '」这类没有保质期记录。')
      return ok('「' + e.it.name + '」还有 ' + e.it.expDays + ' 天到期。')
    }

    case 'qty': {
      const row = findItem(m.a)
      if (!row) return ok('库存里没有「' + m.a + '」，先在「资源库」里加一件？')
      if (m.n > 0) {
        const unit = m.b || row.it.unit || '个'
        return confirmThen(
          '把「' + row.it.name + '」从 ' + row.it.qty + (row.it.unit || '个') + ' 改成 ' + m.n + unit + '？',
          () => api.updateItemQty(row.it.id, m.n - row.it.qty),
          '已把「' + row.it.name + '」改为 ' + m.n + unit + '（可用「撤销」回退）。'
        )
      }
      return ok('「' + row.it.name + '」现在还有 ' + row.it.qty + (row.it.unit || '个') + '（' + row.lib.name + '）。')
    }

    case 'search': {
      try {
        const r: any = await api.search(m.a)
        const hit: any[] = (r && (r.items || r)) || []
        if (!hit.length) return ok('没搜到「' + m.a + '」。', '本地搜索 · 0 次模型调用')
        const t = hit.slice(0, 8).map((x: any) => '· ' + (x.item ? x.item.name : x.name) + '　' + (x.libName || x.lib || '')).join('\n')
        return ok('搜到 ' + hit.length + ' 条：\n' + t, '本地搜索 · 0 次模型调用')
      } catch (e: any) {
        return ok('搜索失败：' + ((e && e.message) || '请重试'))
      }
    }

    case 'open':
      return ok(goPage(m.a) ? '已打开「' + m.a + '」。' : '这一端还没有「' + m.a + '」页面。')

    case 'newlib':
      return confirmThen('新建资源库「' + m.a + '」？', () => api.createLibrary(m.a), '已新建库「' + m.a + '」。')

    case 'renamelib': {
      const l1 = findLib(m.a)
      if (!l1) return ok('没找到「' + m.a + '」这个库。')
      return confirmThen('把「' + l1.name + '」改名为「' + m.b + '」？',
        () => api.renameLibrary(l1.id, m.b), '已改名为「' + m.b + '」。')
    }

    case 'dellib': {
      const l2 = findLib(m.a)
      if (!l2) return ok('没找到「' + m.a + '」这个库。')
      return confirmThen('删除库「' + l2.name + '」？删完可在操作日志里撤销。',
        () => api.deleteLibrary(l2.id), '已删除库「' + l2.name + '」（可撤销恢复）。')
    }

    case 'additem': {
      const lib = findLib(m.a)
      if (!lib) return ok('没找到「' + m.a + '」这个库，说一句「帮我建一个' + m.a + '库」？')
      const name = String(m.b).replace(/^(一|两|二|三|四|五|六|七|八|九|十|\d+)/, '')
      return confirmThen('往「' + lib.name + '」加「' + name + ' ' + unitOf(m.b) + '」？',
        () => api.addItem(lib.id, { name: name, category: '其他', qty: 1, unit: unitOf(m.b), pos: '', expDays: 0, price: 0 } as any),
        '已加入「' + name + '」。')
    }

    case 'moveitem': {
      const row2 = findItem(m.a)
      if (!row2) return ok('没找到「' + m.a + '」。')
      const target = findLib(m.b)
      if (!target) return ok('没找到目标库「' + m.b + '」。')
      return confirmThen('把「' + row2.it.name + '」从「' + row2.lib.name + '」移到「' + target.name + '」？',
        () => api.moveItem(row2.it.id, target.id), '已移动到「' + target.name + '」。')
    }

    case 'delitem': {
      const d = findItem(m.a)
      if (!d) return ok('没找到「' + m.a + '」。')
      return confirmThen('删除「' + d.it.name + '」？删完还有撤销。',
        () => api.deleteItem(d.lib.id, d.it.id), '已删除「' + d.it.name + '」（可撤销恢复）。')
    }

    case 'shopadd':
      return confirmThen('把「' + m.a + '」加进采购清单？',
        () => api.shoppingAdd(m.a, '适量'), '已把「' + m.a + '」加进采购清单。')

    case 'plangen':
      try {
        await api.generatePlans()
        return ok('已按「临期优先 > 清库存 > 营养均衡」重排方案，去「方案」里看。')
      } catch (e: any) {
        return ok('生成方案失败：' + ((e && e.message) || '请重试'))
      }

    case 'planrun': {
      const plans: any[] = (snap().plans || []) as any[]
      const p = plans.filter((x: any) => String(x.title || '').indexOf(m.a) > -1)[0]
      if (!p) return ok('方案列表里没有「' + m.a + '」，先说「生成方案」？')
      return confirmThen('执行「' + p.title + '」？会按用料扣库存（可撤销）。',
        () => api.executePlan(p.id), '已按「' + p.title + '」扣减库存（可撤销）。')
    }

    case 'alertdone': {
      const alerts: any[] = (snap().alerts || []) as any[]
      const al = alerts.filter((a: any) => String(a.name || '').indexOf(m.a) > -1 && !a.done)[0]
      if (!al) return ok('没有「' + m.a + '」相关的待处理提醒。')
      return confirmThen('把「' + al.name + '」这条提醒核销掉？',
        () => api.resolveAlert(al.id), '提醒已核销。')
    }

    case 'coopcreate':
      try {
        const r = await createCoop('家庭协作牌桌')
        return ok('协作池已创建，邀请码 ' + r.code + '，家人可输入「加入协作池 ' + r.code + '」。')
      } catch (e: any) {
        return ok('创建协作池失败：' + ((e && e.message) || '请检查后端'))
      }

    case 'coopjoin':
      try {
        const r = await joinCoop(m.a)
        return ok('已加入「' + r.name + '」，当前 ' + r.members.length + ' 人。')
      } catch (e: any) {
        return ok('加入协作池失败：' + ((e && e.message) || '邀请码无效'))
      }

    case 'theme':
      try {
        await api.setTheme(m.a === 'dark' ? 'dark' : 'light')
        return ok('已切换为' + m.b + '主题。')
      } catch (e: any) {
        return ok('主题切换失败：' + ((e && e.message) || '请重试'))
      }

    case 'backupup':
      try {
        const r: any = await syncUpload(false)
        return ok('已保存到 MySQL 工作区（v' + ((r && r.version) || (snap().syncVersion || 1)) + '）。')
      } catch (e: any) {
        return ok('备份失败：' + ((e && e.message) || '请检查后端是否在跑'))
      }

    case 'backupdown':
      try {
        await syncDownload()
        return ok('已从后端 MySQL 拉取最新工作区。')
      } catch (e: any) {
        return ok('拉取失败：' + ((e && e.message) || '后端没有可用快照'))
      }

    default:
      return ok('这条指令我读错了，换个说法再试一次。')
  }
}
