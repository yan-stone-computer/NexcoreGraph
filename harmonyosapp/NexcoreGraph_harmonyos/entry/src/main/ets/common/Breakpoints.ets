/* 启核图策 · 响应式断点（手机 / 平板 / 手表三档）
   实测口径：display.width 为 px，除以 densityPixels 得 vp。
     compact（手表） < 400vp  → 单列大数字 + 两个动作，砍图表与图谱
     normal（手机/折叠展开）400–840vp → 现有单列 + 底部 Tab
     wide（平板 / 2in1）  ≥ 840vp → AI 面板右侧停靠、内容分栏
   原实现的问题：store.isWide 从未被赋值，平板布局实际从未生效。 */

import { display } from '@kit.ArkUI';
import { deviceInfo } from '@kit.BasicServicesKit';
import { store } from './Store';

/** 仅作兜底：手表档以设备类型为准，绝不能用宽度判定（手机逻辑宽度可低至 360vp） */
export const BP_COMPACT_MAX: number = 300;
export const BP_WIDE_MIN: number = 840;

/** 设备形态：phone / tablet / 2in1 / wearable …（异常时回落 phone） */
export function deviceKind(): string {
  try {
    const k = deviceInfo.deviceType;
    return k === undefined || k === '' ? 'phone' : k;
  } catch (_e) {
    return 'phone';
  }
}

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
  const kind = deviceKind();
  // 手表：按设备类型判定（宽度兜底只在极窄时生效）
  store.isCompact = kind === 'wearable' || w < BP_COMPACT_MAX;
  // 平板 / 2in1：设备类型优先（不再依赖 vp 换算，避免分屏/密度差异导致误判）
  store.isWide = !store.isCompact && (kind === 'tablet' || kind === '2in1' || w >= BP_WIDE_MIN);
}

/** 当前档位名（用于「我的 - 关于」显示，便于真机验证） */
export function breakpointName(): string {
  const w = windowWidthVp();
  return `${deviceKind()} · ${Math.round(w)}vp · ${store.isCompact ? 'compact' : (store.isWide ? 'wide' : 'normal')}`;
}
