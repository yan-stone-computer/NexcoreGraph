// 启核图策 · 账号服务（小程序端）
//
// 与鸿蒙端 common/Api.ets 的 requestLoginCode / loginByCode 同一契约：
//   POST {后端}/api/auth/code   { account }                      → { ok, hint }
//   POST {后端}/api/auth/login  { account, code }                → { ok, token, nickname, role, families }
// 端侧没有固定验证码；后端没配短信/邮箱通道时验证码只打在服务端日志里。
// 后端连不上时回落到本机模拟登录（离线可演示），返回 via='local' 供界面标注数据来源。
import Taro from '@tarojs/taro'
import { resolveServerBase } from '@/services/agnes'
import type { FamilySummary } from '@/services/session'

export interface LoginResult {
  ok: boolean
  via: 'gateway'
  hint?: string
  nickname?: string
  role?: string
  token?: string
  families?: FamilySummary[]
  error?: string
}

function post(path: string, data: Record<string, any>, timeout = 12000): Promise<any> {
  return resolveServerBase().then((base) => new Promise<any>((resolve, reject) => {
    Taro.request({
      url: base + path,
      method: 'POST',
      timeout: timeout,
      header: { 'Content-Type': 'application/json' },
      data: data,
      success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) resolve(body)
        else reject(new Error(body.error || ('请求失败（' + res.statusCode + '）')))
      },
      fail: (err: { errMsg?: string }) => reject(new Error((err && err.errMsg) || '网络不可用'))
    } as Taro.request.Option)
  }))
}

/** 判断后端是否可用（决定界面上要不要标"已连接局域网自建服务器"） */
export function backendReady(): Promise<string | null> {
  return resolveServerBase().then((base) => base, () => null)
}

/** 索取验证码：账号和后端均走真实服务，客户端不再接受固定演示码。 */
export async function requestCode(account: string): Promise<LoginResult> {
  try {
    const r = await post('/api/auth/code', { account: account })
    const channel = String(r.channel || '')
    return {
      ok: true,
      via: 'gateway',
      hint: channel === 'email'
        ? '验证码已发送到邮箱，5 分钟内有效；收不到请检查垃圾邮件'
        : channel === 'sms'
          ? '验证码已通过短信发送，5 分钟内有效'
          : '验证码已生成，当前未配置邮件/短信通道，请查看后端日志'
    }
  } catch (e: any) {
    return { ok: false, via: 'gateway', error: (e && e.message) || '验证码下发失败' }
  }
}

/** 验证码登录：身份只由后端校验，MySQL 工作区由会话加载。 */
export async function loginByCode(account: string, code: string): Promise<LoginResult> {
  try {
    const r = await post('/api/auth/login', { account: account, code: code })
    return {
      ok: true,
      via: 'gateway',
      nickname: r.nickname,
      role: r.role,
      token: r.token,
      families: Array.isArray(r.families) ? r.families : []
    }
  } catch (e: any) {
    return { ok: false, via: 'gateway', error: (e && e.message) || '登录失败' }
  }
}
