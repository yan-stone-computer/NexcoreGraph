/* 启核图策 · 资源库列表（cubby 柜格）与库详情（物品清单 + 步进器） */

import { store } from '../common/Store';
import { T, R_M, R_L, R_XL, S3, S4 } from '../common/Tokens';
import { Ico, TBtn, ToneBadge, Chip, Card, CardHead, IconBtn, NumText, MiniSwitch } from '../components/Widgets';
import { Library, Item, KNOWLEDGE } from '../common/Db';
import { updateItemQty, runBusy, createLibrary, renameLibrary, deleteLibrary, restoreLibrary, moveLibrary } from '../common/Api';

const LIB_ICONS: string[] = ['package', 'fridge', 'shirt', 'pill', 'wrench', 'dumbbell', 'book', 'paw', 'plug'];
const LIB_TONES: string[] = ['teal', 'indigo', 'red', 'slate', 'lime', 'brown', 'orange', 'violet'];

@ComponentV2
export struct LibrariesView {
  @Local newLibName: string = '';
  @Local doorOpen: boolean = false;

  aboutToAppear(): void {
    // 入场：柜门缓缓打开
    setTimeout((): void => {
      this.doorOpen = true;
    }, 400);
  }

  private toggleDoor(): void {
    this.doorOpen = !this.doorOpen;
  }

  build() {
    Scroll() {
      Column({ space: 16 }) {
        Row({ space: 12 }) {
          Column({ space: 8 }) {
            Text('资源库').fontSize(store.isWide ? 28 : 22).fontWeight(800).fontColor(T.c('text-primary'))
            Text(`${store.libraries.length} 个库，拍照自动归类，也可自建。`).fontSize(14).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          TBtn({ label: this.doorOpen ? '关上柜门' : '打开柜门', icon: 'door', kind: 'ghost', tap: (): void => this.toggleDoor() })
          TBtn({ label: '拍照入库', icon: 'camera', kind: 'primary', tap: (): void => {
            store.overlay = 'intake';
          } })
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)

        // 资源柜（双开门）
        Stack({ alignContent: Alignment.TopStart }) {
          // 柜内
          Column({ space: 20 }) {
            Row() {
              Row({ space: 6 }) {
                Ico({ name: 'library', dim: 14, color: T.c('text-muted') })
                Text('启核图策 · 资源柜').fontSize(13).fontWeight(600).fontColor(T.c('text-muted'))
                Blank()
              }
              NumText({ value: `${store.libraries.length} 个库`, dim: 13, color: T.c('text-muted') })
            }
            .width('100%')
            .padding({ bottom: 16 })
            .border({ width: { bottom: 1 }, color: T.c('border') })

            GridRow({ columns: { sm: 2, md: 4, lg: 4 }, gutter: { x: 16, y: 16 } }) {
              ForEach(store.libraries, (lib: Library, i: number) => {
                GridCol({ span: { sm: 1, md: 1, lg: 1 } }) {
                  Stack({ alignContent: Alignment.TopEnd }) {
                    Column({ space: 8 }) {
                      Column() {
                        Ico({ name: lib.icon, dim: 22, color: T.tone(lib.tone)[0] })
                      }
                      .width(46)
                      .height(46)
                      .borderRadius(R_M)
                      .justifyContent(FlexAlign.Center)
                      .backgroundColor(T.tone(lib.tone)[1])

                      Text(lib.name).fontSize(14).fontWeight(700).fontColor(T.c('text-primary'))
                      NumText({ value: `${lib.count} 件`, dim: 12, color: T.c('text-muted') })
                    }
                    .width('100%')
                    .padding({ top: 24, bottom: 24, left: 16, right: 16 })
                    .borderRadius(R_L)
                    .backgroundColor(T.c('surface-raised'))
                    .border({ width: 1, color: T.c('border') })
                    .onClick(() => {
                      store.libMenuId = '';
                      store.libId = lib.id;
                    })

                    IconBtn({ icon: 'more', dim: 15, tap: (): void => {
                      store.libMenuId = store.libMenuId === lib.id ? '' : lib.id;
                    } })
                      .width(26).height(26)
                      .position({ x: 4, y: 4 })

                    if (store.libMenuId === lib.id) {
                      LibMenu({ lib: lib })
                    }
                  }
                  .width('100%')
                }
              }, (lib: Library) => lib.id)

              GridCol({ span: { sm: 1, md: 1, lg: 1 } }) {
                Column({ space: 8 }) {
                  Column() {
                    Ico({ name: 'folder-plus', dim: 22, color: T.c('primary-ink') })
                  }
                  .width(46)
                  .height(46)
                  .borderRadius(R_M)
                  .justifyContent(FlexAlign.Center)
                  .backgroundColor(T.c('primary-container'))

                  Text('新建库').fontSize(14).fontWeight(700).fontColor(T.c('text-muted'))
                  Text('+').fontSize(12).fontColor(T.c('text-muted'))
                }
                .width('100%')
                .padding({ top: 24, bottom: 24, left: 16, right: 16 })
                .borderRadius(R_L)
                .border({ width: 1, color: T.c('border-strong'), style: BorderStyle.Dashed })
                .onClick(() => {
                  this.newLibName = '';
                  store.overlay = 'newlib';
                })
              }
            }
          }
          .width('100%')
          .padding(24)
          .borderRadius(R_XL)
          .backgroundColor(T.c('surface-sunken'))
          .border({ width: 1, color: T.c('border') })

          // 双开门
          CabinetDoor({ open: this.doorOpen, side: 0 })
          CabinetDoor({ open: this.doorOpen, side: 1 })
        }
        .width('100%')
      }
      .padding({ left: 16, right: 16, top: 16, bottom: 32 })
      .constraintSize({ maxWidth: 1180 })
    }
    .width('100%')
    .height('100%')
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
    .onClick(() => {
      if (store.libMenuId !== '') {
        store.libMenuId = '';
      }
    })
  }
}

/* 柜门（3D 开合） */
@ComponentV2
struct CabinetDoor {
  @Param open: boolean = false;
  @Param side: number = 0;   // 0 左门 1 右门

