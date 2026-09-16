/* 启核图策 · AI 工作台（首屏）
   版式原则（ui-alchemy craft floor）：
     · 每屏只有一个焦点：今天要处理（唯一卡片，其余全部退成细线行）
     · 无渐变铺底、无三等分指标卡、无卡片套卡片；数字一律等宽（tnum）
     · 间距走 8pt 网格，标题上方留白 > 下方；层级只靠字重与色阶，不靠装饰
   红线不变：摘要数字由代码计算；队列里的写操作必须用户确认后才生效。 */

import { store } from '../common/Store';
import { T, S1, S2, S3, S4, S6, S8 } from '../common/Tokens';
import { TBtn, Card } from '../components/Widgets';
import { ChatMsg, Plan, Item, Library } from '../common/Db';
import { executePlan, setItemQtyByName, addShoppingByAI, runBusy, valueMetrics, ValueMetrics } from '../common/Api';
import { currentGraphSize, currentGraphVersion } from '../common/GraphQuery';
import { saveChat, saveFormSnapshot } from '../common/LocalStore';
import { pageContentWidth, pageInset } from '../common/Breakpoints';
import { AnalyticsBoard } from './AnalyticsBoard';

@ComponentV2
export struct AiWorkbench {
  @Local graphSize: string = '';
  @Local vm: ValueMetrics = new ValueMetrics();

  aboutToAppear(): void {
    this.graphSize = currentGraphSize();
    this.vm = valueMetrics();
    saveFormSnapshot();
  }

  /* ---------- 事实（全部代码计算） ---------- */

  private expiringItems(): Item[] {
    const out: Item[] = [];
    store.libraries.forEach((l: Library) => {
      l.items.forEach((it: Item) => {
        if (it.expDays > 0 && it.expDays <= 7) {
          out.push(it);
        }
      });
    });
    out.sort((a: Item, b: Item): number => a.expDays - b.expDays);
    return out;
  }

  private itemCount(): number {
    let n = 0;
    store.libraries.forEach((l: Library) => n += l.items.length);
    return n;
  }

  private pendingPlans(): Plan[] {
    const out: Plan[] = [];
    store.plans.forEach((p: Plan) => {
      if (p.status === 'pending') {
        out.push(p);
      }
    });
    return out;
  }

  private pendingChat(): ChatMsg[] {
    const out: ChatMsg[] = [];
    store.chat.forEach((m: ChatMsg) => {
      if (m.who !== 'ai') {
        return;
      }
      if ((m.adjName !== '' && m.adjQty >= 0 && !m.adjDone) || (m.shopName !== '' && !m.shopDone)) {
        out.push(m);
      }
    });
    return out.slice(-3);
  }

  private queueCount(): number {
    return this.pendingChat().length + this.pendingPlans().length;
  }

  /** 今天要处理的一句话结论（代码计算，非模型生成） */
  private todayLine(): string {
    const exp = this.expiringItems();
    if (exp.length === 0) {
      return '没有临期，库存健康';
    }
    return `先消耗 ${exp[0].name}，还有 ${exp[0].expDays} 天`;
  }

  /* ---------- 动作（预览 → 确认才写） ---------- */

  private confirmAdjust(m: ChatMsg): void {
    runBusy('wb:adjust', (): Promise<void> => setItemQtyByName(m.adjName, m.adjQty).then((): void => {
      m.adjDone = true;
      store.chat = store.chat.slice();
      saveChat();
    }), (): void => {
      store.toast(`已应用：${m.adjName} → ${m.adjQty}`);
    });
  }

  private confirmShop(m: ChatMsg): void {
    runBusy('wb:shop', (): Promise<void> => addShoppingByAI(m.shopName, m.shopQty).then((): void => {
      m.shopDone = true;
      store.chat = store.chat.slice();
      saveChat();
    }), (): void => {
      store.toast(`已加入采购清单：${m.shopName}`);
    });
  }

