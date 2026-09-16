/* 启核图策 · 两台设备之间的"活"同步（演示 / 同一账号多端协同）
   —— 不是点按钮才走，而是：任一设备改了数据 → 自动 Post 到中转 → 另一台轮询拉到
     新版本（rev 变化）→ 按 id 原地并入（不打断当前页面）。
   与「流转」共用同一份数据快照（Continuation.buildDataSnapshot/applyDataSnapshot）。
   注意：本机自己发出的版本会被记下（lastRev），不会自己应用自己。 */

import { store } from './Store';
import { buildDataSnapshot, applyDataSnapshot } from './Continuation';
import { publishFlow, pullFlow, deviceLabel, FlowHandoff } from './FlowBridge';

const POLL_MS: number = 2000;     // 轮询间隔：演示足够跟手，又不至于太费电
const PUBLISH_DEBOUNCE_MS: number = 600;   // 连续点击时合并成一次发送

let pollTimer: number = -1;
let publishTimer: number = -1;
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
  pollOnce();
  pollTimer = setInterval((): void => {
    pollOnce();
  }, POLL_MS);
}

export function stopLiveSync(): void {
  if (pollTimer !== -1) {
    clearInterval(pollTimer);
    pollTimer = -1;
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
      store.toast(`已同步${h.from}的数据（${n} 件物品）`);
    }
  }).catch((_e: Error): void => {
    // 中转不可用：静默
  });
}
