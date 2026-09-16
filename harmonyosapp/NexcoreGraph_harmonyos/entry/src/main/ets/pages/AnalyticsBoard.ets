/* 启核图策 · 数据分析看板（平板端填空用）
   把此前首页看板里的分析卡片抽成可复用组件：KPI 四格 + 库存构成环形图 +
   食材趋势折线 + 本周小结圆环 + 落地价值指标。
   红线不变：所有数字由代码统计（valueMetrics / store.stats / 操作日志），模型不参与。 */

import { store } from '../common/Store';
import { T, R_L, R_XL, R_M } from '../common/Tokens';
import { Ico, Card, CardHead, Chip, NumText } from '../components/Widgets';
import { Library, Item, Activity } from '../common/Db';
import { valueMetrics, ValueMetrics } from '../common/Api';
import { DonutChart, LineChart, RingChart, Seg, TrendSet, trendFromLogs } from './DashboardView';

@ComponentV2
export struct AnalyticsBoard {
  @Local vm: ValueMetrics = new ValueMetrics();
  @Local trendRange: string = '7';

  aboutToAppear(): void {
    this.vm = valueMetrics();
  }

  private totalItems(): number {
    let s = 0;
    store.libraries.forEach((l: Library) => {
      s += l.items.length;
    });
    return s;
  }

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

  private doneCount(): number {
    let done = 0;
    store.plans.forEach((p) => {
      if (p.status === 'done') {
        done += 1;
      }
    });
    return done;
  }

  private planPct(): number {
    return store.plans.length === 0 ? 0 : Math.round(this.doneCount() / store.plans.length * 100);
  }

  private healthPct(): number {
    const total = this.totalItems();
    if (total === 0) {
      return 100;
    }
    return Math.max(0, Math.round((total - this.expiringItems().length) / total * 100));
  }

  private activeLibs(): Library[] {
    return store.libraries.filter((l: Library): boolean => l.items.length > 0);
  }

  private libShare(l: Library): number {
    const total = this.totalItems();
    return total > 0 ? Math.round(l.items.length / total * 100) : 0;
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
      .layoutWeight(1)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 16, bottom: 16 })
    .borderRadius(R_L)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
    .alignItems(VerticalAlign.Center)
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
      .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
  }

  build() {
    Column({ space: 16 }) {
      Row() {
        Column({ space: 2 }) {
          Text('数据分析').fontSize(17).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
          Text('按本机库存与操作日志实时统计 · 不上云').fontSize(12).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')

      /* KPI 四格（手机一行两格，平板一行四格） */
      GridRow({ columns: 12, gutter: { x: 16, y: 16 } }) {
        GridCol({ span: { sm: 6, md: 3, lg: 3 } }) {
          this.KpiTile('package', 'teal', String(this.totalItems()), '资源总数',
            `${store.libraries.length} 个库`, T.c('text-muted'))
        }
        GridCol({ span: { sm: 6, md: 3, lg: 3 } }) {
          this.KpiTile('clock', 'amber', String(this.expiringItems().length), '临期预警',
            this.expiringItems().length > 0 ? '今日需处理' : '暂无临期', T.c('warning'))
        }
        GridCol({ span: { sm: 6, md: 3, lg: 3 } }) {
          this.KpiTile('list-check', 'teal', `${this.planPct()}%`, '方案执行率',
            store.plans.length > 0 ? `${this.doneCount()}/${store.plans.length} 已执行` : '暂无方案', T.c('success'))
        }
        GridCol({ span: { sm: 6, md: 3, lg: 3 } }) {
          this.KpiTile('wallet', 'teal', `¥${store.stats.spent}`, '本月花费',
            `预算 ¥${store.stats.budget}`, T.c('text-muted'))
        }
      }
      .width('100%')

      /* 图表两栏 */
      GridRow({ columns: 12, gutter: { x: 16, y: 16 } }) {
        GridCol({ span: { sm: 12, md: 12, lg: 5 } }) {
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
                  this.Legend()
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
                  this.Legend()
                }
                .width('100%')
                .alignItems(HorizontalAlign.Center)
              }
            }
          }
        }

        GridCol({ span: { sm: 12, md: 12, lg: 7 } }) {
          Card() {
            Column({ space: 12 }) {
              Row() {
                Column({ space: 2 }) {
                  Text('食材趋势').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
                  Text(`按近 ${this.trendRange} 天操作记录聚合`).fontSize(13).fontColor(T.c('text-muted'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)

                Row({ space: 8 }) {
                  Chip({ text: '近7天', active: this.trendRange === '7', tap: (): void => {
                    this.trendRange = '7';
                  } })
                  Chip({ text: '近30天', active: this.trendRange === '30', tap: (): void => {
                    this.trendRange = '30';
                  } })
                }
              }
              .width('100%')
              .alignItems(VerticalAlign.Center)

              LineChart({ trend: trendFromLogs(Number(this.trendRange)) })

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
      }
      .width('100%')

      /* 小结 + 落地价值 */
      GridRow({ columns: 12, gutter: { x: 16, y: 16 } }) {
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
                  this.SummaryStats()
                }
                .width('100%')
                .alignItems(VerticalAlign.Center)
              } else {
                Column({ space: 16 }) {
                  RingChart({ pct: this.planPct(), value: `${this.doneCount()}/${store.plans.length}`, label: '方案执行率' })
                  this.SummaryStats()
                }
                .width('100%')
                .alignItems(HorizontalAlign.Center)
              }
            }
          }
        }

        GridCol({ span: { sm: 12, md: 12, lg: 7 } }) {
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
              Text('口径：临期消耗率 = 临期期间被消耗数 / 累计进入临期数；拦截 = 采购命中已有库存被劝止次数；盘点耗时 = 拍照入库批次中位数。')
                .fontSize(10).fontColor(T.c('text-muted'))
            }
            .alignItems(HorizontalAlign.Start)
          }
        }
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  Legend() {
    Column({ space: 6 }) {
      ForEach(this.activeLibs(), (l: Library) => {
        Row({ space: 8 }) {
          Row().width(10).height(10).borderRadius(3).backgroundColor(T.tone(l.tone)[0])
          Text(l.name).fontSize(12).fontColor(T.c('text-secondary')).layoutWeight(1)
          NumText({ value: `${l.items.length} · ${this.libShare(l)}%`, dim: 12, color: T.c('text-muted') })
        }
        .width('100%')
      }, (l: Library) => l.id)
    }
    .layoutWeight(1)
  }

  @Builder
  SummaryStats() {
    Column({ space: 12 }) {
      this.MiniStat('sparkles', 'orange', '还能做', `${store.stats.mealsLeft} 顿饭 · 约 ${store.stats.daysLeft} 天`)
      this.MiniStat('wallet', 'teal', '本月花费', `¥${store.stats.spent} · 预算 ¥${store.stats.budget}`)
      this.MiniStat('package', 'lime', '浪费', `${store.stats.wasted} 件`)
      this.MiniStat('thermometer', 'amber', '库存健康度', `${this.healthPct()}%`)
    }
    .layoutWeight(1)
  }
}
