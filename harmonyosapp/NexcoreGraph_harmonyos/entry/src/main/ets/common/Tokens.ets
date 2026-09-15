/* 启核图策 · 设计令牌（单一来源；禁止在页面里写死颜色）
   两套主题色板 × 明暗两态，可在 设置 → 外观 切换：
     · 启核（默认）：取自官方徽标的 绿→青→蓝 渐变 + 深海军蓝底，见 docs/brand/BRAND.md
     · 经典：早期品牌橙（#FF8833 / #E8701E），保留以兼容既有截图与物料
   圆角 4/8/12/16/999，动效 140/220/320ms。 */

@ObservedV2
export class Theme {
  /** 默认浅色：冷白底（#F5F9FB）+ 启核绿主色；深色可手动切换 */
  @Trace dark: boolean = false;
  /** 默认色板：启核（绿→青→蓝） */
  @Trace palette: string = 'nexcore';

  /* ---------- 启核色板（默认）：严格取自官方徽标的绿→青→蓝三段渐变 ----------
     分工：启核绿 = 主操作/生长；过渡青·科技青 = AI/强调；信号蓝 = 数据与辅助（图表/环形图）。
     浅色态用加深版绿（#2F8F3A）保证白底对比度。 */
  private static NC_DK: Record<string, string> = {
    'surface': '#13172B',
    'surface-raised': '#1A2140',
    'surface-overlay': '#222B4D',
    'surface-sunken': '#0D1224',
    'border': 'rgba(140,170,210,0.20)',
    'border-strong': 'rgba(140,170,210,0.38)',
    'text-primary': '#F2F7FB',
    'text-secondary': '#B7C6D9',
    'text-muted': '#7C8CA6',
    'primary': '#46B14C',                      // 启核绿（徽标顶部主色）
    'on-primary': '#06210A',
    'primary-hover': '#5ACB63',
    'primary-container': 'rgba(70,177,76,0.18)',
    'on-primary-container': '#A8E7AE',
    'accent': '#2FD4B2',                       // 过渡青（徽标中段）
    'on-accent': '#04241D',
    'accent-container': 'rgba(47,212,178,0.16)',
    'on-accent-container': '#A8F0DC',
    'success': '#B1EB59',                      // 嫩芽黄绿（徽标高光）
    'success-container': 'rgba(177,235,89,0.16)',
    'warning': '#FFB020',
    'warning-container': 'rgba(255,176,32,0.16)',
    'danger': '#FF5D5D',
    'danger-container': 'rgba(255,93,93,0.16)',
    'tone-teal': '#19BDC9', 'tone-teal-bg': 'rgba(25,189,201,0.16)',   // 科技青
    'tone-indigo': '#0CA8D6', 'tone-indigo-bg': 'rgba(12,168,214,0.16)', // 信号蓝（数据）
    'tone-red': '#FF6B6B', 'tone-red-bg': 'rgba(255,107,107,0.14)',
    'tone-slate': '#93A1B0', 'tone-slate-bg': 'rgba(147,161,176,0.14)',
    'tone-lime': '#A8E05F', 'tone-lime-bg': 'rgba(168,224,95,0.16)',
    'tone-brown': '#E0A45C', 'tone-brown-bg': 'rgba(224,164,92,0.16)',
    'tone-orange': '#FFA45C', 'tone-orange-bg': 'rgba(255,164,92,0.16)',
    'tone-violet': '#B59CFF', 'tone-violet-bg': 'rgba(181,156,255,0.14)',
    'tone-amber': '#FFB020', 'tone-amber-bg': 'rgba(255,176,32,0.16)'
  };

