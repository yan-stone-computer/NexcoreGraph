// 启核图策 · 导出与订阅（小程序端）
//
// 导出：写一份 UTF-8 BOM 的 CSV 到小程序用户目录，再调 shareFileMessage 发给微信好友/文件传输助手。
//       小程序没有本地文件系统直读能力，也不提供系统打印 API，所以"打印"的口径是「导出后用微信发送/打开」。
// 订阅：模板 ID 必须在微信公众平台申请后填进 TEMPLATES；未配置时如实提示，不假装已开启。
import Taro from '@tarojs/taro'
import { api } from '@/services/api'

export function exportCsv(): string {
  const rows: string[][] = [['资源库', '名称', '数量', '单位', '位置', '剩余天数', '价格']]
  const db = api.getState() as any
  ;(db.libraries || []).forEach((l: any) => {
    ;(l.items || []).forEach((it: any) => {
      rows.push([
        String(l.name || ''),
        String(it.name || ''),
        String(it.qty ?? ''),
        String(it.unit || ''),
        String(it.pos || ''),
        String(it.expDays ?? ''),
        String(it.price ?? '')
      ])
    })
  })
  const csv = '\ufeff' + rows
    .map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(','))
    .join('\r\n')
  const path = Taro.env.USER_DATA_PATH + '/nexcore-inventory-' + Date.now() + '.csv'
  const fs = Taro.getFileSystemManager()
  fs.writeFileSync(path, csv, 'utf8')
  return path
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      out.push(value)
      value = ''
    } else {
      value += ch
    }
  }
  out.push(value)
  return out
}

export async function importCsv(targetLibId: string): Promise<number> {
  const picked: any = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['csv'] } as any)
  const file = picked.tempFiles?.[0]
  if (!file?.path) throw new Error('没有选择 CSV 文件')
  const raw: any = await new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath: file.path,
      encoding: 'utf8',
      success: (r: any) => resolve(r.data),
      fail: reject
    })
  })
  const lines = String(raw || '').replace(/^\ufeff/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('CSV 没有数据行')
  const header = parseCsvLine(lines[0]).map((s) => s.trim().toLowerCase())
  const index = (name: string, fallback: number) => {
    const i = header.indexOf(name)
    return i >= 0 ? i : fallback
  }
  const iName = index('名称', 1)
  const iQty = index('数量', 2)
  const iUnit = index('单位', 3)
  const iPos = index('位置', 4)
  const iExp = index('剩余天数', 5)
  const iPrice = index('价格', 6)
  let added = 0
  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line)
    const name = String(row[iName] || '').trim()
    if (!name) continue
    await api.addItem(targetLibId, {
      name,
      qty: parseFloat(row[iQty]) || 1,
      unit: String(row[iUnit] || '个').trim(),
      pos: String(row[iPos] || '未设置').trim(),
      expDays: parseInt(row[iExp], 10) || 0,
      price: parseFloat(row[iPrice]) || 0,
      emoji: '📦'
    } as any)
    added++
  }
  return added
}

/* ---------- 订阅消息 ---------- */
/** 在微信公众平台「订阅消息」里申请模板后，把模板 ID 填进来（最多 3 个） */
export const TEMPLATES: string[] = []

export async function requestSubscribe(): Promise<{ ok: boolean; msg: string }> {
  if (TEMPLATES.length === 0) {
    return {
      ok: false,
      msg: '订阅模板未配置：请在微信公众平台申请「临期提醒 / 采购提醒 / 协作邀请」后填入 services/exportcsv.ts 的 TEMPLATES'
    }
  }
  try {
    const r: any = await Taro.requestSubscribeMessage({ tmplIds: TEMPLATES } as any)
    const accepted = TEMPLATES.filter((id) => r[id] === 'accept')
    return {
      ok: accepted.length > 0,
      msg: accepted.length > 0 ? ('已开启 ' + accepted.length + ' 个提醒') : '未开启（可在设置里重新授权）'
    }
  } catch (e: any) {
    return { ok: false, msg: '订阅失败：' + ((e && e.errMsg) || (e && e.message) || '请重试') }
  }
}