  build() {
    Stack() {
      Column()
        .width('100%')
        .height('100%')
        .linearGradient({
          angle: 180,
          colors: [[T.c('surface-raised'), 0], [T.c('surface-overlay'), 1]]
        })

      // 把手（靠中缝一侧）
      Circle({ width: 14, height: 14 })
        .fill(T.c('primary'))
        .shadow({ radius: 10, color: 'rgba(232,112,30,0.45)', offsetY: 0 })
        .margin({ left: this.side === 0 ? 'auto' : '14vp', right: this.side === 0 ? '14vp' : 'auto' })
    }
    .width('50%')
    .height('100%')
    .position({
      x: this.side === 0 ? 0 : '50%',
      y: 0
    })
    .border({
      width: 1,
      color: T.c('border-strong')
    })
    .borderRadius({
      topLeft: this.side === 0 ? R_XL : 0,
      bottomLeft: this.side === 0 ? R_XL : 0,
      topRight: this.side === 1 ? R_XL : 0,
      bottomRight: this.side === 1 ? R_XL : 0
    })
    .shadow({ radius: 12, color: 'rgba(0,0,0,0.25)', offsetY: 4 })
    .rotate({
      x: 0,
      y: 1,
      z: 0,
      angle: this.open ? (this.side === 0 ? -105 : 105) : 0,
      centerX: this.side === 0 ? '0%' : '100%',
      centerY: '50%'
    })
    .animation({ duration: 620, curve: Curve.EaseInOut })
    .hitTestBehavior(this.open ? HitTestMode.None : HitTestMode.Default)
  }
}

@ComponentV2
struct LibMenu {
  @Param lib: Library = new Library('', '', '', '', 0, '', []);

  build() {
    Column({ space: 2 }) {
      this.MenuItem('edit', '重命名', (): void => {
        store.overlayArg = this.lib.id;
        store.overlay = 'editlib';
      })
      this.MenuItem('arrow-up', '上移', (): void => {
        runBusy('lib:move', (): Promise<void> => moveLibrary(this.lib.id, -1), (): void => store.toast('已调整排序'));
      })
      this.MenuItem('arrow-down', '下移', (): void => {
        runBusy('lib:move', (): Promise<void> => moveLibrary(this.lib.id, 1), (): void => store.toast('已调整排序'));
      })
      this.MenuItem('trash', '删除', (): void => {
        runBusy('lib:del', async (): Promise<void> => {
          const r = await deleteLibrary(this.lib.id);
          store.lastDeletedLib.lib = r.lib;
          store.lastDeletedLib.index = r.index;
        }, (): void => {
          store.libMenuId = '';
          store.toast(`已删除库「${this.lib.name}」`, '撤销', 'lib:restore');
        });
      })
    }
    .width(132)
    .padding(8)
    .borderRadius(R_L)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
    .shadow({ radius: 16, color: 'rgba(0,0,0,0.4)', offsetY: 6 })
    .position({ x: -100, y: 34 })
  }

