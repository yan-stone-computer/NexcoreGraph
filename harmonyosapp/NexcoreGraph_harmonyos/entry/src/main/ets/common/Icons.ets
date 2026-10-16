/* 启核图策 · 图标体系（复刻 web-demo app.js PATHS：24px 圆头线条，描边 1.7） */

import { display } from '@kit.ArkUI';

const PATHS: Record<string, string> = {
  'dashboard': 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  'library': 'm12 2 9 5-9 5-9-5 9-5Z|M3 12l9 5 9-5|M3 17l9 5 9-5',
  'camera': 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z|circle:12 13 3.5',
  'chat': 'M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z',
  'list-check': 'M9 6h11M9 12h11M9 18h11|m3 6 1.2 1.2L6.5 4.8M3 12l1.2 1.2L6.5 10.8M3 18l1.2 1.2 2.3-2.4',
  'bell': 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z|M10 20a2 2 0 0 0 4 0',
  'cart': 'circle:9 20 1.3|circle:17 20 1.3|M3 4h2l2.5 12h10L21 8H6',
  'users': 'circle:9 8 3.5|M2.5 20a6.5 6.5 0 0 1 13 0|M16 5.5a3.5 3.5 0 0 1 0 7|M17.5 14.5a6.5 6.5 0 0 1 4 5.5',
  'settings': 'circle:12 12 3|M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1',
  'search': 'circle:11 11 7|m21 21-4.3-4.3',
  'plus': 'M12 5v14M5 12h14',
  'minus': 'M5 12h14',
  'check': 'm5 12 4 4L19 6',
  'alert': 'M12 3 2.5 20h19L12 3Z|M12 10v4M12 17.5v.5',
  'clock': 'circle:12 12 9|M12 7v5l3 2',
  'arrow-right': 'M5 12h14M13 5l7 7-7 7',
  'mic': 'M9 5.5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Z|M5 11a7 7 0 0 0 14 0|M12 18v3',
  'sparkles': 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z|M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z',
  'fridge': 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z|M5 11h14|M9 6v2M9 15v3',
  'utensils': 'M7 3v4a2.5 2.5 0 0 0 5 0V3|M9.5 9.5v11|M17 3c2.2 3 2.2 6.5 0 9.5v8',
  'shirt': 'M5 7 9 5c.6 1.2 1.7 2 3 2s2.4-.8 3-2l4 2-1 4-2-1v9H8v-9l-2 1-1-4Z',
  'pill': 'm10.5 13.5 6-6a3.5 3.5 0 0 1 5 5l-6 6a3.5 3.5 0 0 1-5-5Z|m6.5 6.5 4 4M13.5 13.5l4 4',
  'wrench': 'M14.5 6.5a4 4 0 0 0-5.2 5.1L4 17v3h3l5.4-5.3a4 4 0 0 0 5.1-5.2l-3 3-2.3-2.3 3-3Z',
  'dumbbell': 'M7 8v8M17 8v8M4 10v4M20 10v4|M7 12h10',
  'book': 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z|M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
  'paw': 'circle:5 10 1.6|circle:19 10 1.6|circle:9.5 6 1.7|circle:14.5 6 1.7|M12 11c3.5 0 6.5 2.6 6.5 5.5 0 1.5-1 2.5-2.5 2.5-1.6 0-2.8-1.5-4-1.5s-2.4 1.5-4 1.5c-1.5 0-2.5-1-2.5-2.5C5.5 13.6 8.5 11 12 11Z',
  'plug': 'M12 3v4M8 3v4|M6 7h12v3a6 6 0 0 1-12 0V7Z|M12 16v5',
  'shield': 'M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z',
  'package': 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z|m4 7.5 8 4.5 8-4.5M12 12v9',
  'home': 'M4 11 12 4l8 7|M6 10v10h12V10',
  'copy': 'M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  'share': 'circle:18 5 3|circle:6 12 3|circle:18 19 3|m8.6 13.5 6.8 4M15.4 6.5l-6.8 4',
  'logout': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|m16 17 5-5-5-5M21 12H9',
  'x': 'M18 6 6 18M6 6l12 12',
  'edit': 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z',
  'calendar': 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z|M8 3v4M16 3v4M3 10h18',
  'chevron-down': 'm6 9 6 6 6-6',
  'upload': 'M12 16V4|M6 10l6-6 6 6|M4 20h16',
  'scan': 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2',
  'circle-check': 'circle:12 12 9|m8.5 12 2.5 2.5 5-5',
  'undo': 'M9 14 4 9l5-5|M4 9h10a6 6 0 0 1 0 12h-4',
  'leaf': 'M5 20C5 10 12 4 21 4c0 9-6 16-16 16Z|M5 20c3-6 7-10 12-12',
  'history': 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5|M12 8v4l3 2',
  'wallet': 'M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z|M3 10h18|M16 15h.5',
  'trend': 'M3 17l5-6 4 3 6-8|M15 6h5v5',
  'tag': 'M3 12V4h8l10 10-8 8L3 12Z|circle:8 8 1.5',
  'file': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z|M14 2v6h6',
  'sun': 'circle:12 12 4|M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  'moon': 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  'arrow-left': 'M19 12H5M11 19l-7-7 7-7',
  'more': 'circle:5 12 1.2|circle:12 12 1.2|circle:19 12 1.2',
  'download': 'M12 4v11|M7 10l5 5 5-5|M4 19h16',
  'trash': 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  'folder-plus': 'M5 5h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z|M12 11v5M9.5 13.5h5',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  'door': 'M4 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4V3Z|circle:13.5 12 1.2',
  'flame': 'M12 3c.8 1.8 3.5 3.2 3.5 6.3a3.5 3.5 0 0 1-7 0C8.5 6.2 11.2 4.8 12 3Z|M10.5 9.5c1.2 1.6 3 2.2 3 4a2 2 0 0 1-4 0c0-1.4.7-2.4 1-4Z',
  'thermometer': 'M12 3a2.2 2.2 0 0 1 2.2 2.2v7.8a4.5 4.5 0 1 1-4.4 0V5.2A2.2 2.2 0 0 1 12 3Z|M12 9v6',
  'shuffle': 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5'
};

