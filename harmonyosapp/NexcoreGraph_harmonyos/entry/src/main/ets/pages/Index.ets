/* 启核图策 · 应用外壳（鸿蒙范式）
   底部 Tabs 导航 + 顶栏 + 半模态 bindSheet（AI 助手 / 业务浮层）+ 悬浮 AI 球 + Toast */

import { store, ToastMsg } from '../common/Store';
import { T, R_M, R_L, DUR_BASE } from '../common/Tokens';
import { Ico, IconBtn, NumText } from '../components/Widgets';
import { Family } from '../common/Db';
import { restoreLibrary, restoreItem } from '../common/Api';
import { display } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { initLocal, saveThemePrefs } from '../common/LocalStore';
import { LoginView } from './LoginView';
import { DashboardView } from './DashboardView';
import { LibrariesView, LibraryDetailView } from './LibrariesView';
import { WorkbenchView } from './WorkbenchView';
import { SettingsView, SheetContent } from './Overlays';
import { AiPanel } from './AiPanel';

class NavItem {
  label: string = '';
  icon: string = '';

  constructor(label: string, icon: string) {
    this.label = label;
    this.icon = icon;
  }
}

const NAV: NavItem[] = [
  new NavItem('首页', 'dashboard'),
  new NavItem('资源库', 'library'),
  new NavItem('工作台', 'users'),
  new NavItem('我的', 'settings')
];

@Entry
@ComponentV2
struct Index {
  @Local curTab: number = 0;

  aboutToAppear(): void {
    // M2.5 P0-5/P0-4：启动即加载本地对话 / 偏好 / AI 用量（失败静默降级为内存）
    const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
    initLocal(ctx);
  }

  @Computed
  get sheetShow(): boolean {
    // 宽屏时 AI 面板右侧停靠，不走半模态
    return store.overlay !== '' || (store.aiOpen && !store.isWide);
  }

  private sheetHeight(): SheetSize | number {
    if (store.aiOpen) {
      return SheetSize.LARGE;
    }
    switch (store.overlay) {
      case 'newlib':
      case 'editlib':
      case 'itemadd':
      case 'itemedit':
      case 'deckpick':
      case 'groupchat':
        return SheetSize.MEDIUM;
      default:
        return SheetSize.LARGE;
    }
  }

  private closeSheet(): void {
    store.overlay = '';
    store.aiOpen = false;
  }

