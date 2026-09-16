/* 启核图策 · 跨设备流转（中转通道：模拟器 / 跨网段 / 演示用）
   真机同账号同网时走系统接续（Continuation.ets 的 onContinue → restoreFlow）；
   模拟器之间没有 dsoftbus、组不了网，就由这里把**同一份快照**经本地中转服务
   （backend/flow-bridge.js，默认 3100 端口）送到另一台设备，再复用 applyFlowState 还原。
   两条通道共用 buildFlowState/applyFlowState，字段、版本号、隐私口径完全一致。 */

import { http } from '@kit.NetworkKit';
import { requestJson, HttpResult } from './Backend';
import { deviceKind } from './Breakpoints';

/** 中转服务候选地址：模拟器 NAT 宿主机 → 局域网 IP → 本机 */
const HOSTS: string[] = [
  'http://10.0.2.2:3100',
  'http://192.168.16.247:3100',
  'http://127.0.0.1:3100'
];

let resolvedHost: string = '';

export class FlowHandoff {
  found: boolean = false;
  from: string = '';
  at: number = 0;
  json: string = '';
  data: string = '';
}

/** 本机设备名（演示时显示"来自 手机/平板"） */
export function deviceLabel(): string {
  const k = deviceKind();
  if (k === 'tablet') {
    return '平板';
  }
  if (k === '2in1') {
    return '电脑';
  }
  if (k === 'wearable') {
    return '手表';
  }
  return '手机';
}

export function bridgeHost(): string {
  return resolvedHost;
}

function tryAt(idx: number, path: string, method: http.RequestMethod,
  body: string): Promise<HttpResult> {
  if (idx >= HOSTS.length) {
    return Promise.reject(new Error('找不到流转中转服务：请先运行 backend/flow-bridge.js'));
  }
  return requestJson(HOSTS[idx] + path, method, body, 4000, 6000)
    .then((r: HttpResult): Promise<HttpResult> => {
      if (r.code === 200) {
        resolvedHost = HOSTS[idx];
        return Promise.resolve(r);
      }
      if (r.code === 400) {
        resolvedHost = HOSTS[idx];
        return Promise.resolve(r);
      }
      return tryAt(idx + 1, path, method, body);
    })
    .catch((_e: Error): Promise<HttpResult> => tryAt(idx + 1, path, method, body));
}

/** 源端：把当前流程快照 + 数据快照一起发到中转 */
export function publishFlow(from: string, json: string, data: string = ''): Promise<void> {
  const payload = JSON.stringify({ from: from, json: json, data: data });
  return tryAt(0, '/api/flow/publish', http.RequestMethod.POST, payload)
    .then((r: HttpResult): void => {
      if (r.code !== 200) {
        throw new Error('中转服务返回 ' + r.code);
      }
    });
}

/** 目标端：取中转里最新的流转记录 */
export function pullFlow(): Promise<FlowHandoff> {
  return tryAt(0, '/api/flow/latest', http.RequestMethod.GET, '')
    .then((r: HttpResult): FlowHandoff => {
      const out = new FlowHandoff();
      if (r.code !== 200 || r.text === '') {
        return out;
      }
      const j = JSON.parse(r.text) as Record<string, Object>;
      const found = j['found'];
      if (found === undefined || String(found) !== 'true') {
        return out;
      }
      out.found = true;
      out.from = j['from'] === undefined ? '' : String(j['from']);
      out.at = j['at'] === undefined ? 0 : Number(j['at']);
      out.json = j['json'] === undefined ? '' : String(j['json']);
      out.data = j['data'] === undefined || j['data'] === null ? '' : String(j['data']);
      return out;
    });
}