  private execPlan(p: Plan): void {
    runBusy('wb:plan', (): Promise<void> => executePlan(p.id, p.selected), (): void => {
      store.toast(`已执行「${p.title}」，库存已扣减`);
    });
  }

  private ask(prompt: string): void {
    store.aiPrefill = prompt;
    store.aiOpen = true;
  }

  /* ---------- 分区（宽窄屏共用；宽屏由 build() 排成左右两列） ---------- */

  @Builder
  Head() {
    /* 页头：标题自己承担层级，不加 eyebrow */
    Text('AI 工作台').fontSize(24).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
    Row({ space: S2 }) {
      Text(`${store.family.name}`).fontSize(12).fontColor(T.c('text-muted'))
      Text('·').fontSize(12).fontColor(T.c('border-strong'))
      Text(this.todayLine()).fontSize(12).fontColor(T.c('text-muted'))
    }
    .margin({ top: S1 })
  }

  @Builder
  Facts() {
    /* 事实行：等宽数字，细线分隔，不用卡片 */
    Row() {
        this.Fact(`${this.expiringItems().length}`, '临期')
        this.ThinDivider()
        this.Fact(`${this.itemCount()}`, '在库')
        this.ThinDivider()
        this.Fact(`${this.pendingPlans().length}`, '待执行')
        this.ThinDivider()
        this.Fact(this.vm.expiringRate <= 0 ? '—' : `${this.vm.expiringRate}%`, '临期消耗率')
    }
    .width('100%')
    .margin({ top: S4 })
  }

  @Builder
  Focus() {
    /* 焦点区：今天要处理（全页唯一卡片） */
    Text('今天要处理').fontSize(17).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
        .margin({ top: S6, bottom: S2 })
      if (this.queueCount() === 0) {
        Text('还没有待确认的动作。问我「鸡蛋只剩 5 个」或「今晚吃什么」，我会把动作准备好放在这里。')
          .fontSize(13).lineHeight(20).fontColor(T.c('text-muted'))
      } else {
        Card() {
          Column({ space: 0 }) {
            ForEach(this.pendingChat(), (m: ChatMsg, i: number) => {
              this.QueueRow(
                m.adjName !== '' ? `把 ${m.adjName} 改成 ${m.adjQty}` : `把 ${m.shopName} 加入采购清单`,
                m.adjName !== '' ? '来自对话预览，确认后才会改库存' : '来自对话预览，确认后才会进清单',
                '确认',
                (): void => {
                  if (m.adjName !== '') {
                    this.confirmAdjust(m);
                  } else {
                    this.confirmShop(m);
                  }
                },
                i > 0
              )
            }, (m: ChatMsg, i: number) => `qc-${i}-${m.text.length}`)
            ForEach(this.pendingPlans(), (p: Plan, i: number) => {
              this.QueueRow(
                `执行方案 ${p.title}`,
                `${p.reason} · ${p.time} · 消耗 ${p.used.length} 种食材`,
                '执行',
                (): void => this.execPlan(p),
                this.pendingChat().length > 0 || i > 0
              )
            }, (p: Plan, i: number) => `qp-${p.id}`)
          }
          .alignItems(HorizontalAlign.Start)
        }
      }
  }

