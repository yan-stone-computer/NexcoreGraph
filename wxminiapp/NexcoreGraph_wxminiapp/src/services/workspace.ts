import Taro from '@tarojs/taro'
import { resolveServerBase } from '@/services/agnes'
import { authHeaders, loadSession, type AccountSession } from '@/services/session'

export interface RemoteStatus {
  ok: boolean
  version: number
  updatedAt?: string | null
}

export interface RemoteSnapshot extends RemoteStatus {
  payload: Record<string, any>
}

function request<T>(url: string, method: 'GET' | 'POST', data?: any, timeout = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    Taro.request({
      url,
      method,
      timeout,
      header: authHeaders(),
      data,
      success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) resolve(body as T)
        else {
          const err: any = new Error(body.error || ('HTTP ' + res.statusCode))
          err.status = res.statusCode
          err.body = body
          reject(err)
        }
      },
      fail: (e: { errMsg?: string }) => reject(new Error((e && e.errMsg) || '网络不可用'))
    } as Taro.request.Option)
  })
}

export async function remoteStatus(session = loadSession()): Promise<RemoteStatus> {
  if (!session) throw new Error('尚未登录')
  const base = await resolveServerBase()
  return request<RemoteStatus>(base + '/api/sync/status/' + encodeURIComponent(session.familyId), 'GET')
}

export async function pullRemote(session = loadSession()): Promise<RemoteSnapshot | null> {
  const status = await remoteStatus(session)
  if (!status.version) return null
  const base = await resolveServerBase()
  return request<RemoteSnapshot>(
    base + '/api/sync/download/' + encodeURIComponent(session!.familyId),
    'GET',
    undefined,
    20000
  )
}

export async function pushRemote(
  payload: Record<string, any>,
  baseVersion: number,
  options: { force?: boolean; session?: AccountSession } = {}
): Promise<{ ok: boolean; version: number }> {
  const session = options.session || loadSession()
  if (!session) throw new Error('尚未登录')
  const base = await resolveServerBase()
  const version = Date.now()
  return request<{ ok: boolean; version: number }>(base + '/api/sync/upload', 'POST', {
    familyId: session.familyId,
    payload,
    baseVersion,
    force: options.force === true,
    version
  }, 20000)
}
