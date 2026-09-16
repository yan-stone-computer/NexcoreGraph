/* 启核图策 · 首页看板（复刻 viewDashboard：bento 网格 + 环形图 + 趋势折线 + 执行率圆环） */

import { store, LogRow, todayKey } from '../common/Store';
import { T, R_L, R_XL, R_M, S4 } from '../common/Tokens';
import { Ico, TBtn, ToneBadge, Chip, Card, CardHead, NumText } from '../components/Widgets';
import { Library, Item, Todo, Activity } from '../common/Db';
import { toggleDaily, runBusy, valueMetrics, ValueMetrics } from '../common/Api';
import { askSummary } from '../common/AiGateway';
import { statsEvidence } from '../common/Router';
import { saveFormSnapshot } from '../common/LocalStore';

export class Seg {
  label: string = '';
  value: number = 0;
  color: string = '';
}

export class TrendSet {
  a: number[] = [];
  b: number[] = [];
  labels: string[] = [];
}

/** 操作日志 → 近 n 天消耗/采购分布（消耗 = 方案执行/协作；采购 = 拍照/手动新增） */
export function trendFromLogs(n: number): TrendSet {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(todayKey(-i));
  }
  const consume: number[] = new Array<number>(n).fill(0);
  const buy: number[] = new Array<number>(n).fill(0);
  store.logs.forEach((l: LogRow) => {
    const idx = days.indexOf(l.day);
    if (idx < 0) {
      return;
    }
    if (l.action === 'plan' || l.action === 'workbench') {
      consume[idx] += 1;
    } else if (l.action === 'intake' || (l.action === 'qty' && l.detail.indexOf('+') > -1)) {
      buy[idx] += 1;
    }
  });
  const t = new TrendSet();
  t.a = consume;
  t.b = buy;
  t.labels = days.map((d: string): string => {
    return d.substring(5).replace('-', '/');
  });
  return t;
}

/** 近 n 天消费/采购事件数（用于智能洞察文案） */
function recentEventCount(n: number, actions: string[]): number {
  let c = 0;
  store.logs.forEach((l: LogRow) => {
    if (actions.indexOf(l.action) > -1 && l.day >= todayKey(-n)) {
      c += 1;
    }
  });
  return c;
}

const TODO_TONES: string[] = ['tone-teal', 'tone-amber', 'tone-red'];

const WEEKDAYS: string[] = ['日', '一', '二', '三', '四', '五', '六'];

@ComponentV2
export struct DashboardView {
  private nowClock: string = '';
  @Local briefText: string = '';     // AI 一句话简报（M2.5 P0-6，手动触发）
  @Local briefBusy: boolean = false;
  /* M-11 落地价值指标：进页面时刷新，刷新会顺带把新进入临期的物品计入账本 */
  @Local vm: ValueMetrics = new ValueMetrics();

  aboutToAppear(): void {
    const d = new Date();
    this.nowClock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.vm = valueMetrics();
    // M-5：回到看板时刷新服务卡片快照
    saveFormSnapshot();
  }

  /** 盘点耗时展示：≥1s 用秒，保留一位小数 */
  private intakeLabel(): string {
    if (this.vm.intakeRuns === 0) {
      return '暂无样本';
    }
    if (this.vm.intakeMedianMs >= 1000) {
      return `约 ${Math.round(this.vm.intakeMedianMs / 100) / 10} 秒`;
    }
    return `约 ${this.vm.intakeMedianMs} 毫秒`;
  }

  /** AI 简报：统计由 statsEvidence() 代码计算，模型仅润色（数字红线） */
  private genBrief(): void {
    if (this.briefBusy) {
      return;
    }
    this.briefBusy = true;
    askSummary(statsEvidence()).then((s: string): void => {
      this.briefText = s;
      this.briefBusy = false;
      store.pushLog('ai', '看板 AI 简报已生成');
    }).catch((_e: Error): void => {
      this.briefText = '简报生成失败，请检查网络后重试。';
      this.briefBusy = false;
    });
  }