  @Builder
  MenuItem(icon: string, label: string, fn: () => void) {
    Row({ space: 10 }) {
      Ico({ name: icon, dim: 14, color: label === '删除' ? T.c('danger') : T.c('text-secondary') })
      Text(label).fontSize(13).fontWeight(600).fontColor(label === '删除' ? T.c('danger') : T.c('text-secondary'))
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .borderRadius(R_M)
    .onClick(() => {
      store.libMenuId = '';
      fn();
    })
  }
}

/* ---------- 库详情 ---------- */
@ComponentV2
export struct LibraryDetailView {
  private lib(): Library {
    const l = store.findLib(store.libId);
    return l !== null ? l : new Library('', '', '', '', 0, '', []);
  }

  private counts(): number[] {
    const items = this.lib().items;
    const all = items.length;
    let expiring = 0;
    let cold = 0;
    let frozen = 0;
    items.forEach((it: Item) => {
      if (it.expiring) {
        expiring += 1;
      }
      if (it.pos.indexOf('冷藏') > -1) {
        cold += 1;
      }
      if (it.pos.indexOf('冷冻') > -1) {
        frozen += 1;
      }
    });
    return [all, expiring, cold, frozen];
  }

  private filtered(): Item[] {
    const items = this.lib().items;
    if (store.itemFilter === 'expiring') {
      return items.filter((it: Item): boolean => it.expiring);
    }
    if (store.itemFilter === 'cold') {
      return items.filter((it: Item): boolean => it.pos.indexOf('冷藏') > -1);
    }
    if (store.itemFilter === 'frozen') {
      return items.filter((it: Item): boolean => it.pos.indexOf('冷冻') > -1);
    }
    return items;
  }

  build() {
    Scroll() {
      Column({ space: 16 }) {
        Row({ space: 8 }) {
          TBtn({ label: '返回', icon: 'arrow-left', kind: 'ghost', small: true, tap: (): void => {
            store.libId = '';
            store.itemFilter = 'all';
          } })
        }
        .width('100%')

        Row({ space: 12 }) {
          Column({ space: 8 }) {
            Text(this.lib().name).fontSize(store.isWide ? 28 : 22).fontWeight(800).fontColor(T.c('text-primary'))
            Text(`${this.lib().desc} · 共 ${this.lib().count} 件`).fontSize(14).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          TBtn({ label: '拍照入库', icon: 'camera', kind: 'primary', tap: (): void => {
            store.overlay = 'intake';
          } })
          TBtn({ label: '手动添加', icon: 'plus', kind: 'ghost', tap: (): void => {
            store.overlayArg = store.libId;
            store.overlay = 'itemadd';
          } })
        }
        .width('100%')
        .alignItems(VerticalAlign.Bottom)

        Card() {
          Column({ space: 16 }) {
            Column({ space: 2 }) {
              Text('库存清单').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
              Text('点击 +/- 调整数量').fontSize(13).fontColor(T.c('text-muted')).margin({ top: 2 })
            }
            .alignItems(HorizontalAlign.Start)
            .width('100%')

            Scroll() {
              Row({ space: 8 }) {
                Chip({ text: `全部 ${this.counts()[0]}`, active: store.itemFilter === 'all', tap: (): void => {
                  store.itemFilter = 'all';
                } })
                Chip({ text: `临期 ${this.counts()[1]}`, active: store.itemFilter === 'expiring', tap: (): void => {
                  store.itemFilter = 'expiring';
                } })
                Chip({ text: `冷藏 ${this.counts()[2]}`, active: store.itemFilter === 'cold', tap: (): void => {
                  store.itemFilter = 'cold';
                } })
                if (this.counts()[3] > 0) {
                  Chip({ text: `冷冻 ${this.counts()[3]}`, active: store.itemFilter === 'frozen', tap: (): void => {
                    store.itemFilter = 'frozen';
                  } })
                }
              }
            }
            .width('100%')
            .scrollable(ScrollDirection.Horizontal)
            .scrollBar(BarState.Off)

            Column() {
              ForEach(this.filtered(), (it: Item, idx: number) => {
                ItemRow({ lib: this.lib(), it: it })
                if (idx < this.filtered().length - 1) {
                  Row().height(1).width('100%').backgroundColor(T.c('border'))
                }
              }, (it: Item) => it.id)
              if (this.filtered().length === 0) {
                Text('这个筛选下没有物品').fontSize(13).fontColor(T.c('text-muted')).padding(24).width('100%').textAlign(TextAlign.Center)
              }
            }
            .width('100%')
          }
        }
      }
      .padding({ left: 16, right: 16, top: 8, bottom: 32 })
      .constraintSize({ maxWidth: 1180 })
    }
    .width('100%')
    .height('100%')
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
  }
}

@ComponentV2
struct ItemRow {
  @Param lib: Library = new Library('', '', '', '', 0, '', []);
  @Param it: Item = new Item('', '', '📦', '', '', 1, '个', 0, '手动', 7, '', false);