  build() {
    Stack() {
      if (!store.loggedIn) {
        LoginView()
      } else {
        Column() {
          TopBar()
          Row() {
            Tabs({ barPosition: BarPosition.End, index: this.curTab }) {
              TabContent() {
                DashboardView()
              }
              .tabBar(this.TabBarItem(0))

              TabContent() {
                if (store.libId !== '') {
                  LibraryDetailView()
                } else {
                  LibrariesView()
                }
              }
              .tabBar(this.TabBarItem(1))

              TabContent() {
                WorkbenchView()
              }
              .tabBar(this.TabBarItem(2))

              TabContent() {
                SettingsView()
              }
              .tabBar(this.TabBarItem(3))
            }
            .scrollable(false)
            .barHeight(60)
            .onChange((i: number) => {
              this.curTab = i;
              store.tabIndex = i;
              if (i !== 1) {
                store.libId = '';
              }
            })
            .barBackgroundBlurStyle(BlurStyle.Thin)
            .layoutWeight(1)

            // 平板/折叠屏展开态：AI 面板右侧停靠
            if (store.isWide && store.aiOpen) {
              Column() {
                AiPanel()
              }
              .width(420)
              .height('100%')
              .backgroundColor(T.c('surface-raised'))
              .border({ width: { left: 1 }, color: T.c('border') })
            }
          }
          .width('100%')
          .layoutWeight(1)
          .alignItems(VerticalAlign.Top)
        }
        .width('100%')
        .height('100%')
        .backgroundColor(T.c('surface'))
        .bindSheet(this.sheetShow, this.SheetBuilder(), {
          height: this.sheetHeight(),
          dragBar: true,
          
          backgroundColor: T.c('surface'),
          onDisappear: (): void => this.closeSheet()
        })

        // AI 悬浮球（可拖动，点击展开）
        if (!store.aiOpen) {
          AiBall()
        }

        // Toast
        Column({ space: 8 }) {
          ForEach(store.toasts, (t: ToastMsg) => {
            ToastView({ row: t })
          }, (t: ToastMsg) => `${t.id}`)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
        .position({ x: 0, y: 84 })
        .hitTestBehavior(HitTestMode.Transparent)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(T.c('surface'))
  }

  @Builder
  TabBarItem(idx: number) {
    Column({ space: 3 }) {
      Ico({ name: NAV[idx].icon, dim: 21, color: this.curTab === idx ? T.c('primary') : T.c('text-muted') })
      Text(NAV[idx].label)
        .fontSize(10)
        .fontWeight(this.curTab === idx ? 700 : 500)
        .fontColor(this.curTab === idx ? T.c('primary') : T.c('text-muted'))
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }

  @Builder
  SheetBuilder() {
    SheetContent()
  }
}

/* ---------- 顶栏 ---------- */
@ComponentV2
struct TopBar {
  build() {
    Row({ space: 4 }) {
      Row({ space: 8 }) {
        Image($r('app.media.logo'))
          .width(30).height(30).borderRadius(8).objectFit(ImageFit.Cover)
        Column({ space: 1 }) {
          Text('启核图策').fontSize(17).fontWeight(800).fontColor(T.c('text-primary'))
          if (!store.isWide) {
            Text(store.family.name).fontSize(10).fontColor(T.c('text-muted'))
          }
        }
        .alignItems(HorizontalAlign.Start)

        if (store.isWide) {
          Text('NexcoreGraph · 家庭资源智能管家').fontSize(12).fontColor(T.c('text-muted')).margin({ left: 4 })
        }
      }
      .alignItems(VerticalAlign.Center)

      Blank()


      if (store.isWide) {
        Row({ space: 8 }) {
          Ico({ name: 'search', dim: 16, color: T.c('text-muted') })
          Text('搜物品、位置，或问“鸡蛋放哪了”').fontSize(13).fontColor(T.c('text-muted'))
        }
        .height(38)
        .padding({ left: 14, right: 14 })
        .borderRadius(999)
        .backgroundColor(T.c('surface-sunken'))
        .border({ width: 1, color: T.c('border') })
        .constraintSize({ maxWidth: 380 })
        .onClick(() => {
          store.searchQ = '';
          store.overlay = 'search';
        })
      } else {
        // 手机顶栏：预警 / 采购 / 搜索（家庭切换在「我的」页）
        IconBtn({ icon: 'bell', dot: store.alerts.length > 0, tap: (): void => {
          store.overlay = 'alerts';
        } })
        IconBtn({ icon: 'cart', tap: (): void => {
          store.overlay = 'shopping';
        } })
        IconBtn({ icon: 'search', tap: (): void => {
          store.searchQ = '';
          store.overlay = 'search';
        } })
      }

      if (store.isWide) {
        Stack({ alignContent: Alignment.TopEnd }) {
          Row({ space: 6 }) {
            Ico({ name: 'users', dim: 15, color: T.c('text-primary') })
            Text(store.family.name).fontSize(13).fontWeight(600).fontColor(T.c('text-primary'))
            Ico({ name: 'chevron-down', dim: 13, color: T.c('text-muted') })
          }
          .height(36)
          .padding({ left: 12, right: 12 })
          .borderRadius(999)
          .backgroundColor(T.c('surface-raised'))
          .border({ width: 1, color: T.c('border') })
          .onClick(() => {
            store.familyOpen = !store.familyOpen;
          })

          if (store.familyOpen) {
            Column({ space: 2 }) {
              ForEach(store.families, (f: Family) => {
                Row({ space: 8 }) {
                  Ico({ name: 'users', dim: 14, color: T.c('text-secondary') })
                  Text(f.name).fontSize(13).fontWeight(600).fontColor(T.c('text-secondary')).layoutWeight(1)
                  NumText({ value: `${f.memberCount} 人`, dim: 12, color: T.c('text-muted') })
                }
                .padding({ left: 12, right: 12, top: 10, bottom: 10 })
                .borderRadius(R_M)
                .onClick(() => {
                  store.family = f;
                  store.familyOpen = false;
                  store.toast(`已切换到${f.name}`);
                })
              }, (f: Family) => f.id)
            }
            .width(220)
            .padding(8)
            .borderRadius(R_L)
            .backgroundColor(T.c('surface-raised'))
            .border({ width: 1, color: T.c('border') })
            .shadow({ radius: 16, color: 'rgba(0,0,0,0.4)', offsetY: 6 })
            .position({ x: '100%', y: 42 })
            .markAnchor({ x: '100%', y: 0 })
          }
        }

        IconBtn({ icon: 'bell', dot: store.alerts.length > 0, tap: (): void => {
          store.overlay = 'alerts';
        } })
        IconBtn({ icon: 'cart', tap: (): void => {
          store.overlay = 'shopping';
        } })
      }

      IconBtn({ icon: T.dark ? 'sun' : 'moon', tap: (): void => {
        T.setDark(!T.dark);
        saveThemePrefs();
      } })
    }
    .width('100%')
    .height(56)
    .padding({ left: 16, right: 8 })
    .alignItems(VerticalAlign.Center)
  }
}

/* ---------- Toast ---------- */
@ComponentV2
struct ToastView {
  @Param row: ToastMsg = new ToastMsg(0, '', '', '');

  build() {
    Row({ space: 6 }) {
      Ico({ name: 'circle-check', dim: 16, color: T.c('success') })
      Text(this.row.msg).fontSize(13).fontColor(T.c('text-primary')).constraintSize({ maxWidth: 260 })
      if (this.row.actionLabel !== '') {
        Text(this.row.actionLabel)
          .fontSize(13)
          .fontWeight(700)
          .fontColor(T.c('primary'))
          .onClick(() => {
            store.removeToast(this.row.id);
            if (this.row.action === 'lib:restore') {
              const lib = store.lastDeletedLib.lib;
              if (lib !== null) {
                restoreLibrary(lib, store.lastDeletedLib.index).then((): void => {
                  store.toast('已恢复库');
                });
              }
            } else if (this.row.action === 'item:restore') {
              const lib = store.lastDeletedItem.lib;
              const item = store.lastDeletedItem.item;
              if (lib !== null && item !== null) {
                restoreItem(lib, item, store.lastDeletedItem.index).then((): void => {
                  store.toast('已恢复物品');
                });
              }
            }
          })
      }
    }
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .borderRadius(999)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border-strong') })
    .shadow({ radius: 12, color: 'rgba(0,0,0,0.4)', offsetY: 4 })
    .transition(TransitionEffect.asymmetric(
      TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 10 })),
      TransitionEffect.OPACITY
    ).animation({ duration: DUR_BASE, curve: Curve.EaseOut }))
  }
}

/* ---------- AI 悬浮球（可拖动 + 点击展开） ---------- */
@ComponentV2
struct AiBall {
  @Local bx: number = 16;
  @Local by: number = 120;
  @Local moved: boolean = false;
  private originX: number = 0;
  private originY: number = 0;
  private screenW: number = 360;
  private screenH: number = 800;

