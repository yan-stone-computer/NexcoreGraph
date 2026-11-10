/* 启核图策 · 云端同步客户端（后端为账号数据的权威存放处，F9.10）
   地址解析与 JSON 请求复用 common/Backend.ets（与 AI 网关同一套候选地址链）。
   上传/下载共用 Continuation 的同一份快照 DTO（库+物品 / 方案 / 预警 / 采购 / 待办 /
   工作台 / 对话 / 日志 / 设置），因此"换设备拉回来"和"本机恢复"结果完全一致。
   流程：tryUploadSync 先查云端版本（落后 → 409 冲突，返回描述供设置页提示），
   用户选择“覆盖上传”走 forceUploadSync，“改为拉取”走 downloadSync。 */

import { http } from '@kit.NetworkKit';
import { store } from './Store';
import { callJson, backendBody, backendStatus } from './Backend';
import { buildDataSnapshot, applyDataSnapshot } from './Continuation';

let cloudVersion: number = 0;
const CONNECT_MS: number = 5000;
const READ_MS: number = 20000;

class SyncResp {
  ok: boolean = false;
  version: number = 0;
  error: string = '';
  updatedAt: string = '';
  /** 云端存的就是端侧快照 DTO（Continuation.DataPayload），这里只当不透明对象透传 */
  payload: object | null = null;
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
  // payload 直接用与「流转」同一份快照（含物品明细），后端只当"家庭数据块"存，不自解析
  const snapshot: object = JSON.parse(buildDataSnapshot()) as object;
  return JSON.stringify({
    familyId: store.family.id,
    version: Date.now(),
    baseVersion: cloudVersion,
    force: force,
    payload: snapshot
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
    // 走 DTO 还原：@ObservedV2 数组里塞 JSON 纯对象会崩，必须由 applyDataSnapshot 重建实例
    const applied: number = applyDataSnapshot(JSON.stringify(r.payload), true);
    if (applied < 0) {
      throw new Error('云端数据格式不兼容，请升级 App 后再拉取');
    }
    store.initNoSeq();
    return '已拉取云端数据（更新于 ' + r.updatedAt + '）';
  });
}

/** 登录后自动拉取：云端没有快照（404）视为"新账号"，直接从空开始，不当失败处理 */
export function pullMyData(): Promise<boolean> {
  if (store.family.id === '') {
    return Promise.resolve(false);
  }
  return downloadSync().then((_msg: string): boolean => true)
    .catch((e: Error): boolean => {
      if (backendStatus() === 404) {
        return false;
      }
      throw e;
    });
}

/** 静默上传（自动保存用）：不弹冲突提示，冲突时以云端为准（下次拉取覆盖本机） */
export function autoUpload(): Promise<boolean> {
  if (store.family.id === '' || store.authToken === '') {
    return Promise.resolve(false);
  }
  return doUpload(true).then((r: SyncConflict): boolean => r.ok)
    .catch((): boolean => false);
}