  private kbDays(): number {
    const kb = KNOWLEDGE[this.it.kbKey];
    return kb !== undefined ? kb.days : 0;
  }

  private expPct(): number {
    const days = this.kbDays();
    if (days <= 0) {
      return 0;
    }
    return Math.max(4, Math.min(100, Math.round(this.it.expDays / days * 100)));
  }

  build() {
    // 手机：两行布局（名称+步进器 / 位置+临期+价格）；宽屏：单行
    if (!store.isWide) {
      Column({ space: 10 }) {
        Row({ space: 12 }) {
          this.Photo()
          Text(this.it.name).fontSize(14).fontWeight(600).fontColor(T.c('text-primary')).layoutWeight(1)
          this.Stepper()
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        Row({ space: 8 }) {
          Text(this.it.pos).fontSize(12).fontColor(T.c('text-muted'))
          if (this.it.expiring) {
            ToneBadge({ text: `${this.it.expDays} 天到期`, tone: 'red', pulse: true })
          } else {
            ToneBadge({ text: `${this.it.expDays} 天`, tone: 'muted' })
          }
          Blank()
          NumText({ value: `¥${this.it.price.toFixed(2)}`, dim: 12, color: T.c('text-secondary') })
          Text(this.it.priceSrc).fontSize(11).fontColor(T.c('text-muted'))
          IconBtn({ icon: 'more', dim: 15, tap: (): void => {
            store.overlayArg = this.lib.id;
            store.overlayArg2 = this.it.id;
            store.overlay = 'itemedit';
          } })
            .width(28).height(28)
        }
        .width('100%')
        .padding({ left: 52 })
        .alignItems(VerticalAlign.Center)

        if (this.kbDays() > 0) {
          Stack({ alignContent: Alignment.Start }) {
            Row()
              .height(3)
              .borderRadius(999)
              .backgroundColor(this.expPct() < 30 ? T.c('danger') : T.c('primary'))
              .width(`${this.expPct()}%`)
          }
          .height(3)
          .width('60%')
          .borderRadius(999)
          .backgroundColor(T.c('surface-overlay'))
          .margin({ left: 52 })
        }
      }
      .width('100%')
      .padding({ top: S4, bottom: S4 })
      .alignItems(HorizontalAlign.Start)
    } else {
    Row({ space: S4 }) {
      // 图片/emoji
      Stack() {
        if (this.it.img !== '') {
          Image(this.it.img).width(40).height(40).borderRadius(R_M).objectFit(ImageFit.Cover)
        } else {
          Text(this.it.emoji).fontSize(18)
        }
      }
      .width(40)
      .height(40)
      .borderRadius(R_M)
      .backgroundColor(T.c('surface-overlay'))

      Column({ space: 4 }) {
        Row({ space: 6 }) {
          Text(this.it.name).fontSize(14).fontWeight(600).fontColor(T.c('text-primary'))
          if (this.it.isPrivate) {
            Row({ space: 3 }) {
              Ico({ name: 'shield', dim: 10, color: T.c('text-muted') })
              Text('仅自己').fontSize(11).fontColor(T.c('text-muted'))
            }
            .padding({ left: 8, right: 8, top: 2, bottom: 2 })
            .borderRadius(999)
            .backgroundColor(T.c('surface-overlay'))
          }
          if (this.it.no !== '') {
            NumText({ value: this.it.no, dim: 11, color: T.c('text-muted') })
          }
        }

        Row({ space: 6 }) {
          Text(this.it.pos).fontSize(12).fontColor(T.c('text-muted'))
          if (this.it.expiring) {
            ToneBadge({ text: `${this.it.expDays} 天到期`, tone: 'red', pulse: true })
          } else {
            ToneBadge({ text: `${this.it.expDays} 天`, tone: 'muted' })
          }
        }

        // 手机端：价格并入信息行，避免整行过挤
        if (!store.isWide) {
          Row({ space: 6 }) {
            NumText({ value: `¥${this.it.price.toFixed(2)}`, dim: 12, color: T.c('text-secondary') })
            Text(this.it.priceSrc).fontSize(11).fontColor(T.c('text-muted'))
          }
        }

        if (this.kbDays() > 0) {
          Stack({ alignContent: Alignment.Start }) {
            Row()
              .height(3)
              .borderRadius(999)
              .backgroundColor(this.expPct() < 30 ? T.c('danger') : T.c('primary'))
              .width(`${this.expPct()}%`)
          }
          .height(3)
          .width(120)
          .borderRadius(999)
          .backgroundColor(T.c('surface-overlay'))
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      // 数量步进器
      Row({ space: 2 }) {
        Row() {
          Ico({ name: 'minus', dim: 13, color: T.c('text-secondary') })
        }
        .width(28)
        .height(28)
        .borderRadius(999)
        .justifyContent(FlexAlign.Center)
        .onClick(() => {
          runBusy(`item:minus:${this.it.id}`, (): Promise<void> => updateItemQty(this.it.id, -1), (): void => {
            store.toast('已减少数量，变更已留痕');
          });
        })

        Column() {
            NumText({ value: `${this.it.qty} ${this.it.unit}`, dim: 14, weight: FontWeight.Bold, color: T.c('text-primary') })
          }
          .constraintSize({ minWidth: 40 })
          .alignItems(HorizontalAlign.Center)

        Row() {
          Ico({ name: 'plus', dim: 13, color: T.c('text-secondary') })
        }
        .width(28)
        .height(28)
        .borderRadius(999)
        .justifyContent(FlexAlign.Center)
        .onClick(() => {
          runBusy(`item:plus:${this.it.id}`, (): Promise<void> => updateItemQty(this.it.id, 1), (): void => {
            store.toast('已增加数量，变更已留痕');
          });
        })
      }
      .padding(2)
      .borderRadius(999)
      .border({ width: 1, color: T.c('border') })
      .backgroundColor(T.c('surface-raised'))

      // 价格（仅宽屏独立列，手机并入信息行）
      if (store.isWide) {
        Column({ space: 1 }) {
          NumText({ value: `¥${this.it.price.toFixed(2)}`, dim: 13, color: T.c('text-secondary') })
          Text(this.it.priceSrc).fontSize(11).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.End)
      }

      IconBtn({ icon: 'more', dim: 15, tap: (): void => {
        store.overlayArg = this.lib.id;
        store.overlayArg2 = this.it.id;
        store.overlay = 'itemedit';
      } })
        .width(28).height(28)
    }
    .width('100%')
    .padding({ top: S4, bottom: S4 })
    .alignItems(VerticalAlign.Center)
    }
  }

  @Builder
  Photo() {
    Stack() {
      if (this.it.img !== '') {
        Image(this.it.img).width(40).height(40).borderRadius(R_M).objectFit(ImageFit.Cover)
      } else {
        Text(this.it.emoji).fontSize(18)
      }
    }
    .width(40)
    .height(40)
    .borderRadius(R_M)
    .backgroundColor(T.c('surface-overlay'))
  }

  @Builder
  Stepper() {
    Row({ space: 2 }) {
      Row() {
        Ico({ name: 'minus', dim: 13, color: T.c('text-secondary') })
      }
      .width(28)
      .height(28)
      .borderRadius(999)
      .justifyContent(FlexAlign.Center)
      .onClick(() => {
        runBusy(`item:minus:${this.it.id}`, (): Promise<void> => updateItemQty(this.it.id, -1), (): void => {
          store.toast('已减少数量，变更已留痕');
        });
      })

      Column() {
        NumText({ value: `${this.it.qty} ${this.it.unit}`, dim: 14, weight: FontWeight.Bold, color: T.c('text-primary') })
      }
      .constraintSize({ minWidth: 40 })
      .alignItems(HorizontalAlign.Center)

      Row() {
        Ico({ name: 'plus', dim: 13, color: T.c('text-secondary') })
      }
      .width(28)
      .height(28)
      .borderRadius(999)
      .justifyContent(FlexAlign.Center)
      .onClick(() => {
        runBusy(`item:plus:${this.it.id}`, (): Promise<void> => updateItemQty(this.it.id, 1), (): void => {
          store.toast('已增加数量，变更已留痕');
        });
      })
    }
    .padding(2)
    .borderRadius(999)
    .border({ width: 1, color: T.c('border') })
    .backgroundColor(T.c('surface-raised'))
  }
}