function scaleNums(p: string, k: number): string {
  // 按命令缩放：A 命令的 x 轴旋转与两个标志位不缩放
  const COUNTS: Record<string, number> = {
    'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0
  };
  const out: string[] = [];
  let cmd = '';
  let pending: number[] = [];
  let need = 0;
  const flush = (): void => {
    if (pending.length === 0) {
      return;
    }
    let s = cmd;
    const lower = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    for (let i = 0; i < pending.length; i++) {
      let v = pending[i];
      if (up === 'A') {
        const mod = i % 7;
        if (mod === 3 || mod === 4) {
          // 旋转角与标志位保持不变
        } else {
          v = Math.round(v * k * 100) / 100;
        }
      } else if (up !== 'Z') {
        v = Math.round(v * k * 100) / 100;
      }
      s += (i === 0 ? '' : ' ') + (Math.abs(v) < 0.005 ? '0' : String(v));
    }
    out.push(s);
    // 同命令隐式重复：M→L，m→l，其余保持
    if (up === 'M') {
      cmd = lower ? 'l' : 'L';
      need = 2;
    }
    pending = [];
  };
  let num = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p.charAt(i);
    const isNumChar = /[0-9.\-]/.test(ch);
    if (/[a-zA-Z]/.test(ch)) {
      if (num !== '') {
        pending.push(parseFloat(num));
        num = '';
      }
      flush();
      cmd = ch;
      need = COUNTS[ch.toUpperCase()] !== undefined ? COUNTS[ch.toUpperCase()] : 0;
      continue;
    }
    if (isNumChar) {
      if (ch === '-' && num !== '') {
        pending.push(parseFloat(num));
        num = '';
        if (need > 0 && pending.length === need) {
          flush();
        }
      }
      num += ch;
      continue;
    }
    if (num !== '') {
      pending.push(parseFloat(num));
      num = '';
      if (need > 0 && pending.length === need) {
        flush();
      }
    }
  }
  if (num !== '') {
    pending.push(parseFloat(num));
  }
  flush();
  return out.join(' ');
}

let DENSITY: number = 0;
function density(): number {
  if (DENSITY <= 0) {
    try {
      DENSITY = display.getDefaultDisplaySync().densityPixels;
    } catch (e) {
      DENSITY = 3;
    }
  }
  return DENSITY;
}

export function hasIcon(name: string): boolean {
  return PATHS[name] !== undefined;
}

/** 解析 circle:cx cy r 子段并转为 4 段三次贝塞尔（已按 k 缩放，单位 px） */
export function circleSegPath(seg: string, k: number): string {
  const parts = seg.substring(7).split(' ');
  const cx = parseFloat(parts[0]) * k;
  const cy = parseFloat(parts[1]) * k;
  const r = parseFloat(parts[2]) * k;
  const kr = 0.5522847498 * r;
  const f = (n: number): string => String(Math.round(n * 100) / 100);
  return `M ${f(cx + r)} ${f(cy)}` +
    ` C ${f(cx + r)} ${f(cy + kr)} ${f(cx + kr)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}` +
    ` C ${f(cx - kr)} ${f(cy + r)} ${f(cx - r)} ${f(cy + kr)} ${f(cx - r)} ${f(cy)}` +
    ` C ${f(cx - r)} ${f(cy - kr)} ${f(cx - kr)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}` +
    ` C ${f(cx + kr)} ${f(cy - r)} ${f(cx + r)} ${f(cy - kr)} ${f(cx + r)} ${f(cy)}`;
}

/** 图标子段（| 分隔；circle: 段已转为 Path 命令） */
export function iconSegs(name: string, sizeVp: number): string[] {
  const raw = PATHS[name] !== undefined ? PATHS[name] : PATHS['dashboard'];
  const k = sizeVp * density() / 24;
  return raw.split('|').map((seg: string): string => {
    if (seg.startsWith('circle:')) {
      return circleSegPath(seg, k);
    }
    return scaleNums(seg, k);
  });
}

export function iconStroke(sizeVp: number): number {
  return 1.7 * sizeVp / 24;
}
