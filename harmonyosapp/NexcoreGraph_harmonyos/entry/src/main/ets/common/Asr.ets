/* 启核图策 · 语音输入（F5.3）
   ponytail: 元服务形态（bundleType=atomicService）系统级禁用 CoreSpeechKit 与 AudioCapturer，
   故当前仅保留占位降级；完整实现（端侧识别 + 采音）见 git 历史或恢复条件：
   AGC 双包发布（应用包走 app 形态、元服务包走 atomicService）时，把本文件还原为
   speechRecognizer.createEngine + audio.createAudioCapturer 的完整版本并在应用包中启用。 */

import { common } from '@kit.AbilityKit';

export class AsrSession {
  active: boolean = false;

  async start(_ctx: common.UIAbilityContext,
    _onResult: (text: string, isFinal: boolean) => void,
    onError: (msg: string) => void): Promise<void> {
    onError('语音输入需完整应用形态（元服务暂不支持）');
  }

  async stop(): Promise<void> {
    this.active = false;
  }
}
