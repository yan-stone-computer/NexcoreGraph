/* 启核图策 · AI 回复语音播报（整改文档 M-9）
   实现口径（重要）：本应用当前是**元服务（bundleType=atomicService）**形态，
   编译期即拒绝 CoreSpeechKit（`textToSpeech` / `createEngine` 报
   "can't support atomicservice application"），与 Asr.ets 的系统 ASR 同因。
   因此 M-9 走"后端网关合成 + 端侧播放"：POST /api/ai/tts 取音频地址 →
   AVPlayer 播放（AVPlayer 在元服务形态可用）。
   恢复条件（与 Asr.ets 一致）：AGC 双包发布时，应用包内可换回
   textToSpeech.createEngine + speak（端侧合成、零延迟、离线可用）。
   红线外约束：播报文本 ≤120 字截断；未配置 TTS / 断网 / 无音源时静默降级为纯文字。 */

import { media } from '@kit.MediaKit';
import { http } from '@kit.NetworkKit';
import { callJson, backendStatus } from './Backend';
import { store } from './Store';

const MAX_SPEAK_CHARS: number = 120;
const CONNECT_MS: number = 5000;
const READ_MS: number = 20000;

class TtsResp {
  ok: boolean = false;
  url: string = '';
  audioBase64: string = '';
  error: string = '';
}

export class TtsSession {
  private player: media.AVPlayer | null = null;
  /** 后端未配置 TTS（501）时置位：此后不再发起请求，UI 自动隐藏播报入口 */
  unavailable: boolean = false;
  speaking: boolean = false;

  isUsable(): boolean {
    return !this.unavailable;
  }

  private disposePlayer(): void {
    this.speaking = false;
    const p = this.player;
    this.player = null;
    if (p !== null) {
      try {
        p.release();
      } catch (_e) {
        // 释放异常忽略
      }
    }
  }

  private playUrl(url: string): void {
    this.disposePlayer();
    media.createAVPlayer().then((p: media.AVPlayer): void => {
      this.player = p;
      p.on('stateChange', (state: string): void => {
        if (state === 'initialized') {
          p.prepare();
        } else if (state === 'prepared') {
          this.speaking = true;
          p.play();
        } else if (state === 'completed') {
          this.disposePlayer();
        }
      });
      p.on('error', (): void => {
        this.disposePlayer();
      });
      p.url = url;
    }).catch((_e: Error): void => {
      this.speaking = false;
    });
  }

  /** 播报一段文本；返回 false 表示当前环境不支持（调用方无需额外提示） */
  speak(text: string): boolean {
    if (this.unavailable || text === '') {
      return false;
    }
    const cut = text.length > MAX_SPEAK_CHARS ? text.substring(0, MAX_SPEAK_CHARS) : text;
    const body: Record<string, Object> = { 'text': cut, 'voice': 'zh-CN-female' };
    callJson('/api/ai/tts', http.RequestMethod.POST, JSON.stringify(body), CONNECT_MS, READ_MS)
      .then((t: string): void => {
        const r = JSON.parse(t) as TtsResp;
        if (r.url === undefined || r.url === '') {
          this.unavailable = true;
          return;
        }
        this.playUrl(r.url);
      })
      .catch((_e: Error): void => {
        // 501 = 后端未配置 TTS：永久降级；其它错误（断网等）保留重试机会
        if (backendStatus() === 501) {
          this.unavailable = true;
        }
        this.speaking = false;
      });
    return true;
  }

  stop(): void {
    this.disposePlayer();
  }

  release(): void {
    this.disposePlayer();
  }
}
