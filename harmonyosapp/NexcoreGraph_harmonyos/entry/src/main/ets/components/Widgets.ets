/* 启核图策 · 通用组件（复刻 app.css：btn/badge/chip/card/plan-card/switch/stepper/field） */

import { iconSegs, iconStroke, hasIcon } from '../common/Icons';
import { T, R_S, R_M, R_L, DUR_FAST, DUR_BASE } from '../common/Tokens';
import { store } from '../common/Store';
import { Plan, Consume } from '../common/Db';
import { executePlan, rollbackPlan, runBusy } from '../common/Api';

@Builder
function emptyBuilder(): void {
}

/* ---------- 图标 ---------- */
@ComponentV2
export struct Ico {
  @Param name: string = 'dashboard';
  @Param dim: number = 20;
  @Param color: ResourceColor = '#FFFFFF';

  build() {
    Stack() {
      ForEach(iconSegs(this.name, this.dim), (seg: string) => {
        Path()
          .commands(seg)
          .width(this.dim)
          .height(this.dim)
          .fillOpacity(0)
          .stroke(this.color)
          .strokeWidth(iconStroke(this.dim))
          .strokeLineCap(LineCapStyle.Round)
          .strokeLineJoin(LineJoinStyle.Round)
      }, (seg: string) => seg.substring(0, 24))
    }
    .width(this.dim)
    .height(this.dim)
    .alignContent(Alignment.Center)
  }
}

/* ---------- 按钮 ---------- */
@ComponentV2
export struct TBtn {
  @Param label: string = '';
  @Param icon: string = '';
  @Param kind: string = 'primary';   // primary | ghost | soft
  @Param small: boolean = false;
  @Param busyKey: string = '';
  @Event tap: () => void = (): void => {};

  private isBusy(): boolean {
    return this.busyKey !== '' && store.busy === this.busyKey;
  }

  private bgColor(): ResourceColor {
    if (this.kind === 'primary') {
      return T.c('primary');
    }
    if (this.kind === 'soft') {
      return T.c('primary-container');
    }
    return T.c('surface-raised');
  }

  private fgColor(): ResourceColor {
    if (this.kind === 'primary') {
      return T.c('on-primary');
    }
    if (this.kind === 'soft') {
      return T.c('on-primary-container');
    }
    return T.c('text-primary');
  }

  build() {
    Row({ space: 6 }) {
      if (this.isBusy()) {
        LoadingProgress().width(14).height(14).color(this.fgColor())
      } else if (this.icon !== '' && hasIcon(this.icon)) {
        Ico({ name: this.icon, dim: this.small ? 15 : 16, color: this.fgColor() })
      }
      Text(this.label)
        .fontSize(this.small ? 13 : 14)
        .fontWeight(600)
        .fontColor(this.fgColor())
        .maxLines(1)
    }
    .constraintSize({ minWidth: this.small ? 60 : 0 })
    .height(this.small ? 34 : 40)
    .padding({ left: this.small ? 14 : 20, right: this.small ? 14 : 20 })
    .borderRadius(R_M)
    .backgroundColor(this.bgColor())
    .border(this.kind === 'ghost' ? { width: 1, color: T.c('border') } : { width: 0, color: Color.Transparent })
    .opacity(this.isBusy() ? 0.62 : 1)
    .animation({ duration: DUR_FAST, curve: Curve.EaseOut })
    .onClick(() => {
      if (!this.isBusy()) {
        this.tap();
      }
    })
  }
}

/* ---------- 图标按钮 ---------- */
@ComponentV2
export struct IconBtn {
  @Param icon: string = '';
  @Param dim: number = 19;
  @Param dot: boolean = false;
  @Event tap: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Ico({ name: this.icon, dim: this.dim, color: T.c('text-secondary') })
      if (this.dot) {
        Circle({ width: 8, height: 8 }).fill(T.c('danger'))
          .position({ x: 26, y: 6 })
          .border({ width: 2, color: T.c('surface') })
      }
    }
    .width(40)
    .height(40)
    .borderRadius(R_M)
    .onClick(() => this.tap())
  }
}

/* ---------- 徽标 ---------- */
@ComponentV2
export struct ToneBadge {
  @Param text: string = '';
  @Param tone: string = 'muted';  // teal|amber|red|muted|success
  @Param pulse: boolean = false;
  @Param icon: string = '';

  private colors(): ResourceColor[] {
    if (this.tone === 'teal') {
      return [T.c('tone-teal'), T.c('tone-teal-bg')];
    }
    if (this.tone === 'amber') {
      return [T.c('tone-amber'), T.c('tone-amber-bg')];
    }
    if (this.tone === 'red') {
      return [T.c('tone-red'), T.c('tone-red-bg')];
    }
    if (this.tone === 'success') {
      return [T.c('success'), T.c('success-container')];
    }
    return [T.c('text-muted'), T.c('surface-overlay')];
  }

