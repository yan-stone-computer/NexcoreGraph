/* 启核图策 · 后端地址解析与 JSON 请求（同步 SyncApi 与 AI 网关 AiGateway 共用）
   候选地址链：模拟器 NAT 宿主机 → 局域网 IP → 本机预览；健康探测通过后缓存。
   整改文档 4.7：端上不直连模型厂商，所有 AI 调用都经此模块打到自建后端 /api/ai/*。 */

import { http } from '@kit.NetworkKit';

const CANDIDATES: string[] = [
  'http://10.0.2.2:3000',          // QEMU NAT 宿主机
  'http://192.168.16.247:3000',    // 宿主机局域网 IP
  'http://127.0.0.1:3000'          // PC 侧预览/真机同网段时替换
];

let resolvedBase: string = '';
let lastStatus: number = 0;
let lastBody: string = '';

/** HTTP 结果：不因状态码非 200 抛异常，交由调用方按业务语义处理（如同步 409 冲突） */
export class HttpResult {
  code: number = 0;
  text: string = '';
}

export function backendStatus(): number {
  return lastStatus;
}

export function backendBody(): string {
  return lastBody;
}

/** 已解析的后端地址（未解析时为空字符串） */
export function currentBase(): string {
  return resolvedBase;
}

/** 单次 JSON 请求（调用方自行决定超时；失败时 reject 网络层错误） */
export function requestJson(url: string, method: http.RequestMethod, body: string,
  connectTimeout: number, readTimeout: number): Promise<HttpResult> {
  const req = http.createHttp();
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  const opts: http.HttpRequestOptions = {
    method: method,
    header: header,
    connectTimeout: connectTimeout,
    readTimeout: readTimeout
  };
  if (body !== '') {
    opts.extraData = body;
  }
  return new Promise<HttpResult>((resolve: (v: HttpResult) => void, reject: (e: Error) => void) => {
    req.request(url, opts).then((res: http.HttpResponse): void => {
      const out = new HttpResult();
      out.code = res.responseCode;
      out.text = typeof res.result === 'string' ? res.result : '';
      req.destroy();
      resolve(out);
    }).catch((e: Error): void => {
      req.destroy();
      reject(e);
    });
  });
}

/** 从响应体里取 error 字段作为可读错误信息 */
function errorOf(text: string, code: number): string {
  if (text !== '') {
    try {
      const j = JSON.parse(text) as Record<string, Object>;
      const msg = j['error'];
      if (msg !== undefined && String(msg) !== '') {
        return String(msg);
      }
    } catch (_e) {
      // 非 JSON 错误体：退回状态码描述
    }
  }
  return '请求失败(' + code + ')';
}

/** 依次尝试候选地址，返回第一个健康的后端 base；结果缓存复用 */
export function resolveBase(): Promise<string> {
  if (resolvedBase !== '') {
    return Promise.resolve(resolvedBase);
  }
  const tryAt = (idx: number): Promise<string> => {
    if (idx >= CANDIDATES.length) {
      return Promise.reject(new Error('找不到后端服务（请确认电脑上 backend 已启动）'));
    }
    return requestJson(CANDIDATES[idx] + '/api/health', http.RequestMethod.GET, '', 4000, 6000)
      .then((r: HttpResult): Promise<string> => {
        if (r.code !== 200) {
          return tryAt(idx + 1);
        }
        resolvedBase = CANDIDATES[idx];
        return Promise.resolve(resolvedBase);
      })
      .catch((_e: Error): Promise<string> => tryAt(idx + 1));
  };
  return tryAt(0);
}

/** 带 base 的 JSON 请求：网络错误 / 非 200 都 reject，并记录最后一次状态码与响应体 */
export function callJson(path: string, method: http.RequestMethod, body: string,
  connectTimeout: number, readTimeout: number): Promise<string> {
  return resolveBase().then((base: string): Promise<HttpResult> => {
    return requestJson(base + path, method, body, connectTimeout, readTimeout);
  }).then((r: HttpResult): string => {
    lastStatus = r.code;
    lastBody = r.text;
    if (r.code !== 200) {
      throw new Error(errorOf(r.text, r.code));
    }
    lastStatus = 0;
    lastBody = '';
    return r.text;
  });
}
