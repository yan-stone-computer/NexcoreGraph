/* 启核图策 · 响应式断点（手机 / 平板 / 手表三档）
   实测口径：display.width 为 px，除以 densityPixels 得 vp。
     compact（手表） < 400vp  → 单列大数字 + 两个动作，砍图表与图谱
     normal（手机/折叠展开）400–840vp → 现有单列 + 底部 Tab
     wide（平板 / 2in1）  ≥ 840vp → AI 面板右侧停靠、内容分栏
   原实现的问题：store.isWide 从未被赋值，平板布局实际从未生效。 */

import { display } from '@kit.ArkUI';
import { store } from './Store';

export const BP_COMPACT_MAX: number = 400;
export const BP_WIDE_MIN: number = 840;

/** 当前窗口宽度（vp）；异常时回落到 380（手机） */
export function windowWidthVp(): number {
  try {
    const d = display.getDefaultDisplaySync();
    if (d.densityPixels <= 0) {
      return 380;
    }
    return d.width / d.densityPixels;
  } catch (_e) {
    return 380;
  }
}

/** 写入 store 供全端读取（启动与窗口尺寸变化时调用） */
export function applyBreakpoints(): void {
  const w = windowWidthVp();
  store.isCompact = w < BP_COMPACT_MAX;
  store.isWide = w >= BP_WIDE_MIN;
}

/** 当前档位名（用于「我的 - 关于」显示，便于真机验证） */
export function breakpointName(): string {
  const w = windowWidthVp();
  if (w < BP_COMPACT_MAX) {
    return `compact（${Math.round(w)}vp）`;
  }
  if (w >= BP_WIDE_MIN) {
    return `wide（${Math.round(w)}vp）`;
  }
  return `normal（${Math.round(w)}vp）`;
}
