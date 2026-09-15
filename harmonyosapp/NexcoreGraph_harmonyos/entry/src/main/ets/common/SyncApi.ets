/* 启核图策 · 云端同步客户端（M2：本地优先 + 版本冲突提示，F9.10）
   地址解析与 JSON 请求复用 common/Backend.ets（与 AI 网关同一套候选地址链）。
   流程：tryUploadSync 先查云端版本（落后 → 409 冲突，返回描述供设置页提示），
   用户选择“覆盖上传”走 forceUploadSync，“改为拉取”走 downloadSync。 */

import { http } from '@kit.NetworkKit';
import { store } from './Store';
import { Library, AlertItem, Plan, ShoppingItem, Todo } from './Db';
import { callJson, backendBody, backendStatus } from './Backend';

let cloudVersion: number = 0;
const CONNECT_MS: number = 5000;
const READ_MS: number = 20000;

class SyncResp {
  ok: boolean = false;
  version: number = 0;
  error: string = '';
  updatedAt: string = '';
  payload: Payload | null = null;
}

class Payload {
  libraries: Library[] = [];
  alerts: AlertItem[] = [];
  plans: Plan[] = [];
  shopping: ShoppingItem[] = [];
  daily: Todo[] = [];
  logs: LogRowLike[] = [];
}

interface LogRowLike {
  action: string;
  detail: string;
  at: string;
}

/** 上传冲突 / 结果描述 */
export class SyncConflict {
  ok: boolean = false;        // 上传是否成功
  conflict: boolean = false;  // 是否因云端更新而 409
  version: number = 0;
  updatedAt: string = '';
  error: string = '';
}

function parseStatus(text: string): SyncResp {
  try {
    return JSON.parse(text) as SyncResp;
  } catch (_e) {
    const r = new SyncResp();
    r.ok = false;
    r.error = '返回数据解析失败';
    return r;
  }
}

function buildUploadBody(force: boolean): string {
  const p: Record<string, Object> = {
    'libraries': store.libraries,
    'alerts': store.alerts,
    'plans': store.plans,
    'shopping': store.shopping,
    'daily': store.daily,
    'logs': store.logs
  };
  return JSON.stringify({
    familyId: store.family.id,
    version: Date.now(),
    baseVersion: cloudVersion,
    force: force,
    payload: JSON.parse(JSON.stringify(p)) as object
  });
}

/** 查询云端当前版本并同步到会话基线 */
function refreshCloudVersion(): Promise<number> {
  return callJson('/api/sync/status/' + store.family.id, http.RequestMethod.GET, '', CONNECT_MS, READ_MS)
    .then((text: string): number => {
    const r = parseStatus(text);
    cloudVersion = r.ok ? r.version : 0;
    return cloudVersion;
  });
}

function doUpload(force: boolean): Promise<SyncConflict> {
  const needStatus = !force;
  const prep: Promise<number> = needStatus ? refreshCloudVersion() : Promise.resolve(cloudVersion);
  return prep.then((): Promise<string> => {
    return callJson('/api/sync/upload', http.RequestMethod.POST, buildUploadBody(force), CONNECT_MS, READ_MS);
  }).then((text: string): SyncConflict => {
    const r = parseStatus(text);
    const out = new SyncConflict();
    if (!r.ok) {
      out.ok = false;
      out.error = r.error;
      return out;
    }
    cloudVersion = r.version;
    out.ok = true;
    out.version = r.version;
    return out;
  });
}

/** 尝试上传：云端已有更新版本则返回 conflict=true（不覆盖），由调用方提示后二选一 */
export function tryUploadSync(): Promise<SyncConflict> {
  return doUpload(false).catch((e: Error): SyncConflict => {
    const out = new SyncConflict();
    if (backendStatus() === 409) {
      out.conflict = true;
      out.error = e.message !== undefined && e.message !== '' ? e.message : '云端已有更新';
      try {
        const j = JSON.parse(backendBody()) as SyncResp;
        out.version = j.version;
        out.updatedAt = j.updatedAt;
      } catch (e2) {
        // 保留冲突标记即可
      }
      return out;
    }
    out.error = e.message !== undefined && e.message !== '' ? e.message : '同步失败';
    return out;
  });
}

/** 用户在冲突提示后选择覆盖上传 */
export function forceUploadSync(): Promise<SyncConflict> {
  return doUpload(true).catch((e: Error): SyncConflict => {
    const out = new SyncConflict();
    out.error = e.message !== undefined && e.message !== '' ? e.message : '同步失败';
    return out;
  });
}

/** 下载云端快照并覆盖本地 */
export function downloadSync(): Promise<string> {
  return refreshCloudVersion().then((): Promise<string> => {
    return callJson('/api/sync/download/' + store.family.id, http.RequestMethod.GET, '', CONNECT_MS, READ_MS);
  }).then((text: string): string => {
    const r = parseStatus(text);
    if (!r.ok || r.payload === null) {
      throw new Error(r.error);
    }
    const p = r.payload as Payload;
    if (p.libraries !== undefined) {
      store.libraries = p.libraries;
    }
    if (p.alerts !== undefined) {
      store.alerts = p.alerts;
    }
    if (p.plans !== undefined) {
      store.plans = p.plans;
    }
    if (p.shopping !== undefined) {
      store.shopping = p.shopping;
    }
    if (p.daily !== undefined) {
      store.daily = p.daily;
    }
    store.initNoSeq();
    return '已拉取云端数据（更新于 ' + r.updatedAt + '）';
  });
}