  private static NC_LT: Record<string, string> = {
    'surface': '#F5F9FB',
    'surface-raised': '#FFFFFF',
    'surface-overlay': '#E9F1F5',
    'surface-sunken': '#EDF3F7',
    'border': 'rgba(18,60,80,0.14)',
    'border-strong': 'rgba(18,60,80,0.30)',
    'text-primary': '#0E1424',
    'text-secondary': '#3C4C5C',
    'text-muted': '#6B7C8C',
    'primary': '#2F8F3A',                      // 启核绿（加深版，白底可读）
    'on-primary': '#F2FBF3',
    'primary-hover': '#46B14C',
    'primary-container': '#DDF1DE',
    'on-primary-container': '#14501C',
    'accent': '#19BDC9',                       // 科技青
    'on-accent': '#FFFFFF',
    'accent-container': '#D6F4F6',
    'on-accent-container': '#03555C',
    'success': '#5E8A2A',                      // 嫩芽黄绿（加深版）
    'success-container': '#EAF3D6',
    'warning': '#B87D16',
    'warning-container': '#F7EAD0',
    'danger': '#C53D3D',
    'danger-container': '#F7E0DE',
    'tone-teal': '#00808F', 'tone-teal-bg': '#D5EEF2',
    'tone-indigo': '#0A7FA8', 'tone-indigo-bg': '#D8EDF5',
    'tone-red': '#C24B4B', 'tone-red-bg': '#F5E2E0',
    'tone-slate': '#566873', 'tone-slate-bg': '#E3E9ED',
    'tone-lime': '#6B9B2E', 'tone-lime-bg': '#EAF3D6',
    'tone-brown': '#8A5F28', 'tone-brown-bg': '#F1E6D6',
    'tone-orange': '#C2701F', 'tone-orange-bg': '#FAE4CE',
    'tone-violet': '#5F55A0', 'tone-violet-bg': '#E8E5F4',
    'tone-amber': '#A8710F', 'tone-amber-bg': '#F5E9CE'
  };

  /* ---------- 经典色板：早期品牌橙（保留兼容） ---------- */
  private static DK: Record<string, string> = {
    'surface': '#13172B',
    'surface-raised': '#1A1E35',
    'surface-overlay': '#232945',
    'surface-sunken': '#0E1122',
    'border': 'rgba(150,160,210,0.18)',
    'border-strong': 'rgba(150,160,210,0.36)',
    'text-primary': '#F2F4FA',
    'text-secondary': '#B9C0DA',
    'text-muted': '#7C84AA',
    'primary': '#FF8833',
    'on-primary': '#241000',
    'primary-hover': '#FF9E57',
    'primary-container': 'rgba(255,136,51,0.14)',
    'on-primary-container': '#FFC79B',
    'accent': '#00D4FF',
    'on-accent': '#001820',
    'accent-container': 'rgba(0,212,255,0.14)',
    'on-accent-container': '#8DEBFF',
    'success': '#4ADE80',
    'success-container': 'rgba(74,222,128,0.14)',
    'warning': '#FFB020',
    'warning-container': 'rgba(255,176,32,0.16)',
    'danger': '#FF5D5D',
    'danger-container': 'rgba(255,93,93,0.16)',
    'tone-teal': '#00D4FF', 'tone-teal-bg': 'rgba(0,212,255,0.14)',
    'tone-indigo': '#7C9CFF', 'tone-indigo-bg': 'rgba(124,156,255,0.14)',
    'tone-red': '#FF6B6B', 'tone-red-bg': 'rgba(255,107,107,0.14)',
    'tone-slate': '#93A1B0', 'tone-slate-bg': 'rgba(147,161,176,0.14)',
    'tone-lime': '#A8E05F', 'tone-lime-bg': 'rgba(168,224,95,0.14)',
    'tone-brown': '#E0A45C', 'tone-brown-bg': 'rgba(224,164,92,0.16)',
    'tone-orange': '#FF8833', 'tone-orange-bg': 'rgba(255,136,51,0.16)',
    'tone-violet': '#B59CFF', 'tone-violet-bg': 'rgba(181,156,255,0.14)',
    'tone-amber': '#FFB020', 'tone-amber-bg': 'rgba(255,176,32,0.16)'
  };

