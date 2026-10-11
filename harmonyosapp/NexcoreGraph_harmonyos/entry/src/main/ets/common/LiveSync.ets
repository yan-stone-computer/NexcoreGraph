/* 启核图策 · 数据同步（多端协同 + 后端持久化）
   —— 不是点按钮才走，而是：任一设备改了数据 → 自动 Post 到中转 → 另一台轮询拉到
     新版本（rev 变化）→ 按 id 原地并入（不打断当前页面）。
   与「流转」共用同一份数据快照（Continuation.buildDataSnapshot/applyDataSnapshot）。
   注意：本机自己发出的版本会被记下（lastRev），不会自己应用自己。

   另外本文件还负责"用户数据不丢"的两条兜底（用户数据既落本机、也落后端）：
     · 本机落盘 saveUserData()：杀进程/断网后重开还是上次的样子；
     · 后端 autoUpload()：换设备/重装后用同一账号登录即可拉回。
   实现方式是最朴素的"内容变了才写"：每 AUTOSAVE_MS 比一次快照字符串，
   变了才落盘 + 防抖上传，避免在几十个写操作点里挨个插代码（漏一个就丢数据）。 */

import { store } from './Store';
import { buildDataSnapshot, applyDataSnapshot } from './Continuation';
import { publishFlow, pullFlow, deviceLabel, FlowHandoff } from './FlowBridge';
import { saveUserData } from './LocalStore';
import { autoUpload } from './SyncApi';

const POLL_MS: number = 2000;     // 轮询间隔：演示足够跟手，又不至于太费电
const PUBLISH_DEBOUNCE_MS: number = 600;   // 连续点击时合并成一次发送
const AUTOSAVE_MS: number = 6000;          // 数据内容比对间隔
const CLOUD_DEBOUNCE_MS: number = 2500;    // 上传后端前的防抖

let pollTimer: number = -1;
let publishTimer: number = -1;
let saveTimer: number = -1;
let cloudTimer: number = -1;
let lastSnapshot: string = '';
let lastRev: number = 0;          // 已知的最新版本（自己发的 / 已应用的）
let applying: boolean = false;    // 正在应用远端数据：期间不再触发发送，避免来回循环
let running: boolean = false;

export function liveSyncRunning(): boolean {
  return running;
}

export function lastSyncedRev(): number {
  return lastRev;
}

/** 手动接收后登记版本，避免轮询把同一版再应用一次 */
export function markSyncedRev(rev: number): void {
  if (rev > lastRev) {
    lastRev = rev;
  }
}

/** 登录后启动：先拉一次对齐版本，再开始轮询 */
export function startLiveSync(): void {
  if (running) {
    return;
  }
  running = true;
  lastSnapshot = buildDataSnapshot();
  saveTimer = setInterval((): void => {
    autoSaveTick();
  }, AUTOSAVE_MS);
  pollOnce();
  pollTimer = setInterval((): void => {
    pollOnce();
  }, POLL_MS);
}

/** 数据内容变了才落盘 + 上传后端（内容没变就什么都不做） */
function autoSaveTick(): void {
  if (!store.loggedIn || applying) {
    return;
  }
  const snap = buildDataSnapshot();
  if (snap === lastSnapshot) {
    return;
  }
  lastSnapshot = snap;
  saveUserData();
  if (cloudTimer !== -1) {
    clearTimeout(cloudTimer);
  }
  cloudTimer = setTimeout((): void => {
    cloudTimer = -1;
    autoUpload();
  }, CLOUD_DEBOUNCE_MS);
}

export function stopLiveSync(): void {
  // 退出前再落一次盘：最后一个改动不会因为定时器还没轮到而丢
  if (store.loggedIn) {
    const snap = buildDataSnapshot();
    if (snap !== lastSnapshot) {
      lastSnapshot = snap;
      saveUserData();
    }
  }
  if (pollTimer !== -1) {
    clearInterval(pollTimer);
    pollTimer = -1;
  }
  if (saveTimer !== -1) {
    clearInterval(saveTimer);
    saveTimer = -1;
  }
  if (cloudTimer !== -1) {
    clearTimeout(cloudTimer);
    cloudTimer = -1;
  }
  if (publishTimer !== -1) {
    clearTimeout(publishTimer);
    publishTimer = -1;
  }
  running = false;
}

/** 本机数据发生变化后调用（写操作收尾）：防抖合并后自动发送 */
export function scheduleLivePublish(): void {
  if (!running || applying || !store.loggedIn) {
    return;
  }
  if (publishTimer !== -1) {
    clearTimeout(publishTimer);
  }
  publishTimer = setTimeout((): void => {
    publishTimer = -1;
    doPublish(false);
  }, PUBLISH_DEBOUNCE_MS);
}

/** 手动「发送流转」也走这里：带上页面状态（手动时 want 状态 + 数据） */
export function publishNow(stateJson: string): void {
  if (publishTimer !== -1) {
    clearTimeout(publishTimer);
    publishTimer = -1;
  }
  publishFlow(deviceLabel(), stateJson, buildDataSnapshot()).then((_: void): void => {
    lastRev += 1;
  }).catch((_e: Error): void => {
    // 中转没起就算了：不影响本机使用
  });
}

function doPublish(stateOnly: boolean): void {
  const data = buildDataSnapshot();
  const stateJson = '{}';
  publishFlow(deviceLabel(), stateJson, data).then((_: void): void => {
    lastRev += 1;      // 保守估计：下一轮拉取时用 since 过滤掉自己这版
  }).catch((_e: Error): void => {
    // 静默失败：模拟器有时候没起中转
  });
}

function pollOnce(): void {
  if (!store.loggedIn || applying) {
    return;
  }
  pullFlow(lastRev).then((h: FlowHandoff): void => {
    if (!h.found) {
      return;
    }
    lastRev = h.rev;
    if (h.from === deviceLabel()) {
      return;   // 自己发的（同名设备）：忽略
    }
    if (h.data === '') {
      return;
    }
    applying = true;
    const n = applyDataSnapshot(h.data);
    applying = false;
    if (n >= 0) {
      // 不弹 Toast（活同步很频繁，弹窗会打扰）：只记一行状态，在「我的 → 跨设备流转」里看
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      store.lastSyncNote = `${hh}:${mm} 已同步${h.from}的数据 · ${n} 件物品`;
    }
  }).catch((_e: Error): void => {
    // 中转不可用：静默
  });
}
