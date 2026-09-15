/* 启核图策 · AI 工作台（补充方案 G4：AI 是入口）
   结构：① AI 摘要条（数值全部代码计算）② 待确认动作队列（AI 已准备，点确认才生效）
        ③ 图谱入口 ④ 快捷指令 ⑤ 对话入口（打开常驻 AI 面板）
   红线：摘要数字来自 store/图谱统计；队列里的写操作一律"预览 → 用户点确认"才生效。 */

import { store } from '../common/Store';
import { T, R_L, R_M, R_S } from '../common/Tokens';
import { Ico, TBtn, Card, Chip, CardHead, NumText } from '../components/Widgets';
import { ChatMsg, Plan, Item, Library, ShoppingItem } from '../common/Db';
import {
  executePlan, setItemQtyByName, addShoppingByAI, runBusy, valueMetrics, ValueMetrics
} from '../common/Api';
import { currentGraphSize, currentGraphVersion } from '../common/GraphQuery';
import { saveChat, saveFormSnapshot } from '../common/LocalStore';

@ComponentV2
export struct AiWorkbench {
  @Local graphSize: string = '';
  @Local graphVer: string = '';
  @Local vm: ValueMetrics = new ValueMetrics();

  aboutToAppear(): void {
    // currentGraphSize() 会触发"按需构图"（脏则重建），保证首屏拿到真实图规模
    this.graphSize = currentGraphSize();
    this.graphVer = currentGraphVersion();
    this.vm = valueMetrics();
    saveFormSnapshot();
  }

  /* ---------- 摘要条（代码计算，0 次模型） ---------- */

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

  private summaryLine(): string {
    const exp = this.expiringItems();
    if (exp.length === 0) {
      return `库存 ${this.totalItems()} 件，暂无临期；可以问我"今晚吃什么"。`;
    }
    const first = exp[0];
    return `临期 ${exp.length} 项 · 建议先消耗「${first.name}」（${first.expDays} 天后到期）`;
  }

  private totalItems(): number {
    let n = 0;
    store.libraries.forEach((l: Library) => n += l.items.length);
    return n;
  }

  /* ---------- 待确认动作队列（来自 AI 预览卡 + 待执行方案） ---------- */

  private pendingChat(): ChatMsg[] {
    const out: ChatMsg[] = [];
    store.chat.forEach((m: ChatMsg) => {
      if (m.who !== 'ai') {
        return;
      }
      if (m.adjName !== '' && m.adjQty >= 0 && !m.adjDone) {
        out.push(m);
      } else if (m.shopName !== '' && !m.shopDone) {
        out.push(m);
      }
    });
    return out.slice(-3);
  }

  private pendingPlans(): Plan[] {
    const out: Plan[] = [];
    store.plans.forEach((p: Plan) => {
      if (p.status === 'pending' && out.length < 2) {
        out.push(p);
      }
    });
    return out;
  }

  private queueSize(): number {
    return this.pendingChat().length + this.pendingPlans().length;
  }

  private confirmAdjust(m: ChatMsg): void {
    runBusy('wb:adjust', (): Promise<void> => setItemQtyByName(m.adjName, m.adjQty).then((): void => {
      m.adjDone = true;
      store.chat = store.chat.slice();
      saveChat();
    }), (): void => {
      store.toast(`已应用调整：${m.adjName} → ${m.adjQty}`);
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
      store.toast(`已执行方案「${p.title}」，库存已扣减`);
    });
  }

  /* ---------- 交互 ---------- */

  private ask(prompt: string): void {
    store.aiPrefill = prompt;
    store.aiOpen = true;
  }