  aboutToAppear(): void {
    try {
      const d = display.getDefaultDisplaySync();
      this.screenW = d.width / d.densityPixels;
      this.screenH = d.height / d.densityPixels;
      this.bx = Math.max(16, this.screenW - 68);
      this.by = Math.max(80, this.screenH - 200);
    } catch (e) {
      this.bx = 16;
      this.by = 120;
    }
  }

  build() {
    Stack() {
      Circle({ width: 52, height: 52 })
        .fill(T.c('primary'))
      Ico({ name: 'sparkles', dim: 22, color: T.c('on-primary') })
    }
    .width(52)
    .height(52)
    .borderRadius(999)
    .shadow({ radius: 18, color: 'rgba(255,136,51,0.45)', offsetY: 4 })
    .position({ x: this.bx, y: this.by })
    .animation({ duration: this.moved ? 0 : DUR_BASE, curve: Curve.EaseOut })
    .gesture(
      PanGesture({ direction: PanDirection.All, distance: 5 })
        .onActionStart(() => {
          this.originX = this.bx;
          this.originY = this.by;
          this.moved = false;
        })
        .onActionUpdate((e: GestureEvent) => {
          this.moved = true;
          this.bx = Math.min(Math.max(8, this.originX + e.offsetX), this.screenW - 60);
          this.by = Math.min(Math.max(80, this.originY + e.offsetY), this.screenH - 130);
        })
    )
    .onClick(() => {
      if (this.moved) {
        this.moved = false;
        return;
      }
      store.aiOpen = true;
    })
  }
}
