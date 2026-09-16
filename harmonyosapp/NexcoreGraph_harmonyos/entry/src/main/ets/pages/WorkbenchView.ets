/* 启核图策 · 协作工作台（牌桌式座位：我的手牌扇形展开，对方牌背可翻转，邀请码 + 规则 + 协作方案） */

import { store } from '../common/Store';
import { T, R_M, R_L, R_XL, DUR_BASE, DUR_SLOW } from '../common/Tokens';
import { Ico, TBtn, ToneBadge, Card, CardHead, NumText } from '../components/Widgets';
import { Seat, SeatLib, WbHistory, Snap } from '../common/Db';
import { runBusy, sendLibrary, endCoop, runWorkbench, revokeInvite, SendResult, syncMyHand } from '../common/Api';

@ComponentV2
export struct WorkbenchView {
  aboutToAppear(): void {
    // 进入牌桌时同步我的手牌（与换牌选择、实时库存数量保持一致）
    syncMyHand();
  }

  private poolCards(): number[] {
    const n = Math.min(5, store.workbench.history.length);
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      arr.push(i);
    }
    return arr;
  }

  /** 补足 4 个牌位的空位序号 */
  private emptySlots(filled: number): number[] {
    const arr: number[] = [];
    for (let i = filled; i < 4; i++) {
      arr.push(i);
    }
    return arr;
  }
  build() {
    Scroll() {
      Column({ space: 16 }) {
        Row({ space: 12 }) {
          Column({ space: 8 }) {
            Text(store.workbench.name).fontSize(store.isWide ? 24 : 20).fontWeight(800).fontColor(T.c('text-primary'))
            Text('3 人同桌 · 斗地主式合作牌桌 · 结束后清理聚合数据').fontSize(14).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          ToneBadge({ text: store.workbench.expires, tone: 'teal', icon: 'clock' })
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)

        // 牌桌：桌面容器 + 中央合作池 + 对家左右入座
        Column({ space: 14 }) {
          // 中央合作池
          Stack({ alignContent: Alignment.Center }) {
            // 桌呢
            Column()
              .width('100%')
              .height(210)
              .borderRadius(105)
              .backgroundColor(T.c('surface-sunken'))
              .border({ width: 1.5, color: T.c('border-strong') })
              .shadow({ radius: 18, color: 'rgba(0,0,0,0.15)', offsetY: 4 })

            // 虚线环
            Column()
              .width(168)
              .height(168)
              .borderRadius(999)
              .border({ width: 1.5, color: T.c('border-strong'), style: BorderStyle.Dashed })

            // 池内容
            Column({ space: 6 }) {
              Text('合作池').fontSize(15).fontWeight(800).fontColor(T.c('primary-ink')).letterSpacing(2)
              Row({ space: -6 }) {
                ForEach(this.poolCards(), (_: number, i: number) => {
                  Row()
                    .width(24)
                    .height(34)
                    .borderRadius(4)
                    .backgroundColor(T.c('primary-container'))
                    .border({ width: 1, color: T.c('primary-ink') })
                }, (i: number) => `pool-${i}`)
                if (store.workbench.history.length > 5) {
                  Text(`+${store.workbench.history.length - 5}`)
                    .fontSize(11).fontWeight(700).fontColor(T.c('primary-ink')).margin({ left: 8 })
                }
                if (store.workbench.history.length === 0) {
                  Text('还没有库传出去').fontSize(11).fontColor(T.c('text-muted')).margin({ left: 8 })
                }
              }
              .justifyContent(FlexAlign.Center)

              Text('对方本地自动复制 · 结束即清理').fontSize(10).fontColor(T.c('text-muted'))
              Text('结束合作')
                .fontSize(11).fontWeight(600).fontColor(T.c('danger'))
                .padding({ left: 10, right: 10, top: 4, bottom: 4 })
                .borderRadius(999)
                .border({ width: 1, color: T.c('danger-container') })
                .backgroundColor(T.c('danger-container'))
                .onClick(() => {
                  runBusy('coop:end', (): Promise<void> => endCoop().then((summary: WbHistory[]): void => {
                    if (summary.length > 0) {
                      store.toast('本局结算已清理');
                    }
                  }), (): void => {
                    store.toast('合作已结束，聚合数据与复制库已清理');
                  });
                })
            }
            .alignItems(HorizontalAlign.Center)
          }
          .width('100%')

          // 对家：左右入座
          Row({ space: 0 }) {
            Column() {
              this.SeatView(store.workbench.seats[1])
            }
            .layoutWeight(1)

            Column()
              .width(1)
              .height(72)
              .backgroundColor(T.c('border'))
              .margin({ top: 24 })

            Column() {
              this.SeatView(store.workbench.seats[2])
            }
            .layoutWeight(1)
          }
          .width('100%')
          .alignItems(VerticalAlign.Top)
        }
        .width('100%')
        .padding(16)
        .borderRadius(24)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border-strong') })

        // 我的座位（地主）
        Column({ space: 10 }) {
          this.SeatView(store.workbench.seats[0])
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 14, bottom: 14 })
        .borderRadius(R_XL)
        .backgroundColor(T.c('surface-overlay'))
        .border({ width: 1, color: T.c('border') })

        // 协作方案
        Card() {
          Column({ space: 12 }) {
            CardHead({ title: `协作方案 · ${store.workbench.plan.title}`, sub: store.workbench.plan.note })
            Text(store.workbench.plan.consume).fontSize(13).fontColor(T.c('text-secondary'))
            TBtn({ label: '开饭！按归属扣减', icon: 'check', kind: 'primary', small: true, busyKey: 'wb:run',
              tap: (): void => {
                runBusy('wb:run', (): Promise<void> => runWorkbench().then((_s: Snap[]): void => {}), (): void => {
                  store.toast('开饭啦！已按各家扣减：A 家鸡蛋 4 个、B 家番茄 2 个');
                });
              } })
          }
        }

        // 邀请 + 规则
        GridRow({ columns: 12, gutter: { x: 16, y: 16 } }) {
          GridCol({ span: 12 }) {
            Column({ space: 4 }) {
              Text('邀请成员').fontSize(20).fontWeight(800).fontColor(T.c('text-primary')).margin({ bottom: 8 })
              Column({ space: 4 }) {
                Text('限时邀请码').fontSize(13).fontColor(T.c('text-secondary'))
                Text(store.workbench.code)
                  .fontSize(26).fontWeight(FontWeight.Bold).fontColor(T.c('primary-ink')).fontFeature('ss01').letterSpacing(6)
                  .padding({ left: 20, right: 20, top: 12, bottom: 12 })
                  .margin({ top: 12, bottom: 12 })
                  .border({ width: 1.5, color: T.c('primary-ink'), style: BorderStyle.Dashed })
                  .borderRadius(R_M)
                  .backgroundColor(T.c('primary-container'))
                Text('7 天后失效 · 已用 2 / 3 人').fontSize(12).fontColor(T.c('text-muted'))
                Row({ space: 12 }) {
                  TBtn({ label: '复制邀请码', icon: 'copy', kind: 'primary', small: true, tap: (): void => {
                    store.toast(`邀请码 ${store.workbench.code} 已复制，7 天后失效`);
                  } })
                  TBtn({ label: '撤销邀请码', kind: 'ghost', small: true, busyKey: 'wb:revoke',
                    tap: (): void => {
                      runBusy('wb:revoke', (): Promise<void> => revokeInvite(), (): void => {
                        store.toast('邀请码已撤销，新成员无法再通过它加入');
                      });
                    } })
                }
                .margin({ top: 16 })
              }
              .width('100%')
              .padding(24)
              .borderRadius(R_L)
              .backgroundColor(T.c('primary-container'))
              .border({ width: 1.5, color: T.c('primary-ink'), style: BorderStyle.Dashed })
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')
          }

          GridCol({ span: 12 }) {
            Column({ space: 4 }) {
              Text('牌桌规则').fontSize(20).fontWeight(800).fontColor(T.c('text-primary')).margin({ bottom: 8 })
              Column({ space: 10 }) {
                Text('上限 3 人同桌，地主坐庄发牌').fontSize(13).fontColor(T.c('text-secondary'))
                Text('手牌 = 各自资源库，点手牌发给其他座位').fontSize(13).fontColor(T.c('text-secondary'))
                Text('对方牌背可见数量，点牌背可回传给我（本地复制）').fontSize(13).fontColor(T.c('text-secondary'))
                Text('接收方本地自动复制同样库，操作云端同步').fontSize(13).fontColor(T.c('text-secondary'))
                Text('合作结束，聚合数据与复制库自动清理').fontSize(13).fontColor(T.c('text-secondary'))
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
              .padding(24)
              .borderRadius(R_L)
              .backgroundColor(T.c('surface-raised'))
              .border({ width: 1, color: T.c('border') })
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')
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
  }

  @Builder
  SeatView(seat: Seat) {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Row().width(10).height(10).borderRadius(999).backgroundColor(T.tone(seat.color)[0])
        Text(seat.name).fontSize(13).fontWeight(700).fontColor(T.c('text-secondary'))
        Text(seat.id === 'me' ? '地主' : '农民')
          .fontSize(10).fontWeight(700)
          .fontColor(seat.id === 'me' ? T.c('tone-amber') : T.c('text-muted'))
          .padding({ left: 7, right: 7, top: 1, bottom: 1 })
          .borderRadius(999)
          .backgroundColor(seat.id === 'me' ? T.c('tone-amber-bg') : T.c('surface-overlay'))
        NumText({ value: `${seat.libs.length}/4 张`, dim: 12, color: T.c('text-muted') })
      }

      // 固定 4 个牌位：已上场的库 + 空牌占位
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
        ForEach(seat.libs, (lib: SeatLib, ci: number) => {
          if (seat.id === 'me') {
            MyHandCard({ lib: lib, ci: ci })
          } else {
            PileCard({ seat: seat, lib: lib, ci: ci })
          }
        }, (lib: SeatLib) => lib.id)
        ForEach(this.emptySlots(seat.libs.length), (ei: number) => {
          if (seat.id === 'me') {
            EmptyHandSlot()
          } else {
            EmptyPileSlot()
          }
        }, (ei: number) => `empty-${ei}`)
      }
      .width('100%')

      if (seat.id === 'me') {
        Row({ space: 8 }) {
          TBtn({ label: '发言', icon: 'chat', kind: 'ghost', small: true, tap: (): void => {
            store.overlay = 'groupchat';
          } })
          TBtn({ label: '换牌', icon: 'shuffle', kind: 'ghost', small: true, tap: (): void => {
            store.deckDraft = store.workbench.myDeck.slice();
            store.overlay = 'deckpick';
          } })
        }
      }
    }
    .alignItems(HorizontalAlign.Center)
  }
}

/* 空手牌位：点击进入换牌 */
@ComponentV2
struct EmptyHandSlot {
  build() {
    Column({ space: 6 }) {
      Column() {
        Ico({ name: 'plus', dim: 15, color: T.c('text-muted') })
      }
      .width(30)
      .height(30)
      .borderRadius(R_M)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(T.c('surface-overlay'))

      Text('空牌位').fontSize(12).fontWeight(600).fontColor(T.c('text-muted'))
      Text('点击换牌').fontSize(10).fontColor(T.c('text-muted'))
    }
    .width(96)
    .padding(12)
    .borderRadius(R_L)
    .border({ width: 1.5, color: T.c('border-strong'), style: BorderStyle.Dashed })
    .onClick(() => {
      store.deckDraft = store.workbench.myDeck.slice();
      store.overlay = 'deckpick';
    })
  }
}

/* 对方空牌位 */
@ComponentV2
struct EmptyPileSlot {
  build() {
    Column() {
      Text('空').fontSize(12).fontWeight(700).fontColor(T.c('text-muted'))
    }
    .width(store.isWide ? 84 : 64)
    .height(store.isWide ? 116 : 92)
    .borderRadius(10)
    .justifyContent(FlexAlign.Center)
    .backgroundColor(T.c('surface-overlay'))
    .border({ width: 1.5, color: T.c('border-strong'), style: BorderStyle.Dashed })
  }
}

/* 我的手牌（整齐排列，点击选座传出） */
@ComponentV2
struct MyHandCard {
  @Param lib: SeatLib = new SeatLib('', '', '', 0, []);
  @Param ci: number = 0;
  @Local menuOpen: boolean = false;

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column({ space: 6 }) {
        Column() {
          Ico({ name: this.lib.icon, dim: 15, color: T.c('on-primary-container') })
        }
        .width(30)
        .height(30)
        .borderRadius(R_M)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(T.c('primary-container'))

        Text(this.lib.name).fontSize(13).fontWeight(700).fontColor(T.c('text-primary')).maxLines(1)
        NumText({ value: `${this.lib.count} 件`, dim: 11, color: T.c('text-muted') })
        if (this.lib.tag !== '') {
          Text(this.lib.tag).fontSize(10).fontColor(T.c('tone-amber'))
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .borderRadius(999)
            .backgroundColor(T.c('tone-amber-bg'))
        }
      }
      .width(96)
      .padding(12)
      .borderRadius(R_L)
      .backgroundColor(T.c('surface-raised'))
      .border({ width: 1, color: this.menuOpen ? T.c('primary') : T.c('border-strong') })

      if (this.menuOpen) {
        Column({ space: 2 }) {
          this.PassItem('发给所有人', 'all')
          ForEach(store.workbench.seats, (s: Seat) => {
            if (s.id !== 'me') {
              this.PassItem(`发给 ${s.name}`, s.id)
            }
          }, (s: Seat) => s.id)
        }
        .width(150)
        .padding(8)
        .borderRadius(R_L)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .shadow({ radius: 16, color: 'rgba(0,0,0,0.2)', offsetY: 6 })
        .zIndex(20)
      }
    }
    .onClick(() => {
      this.menuOpen = !this.menuOpen;
    })
  }

  @Builder
  PassItem(label: string, toSeat: string) {
    Row({ space: 8 }) {
      Ico({ name: 'arrow-right', dim: 13, color: T.c('text-secondary') })
      Text(label).fontSize(13).fontWeight(600).fontColor(T.c('text-secondary'))
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .borderRadius(R_M)
    .onClick(() => {
      this.menuOpen = false;
      runBusy('coop:send', async (): Promise<void> => {
        if (toSeat === 'all') {
          await sendLibrary('me', 'A', this.lib.id);
          await sendLibrary('me', 'B', this.lib.id);
        } else {
          await sendLibrary('me', toSeat, this.lib.id);
        }
      }, (): void => {
        store.toast(toSeat === 'all' ? '已发给 A 家、B 家' : '已传出手牌');
      });
    })
  }
}

/* 对方牌背（点击翻转/回传） */
@ComponentV2
struct PileCard {
  @Param seat: Seat = new Seat('', '', '', []);
  @Param lib: SeatLib = new SeatLib('', '', '', 0, []);
  @Param ci: number = 0;
  @Local flipped: boolean = false;

  private pw(): number {
    return store.isWide ? 84 : 64;
  }

  private ph(): number {
    return store.isWide ? 116 : 92;
  }

  build() {
    Stack() {
      if (this.flipped) {
        Column({ space: 6 }) {
          Text(this.lib.name).fontSize(12).fontWeight(800).fontColor(T.c('text-primary')).textAlign(TextAlign.Center)
          NumText({ value: `${this.lib.count} 件`, dim: 11, color: T.c('text-muted') })
          TBtn({ label: '回传给我', kind: 'primary', small: true, busyKey: 'coop:send',
            tap: (): void => {
              runBusy('coop:send', (): Promise<void> => sendLibrary(this.seat.id, 'me', this.lib.id).then((_r: SendResult): void => {}), (): void => {
                this.flipped = false;
                store.toast(`已合并「${this.lib.name}」`);
              });
            } })
            .width('100%')
        }
        .width(this.pw())
        .padding(8)
        .borderRadius(10)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border-strong') })
      } else {
        Stack() {
          Image($r('app.media.cardback'))
            .width(this.pw())
            .height(this.ph())
            .borderRadius(10)
            .objectFit(ImageFit.Cover)
            .border({ width: 1, color: T.c('border-strong') })
          NumText({ value: String(this.lib.count), dim: 10, weight: FontWeight.Bold, color: T.c('tone-orange') })
            .padding({ left: 6, right: 6, top: 1, bottom: 1 })
            .borderRadius(999)
            .backgroundColor(T.c('tone-orange-bg'))
            .position({ x: this.pw() - 26, y: this.ph() - 22 })
        }
      }
    }
    .width(this.pw())
    .height(this.ph())
    .onClick(() => {
      this.flipped = !this.flipped;
    })
  }
}
