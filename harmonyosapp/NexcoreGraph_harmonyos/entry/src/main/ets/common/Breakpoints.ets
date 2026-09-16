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

/* ---------- 页面内容宽度（显式算，不用 padding/width('100%')） ----------
   背景：ArkUI 在「Scroll 子节点」这一层只把左内边距算进布局，右侧内边距
   会被吃掉 —— 结果就是内容左边缘被顶到侧边栏、或者右边缘顶到屏幕边
   （两个方向都会被用户看成"被挡住"）。
   所以页面内容一律用「显式 vp 宽度 + 左边距」，不再依赖内边距。 */

/** 平板/2in1 左侧导航栏宽度（vp），与 Index.NavRail 保持一致 */
export const RAIL_WIDTH_VP: number = 96;
/** 平板右侧停靠的 AI 助手面板宽度（vp），与 Index 里的 AiPanel 停靠列保持一致 */
export const AI_PANEL_WIDTH_VP: number = 420;
/** 页面左右留白（vp）：宽屏 32，手机 16 */
export const PAGE_INSET_WIDE: number = 32;
export const PAGE_INSET_PHONE: number = 16;

export function pageInset(): number {
  return store.isWide ? PAGE_INSET_WIDE : PAGE_INSET_PHONE;
}

/** 页面内容可用宽度（vp）：窗口宽 - 侧栏 - 左右留白 */
export function pageContentWidth(): number {
  let w = windowWidthVp() - (store.isWide ? RAIL_WIDTH_VP : 0) - pageInset() * 2;
  // AI 助手面板是右侧「停靠」而不是浮层，必须一起扣掉，否则页面内容会把面板挤出屏幕右侧
  if (store.isWide && store.aiOpen) {
    w -= AI_PANEL_WIDTH_VP;
  }
  return w > 240 ? w : 240;
}