  private static LT: Record<string, string> = {
    'surface': '#FBF7F2',
    'surface-raised': '#FEFCF9',
    'surface-overlay': '#F1EAE1',
    'surface-sunken': '#F4EDE5',
    'border': 'rgba(60,45,30,0.14)',
    'border-strong': 'rgba(60,45,30,0.3)',
    'text-primary': '#221A12',
    'text-secondary': '#5A4B3B',
    'text-muted': '#8A7A68',
    'primary': '#E8701E',
    'on-primary': '#FFF8F0',
    'primary-hover': '#D26010',
    'primary-container': '#FCE6D2',
    'on-primary-container': '#6E3005',
    'accent': '#0096C4',
    'on-accent': '#F2FBFF',
    'accent-container': '#D8F2FA',
    'on-accent-container': '#024A60',
    'success': '#2F9E63',
    'success-container': '#DDF2E5',
    'warning': '#B87D16',
    'warning-container': '#F7EAD0',
    'danger': '#C53D3D',
    'danger-container': '#F7E0DE',
    'tone-teal': '#00849C', 'tone-teal-bg': '#D9F1F6',
    'tone-indigo': '#5B6EC8', 'tone-indigo-bg': '#E7EAF7',
    'tone-red': '#C24B4B', 'tone-red-bg': '#F5E2E0',
    'tone-slate': '#5E6C78', 'tone-slate-bg': '#E5E9EC',
    'tone-lime': '#6C8F3C', 'tone-lime-bg': '#EAF0DC',
    'tone-brown': '#9A6B2F', 'tone-brown-bg': '#F2E7D7',
    'tone-orange': '#E8701E', 'tone-orange-bg': '#FBE3CE',
    'tone-violet': '#6F5FA8', 'tone-violet-bg': '#EAE6F4',
    'tone-amber': '#B87D16', 'tone-amber-bg': '#F7EAD0'
  };

  /** 当前生效的色表 */
  private active(): Record<string, string> {
    if (this.palette === 'classic') {
      return this.dark ? Theme.DK : Theme.LT;
    }
    return this.dark ? Theme.NC_DK : Theme.NC_LT;
  }

  /** 取令牌色，如 T.c('primary') / T.c('tone-teal-bg') */
  c(key: string): string {
    const map = this.active();
    const v = map[key];
    return v !== undefined ? v : '#FF0000';
  }

  /** 库色调 [前景, 背景]，与 web-demo libraryTone 一致 */
  tone(name: string): string[] {
    const map = this.active();
    const fg = map['tone-' + name];
    const bg = map['tone-' + name + '-bg'];
    if (fg === undefined || bg === undefined) {
      return [this.c('primary'), this.c('primary-container')];
    }
    return [fg, bg];
  }

  /** 主题色板中文名（设置页展示用） */
  paletteLabel(): string {
    return this.palette === 'classic' ? '经典橙' : '启核绿青蓝';
  }

  /** 当前主题完整描述：如"启核绿青蓝 · 深色" */
  themeLabel(): string {
    return `${this.paletteLabel()} · ${this.dark ? '深色' : '浅色'}`;
  }

  setPalette(p: string): void {
    this.palette = p === 'classic' ? 'classic' : 'nexcore';
  }

  setDark(v: boolean): void {
    this.dark = v;
  }

  /** 恢复到品牌默认（启核色板 + 深色） */
  resetDefault(): void {
    this.palette = 'nexcore';
    this.dark = false;
  }
}

export const T: Theme = new Theme();

/* 8pt 间距 */
export const S1: number = 4;
export const S2: number = 8;
export const S3: number = 12;
export const S4: number = 16;
export const S5: number = 20;
export const S6: number = 24;
export const S8: number = 32;

/* 圆角 */
export const R_S: number = 4;
export const R_M: number = 8;
export const R_L: number = 12;
export const R_XL: number = 16;

/* 动效时长 ms（ease-out 为主） */
export const DUR_FAST: number = 140;
export const DUR_BASE: number = 220;
export const DUR_SLOW: number = 320;