  build() {
    Row({ space: 4 }) {
      if (this.icon !== '') {
        Ico({ name: this.icon, dim: 12, color: this.colors()[0] })
      }
      Text(this.text).fontSize(12).fontWeight(600).fontColor(this.colors()[0]).maxLines(1)
    }
    .height(24)
    .padding({ left: 10, right: 10 })
    .borderRadius(999)
    .backgroundColor(this.colors()[1])
    .constraintSize({ maxWidth: '100%' })
  }
}

/* ---------- Chip ---------- */
@ComponentV2
export struct Chip {
  @Param text: string = '';
  @Param active: boolean = false;
  @Event tap: () => void = (): void => {};

  build() {
    Text(this.text)
      .fontSize(13)
      .fontWeight(500)
      .fontColor(this.active ? T.c('on-primary') : T.c('text-secondary'))
      .height(32)
      .padding({ left: 16, right: 16 })
      .borderRadius(999)
      .backgroundColor(this.active ? T.c('primary') : T.c('surface-raised'))
      .border({ width: 1, color: this.active ? T.c('primary') : T.c('border') })
      .onClick(() => this.tap())
  }
}

/* ---------- 卡片 ---------- */
@ComponentV2
export struct Card {
  @BuilderParam content: () => void = emptyBuilder;
  @Param pad: number = 24;

  build() {
    Column() {
      this.content()
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
    .padding(this.pad)
    .borderRadius(R_L)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
    .shadow({ radius: 2, color: 'rgba(0,0,0,0.25)', offsetY: 1 })
  }
}

@ComponentV2
export struct CardHead {
  @Param title: string = '';
  @Param sub: string = '';
  @Param badgeText: string = '';
  @Param badgeTone: string = 'muted';
  @Param badgeIcon: string = '';