  /** 按时段问候 */
  private greet(): string {
    const h = new Date().getHours();
    if (h < 5) {
      return '夜深了';
    }
    if (h < 9) {
      return '早上好';
    }
    if (h < 12) {
      return '上午好';
    }
    if (h < 14) {
      return '中午好';
    }
    if (h < 18) {
      return '下午好';
    }
    return '晚上好';
  }

  private todayText(): string {
    const d = new Date();
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${WEEKDAYS[d.getDay()]} · 家庭空间：${store.family.name}`;
  }

  /** 库存件数 = 各库物品条目之和（实时） */
  private totalItems(): number {
    let s = 0;
    store.libraries.forEach((l: Library) => {
      s += l.items.length;
    });
    return s;
  }

  private planPct(): number {
    let done = 0;
    store.plans.forEach((p) => {
      if (p.status === 'done') {
        done += 1;
      }
    });
    return store.plans.length === 0 ? 0 : Math.round(done / store.plans.length * 100);
  }

  private doneCount(): number {
    let done = 0;
    store.plans.forEach((p) => {
      if (p.status === 'done') {
        done += 1;
      }
    });
    return done;
  }

  /** 跨全部库收集临期物品（不再只取第一个有物品的库） */
  private expiringItems(): Item[] {
    const out: Item[] = [];
    store.libraries.forEach((l: Library) => {
      l.items.forEach((i: Item) => {
        if (i.expiring) {
          out.push(i);
        }
      });
    });
    return out;
  }

  /** 库存健康度：非临期占比 */
  private healthPct(): number {
    const total = this.totalItems();
    if (total === 0) {
      return 100;
    }
    return Math.max(0, Math.round((total - this.expiringItems().length) / total * 100));
  }

  private maxActivity(): number {
    let m = 1;
    store.stats.activity.forEach((x: Activity) => {
      if (x.v > m) {
        m = x.v;
      }
    });
    return m;
  }

  private donutSegs(): Seg[] {
    return this.activeLibs().map((l: Library): Seg => {
      const s = new Seg();
      s.label = l.name;
      s.value = l.items.length;
      s.color = T.tone(l.tone)[0];
      return s;
    });
  }

  private activeLibs(): Library[] {
    return store.libraries.filter((l: Library): boolean => l.items.length > 0);
  }

  private libNameOf(it: Item): string {
    for (let i = 0; i < store.libraries.length; i++) {
      const l = store.libraries[i];
      for (let j = 0; j < l.items.length; j++) {
        if (l.items[j].id === it.id) {
          return l.name;
        }
      }
    }
    return '';
  }

  private libShare(l: Library): number {
    const total = this.totalItems();
    return total > 0 ? Math.round(l.items.length / total * 100) : 0;
  }

  /** 智能洞察：近 7 天消耗/采购 + 临期建议 */
  private insightText(): string {
    const c = recentEventCount(7, ['plan', 'workbench']);
    const b = recentEventCount(7, ['intake']);
    const exp = this.expiringItems().length;
    let s = `近 7 天消耗动作 ${c} 次、入库 ${b} 次。`;
    if (exp > 0) {
      s += `当前有 ${exp} 项临期食材，建议优先排进近日餐单；`;
    }
    const low = this.lowStockNames();
    if (low.length > 0) {
      s += `鸡蛋等低库存建议补货（采购清单已生成）。`;
    } else if (exp === 0) {
      s += `库存状态良好，暂无临期与缺货压力。`;
    } else {
      s += `采购清单可直接查看。`;
    }
    return s;
  }

  private insightBadge(): string {
    return store.logs.length === 0 ? '暂无记录' : '近 7 天';
  }

  private lowStockNames(): string[] {
    const out: string[] = [];
    store.libraries.forEach((l: Library) => {
      l.items.forEach((it: Item) => {
        if (it.name === '鸡蛋' && it.qty < 5) {
          out.push(it.name);
        }
      });
    });
    return out;
  }

  @Builder
  KpiTile(icon: string, tone: string, value: string, label: string, delta: string, deltaColor: string) {
    Row({ space: 12 }) {
      Column() {
        Ico({ name: icon, dim: 20, color: T.tone(tone)[0] })
      }
      .width(44)
      .height(44)
      .borderRadius(R_M)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(T.tone(tone)[1])

      Column({ space: 2 }) {
        NumText({ value, dim: 22, weight: FontWeight.Bold, color: T.c('text-primary') })
        Text(label).fontSize(12).fontColor(T.c('text-muted'))
        Text(delta).fontSize(12).fontWeight(600).fontColor(deltaColor)
      }
      .alignItems(HorizontalAlign.Start)
    }
    .padding({ left: 20, right: 20, top: 16, bottom: 16 })
    .borderRadius(R_L)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
  }

  @Builder
  MiniStat(icon: string, tone: string, label: string, value: string) {
    Row({ space: 12 }) {
      Column() {
        Ico({ name: icon, dim: 16, color: T.tone(tone)[0] })
      }
      .width(36)
      .height(36)
      .borderRadius(R_M)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(T.tone(tone)[1])

      Column({ space: 1 }) {
        Text(label).fontSize(12).fontColor(T.c('text-muted'))
        NumText({ value, dim: 15, weight: FontWeight.Bold, color: T.c('text-primary') })
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  HBars() {
    Column({ space: 8 }) {
      ForEach(store.stats.activity, (x: Activity) => {
        Row({ space: 12 }) {
          Text(x.name).fontSize(13).fontColor(T.c('text-secondary')).width(56)
          Stack({ alignContent: Alignment.Start }) {
            Row()
              .height(8)
              .borderRadius(999)
              .backgroundColor(T.c('primary'))
              .width(`${Math.round(x.v / this.maxActivity() * 100)}%`)
          }
          .height(8)
          .layoutWeight(1)
          .backgroundColor(T.c('surface-overlay'))
          .borderRadius(999)
          NumText({ value: `${x.v} 次`, dim: 12, color: T.c('text-muted') })
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)
      }, (x: Activity) => x.name)
    }
    .width('100%')
  }

  build() {
    Scroll() {
      Column({ space: 16 }) {
        // 头部
        Row({ space: 12 }) {
          Column({ space: 8 }) {
            Text(`${this.greet()}，${store.userName}`).fontSize(store.isWide ? 28 : 22).fontWeight(800).fontColor(T.c('text-primary'))
            Text(this.todayText())
              .fontSize(14).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          Row({ space: 6 }) {
            Ico({ name: 'leaf', dim: 13, color: T.c('on-accent-container') })
            Text('本地模式 · 数据仅存本机').fontSize(12).fontColor(T.c('on-accent-container'))
          }
          .padding({ left: 12, right: 12, top: 6, bottom: 6 })
          .borderRadius(999)
          .backgroundColor(T.c('accent-container'))
          .visibility(store.isWide ? Visibility.Visible : Visibility.None)
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)

        // Bento
        GridRow({ columns: 12, gutter: { x: 16, y: 16 } }) {
          GridCol({ span: { sm: 6, md: 6, lg: 3 } }) {
            this.KpiTile('package', 'teal', String(this.totalItems()), '资源总数',
              `${store.libraries.length} 个库`, T.c('text-muted'))
          }
          GridCol({ span: { sm: 6, md: 6, lg: 3 } }) {
            this.KpiTile('clock', 'amber', String(this.expiringItems().length), '临期预警',
              this.expiringItems().length > 0 ? '今日需处理' : '暂无临期', T.c('warning'))
          }
          GridCol({ span: { sm: 6, md: 6, lg: 3 } }) {
            this.KpiTile('list-check', 'teal', `${this.planPct()}%`, '方案执行率',
              store.plans.length > 0 ? `${this.doneCount()}/${store.plans.length} 已执行` : '暂无方案', T.c('success'))
          }
          GridCol({ span: { sm: 6, md: 6, lg: 3 } }) {
            this.KpiTile('wallet', 'teal', `¥${store.stats.spent}`, '本月花费',
              `预算 ¥${store.stats.budget}`, T.c('text-muted'))
          }

          // 今日摘要
          GridCol({ span: { sm: 12, md: 12, lg: 8 } }) {
            Column({ space: 8 }) {
              Row() {
                Row({ space: 8 }) {
                  Ico({ name: 'sun', dim: 15, color: T.c('primary-ink') })
                  Text('今日摘要').fontSize(13).fontWeight(600).fontColor(T.c('primary-ink'))
                }
                Blank()
                NumText({ value: this.nowClock, dim: 13, weight: FontWeight.Bold, color: T.c('text-secondary') })
              }
              .width('100%')

              Text(`${store.daily.length} 件事值得优先处理`).fontSize(store.isWide ? 30 : 24).fontWeight(800).fontColor(T.c('text-primary')).margin({ top: 8 })
              Text('按临期与重要度排好优先级，做完勾掉；也可以直接问 AI 今晚吃什么。')
                .fontSize(14).fontColor(T.c('text-secondary')).margin({ top: 8 })

              Column({ space: 8 }) {
                ForEach(store.daily, (t: Todo, ti: number) => {
                  Row({ space: 12 }) {
                    Row() {
                      Ico({ name: 'check', dim: 12, color: t.done ? T.c('on-primary') : Color.Transparent })
                    }
                    .width(20)
                    .height(20)
                    .borderRadius(6)
                    .backgroundColor(t.done ? T.c('primary') : Color.Transparent)
                    .border({ width: 1.5, color: t.done ? T.c('primary') : T.c('border-strong') })

                    Text(t.text)
                      .fontSize(14)
                      .fontColor(T.c('text-primary'))
                      .decoration({ type: t.done ? TextDecorationType.LineThrough : TextDecorationType.None })
                      .opacity(t.done ? 0.62 : 1)
                  }
                  .width('100%')
                  .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                  .borderRadius(R_M)
                  .backgroundColor(T.c('surface-raised'))
                  .border({ width: { left: 3 }, color: T.tone(TODO_TONES[ti % 3])[0] })
                  .rotate({ angle: t.done ? 0 : (ti % 3 === 0 ? -1.4 : ti % 3 === 1 ? 1.1 : -0.7) })
                  .animation({ duration: 220, curve: Curve.EaseOut })
                  .onClick(() => {
                    runBusy('daily', (): Promise<void> => toggleDaily(t.id));
                  })
                }, (t: Todo) => `${t.id}-${t.done}`)
              }
              .margin({ top: 24 })

              TBtn({ label: '问 AI 今晚吃什么', icon: 'sparkles', kind: 'primary', tap: (): void => {
                store.aiOpen = true;
              } })
                .margin({ top: 24 })
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding(store.isWide ? 32 : 20)
            .borderRadius(R_XL)
            .backgroundColor(T.c('surface-raised'))
            .border({ width: 1, color: T.c('border-strong') })
          }

          // 库存构成
          GridCol({ span: { sm: 12, md: 12, lg: 4 } }) {
            Card() {
              Column({ space: 16 }) {
                CardHead({ title: '库存构成', sub: '按当前库存件数' })
                if (store.isWide) {
                  Row({ space: 24 }) {
                    DonutChart({
                      segs: this.donutSegs(),
                      centerTop: String(this.totalItems()),
                      centerBottom: `件 · ${this.activeLibs().length} 个有库存库`
                    })
                    Column({ space: 6 }) {
                      ForEach(this.activeLibs(), (l: Library) => {
                        Row({ space: 8 }) {
                          Row().width(10).height(10).borderRadius(3).backgroundColor(T.tone(l.tone)[0])
                          Text(l.name).fontSize(12).fontColor(T.c('text-secondary')).layoutWeight(1)
                          NumText({
                            value: `${l.items.length} · ${this.libShare(l)}%`,
                            dim: 12, color: T.c('text-muted')
                          })
                        }
                        .width('100%')
                      }, (l: Library) => l.id)
                    }
                    .layoutWeight(1)
                  }
                  .width('100%')
                  .alignItems(VerticalAlign.Center)
                } else {
                  Column({ space: 16 }) {
                    DonutChart({
                      segs: this.donutSegs(),
                      centerTop: String(this.totalItems()),
                      centerBottom: `件 · ${this.activeLibs().length} 个有库存库`
                    })
                    Column({ space: 6 }) {
                      ForEach(this.activeLibs(), (l: Library) => {
                        Row({ space: 8 }) {
                          Row().width(10).height(10).borderRadius(3).backgroundColor(T.tone(l.tone)[0])
                          Text(l.name).fontSize(12).fontColor(T.c('text-secondary')).layoutWeight(1)
                          NumText({
                            value: `${l.items.length} · ${this.libShare(l)}%`,
                            dim: 12, color: T.c('text-muted')
                          })
                        }
                        .width('100%')
                      }, (l: Library) => l.id)
                    }
                    .width('100%')
                  }
                  .width('100%')
                  .alignItems(HorizontalAlign.Center)
                }
              }
            }
          }

          // 食材趋势
          GridCol({ span: { sm: 12, md: 12, lg: 7 } }) {
            Card() {
              Column({ space: 12 }) {
                Row() {
                  Column({ space: 2 }) {
                    Text('食材趋势').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
                    Text(`按近 ${store.trendRange} 天操作记录聚合`).fontSize(13).fontColor(T.c('text-muted'))
                  }
                  .alignItems(HorizontalAlign.Start)
                  .layoutWeight(1)

                  Row({ space: 8 }) {
                    Chip({ text: '近7天', active: store.trendRange === '7', tap: (): void => {
                      store.trendRange = '7';
                    } })
                    Chip({ text: '近30天', active: store.trendRange === '30', tap: (): void => {
                      store.trendRange = '30';
                    } })
                  }
                }
                .width('100%')
                .alignItems(VerticalAlign.Center)

                LineChart({ trend: trendFromLogs(Number(store.trendRange)) })

                Row({ space: 16 }) {
                  Row({ space: 6 }) {
                    Row().width(10).height(10).borderRadius(3).backgroundColor(T.c('primary'))
                    Text('消耗').fontSize(12).fontColor(T.c('text-muted'))
                  }
                  Row({ space: 6 }) {
                    Row().width(10).height(10).borderRadius(3).backgroundColor(T.c('accent'))
                    Text('采购').fontSize(12).fontColor(T.c('text-muted'))
                  }
                }
              }
            }
          }

          // 本周小结
          GridCol({ span: { sm: 12, md: 12, lg: 5 } }) {
            Card() {
              Column({ space: 16 }) {
                CardHead({
                  title: '本周小结', sub: '按当前库存与方案统计',
                  badgeText: '自动计算', badgeTone: 'teal', badgeIcon: 'sparkles'
                })
                if (store.isWide) {
                  Row({ space: 24 }) {
                    RingChart({ pct: this.planPct(), value: `${this.doneCount()}/${store.plans.length}`, label: '方案执行率' })
                    Column({ space: 12 }) {
                      this.MiniStat('sparkles', 'orange', '还能做', `${store.stats.mealsLeft} 顿饭 · 约 ${store.stats.daysLeft} 天`)
                      this.MiniStat('wallet', 'teal', '本月花费', `¥${store.stats.spent} · 预算 ¥${store.stats.budget}`)
                      this.MiniStat('package', 'lime', '浪费', `${store.stats.wasted} 件`)
                      this.MiniStat('thermometer', 'amber', '库存健康度', `${this.healthPct()}%${this.healthPct() >= 60 ? ' · 良好' : ' · 注意临期'}`)
                    }
                    .layoutWeight(1)
                  }
                  .width('100%')
                  .alignItems(VerticalAlign.Center)
                } else {
                  Column({ space: 16 }) {
                    RingChart({ pct: this.planPct(), value: `${this.doneCount()}/${store.plans.length}`, label: '方案执行率' })
                    Column({ space: 12 }) {
                      this.MiniStat('sparkles', 'orange', '还能做', `${store.stats.mealsLeft} 顿饭 · 约 ${store.stats.daysLeft} 天`)
                      this.MiniStat('wallet', 'teal', '本月花费', `¥${store.stats.spent} · 预算 ¥${store.stats.budget}`)
                      this.MiniStat('package', 'lime', '浪费', `${store.stats.wasted} 件`)
                      this.MiniStat('thermometer', 'amber', '库存健康度', `${this.healthPct()}%${this.healthPct() >= 60 ? ' · 良好' : ' · 注意临期'}`)
                    }
                    .width('100%')
                  }
                  .width('100%')
                  .alignItems(HorizontalAlign.Center)
                }
              }
            }
          }

          // 落地价值（M-11：临期消耗率 / 拦截重复购买 / 单次盘点耗时）
          GridCol({ span: { sm: 12, md: 6, lg: 4 } }) {
            Card() {
              Column({ space: 16 }) {
                CardHead({
                  title: '落地价值', sub: '本地口径实时计算',
                  badgeText: 'M-11', badgeTone: 'lime', badgeIcon: 'check'
                })
                Column({ space: 12 }) {
                  this.MiniStat('clock', 'teal', '临期消耗率',
                    `${this.vm.expiringRate}%（${this.vm.expiringConsumed}/${this.vm.expiringTotal}）`)
                  this.MiniStat('cart', 'amber', '避免重复购买', `${this.vm.blockedRepurchase} 次拦截`)
                  this.MiniStat('camera', 'red', '单次盘点耗时',
                    `${this.intakeLabel()}${this.vm.intakeRuns > 0 ? ` · ${this.vm.intakeRuns} 次样本` : ''}`)
                }
                .width('100%')
                Text('口径：临期消耗率 = 临期期间被消耗数 / 累计进入临期数；拦截 = 采购命中已有库存被劝止次数；' +
                  '盘点耗时 = 拍照入库批次中位数。仅本机统计，不上云。')
                  .fontSize(10)
                  .fontColor(T.c('text-muted'))
              }
            }
          }

          // 协作活跃度
          GridCol({ span: { sm: 12, md: 6, lg: 4 } }) {
            Card() {
              Column({ space: 16 }) {
                CardHead({ title: '协作活跃度', sub: '工作台成员本周操作' })
                this.HBars()
              }
            }
          }

          // 临期提醒
          GridCol({ span: { sm: 12, md: 6, lg: 8 } }) {
            Column({ space: 12 }) {
              Row() {
                Text('临期提醒').fontSize(20).fontWeight(800).fontColor(T.c('text-primary'))
                Blank()
                Text('查看全部 ›')
                  .fontSize(13).fontWeight(600).fontColor(T.c('primary-ink'))
                  .onClick(() => {
                    store.overlay = 'alerts';
                  })
              }
              .width('100%')

              Column({ space: 12 }) {
                ForEach(this.expiringItems(), (it: Item) => {
                  Row({ space: 16 }) {
                    Column() {
                      Ico({ name: 'clock', dim: 20, color: T.c('tone-amber') })
                    }
                    .width(40)
                    .height(40)
                    .borderRadius(R_M)
                    .justifyContent(FlexAlign.Center)
                    .backgroundColor(T.c('tone-amber-bg'))

                    Column({ space: 2 }) {
                      Text(`${it.name} ${it.expDays} 天后到期，当前 ${it.qty} ${it.unit}`)
                        .fontSize(14).fontColor(T.c('text-primary'))
                      Text(`${it.pos} · ${this.libNameOf(it)}`).fontSize(12).fontColor(T.c('text-muted'))
                    }
                    .alignItems(HorizontalAlign.Start)
                    .layoutWeight(1)

                    TBtn({ label: '看方案', kind: 'ghost', small: true, tap: (): void => {
                      store.overlay = 'plans';
                    } })
                  }
                  .width('100%')
                  .padding({ left: 20, right: 20, top: 16, bottom: 16 })
                  .borderRadius(R_M)
                  .backgroundColor(T.c('surface-raised'))
                  .shadow({ radius: 2, color: 'rgba(0,0,0,0.2)', offsetY: 1 })
                }, (it: Item) => it.id)
              }
            }
            .alignItems(HorizontalAlign.Start)
          }

          // 智能洞察
          GridCol({ span: { sm: 12, md: 12, lg: 12 } }) {
            Card() {
              Column({ space: 16 }) {
                CardHead({
                  title: '智能洞察', sub: '按操作日志统计',
                  badgeText: this.insightBadge(), badgeTone: 'amber', badgeIcon: 'sparkles'
                })
                Text(this.insightText())
                  .fontSize(14).fontColor(T.c('text-secondary'))

                // AI 一句话简报（F7.7 / M2.5 P0-6）：数字与看板一致，模型仅润色
                if (this.briefText !== '') {
                  Column({ space: 6 }) {
                    Text(this.briefText)
                      .fontSize(13).lineHeight(19).fontColor(T.c('text-primary'))
                    Text('由 AI 基于上方统计生成 · 数字以看板为准')
                      .fontSize(10).fontColor(T.c('text-muted'))
                  }
                  .width('100%')
                  .padding(12)
                  .borderRadius(R_M)
                  .backgroundColor(T.c('surface-overlay'))
                  .alignItems(HorizontalAlign.Start)
                }

                Row({ space: 12 }) {
                  TBtn({ label: this.briefBusy ? '生成中…' : 'AI 简报', icon: 'sparkles', kind: 'soft', small: true,
                    tap: (): void => this.genBrief() })
                  TBtn({ label: '查看采购清单', icon: 'arrow-right', kind: 'soft', small: true, tap: (): void => {
                    store.overlay = 'shopping';
                  } })
                }
              }
              .alignItems(HorizontalAlign.Start)
            }
          }
        }
      }
      .padding({ left: 16, right: 16, top: 16, bottom: 96 })
      .constraintSize({ maxWidth: 1180 })
    }
    .width('100%')
    .height('100%')
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
  }
}

/* ---------- Canvas 图表 ---------- */

@ComponentV2
export struct DonutChart {
  @Param segs: Seg[] = [];
  @Param centerTop: string = '';
  @Param centerBottom: string = '';
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private ctx: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);
  private ready: boolean = false;

  private draw(): void {
    const ctx = this.ctx;
    const w = Number(ctx.width);
    if (w <= 0) {
      return;
    }
    const k = w / 180;
    ctx.clearRect(0, 0, w, w);
    const cx = 90 * k;
    const cy = 90 * k;
    const r = 70 * k;
    const lw = 24 * k;
    let total = 0;
    this.segs.forEach((s: Seg) => {
      total += s.value;
    });
    let start = -Math.PI / 2;
    this.segs.forEach((s: Seg) => {
      const frac = total > 0 ? s.value / total : 0;
      const end = start + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.lineWidth = lw;
      ctx.strokeStyle = s.color;
      ctx.arc(cx, cy, r, start + 0.004, Math.max(start + 0.008, end - 0.004));
      ctx.stroke();
      start = end;
    });
    ctx.fillStyle = T.c('text-primary');
    ctx.font = `800 ${Math.round(30 * k)}px HarmonyOS Sans SC`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.centerTop, cx, 84 * k);
    ctx.fillStyle = T.c('text-muted');
    ctx.font = `400 ${Math.round(12 * k)}px HarmonyOS Sans SC`;
    ctx.fillText(this.centerBottom, cx, 106 * k);
  }

  build() {
    Canvas(this.ctx)
      .width(180)
      .height(180)
      .onReady(() => {
        this.ready = true;
        this.draw();
      })
      .onAreaChange((_o: Area, _n: Area) => {
        if (this.ready) {
          this.draw();
        }
      })
  }
}

@ComponentV2
export struct LineChart {
  @Param trend: TrendSet = new TrendSet();
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private ctx: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);
  private ready: boolean = false;

  private draw(): void {
    const ctx = this.ctx;
    const w = Number(ctx.width);
    const h = Number(ctx.height);
    if (w <= 0) {
      return;
    }
    ctx.clearRect(0, 0, w, h);
    const pad = 12;
    const a = this.trend.a;
    const b = this.trend.b;
    const stepX = (w - pad * 2) / Math.max(1, a.length - 1);

    ctx.strokeStyle = T.c('border');
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f: number) => {
      const y = h - pad - f * (h - pad * 2);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    });

    this.drawSeries(b, T.c('accent'), 2, 0.1);
    this.drawSeries(a, T.c('primary'), 2.5, 0.14);

    const minA = Math.min(...a);
    const maxA = Math.max(...a);
    const spanA = maxA - minA || 1;
    ctx.fillStyle = T.c('primary');
    a.forEach((v: number, i: number) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - minA) / spanA) * (h - pad * 2);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = T.c('text-muted');
    ctx.font = '400 10px HarmonyOS Sans SC';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.round(a.length / 10));
    this.trend.labels.forEach((lb: string, i: number) => {
      if (i % labelStep === 0 || i === a.length - 1) {
        ctx.fillText(lb, pad + i * stepX, h - 2);
      }
    });
  }

  private drawSeries(points: number[], color: string, lw: number, areaAlpha: number): void {
    const ctx = this.ctx;
    const w = Number(ctx.width);
    const h = Number(ctx.height);
    const pad = 12;
    const stepX = (w - pad * 2) / Math.max(1, points.length - 1);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const pts: number[][] = points.map((v: number, i: number): number[] => {
      return [pad + i * stepX, h - pad - ((v - min) / span) * (h - pad * 2)];
    });
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h - pad);
    pts.forEach((p: number[]) => {
      ctx.lineTo(p[0], p[1]);
    });
    ctx.lineTo(pts[pts.length - 1][0], h - pad);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = areaAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    pts.forEach((p: number[], i: number) => {
      if (i === 0) {
        ctx.moveTo(p[0], p[1]);
      } else {
        ctx.lineTo(p[0], p[1]);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  build() {
    Canvas(this.ctx)
      .width('100%')
      .height(176)
      .onReady(() => {
        this.ready = true;
        this.draw();
      })
      .onAreaChange((_o: Area, _n: Area) => {
        if (this.ready) {
          this.draw();
        }
      })
  }
}

@ComponentV2
export struct RingChart {
  @Param pct: number = 0;
  @Param value: string = '';
  @Param label: string = '';
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private ctx: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);
  private ready: boolean = false;

  private draw(): void {
    const ctx = this.ctx;
    const w = Number(ctx.width);
    if (w <= 0) {
      return;
    }
    const k = w / 128;
    ctx.clearRect(0, 0, w, w);
    const cx = 64 * k;
    const cy = 64 * k;
    const r = 52 * k;
    ctx.beginPath();
    ctx.lineWidth = 12 * k;
    ctx.strokeStyle = T.c('surface-overlay');
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = T.c('primary');
    ctx.lineCap = 'round';
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.pct / 100);
    ctx.stroke();
    ctx.fillStyle = T.c('text-primary');
    ctx.font = `800 ${Math.round(20 * k)}px HarmonyOS Sans SC`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.value, cx, 58 * k);
    ctx.fillStyle = T.c('text-muted');
    ctx.font = `400 ${Math.round(10 * k)}px HarmonyOS Sans SC`;
    ctx.fillText(this.label, cx, 80 * k);
  }

  build() {
    Canvas(this.ctx)
      .width(128)
      .height(128)
      .onReady(() => {
        this.ready = true;
        this.draw();
      })
      .onAreaChange((_o: Area, _n: Area) => {
        if (this.ready) {
          this.draw();
        }
      })
  }
}