  build() {
    Column({ space: 12 }) {
      /* ① AI 摘要条 */
      Row({ space: 10 }) {
        Ico({ name: 'sparkles', dim: 16, color: T.c('on-accent-container') })
        Column({ space: 2 }) {
          Text('AI 工作台').fontSize(15).fontWeight(800).fontColor(T.c('text-primary'))
          Text(this.summaryLine()).fontSize(12).fontColor(T.c('text-secondary')).maxLines(2)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        TBtn({ label: '简报', icon: 'sparkles', kind: 'soft', small: true, tap: (): void => {
          this.ask('帮我总结这周的库存情况，给出 1 条行动建议');
        } })
      }
      .width('100%')
      .padding(R_M)
      .borderRadius(R_L)
      .backgroundColor(T.c('accent-container'))
      .alignItems(VerticalAlign.Center)

      /* ② 待确认动作队列 */
      Card() {
        Column({ space: 10 }) {
          CardHead({
            title: '待确认', sub: this.queueSize() === 0 ? 'AI 暂无待办' : `${this.queueSize()} 项等你确认`,
            badgeText: '红线：先预览后生效', badgeTone: 'amber', badgeIcon: 'check'
          })
          if (this.queueSize() === 0) {
            Text('问我"鸡蛋只剩 5 个"或"今晚吃什么"，我会把动作准备好放在这里。')
              .fontSize(12).fontColor(T.c('text-muted'))
          } else {
            ForEach(this.pendingChat(), (m: ChatMsg, i: number) => {
              Row({ space: 10 }) {
                Column({ space: 2 }) {
                  Text(m.adjName !== '' ? `调整：${m.adjName} → ${m.adjQty}` : `加入采购：${m.shopName} ${m.shopQty}`)
                    .fontSize(13).fontWeight(700).fontColor(T.c('text-primary'))
                  Text('来自 AI 对话预览卡 · 确认后才写入')
                    .fontSize(11).fontColor(T.c('text-muted'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)
                TBtn({ label: '确认', icon: 'check', kind: 'primary', small: true, tap: (): void => {
                  if (m.adjName !== '') {
                    this.confirmAdjust(m);
                  } else {
                    this.confirmShop(m);
                  }
                } })
              }
              .width('100%')
              .padding({ top: 6, bottom: 6 })
              .border({ width: { bottom: 1 }, color: T.c('border') })
            }, (m: ChatMsg, i: number) => `qc-${i}-${m.time}-${m.text.length}`)

            ForEach(this.pendingPlans(), (p: Plan, i: number) => {
              Row({ space: 10 }) {
                Column({ space: 2 }) {
                  Text(`方案：${p.title}`).fontSize(13).fontWeight(700).fontColor(T.c('text-primary'))
                  Text(`${p.reason} · ${p.time} · 消耗 ${p.used.length} 种食材`)
                    .fontSize(11).fontColor(T.c('text-muted'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)
                TBtn({ label: '执行', icon: 'check', kind: 'soft', small: true, tap: (): void => {
                  this.execPlan(p);
                } })
              }
              .width('100%')
              .padding({ top: 6, bottom: 6 })
            }, (p: Plan, i: number) => `qp-${p.id}`)
          }
        }
        .alignItems(HorizontalAlign.Start)
      }

      /* ③ 图谱入口 */
      Card() {
        Row({ space: 10 }) {
          Column({ space: 3 }) {
            Text('库存知识图谱').fontSize(15).fontWeight(700).fontColor(T.c('text-primary'))
            Text(`${this.graphSize}｜${this.graphVer}`).fontSize(12).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          TBtn({ label: '打开图谱', icon: 'listcheck', kind: 'ghost', small: true, tap: (): void => {
            store.overlay = 'graph';
          } })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }

      /* ④ 快捷指令 */
      Row({ space: 8 }) {
        Chip({ text: '今日吃什么', active: false, tap: (): void => this.ask('今晚吃什么') })
        Chip({ text: '盘点', active: false, tap: (): void => {
          store.overlay = 'intake';
        } })
        Chip({ text: '谁改了库存', active: false, tap: (): void => this.ask('最近谁改了库存') })
      }

      /* ⑤ 对话入口（打开常驻 AI 面板） */
      Row({ space: 10 }) {
        Row({ space: 8 }) {
          Ico({ name: 'sparkles', dim: 15, color: T.c('text-muted') })
          Text('问 AI：今晚吃什么 / 牛奶还能放几天').fontSize(13).fontColor(T.c('text-muted'))
        }
        .layoutWeight(1)
        .height(44)
        .padding({ left: 12, right: 12 })
        .borderRadius(22)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .alignItems(VerticalAlign.Center)
        .onClick((): void => {
          this.ask('');
        })
        TBtn({ label: 'AI 对话', icon: 'sparkles', kind: 'primary', tap: (): void => {
          this.ask('');
        } })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      /* 价值指标（沿用 M-11，保留在看板折叠区之前的简要展示） */
      Row({ space: 12 }) {
        Text(`临期消耗率 ${this.vm.expiringRate}%`).fontSize(12).fontColor(T.c('text-secondary'))
        Text(`拦截重复购买 ${this.vm.blockedRepurchase} 次`).fontSize(12).fontColor(T.c('text-secondary'))
        Text(`盘点中位 ${this.vm.intakeMedianMs > 0 ? this.vm.intakeMedianMs + ' ms' : '—'}`)
          .fontSize(12).fontColor(T.c('text-secondary'))
      }
      .width('100%')
    }
    .width('100%')
    .padding(R_S)
    .alignItems(HorizontalAlign.Start)
  }
}