  build() {
    Row() {
      Column({ space: 2 }) {
        Text(this.title).fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
        if (this.sub !== '') {
          Text(this.sub).fontSize(13).fontColor(T.c('text-muted'))
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      if (this.badgeText !== '') {
        ToneBadge({ text: this.badgeText, tone: this.badgeTone, icon: this.badgeIcon })
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
    .margin({ bottom: 16 })
  }
}

/* ---------- 开关行 ---------- */
@ComponentV2
export struct SwitchRow {
  @Param title: string = '';
  @Param desc: string = '';
  @Param on: boolean = false;
  @Event tap: () => void = (): void => {};

  build() {
    Row() {
      Column({ space: 2 }) {
        Text(this.title).fontSize(14).fontWeight(600).fontColor(T.c('text-primary'))
        Text(this.desc).fontSize(12).fontColor(T.c('text-muted'))
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      MiniSwitch({ on: this.on, tap: (): void => this.tap() })
    }
    .width('100%')
    .padding({ top: 16, bottom: 16 })
    .border({ width: { bottom: 1 }, color: T.c('border') })
  }
}

@ComponentV2
export struct MiniSwitch {
  @Param on: boolean = false;
  @Event tap: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Start }) {
      Circle({ width: 18, height: 18 })
        .fill(Color.White)
        .shadow({ radius: 2, color: 'rgba(0,0,0,0.3)', offsetY: 1 })
        .margin({ left: this.on ? 20 : 2 })
        .animation({ duration: DUR_BASE, curve: Curve.EaseOut })
    }
    .width(40)
    .height(22)
    .borderRadius(999)
    .backgroundColor(this.on ? T.c('primary') : T.c('surface-overlay'))
    .border({ width: 1, color: this.on ? T.c('primary') : T.c('border-strong') })
    .animation({ duration: DUR_BASE, curve: Curve.EaseOut })
    .onClick(() => this.tap())
  }
}

/* ---------- 输入 Field ---------- */
@ComponentV2
export struct Field {
  @Param label: string = '';
  @Param text: string = '';
  @Param placeholder: string = '';
  @Param attention: boolean = false;
  @Param num: boolean = false;
  @Param maxLen: number = 0;
  @Event change: (v: string) => void = (v: string): void => {};

  build() {
    Column({ space: 4 }) {
      Text(this.label).fontSize(11).fontWeight(600).fontColor(T.c('text-muted'))
      TextInput({ text: this.text, placeholder: this.placeholder })
        .height(34)
        .fontSize(13)
        .borderRadius(R_S)
        .backgroundColor(T.c('surface'))
        .border({ width: 1, color: this.attention ? T.c('warning') : T.c('border') })
        .fontColor(T.c('text-primary'))
        .placeholderColor(T.c('text-muted'))
        .maxLength(this.maxLen > 0 ? this.maxLen : 999)
        .type(this.num ? InputType.Number : InputType.Normal)
        .onChange((v: string) => this.change(v))
    }
    .alignItems(HorizontalAlign.Start)
    .width('100%')
  }
}

/* ---------- 方案卡片（plan-card / plan-card--flat） ---------- */
@ComponentV2
export struct PlanCard {
  @Param plan: Plan = new Plan(0, '', '中', '', '', '', [], [], 'pending');
  @Param compact: boolean = false;
  @Event changed: () => void = (): void => {};

  private isSelected(u: Consume): boolean {
    if (this.plan.status === 'done') {
      return true;
    }
    return this.plan.selected.indexOf(u.name) > -1;
  }

  build() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        ToneBadge({
          text: this.plan.priority === '高' ? '大火' : '中火',
          tone: this.plan.priority === '高' ? 'red' : 'amber',
          icon: 'flame'
        })
        Text(this.plan.title).fontSize(15).fontWeight(700).fontColor(T.c('text-primary')).layoutWeight(1)
      }
      .width('100%')

      Row({ space: 12 }) {
        Row({ space: 4 }) {
          Ico({ name: 'clock', dim: 13, color: T.c('text-muted') })
          Text(this.plan.time).fontSize(12).fontColor(T.c('text-muted'))
        }
        Row({ space: 4 }) {
          Ico({ name: 'sparkles', dim: 13, color: T.c('text-muted') })
          Text(this.plan.source).fontSize(12).fontColor(T.c('text-muted'))
        }
        Text(this.plan.reason).fontSize(12).fontColor(T.c('text-muted'))
      }

      // 营养速览（M2.5 P0-3，F3.4）：估算值，标注"约"
      if (this.plan.kcal > 0) {
        Row({ space: 4 }) {
          Ico({ name: 'flame', dim: 13, color: T.c('text-muted') })
          Text(`营养速览：约 ${this.plan.kcal} 千卡/份（估算）`).fontSize(12).fontColor(T.c('text-muted'))
        }
      }

      Column({ space: 4 }) {
        ForEach(this.plan.used, (u: Consume) => {
          Row({ space: 8 }) {
            Row() {
              Ico({ name: 'check', dim: 11, color: this.isSelected(u) ? T.c('on-primary') : 'rgba(0,0,0,0)' })
            }
            .width(18)
            .height(18)
            .borderRadius(5)
            .backgroundColor(this.isSelected(u) ? T.c('primary') : Color.Transparent)
            .border({ width: 1.5, color: this.isSelected(u) ? T.c('primary') : T.c('border-strong') })
            .onClick(() => {
              if (this.plan.status !== 'done') {
                const i = this.plan.selected.indexOf(u.name);
                if (i > -1) {
                  this.plan.selected.splice(i, 1);
                } else {
                  this.plan.selected.push(u.name);
                }
                this.changed();
              }
            })

            Text(`${u.name} × ${u.qty}`)
              .fontSize(13)
              .fontColor(T.c('text-secondary'))
              .decoration({ type: this.isSelected(u) ? TextDecorationType.LineThrough : TextDecorationType.None })
              .opacity(this.isSelected(u) ? 0.85 : 1)
          }
          .width('100%')
        })
      }
      .margin({ top: 4 })

      if (this.plan.missing.length > 0) {
        Text(`缺料：${this.plan.missing.map((m: Consume): string => `${m.name} ${m.qty}`).join('、')}`)
          .fontSize(12)
          .fontColor(T.c('text-muted'))
      } else {
        ToneBadge({ text: '食材齐全', tone: 'success' })
      }

      Row() {
        if (this.plan.status === 'done') {
          ToneBadge({ text: '已执行', tone: 'success', icon: 'check' })
          Blank()
          TBtn({ label: '撤销', icon: 'undo', kind: 'ghost', small: true, busyKey: `plan:undo:${this.plan.id}`,
            tap: (): void => {
              runBusy(`plan:undo:${this.plan.id}`, (): Promise<void> => rollbackPlan(this.plan.id), (): void => {
                store.toast('已撤销，库存恢复');
                this.changed();
              });
            } })
        } else {
          Blank()
          TBtn({ label: '勾选执行', icon: 'check', kind: 'primary', small: true, busyKey: `plan:run:${this.plan.id}`,
            tap: (): void => {
              runBusy(`plan:run:${this.plan.id}`, (): Promise<void> => executePlan(this.plan.id, this.plan.selected), (): void => {
                store.toast('方案已执行，库存已按勾选的食材扣减');
                this.changed();
              });
            } })
        }
      }
      .width('100%')
      .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(this.compact ? { top: 16, bottom: 16 } : 16)
    .borderRadius(this.compact ? 0 : R_M)
    .backgroundColor(this.compact ? Color.Transparent : T.c('surface'))
    .border({
      width: this.compact ? { top: 1 } : { top: 1, bottom: 1, left: 1, right: 1 },
      color: T.c('border')
    })
  }
}

/* ---------- 数字文本（等宽数字） ---------- */
@ComponentV2
export struct NumText {
  @Param value: string = '';
  @Param dim: number = 14;
  @Param weight: number | FontWeight = FontWeight.Normal;
  @Param color: ResourceColor = '#FFFFFF';

  build() {
    Text(this.value)
      .fontSize(this.dim)
      .fontWeight(this.weight)
      .fontColor(this.color)
      .fontFeature('ss01')
  }
}