  @Builder
  Overview() {
    /* 概览：label-value 细线行，退回背景层 */
    Row() {
      Text('概览').fontSize(17).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
      Blank()
      /* 手机：数据分析看板不铺在首页，改由这个按钮打开（平板是直接铺在下方，不再放入口） */
      if (!store.isWide) {
        Text('数据分析 ›')
          .fontSize(13).fontWeight(600).fontColor(T.c('primary-ink'))
          .padding({ left: 8, right: 4, top: 4, bottom: 4 })
          .onClick((): void => {
            store.overlay = 'analytics';
          })
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
    .margin({ top: store.isWide ? S4 : S6, bottom: S2 })
    this.InfoRow('库存知识图谱', this.graphSize)
    this.InfoRow('避免重复购买', `${this.vm.blockedRepurchase} 次`)
    this.InfoRow('盘点中位耗时', this.vm.intakeMedianMs > 0 ? `${this.vm.intakeMedianMs} ms` : '暂无记录')
  }

  @Builder
  AskBar() {
    /* 底部：单一对话入口（克制，不再并排两个入口） */
    Row({ space: S3 }) {
        Text('今晚吃什么').fontSize(13).fontColor(T.c('text-secondary'))
          .onClick((): void => this.ask('今晚吃什么'))
        Text('牛奶还能放几天').fontSize(13).fontColor(T.c('text-secondary'))
          .onClick((): void => this.ask('牛奶还能放几天'))
        Blank()
        TBtn({ label: '问 AI', icon: 'sparkles', kind: 'primary', small: true, tap: (): void => this.ask('') })
    }
    .width('100%')
    .margin({ top: S6 })
  }

  build() {
    /* 用 Scroll 包一层：一是内容更长时可滚动，二是「显式宽度+左边距」只有在
       Scroll 子节点这一层才被 ArkUI 正确摆放（直接放 TabContent 里会整体右移并溢出右沿）。 */
    Scroll() {
      Column({ space: 0 }) {
      this.Head()

      if (store.isWide) {
        /* 平板 / 2in1：左列＝事实 + 今天要处理（唯一焦点），右列＝概览 + 对话入口
           不再是「把手机单列放大」，两列都吃满横向空间 */
        Row({ space: S8 }) {
          Column({ space: 0 }) {
            this.Facts()
            this.Focus()
          }
          .layoutWeight(11)
          .alignItems(HorizontalAlign.Start)

          Column({ space: 0 }) {
            this.Overview()
            this.AskBar()
          }
          .layoutWeight(9)
          .alignItems(HorizontalAlign.Start)
          }
          .width('100%')
          .alignItems(VerticalAlign.Top)

          /* 平板：下面接数据分析看板（KPI + 库存构成 + 食材趋势 + 小结 + 落地价值），
             把宽屏多出来的纵向空间用起来；手机端不加，保持原来的单列节奏 */
          AnalyticsBoard()
            .margin({ top: S8 })
        } else {
        this.Facts()
        this.Focus()
        this.Overview()
        this.AskBar()
      }

      /* 底部留白：避开悬浮 AI 球 */
      Row().height(64)
      }
      // 显式宽度 + 左边距：靠内边距留白时 ArkUI 会吃掉右侧，内容顶到屏幕右沿
      .width(pageContentWidth())
      .margin({ left: pageInset() })
      .padding({ top: S4, bottom: S4 })
      .alignItems(HorizontalAlign.Start)
      .justifyContent(FlexAlign.Start)
    }
    .width('100%')
    .height('100%')
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
  }

  @Builder
  Fact(value: string, label: string) {
    Column({ space: 2 }) {
      Text(value).fontSize(20).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary')).fontFeature('tnum')
      Text(label).fontSize(11).fontColor(T.c('text-muted'))
    }
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  ThinDivider() {
    Row().width(1).height(28).backgroundColor(T.c('border'))
  }

  @Builder
  QueueRow(title: string, note: string, action: string, tap: () => void, divider: boolean) {
    Row({ space: S3 }) {
      Column({ space: 3 }) {
        Text(title).fontSize(15).fontWeight(FontWeight.Medium).fontColor(T.c('text-primary')).maxLines(1)
        Text(note).fontSize(12).fontColor(T.c('text-muted')).maxLines(1)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      TBtn({ label: action, kind: 'soft', small: true, tap: tap })
    }
    .width('100%')
    .padding({ top: S3, bottom: S3 })
    .border({ width: divider ? { top: 1 } : { top: 0 }, color: T.c('border') })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  InfoRow(label: string, value: string) {
    Row() {
      Text(label).fontSize(14).fontColor(T.c('text-secondary'))
      Blank()
      Text(value).fontSize(14).fontColor(T.c('text-primary')).fontFeature('tnum')
    }
    .width('100%')
    .padding({ top: S3, bottom: S3 })
    .border({ width: { top: 1 }, color: T.c('border') })
  }
}
