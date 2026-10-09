/* 启核图策 · 浮层系统与设置页（复刻 viewAlerts/viewShopping/viewPlans/viewSearch/viewSettings/
   viewIntake/overlay 表单/deckpick/groupchat） */

import { store, LogRow, AiUsageRow } from '../common/Store';
import { T, R_S, R_M, R_L, R_XL, DUR_BASE, DUR_SLOW } from '../common/Tokens';
import { Ico, TBtn, ToneBadge, Chip, Card, CardHead, IconBtn, NumText, MiniSwitch, SwitchRow, Field, PlanCard } from '../components/Widgets';
import {
  Library, Item, AlertItem, ShoppingItem, Plan, IntakeResult, WbMsg, seedIntake, Family
} from '../common/Db';
import {
  runBusy, addItems, mergeIntakeResults, resetIntake, generatePlans, resolveAlert, shoppingList, search, SearchHit,
  createLibrary, renameLibrary, addItem, updateItem, deleteItem, restoreItem,
  setDeck, sendChat, setSetting, ItemForm, kbSrc, recordIntakeMs, valueMetrics, ValueMetrics
} from '../common/Api';
import { AiPanel } from './AiPanel';
import { GraphPanel } from './GraphPanel';
import { AnalyticsBoard } from './AnalyticsBoard';
import { buildFlowState, applyFlowState, buildDataSnapshot, applyDataSnapshot } from '../common/Continuation';
import { publishFlow, pullFlow, deviceLabel, FlowHandoff } from '../common/FlowBridge';
import { markSyncedRev } from '../common/LiveSync';
import { recognizeImage, gatewayUsage, UsageSummary, UsageRow } from '../common/AiGateway';
import { tryUploadSync, forceUploadSync, downloadSync, SyncConflict } from '../common/SyncApi';
import { saveProfile, saveFormSnapshot, saveThemePrefs } from '../common/LocalStore';
import { currentGraphSize, currentGraphVersion } from '../common/GraphQuery';
import { rebuildGraph } from '../common/GraphBuild';
import { pageContentWidth, pageInset } from '../common/Breakpoints';
import { GraphBuildStat } from '../common/GraphModel';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { cameraPicker, camera } from '@kit.CameraKit';
import { image } from '@kit.ImageKit';
import { util } from '@kit.ArkTS';
import { common } from '@kit.AbilityKit';

/* ================= 半模态 Sheet 宿主（鸿蒙 bindSheet 内容） ================= */

@ComponentV2
export struct SheetContent {
  build() {
    Column() {
      Scroll() {
        Column() {
          if (store.overlay === 'alerts') {
            AlertsPanel()
          } else if (store.overlay === 'shopping') {
            ShoppingPanel()
          } else if (store.overlay === 'plans') {
            PlansPanel()
          } else if (store.overlay === 'search') {
            SearchPanel()
          } else if (store.overlay === 'intake') {
            IntakePanel()
          } else if (store.overlay === 'newlib') {
            NewLibPanel()
          } else if (store.overlay === 'editlib') {
            EditLibPanel()
          } else if (store.overlay === 'itemadd') {
            ItemAddPanel()
          } else if (store.overlay === 'itemedit') {
            ItemEditPanel()
          } else if (store.overlay === 'deckpick') {
            DeckPickPanel()
          } else if (store.overlay === 'groupchat') {
            GroupChatPanel()
          } else if (store.overlay === 'settings') {
            SettingsView()
            } else if (store.overlay === 'graph') {
              GraphPanel()
            } else if (store.overlay === 'analytics') {
              AnalyticsBoard()
            } else if (store.overlay === 'flow') {
              FlowPanel()
            } else if (store.aiOpen) {
            AiPanel()
          }
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 8, bottom: 24 })
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
      .align(Alignment.TopStart)
      .edgeEffect(EdgeEffect.Spring)
    }
    .width('100%')
    .height('100%')
  }
}

/* ================= 跨设备流转（系统接续 + 中转通道） =================
   真机同账号同网：系统「应用接续」自动完成（EntryAbility.onContinue / onCreate）。
   模拟器或跨网段：用同一份快照经本地中转服务（backend/flow-bridge.js）手递手传过去。
   演示脚本：A 机走到某页 → 发送流转；B 机点接收流转 → 同页面出现。 */
@ComponentV2
struct FlowPanel {
  @Local note: string = '点「发送流转」把当前页面送到另一台设备；对方点「接收流转」即可接着做。';
  @Local busy: boolean = false;

  private send(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    const json = buildFlowState();
    const data = buildDataSnapshot();
    publishFlow(deviceLabel(), json, data).then((): void => {
      this.busy = false;
      this.note = `已发送（来自${deviceLabel()}，页面状态 ${json.length} 字节 + 数据 ${Math.round(data.length / 1024)}KB）· 请在另一台设备点「接收流转」`;
      store.toast('已发送流转，请在另一台设备点「接收流转」');
    }).catch((e: Error): void => {
      this.busy = false;
      this.note = '发送失败：' + e.message;
      store.toast('流转发送失败');
    });
  }

  private receive(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    pullFlow().then((h: FlowHandoff): void => {
      this.busy = false;
      if (!h.found || h.json === '') {
        this.note = '中转里还没有流转记录：请先在另一台设备点「发送流转」';
        return;
      }
      const ok = applyFlowState(h.json);
      const items = h.data === '' ? 0 : applyDataSnapshot(h.data);
      markSyncedRev(h.rev);
      if (ok) {
        this.note = items >= 0
          ? `已接续来自「${h.from}」的进度 · 同时同步 ${items} 件物品数据`
          : `已接续来自「${h.from}」的进度`;
        store.overlay = '';     // 关掉面板，露出还原后的页面
      } else {
        this.note = '快照版本不一致，已忽略这次流转';
      }
    }).catch((e: Error): void => {
      this.busy = false;
      this.note = '接收失败：' + e.message;
    });
  }

  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text('跨设备流转').fontSize(24).fontWeight(800).fontColor(T.c('text-primary'))
          Text('手机 / 平板之间接着做：当前页面、打开的库、浮层、AI 面板状态一起带过去')
            .fontSize(13).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        ToneBadge({ text: deviceLabel(), tone: 'teal', icon: 'share' })
      }
      .width('100%')

      Row({ space: 12 }) {
        TBtn({ label: '发送流转', icon: 'upload', kind: 'primary', tap: (): void => this.send() })
        TBtn({ label: '接收流转', icon: 'download', kind: 'ghost', tap: (): void => this.receive() })
      }
      .width('100%')

      Column({ space: 8 }) {
        Text(this.note).fontSize(13).fontColor(T.c('text-secondary'))
        Text('通道说明：真机同账号同网时由系统「应用接续」完成（无需点这里）；模拟器之间没有 dsoftbus、组不了网，' +
          '就走本地中转服务 backend/flow-bridge.js —— 用的是与系统接续完全相同的一份快照（仅状态位：当前页 / 打开的库 / 浮层 / ' +
          'AI 面板开关与草稿 / 库筛选 / 趋势区间），不含图片二进制与聊天正文。')
          .fontSize(11).fontColor(T.c('text-muted'))
      }
      .width('100%')
      .padding(16)
      .borderRadius(R_M)
      .backgroundColor(T.c('surface-overlay'))
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 预警中心 ================= */
@ComponentV2
struct AlertsPanel {
  private state(): string {
    const danger = store.alerts.some((a: AlertItem): boolean => a.tone === 'red');
    const warn = store.alerts.some((a: AlertItem): boolean => a.tone === 'amber');
    return danger ? 'danger' : warn ? 'warn' : '';
  }

  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text('预警中心').fontSize(24).fontWeight(800).fontColor(T.c('text-primary'))
          Text('临期 · 低库存 · 药品 · 保修期 · 重复购买').fontSize(13).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        NumText({ value: `${store.alerts.length} 条待处理`, dim: 12, color: T.c('text-muted') })
      }
      .width('100%')

      // 警报灯
      Row({ space: 16 }) {
        Circle({ width: 44, height: 44 })
          .fill(this.state() === 'danger' ? T.c('tone-red') : this.state() === 'warn' ? T.c('tone-amber') : T.c('tone-teal'))
        Column({ space: 2 }) {
          Text(this.state() === 'danger' ? '有紧急情况' : this.state() === 'warn' ? '有临期 / 待处理' : '库存健康')
            .fontSize(15).fontWeight(800).fontColor(T.c('text-primary'))
          Text(this.state() === 'danger' ? '红色预警请立即处理' : this.state() === 'warn' ? '优先消耗临期食材，黄色灯在闪' : '一切正常，继续保持')
            .fontSize(12).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')
      .padding(20)
      .borderRadius(R_L)
      .backgroundColor(T.c('surface-raised'))
      .border({ width: 1, color: T.c('border') })

      if (store.alerts.length === 0) {
        Column({ space: 8 }) {
          Ico({ name: 'circle-check', dim: 24, color: T.c('success') })
          Text('今天没有预警').fontSize(15).fontWeight(700).fontColor(T.c('text-primary'))
          Text('库存很健康，继续保持').fontSize(13).fontColor(T.c('text-muted'))
        }
        .width('100%')
        .padding(40)
      } else {
        Column({ space: 12 }) {
          ForEach(store.alerts, (a: AlertItem) => {
            AlertRow({ alert: a })
          }, (a: AlertItem) => `${a.id}`)
        }
        .width('100%')
      }
    }
    .width('100%')
    .padding(20)
    .alignItems(HorizontalAlign.Start)
  }
}

@ComponentV2
struct AlertRow {
  @Param alert: AlertItem = new AlertItem(0, '', 'clock', 'amber', '', '');

  private sev(): number {
    return this.alert.tone === 'red' ? 3 : this.alert.tone === 'amber' ? 2 : 1;
  }

  build() {
    Row({ space: 16 }) {
      Column() {
        Ico({ name: this.alert.icon, dim: 20, color: T.tone(this.alert.tone)[0] })
      }
      .width(40)
      .height(40)
      .borderRadius(R_M)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(T.tone(this.alert.tone)[1])

      Column({ space: 2 }) {
        Text(this.alert.text).fontSize(14).fontColor(T.c('text-primary'))
        Text(this.alert.meta).fontSize(12).fontColor(T.c('text-muted'))
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Row({ space: 3 }) {
        ForEach([1, 2, 3], (i: number) => {
          Circle({ width: 7, height: 7 })
            .fill(i <= this.sev() ? T.tone(this.alert.tone)[0] : T.c('surface-overlay'))
        }, (i: number) => String(i))
      }

      TBtn({ label: '已处理', kind: 'ghost', small: true, busyKey: `alert:${this.alert.id}`,
        tap: (): void => {
          runBusy(`alert:${this.alert.id}`, (): Promise<void> => resolveAlert(this.alert.id), (): void => {
            store.toast('已处理，预警已归档');
          });
        } })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 16, bottom: 16 })
    .borderRadius(R_M)
    .backgroundColor(T.c('surface-raised'))
    .shadow({ radius: 2, color: 'rgba(0,0,0,0.25)', offsetY: 1 })
    .alignItems(VerticalAlign.Center)
  }
}

/* ================= 采购清单 ================= */
@ComponentV2
struct ShoppingPanel {
  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text('采购清单').fontSize(24).fontWeight(800).fontColor(T.c('text-primary'))
          Text('方案缺料 + 低库存自动合并（F3.6）').fontSize(13).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Column({ space: 8 }) {
          TBtn({ label: '复制文本', icon: 'copy', kind: 'ghost', small: true, busyKey: 'shop',
            tap: (): void => {
              runBusy('shop', (): Promise<void> => shoppingList().then((): void => {}), (): void => {
                const first = store.shopping.slice(0, 2).map((x: ShoppingItem): string => `${x.name} ${x.qty}`).join('、');
                store.toast(`采购清单已复制：${first} …`);
              });
            } })
          TBtn({ label: '分享', icon: 'share', kind: 'primary', small: true, tap: (): void => {
            store.toast('已生成分享卡片，发送给家人');
          } })
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Bottom)

      Card() {
        Column({ space: 16 }) {
          CardHead({ title: `待采购 ${store.shopping.length} 项`, sub: '合计约 ¥23' })
          Column({ space: 8 }) {
            ForEach(store.shopping, (s: ShoppingItem, i: number) => {
              Row({ space: 12 }) {
                Row() {
                  Ico({ name: 'check', dim: 11, color: s.checked ? '#FDFCFB' : Color.Transparent })
                }
                .width(20)
                .height(20)
                .borderRadius(6)
                .backgroundColor(s.checked ? T.c('success') : Color.Transparent)
                .border({ width: 1.5, color: s.checked ? T.c('success') : T.c('border-strong') })
                .onClick(() => {
                  s.checked = !s.checked;
                  const arr = store.shopping.slice();
                  arr[i] = s;
                  store.shopping = arr;
                })

                Column({ space: 2 }) {
                  Text(s.name)
                    .fontSize(14).fontWeight(600).fontColor(T.c('text-primary'))
                    .decoration({ type: s.checked ? TextDecorationType.LineThrough : TextDecorationType.None })
                    .opacity(s.checked ? 0.6 : 1)
                  Text(s.src).fontSize(12).fontColor(T.c('text-muted'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)

                ToneBadge({ text: s.qty, tone: 'muted' })
              }
              .width('100%')
              .padding({ left: 16, right: 16, top: 12, bottom: 12 })
              .borderRadius(R_M)
              .backgroundColor(T.c('surface'))
              .border({ width: 1, color: T.c('border') })
            }, (s: ShoppingItem) => `${s.name}-${s.checked}`)
          }
          .alignItems(HorizontalAlign.Start)
        }
      }
    }
    .width('100%')
    .padding(20)
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 方案列表 ================= */
@ComponentV2
struct PlansPanel {
  build() {
    Column({ space: 16 }) {
      Row({ space: 12 }) {
        Column({ space: 8 }) {
          Text('方案').fontSize(24).fontWeight(800).fontColor(T.c('text-primary'))
          Text('勾选已执行自动扣减库存，可撤销（F6.1）').fontSize(13).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        TBtn({ label: '生成新方案', icon: 'sparkles', kind: 'primary', busyKey: 'plans',
          tap: (): void => {
            generatePlans().then((plans: Plan[]): void => {
              store.toast(`已生成 ${plans.length} 个新方案`);
            });
          } })
      }
      .width('100%')
      .alignItems(VerticalAlign.Bottom)

      ForEach(store.plans, (p: Plan) => {
        Card() {
          Column() {
            PlanCard({ plan: p, compact: false })
          }
        }
      }, (p: Plan) => `${p.id}-${p.status}`)
    }
    .width('100%')
    .padding(20)
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 全局搜索 ================= */
@ComponentV2
struct SearchPanel {
  build() {
    Column({ space: 16 }) {
      Text('全局搜索').fontSize(24).fontWeight(800).fontColor(T.c('text-primary'))
      TextInput({ text: store.searchQ, placeholder: '搜物品、位置，或问"鸡蛋放哪了”' })
        .height(48)
        .fontSize(15)
        .borderRadius(R_L)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .fontColor(T.c('text-primary'))
        .placeholderColor(T.c('text-muted'))
        .onChange((v: string) => {
          store.searchQ = v;
        })

      if (this.hasLocationAnswer()) {
        Row({ space: 16 }) {
          Column() {
            Ico({ name: 'sparkles', dim: 14, color: T.c('on-accent-container') })
          }
          .width(34)
          .height(34)
          .borderRadius(999)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(T.c('accent-container'))

          Column({ space: 4 }) {
            Text('鸡蛋在冷藏区中层').fontSize(15).fontWeight(700).fontColor(T.c('text-primary'))
            Text('当前 8 个，3 天后到期。价格 ¥15.9（拍照识别）。建议优先安排到今晚的番茄炒蛋。')
              .fontSize(13).fontColor(T.c('text-secondary'))
            TBtn({ label: '去冰箱看看', icon: 'arrow-right', kind: 'ghost', small: true, tap: (): void => {
              store.overlay = '';
              store.tabIndex = 1;
              store.libId = 'fridge';
            } })
              .margin({ top: 8 })
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
        }
        .width('100%')
        .padding(20)
        .borderRadius(R_L)
        .backgroundColor(T.c('accent-container'))
        .alignItems(VerticalAlign.Top)
      }

      if (this.hits().length > 0 || this.libHits().length > 0 || store.searchQ === '') {
        Text('物品').fontSize(20).fontWeight(800).fontColor(T.c('text-primary'))
        Card({ pad: 12 }) {
          Column() {
            ForEach(this.hits(), (h: SearchHit) => {
              Row({ space: 12 }) {
                Column() {
                  Text(h.emoji).fontSize(17)
                }
                .width(40)
                .height(40)
                .borderRadius(R_M)
                .justifyContent(FlexAlign.Center)
                .backgroundColor(T.c('surface-overlay'))

                Column({ space: 2 }) {
                  Text(h.name).fontSize(14).fontWeight(600).fontColor(T.c('text-primary'))
                  Text(`${h.libName} · ${h.pos}`).fontSize(12).fontColor(T.c('text-muted'))
                }
                .alignItems(HorizontalAlign.Start)
                .layoutWeight(1)

                ToneBadge({ text: `${h.qty} ${h.unit}`, tone: 'muted' })
              }
              .width('100%')
              .padding({ left: 12, right: 12, top: 10, bottom: 10 })
              .borderRadius(R_M)
              .onClick(() => {
                store.overlay = '';
                store.tabIndex = 1;
                store.libId = h.libId;
              })
            }, (h: SearchHit) => `${h.libId}-${h.name}`)
            if (this.hits().length === 0) {
              Text('没有匹配的物品').fontSize(13).fontColor(T.c('text-muted')).padding(24).width('100%').textAlign(TextAlign.Center)
            }
          }
          .width('100%')
        }
      }

      if (this.libHits().length > 0) {
        Text('资源库').fontSize(20).fontWeight(800).fontColor(T.c('text-primary'))
        Card({ pad: 12 }) {
          Column() {
            ForEach(this.libHits(), (l: Library) => {
              Row({ space: 12 }) {
                Column() {
                  Ico({ name: l.icon, dim: 17, color: T.tone(l.tone)[0] })
                }
                .width(34)
                .height(34)
                .borderRadius(R_M)
                .justifyContent(FlexAlign.Center)
                .backgroundColor(T.tone(l.tone)[1])
                Text(l.name).fontSize(14).fontWeight(600).fontColor(T.c('text-primary')).layoutWeight(1)
                ToneBadge({ text: `${l.count} 件`, tone: 'muted' })
              }
              .width('100%')
              .padding({ left: 12, right: 12, top: 10, bottom: 10 })
              .borderRadius(R_M)
              .onClick(() => {
                store.overlay = '';
                store.tabIndex = 1;
                store.libId = l.id;
              })
            }, (l: Library) => l.id)
          }
          .width('100%')
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private hasLocationAnswer(): boolean {
    const q = store.searchQ;
    return q.indexOf('在哪') > -1 || q.indexOf('放哪') > -1 || q.indexOf('哪里') > -1;
  }

  private hits(): SearchHit[] {
    const r = search(store.searchQ);
    if (store.searchQ.trim() === '') {
      return r[0].slice(0, 4);
    }
    return r[0];
  }

  private libHits(): Library[] {
    return search(store.searchQ)[1];
  }
}

/* ================= 新建库 / 重命名 ================= */
@ComponentV2
struct NewLibPanel {
  @Local name: string = '';
  @Local icon: string = 'package';
  @Local tone: string = 'teal';

  build() {
    Column({ space: 16 }) {
      Text('新建资源库').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')
      Field({ label: '库名称', text: this.name, placeholder: '如：零食柜、鞋柜',
        change: (v: string): void => {
          this.name = v;
        } })
      Text('图标').fontSize(11).fontWeight(600).fontColor(T.c('text-muted')).width('100%')
      Row({ space: 8 }) {
        ForEach(['package', 'fridge', 'shirt', 'pill', 'wrench', 'dumbbell', 'book', 'paw', 'plug'], (ic: string) => {
          Column() {
            Ico({ name: ic, dim: 16, color: this.icon === ic ? T.c('on-primary') : T.c('text-secondary') })
          }
          .width(36)
          .height(36)
          .borderRadius(R_M)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(this.icon === ic ? T.c('primary') : T.c('surface-overlay'))
          .onClick(() => {
            this.icon = ic;
          })
        }, (ic: string) => ic)
      }
      Text('主色调').fontSize(11).fontWeight(600).fontColor(T.c('text-muted')).width('100%')
      Row({ space: 8 }) {
        ForEach(['teal', 'indigo', 'red', 'slate', 'lime', 'brown', 'orange', 'violet'], (tn: string) => {
          Row()
            .width(28)
            .height(28)
            .borderRadius(999)
            .backgroundColor(T.tone(tn)[0])
            .border({ width: this.tone === tn ? 3 : 0, color: T.c('text-primary') })
            .onClick(() => {
              this.tone = tn;
            })
        }, (tn: string) => tn)
      }

      TBtn({ label: '创建库', kind: 'primary', busyKey: 'lib:create', tap: (): void => {
        if (this.name.trim() === '') {
          store.toast('请输入库名称');
          return;
        }
        const icon = this.icon;
        const tone = this.tone;
        const name = this.name.trim();
        runBusy('lib:create', (): Promise<void> => createLibrary(name, icon, tone).then((): void => {
          store.overlay = '';
        }), (): void => {
          store.toast(`已创建库「${name}」`);
        });
      } })
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@ComponentV2
struct EditLibPanel {
  @Local name: string = '';

  aboutToAppear(): void {
    const lib = store.findLib(store.overlayArg);
    this.name = lib !== null ? lib.name : '';
  }

  build() {
    Column({ space: 16 }) {
      Text('重命名资源库').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')
      Field({ label: '库名称', text: this.name,
        change: (v: string): void => {
          this.name = v;
        } })
      TBtn({ label: '保存', kind: 'primary', busyKey: 'lib:rename', tap: (): void => {
        const libId = store.overlayArg;
        const name = this.name.trim();
        if (name === '') {
          return;
        }
        runBusy('lib:rename', (): Promise<void> => renameLibrary(libId, name).then((): void => {
          store.overlay = '';
        }), (): void => {
          store.toast('已重命名');
        });
      } })
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 手动添加 / 编辑物品 ================= */
@ComponentV2
struct ItemAddPanel {
  @Local form: ItemForm = new ItemForm();

  build() {
    Column({ space: 16 }) {
      Text('手动添加物品').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')
      Field({ label: '名称', text: this.form.name, placeholder: '如：青椒',
        change: (v: string): void => {
          this.form.name = v;
        } })
      Row({ space: 12 }) {
        Field({ label: '数量', text: this.form.qty, num: true,
          change: (v: string): void => {
            this.form.qty = v;
          } }).layoutWeight(1)
        Field({ label: '单位', text: this.form.unit,
          change: (v: string): void => {
            this.form.unit = v;
          } }).layoutWeight(1)
      }
      Row({ space: 12 }) {
        Field({ label: '价格（¥）', text: this.form.price, num: true,
          change: (v: string): void => {
            this.form.price = v;
          } }).layoutWeight(1)
        Field({ label: '保质期（天）', text: this.form.expDays, num: true,
          change: (v: string): void => {
            this.form.expDays = v;
          } }).layoutWeight(1)
      }
      Field({ label: '存放位置', text: this.form.pos, placeholder: '如：冷藏区底层',
        change: (v: string): void => {
          this.form.pos = v;
        } })
      SwitchRow({ title: '仅自己可见', desc: '共享库与协作中不展示（F2.5）', on: this.form.isPrivate,
        tap: (): void => {
          this.form.isPrivate = !this.form.isPrivate;
        } })

      TBtn({ label: '添加', kind: 'primary', busyKey: 'item:save', tap: (): void => {
        if (this.form.name.trim() === '') {
          store.toast('请输入物品名称');
          return;
        }
        const libId = store.overlayArg;
        const form = this.form;
        runBusy('item:save', (): Promise<void> => addItem(libId, form).then((): void => {
          store.overlay = '';
        }), (): void => {
          store.toast(`已添加「${form.name.trim()}」`);
        });
      } })
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@ComponentV2
struct ItemEditPanel {
  @Local form: ItemForm = new ItemForm();

  private lib(): Library | null {
    return store.findLib(store.overlayArg);
  }

  private it(): Item | null {
    const lib = this.lib();
    if (lib === null) {
      return null;
    }
    let found: Item | null = null;
    lib.items.forEach((x: Item) => {
      if (x.id === store.overlayArg2) {
        found = x;
      }
    });
    return found;
  }

  aboutToAppear(): void {
    const it = this.it();
    if (it !== null) {
      const target = it as Item;
      this.form = new ItemForm();
      this.form.name = target.name;
      this.form.no = target.no;
      this.form.qty = String(target.qty);
      this.form.unit = target.unit;
      this.form.price = String(target.price);
      this.form.expDays = String(target.expDays);
      this.form.pos = target.pos;
      this.form.isPrivate = target.isPrivate;
    }
  }

  build() {
    Column({ space: 16 }) {
      Text('编辑物品').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')
      Field({ label: '名称', text: this.form.name,
        change: (v: string): void => {
          this.form.name = v;
        } })
      Field({ label: '编号', text: this.form.no,
        change: (_v: string): void => {} })
      Row({ space: 12 }) {
        Field({ label: '数量', text: this.form.qty, num: true,
          change: (v: string): void => {
            this.form.qty = v;
          } }).layoutWeight(1)
        Field({ label: '单位', text: this.form.unit,
          change: (v: string): void => {
            this.form.unit = v;
          } }).layoutWeight(1)
      }
      Row({ space: 12 }) {
        Field({ label: '价格（¥）', text: this.form.price, num: true,
          change: (v: string): void => {
            this.form.price = v;
          } }).layoutWeight(1)
        Field({ label: '保质期（天）', text: this.form.expDays, num: true,
          change: (v: string): void => {
            this.form.expDays = v;
          } }).layoutWeight(1)
      }
      Field({ label: '存放位置', text: this.form.pos,
        change: (v: string): void => {
          this.form.pos = v;
        } })
      SwitchRow({ title: '仅自己可见', desc: '共享库与协作中不展示（F2.5）', on: this.form.isPrivate,
        tap: (): void => {
          this.form.isPrivate = !this.form.isPrivate;
        } })

      Row({ space: 12 }) {
        TBtn({ label: '保存', kind: 'primary', busyKey: 'item:save', tap: (): void => {
          const libId = store.overlayArg;
          const itemId = store.overlayArg2;
          const form = this.form;
          runBusy('item:save', (): Promise<void> => updateItem(libId, itemId, form).then((): void => {
            store.overlay = '';
          }), (): void => {
            store.toast('已保存修改');
          });
        } }).layoutWeight(1)

        TBtn({ label: '删除物品', icon: 'trash', kind: 'ghost', busyKey: 'item:del', tap: (): void => {
          const libId = store.overlayArg;
          const itemId = store.overlayArg2;
          runBusy('item:del', async (): Promise<void> => {
            const r = await deleteItem(libId, itemId);
            store.lastDeletedItem.lib = r.lib;
            store.lastDeletedItem.item = r.item;
            store.lastDeletedItem.index = r.index;
          }, (): void => {
            store.overlay = '';
            store.toast(`已删除「${store.lastDeletedItem.item !== null ? (store.lastDeletedItem.item as Item).name : ''}」`, '撤销', 'item:restore');
          });
        } }).layoutWeight(1)
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 换牌 ================= */
@ComponentV2
struct DeckPickPanel {
  build() {
    Column({ space: 16 }) {
      Text('选择手牌 · 上限 4 张').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')
      NumText({ value: `已选 ${store.deckDraft.length} / 4 · 有什么库就有什么卡牌`, dim: 12, color: T.c('text-muted') })
      Column() {
        ForEach(store.libraries, (l: Library) => {
          SwitchRow({
            title: l.name,
            desc: `${l.count} 件${l.coopFrom !== '' ? ` · 来自 ${l.coopFrom}` : ''}`,
            on: store.deckDraft.indexOf(l.id) > -1,
            tap: (): void => {
              const idx = store.deckDraft.indexOf(l.id);
              const draft = store.deckDraft.slice();
              if (idx > -1) {
                draft.splice(idx, 1);
              } else {
                if (draft.length >= 4) {
                  store.toast('最多带 4 张手牌');
                  return;
                }
                draft.push(l.id);
              }
              store.deckDraft = draft;
            }
          })
        }, (l: Library) => l.id)
      }
      .width('100%')

      TBtn({ label: '保存手牌', kind: 'primary', busyKey: 'deck:save', tap: (): void => {
        runBusy('deck:save', (): Promise<void> => setDeck(store.deckDraft.slice()).then((): void => {
          store.overlay = '';
        }), (): void => {
          store.toast('手牌已更新');
        });
      } })
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/* ================= 群聊 ================= */
@ComponentV2
struct GroupChatPanel {
  @Local input: string = '';
  private scroller: Scroller = new Scroller();

  build() {
    Column({ space: 12 }) {
      Text('群聊 · 3 人').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).width('100%')

      Scroll(this.scroller) {
        Column({ space: 10 }) {
          ForEach(store.workbench.chat, (m: WbMsg, i: number) => {
            if (m.sys) {
              Text(m.text)
                .fontSize(11).fontColor(T.c('text-muted'))
                .padding({ left: 12, right: 12, top: 3, bottom: 3 })
                .borderRadius(999)
                .backgroundColor(T.c('surface-overlay'))
            } else {
              Row({ space: 8 }) {
                Column() {
                  Text(m.from.charAt(0)).fontSize(12).fontWeight(800).fontColor(T.c('on-primary-container'))
                }
                .width(26)
                .height(26)
                .borderRadius(999)
                .justifyContent(FlexAlign.Center)
                .backgroundColor(T.c('primary-container'))

                Column({ space: 2 }) {
                  Row({ space: 6 }) {
                    Text(m.from).fontSize(11).fontWeight(600).fontColor(T.c('text-muted'))
                    NumText({ value: m.time, dim: 10, color: T.c('text-muted') })
                  }
                  Text(m.text)
                    .fontSize(13).fontColor(T.c('text-secondary'))
                    .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                    .borderRadius(R_M)
                    .backgroundColor(T.c('surface'))
                }
                .alignItems(HorizontalAlign.Start)
              }
              .width('100%')
              .alignItems(VerticalAlign.Top)
            }
          }, (m: WbMsg, i: number) => `${i}-${m.text.length}`)
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding({ top: 4, bottom: 4, left: 2, right: 2 })
      }
      .height(300)
      .scrollBar(BarState.Off)
      .align(Alignment.TopStart)

      Row({ space: 8 }) {
        TextInput({ text: this.input, placeholder: '说点什么…' })
          .layoutWeight(1)
          .height(38)
          .fontSize(13)
          .borderRadius(R_M)
          .backgroundColor(T.c('surface'))
          .border({ width: 1, color: T.c('border') })
          .fontColor(T.c('text-primary'))
          .placeholderColor(T.c('text-muted'))
          .onChange((v: string) => {
            this.input = v;
          })
          .onSubmit(() => this.send())
        TBtn({ label: '发送', kind: 'primary', small: true, tap: (): void => this.send() })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  private send(): void {
    const v = this.input.trim();
    if (v === '') {
      return;
    }
    this.input = '';
    sendChat(store.userName, v).then((): void => {
      setTimeout((): void => {
        this.scroller.scrollEdge(Edge.Bottom);
      }, 60);
    });
  }
}

/* ================= 拍照入库 ================= */
@ComponentV2
struct IntakePanel {
  @Local scanY: number = 0;
  @Local frameH: number = 320;
  @Local batchMode: boolean = false;      // 连拍合并模式（F1.2）
  @Local mergedDone: boolean = false;     // 合并已完成（展示去重后清单）
  private scanTimer: number = -1;
  private intakeStartMs: number = 0;      // M-11 指标③：本次盘点起始时刻（拍摄/选图 → 确认入库）

  aboutToAppear(): void {
    this.scanTimer = setInterval((): void => {
      this.scanY = this.scanY === 0 ? this.frameH - 44 : 0;
    }, 1450);
  }

  aboutToDisappear(): void {
    if (this.scanTimer !== -1) {
      clearInterval(this.scanTimer);
      this.scanTimer = -1;
    }
  }

  build() {
    Column({ space: 20 }) {
      Text('拍照入库').fontSize(24).fontWeight(800).fontColor(T.c('text-primary')).width('100%')
      Text('拍一张 → AI 识别 → 只补缺 → 入库（F1.1 / F1.5）').fontSize(13).fontColor(T.c('text-muted')).width('100%')

      // 步骤条
      Row({ space: 8 }) {
        this.Step(0, '拍摄 / 上传')
        Row().height(2).layoutWeight(1).backgroundColor(store.intakeStep > 0 ? T.c('primary') : T.c('border')).borderRadius(999)
        this.Step(1, 'AI 识别与补缺')
        Row().height(2).layoutWeight(1).backgroundColor(store.intakeStep > 1 ? T.c('primary') : T.c('border')).borderRadius(999)
        this.Step(2, '确认入库')
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      if (store.intakeStep === 0) {
        // 取景框
        Column({ space: 16 }) {
          Stack() {
            Image($r('app.media.fridge'))
              .width('100%')
              .aspectRatio(1)
              .borderRadius(R_L)
              .objectFit(ImageFit.Cover)

            // 四角
            VfCorner({ corner: 0 }).position({ x: 14, y: 14 })
            VfCorner({ corner: 1 }).position({ x: '100%', y: 14 }).markAnchor({ x: '100%', y: 0 })
            VfCorner({ corner: 2 }).position({ x: 14, y: '100%' }).markAnchor({ x: 0, y: '100%' })
            VfCorner({ corner: 3 }).position({ x: '100%', y: '100%' }).markAnchor({ x: '100%', y: '100%' })

            // 扫描线（上下往复）
            Column()
              .width('86%')
              .height(2)
              .borderRadius(999)
              .backgroundColor(T.c('primary'))
              .shadow({ radius: 14, color: 'rgba(255,136,51,0.6)', offsetY: 0 })
              .position({ x: '7%', y: 16 })
              .translate({ y: this.scanY })
              .animation({ duration: 1300, curve: Curve.EaseInOut })

            Row({ space: 6 }) {
              Ico({ name: 'scan', dim: 13, color: T.c('text-primary') })
              Text('对准冰箱 · AI 自动识别').fontSize(12).fontWeight(600).fontColor(T.c('text-primary'))
            }
            .padding({ left: 14, right: 14, top: 6, bottom: 6 })
            .borderRadius(999)
            .backgroundColor('rgba(14,17,34,0.82)')
            .border({ width: 1, color: T.c('border-strong') })
            .position({ x: '50%', y: '88%' })
            .markAnchor({ x: '50%', y: '50%' })
          }
          .width('100%')
          .onAreaChange((_o: Area, n: Area) => {
            this.frameH = Number(n.height);
          })

          Text('拍一张冰箱里的照片').fontSize(18).fontWeight(700).fontColor(T.c('text-primary'))
          Text('AI 自动识别物品、数量、保质期与价格，缺失字段你只补缺')
            .fontSize(13).fontColor(T.c('text-muted')).textAlign(TextAlign.Center)

            Row({ space: 12 }) {
              TBtn({ label: '拍照', icon: 'camera', kind: 'primary', tap: (): void => this.shoot() })
              TBtn({ label: '从相册选择', icon: 'upload', kind: 'ghost', tap: (): void => this.pickPhoto() })
            }

            Text('用内置演示图识别（相机不可用时）')
              .fontSize(12).fontWeight(600).fontColor(T.c('primary-ink'))
              .onClick((): void => this.shootDemoImage())

            Text('相册一次可多选最多 6 张，连拍自动合并去重累加')
              .fontSize(12).fontColor(T.c('text-muted'))
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)

        Card() {
          Column({ space: 8 }) {
            CardHead({ title: '价格自动补全', sub: '识别流程的一部分（F1.5）' })
            Text('照片里有价签 → 拍照识别价格；没有 → 联网搜索参考价并标注来源；入库后随时可改。')
              .fontSize(14).fontColor(T.c('text-secondary'))
          }
        }
      } else if (store.intakeStep === 1) {
        if (store.intakeLoading) {
          Column({ space: 12 }) {
            Row({ space: 8 }) {
              Ico({ name: 'scan', dim: 14, color: T.c('primary-ink') })
              Text(this.batchMode ? '连拍识别中 · 多张合并去重中' : 'AI 识别中…')
                .fontSize(13).fontWeight(600).fontColor(T.c('primary-ink'))
            }
            Row().height(14).borderRadius(999).backgroundColor(T.c('surface-overlay')).width('70%')
            Row().height(14).borderRadius(999).backgroundColor(T.c('surface-overlay')).width('40%')
            Row().height(14).borderRadius(999).backgroundColor(T.c('surface-overlay')).width('100%')
            Row().height(14).borderRadius(999).backgroundColor(T.c('surface-overlay')).width('40%')
          }
          .width('100%')
          .padding(24)
          .borderRadius(R_L)
          .backgroundColor(T.c('surface-raised'))
        } else {
          Column({ space: 12 }) {
            ForEach(store.intake, (r: IntakeResult, ri: number) => {
              RecogCard({ r: r, ri: ri })
            }, (r: IntakeResult) => r.id)

            Row({ space: 16 }) {
              Column({ space: 2 }) {
                Text(this.batchMode && this.mergedDone ? '连拍合并完成' : '识别完成')
                  .fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
                if (this.batchMode && this.mergedDone) {
                  Text('同名物品已合并去重并累加数量，缺失字段取首张非空值')
                    .fontSize(13).fontColor(T.c('text-muted'))
                } else {
                  Text('检查识别结果，缺失字段补缺后可入库')
                    .fontSize(13).fontColor(T.c('text-muted'))
                }
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)

              Row({ space: 12 }) {
                TBtn({ label: '重新识别', icon: 'undo', kind: 'ghost', small: true, tap: (): void => {
                  this.batchMode = false;
                  this.mergedDone = false;
                  resetIntake();
                } })
                TBtn({ label: '确认入库', icon: 'check', kind: 'primary', busyKey: 'intake:confirm',
                  tap: (): void => {
                    runBusy('intake:confirm', (): Promise<void> => addItems(store.intake).then((): void => {
                      // M-11 指标③：记录本次盘点耗时（成功入库才算一次）
                      if (this.intakeStartMs > 0) {
                        recordIntakeMs(Date.now() - this.intakeStartMs);
                        this.intakeStartMs = 0;
                      }
                      // M-5：入库后刷新服务卡片快照，卡片立即能反映新库存
                      saveFormSnapshot();
                      resetIntake();
                    }), (): void => {
                      const n = store.intake.filter((x: IntakeResult): boolean => x.name !== '').length;
                      store.overlay = '';
                      store.toast(`已入库 ${n} 项到「冰箱」，价格来源已标注`);
                    });
                  } })
              }
            }
            .width('100%')
            .alignItems(VerticalAlign.Center)
          }
          .width('100%')
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  /** 真实拍照：调系统相机（CameraPicker，自带拍照权限流程），拍完直接压缩上传给后端做 Agnes 识图 */
  private shoot(): void {
    try {
      const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const profile: cameraPicker.PickerProfile = {
        cameraPosition: camera.CameraPosition.CAMERA_POSITION_BACK
      };
      // 注意：部分设备/模拟器上 pick 会直接返回 undefined（而不是 reject），
      // 直接 .then 会 TypeError 闪退——必须先判空再挂回调。
      const pending: Promise<cameraPicker.PickerResult> | undefined =
        cameraPicker.pick(ctx, [cameraPicker.PickerMediaType.PHOTO], profile);
      if (pending === undefined || pending === null) {
        store.toast('当前设备相机不可用，改用内置演示图识别');
        this.shootDemoImage();
        return;
      }
      pending.then((result: cameraPicker.PickerResult): void => {
        if (result === undefined || result.resultCode !== 0 ||
          result.resultUri === undefined || result.resultUri === '') {
          return;   // 用户取消拍摄
        }
        this.compressAndRecognize(result.resultUri);
      }).catch((e: Error): void => {
        // 模拟器/无相机设备：回退到内置演示图，保证演示不空转
        store.toast('相机不可用（' + (e !== undefined && e.message !== undefined ? e.message : '未知原因') +
          '），改用内置演示图');
        this.shootDemoImage();
      });
    } catch (_e) {
      store.toast('相机调用失败，改用内置演示图识别');
      this.shootDemoImage();
    }
  }

  /** 内置演示图：走的是同一条真实链路（压缩 → 上传 → Agnes 识图） */
  private shootDemoImage(): void {
    this.batchMode = false;
    this.mergedDone = false;
    store.intakeStep = 1;
    store.intakeLoading = true;
    const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
    ctx.resourceManager.getMediaContent($r('app.media.fridge')).then((data: Uint8Array): void => {
      const b64 = new util.Base64Helper().encodeToStringSync(data);
      this.recognizeBase64(b64);
    }).catch((_e: Error): void => {
      this.recognizeFallback();
    });
  }

  private pickPhoto(): void {
    const picker = new photoAccessHelper.PhotoViewPicker();
    const opts: photoAccessHelper.PhotoSelectOptions = {
      MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE,
      maxSelectNumber: 6
    };
    picker.select(opts).then((result: photoAccessHelper.PhotoSelectResult): void => {
      const uris = result.photoUris;
      if (uris.length === 0) {
        return;
      }
      if (uris.length === 1) {
        // 单张：直接识别
        this.compressAndRecognize(uris[0]);
      } else {
        // 多张：连拍合并（F1.2），逐张识别后按名称合并去重
        store.intakeStep = 1;
        store.intakeLoading = true;
        store.intake = [];
        this.batchMode = true;
        this.mergedDone = false;
        this.intakeStartMs = Date.now();
        const batches: IntakeResult[][] = [];
        this.recognizeBatch(uris, 0, batches);
      }
    }).catch((): void => {
      store.toast('未选择图片');
    });
  }

  /** 串行识别多张图，全部完成后合并去重累加 */
  private recognizeBatch(uris: string[], idx: number, batches: IntakeResult[][]): void {
    if (idx >= uris.length) {
      const merged = mergeIntakeResults(batches);
      if (merged.length === 0) {
        this.recognizeFallback();
        return;
      }
      store.intake = merged;
      store.intakeLoading = false;
      this.mergedDone = true;
      store.toast(`连拍合并完成：${uris.length} 张 → ${merged.length} 项（同名已合并）`);
      return;
    }
    this.recognizeUri(uris[idx]).then((items: IntakeResult[]): void => {
      batches.push(items);
      this.recognizeBatch(uris, idx + 1, batches);
    }).catch((_e: Error): void => {
      // 单张失败不影响其余
      this.recognizeBatch(uris, idx + 1, batches);
    });
  }

  /** 对单个 uri 跑识别，返回结果数组 */
  private recognizeUri(uri: string): Promise<IntakeResult[]> {
    return image.createImageSource(uri).getImageInfo().then((info: image.ImageInfo): Promise<image.PixelMap> => {
      const long = Math.max(info.size.width, info.size.height);
      const scale = Math.min(1, 1024 / long);
      const pmOpts: image.DecodingOptions = {
        desiredSize: { width: Math.round(info.size.width * scale), height: Math.round(info.size.height * scale) }
      };
      return image.createImageSource(uri).createPixelMap(pmOpts);
    }).then((pm: image.PixelMap): Promise<ArrayBuffer> => {
      const pk = image.createImagePacker();
      return pk.packToData(pm, { format: 'image/jpeg', quality: 80 });
    }).then((buf: ArrayBuffer): Promise<IntakeResult[]> => {
      const b64 = new util.Base64Helper().encodeToStringSync(new Uint8Array(buf));
      return recognizeImage(b64);
    });
  }

  private compressAndRecognize(uri: string): void {
    this.batchMode = false;
    this.mergedDone = false;
    this.intakeStartMs = Date.now();
    store.intakeStep = 1;
    store.intakeLoading = true;
    const src = image.createImageSource(uri);
    src.getImageInfo().then((info: image.ImageInfo): Promise<image.PixelMap> => {
      const long = Math.max(info.size.width, info.size.height);
      const scale = Math.min(1, 1024 / long);
      const pmOpts: image.DecodingOptions = {
        desiredSize: { width: Math.round(info.size.width * scale), height: Math.round(info.size.height * scale) }
      };
      return src.createPixelMap(pmOpts);
    }).then((pm: image.PixelMap): Promise<ArrayBuffer> => {
      const pk = image.createImagePacker();
      return pk.packToData(pm, { format: 'image/jpeg', quality: 80 });
    }).then((buf: ArrayBuffer): void => {
      const b64 = new util.Base64Helper().encodeToStringSync(new Uint8Array(buf));
      this.recognizeBase64(b64);
    }).catch((_e: Error): void => {
      this.recognizeFallback();
    });
  }

  private recognizeBase64(b64: string): void {
    store.intakeStep = 1;
    store.intakeLoading = true;
      recognizeImage(b64).then((items: IntakeResult[]): void => {
        store.intake = items;
        store.intakeLoading = false;
        store.toast(`Agnes 已识别 ${items.length} 项，请补缺确认`);
      }).catch((e: Error): void => {
        // 不再静默回退：把网关失败原因说出来，避免"看着像没接 AI"
        store.toast('AI 识图失败（' +
          (e !== undefined && e.message !== undefined ? e.message : '未知原因') + '），先用演示数据占位');
        this.recognizeFallback();
      });
  }

  private recognizeFallback(): void {
    store.intake = seedIntake();
    store.intakeLoading = false;
    store.intakeStep = 1;
    store.toast('Agnes 识别失败，已载入演示数据');
  }

  @Builder
  Step(i: number, label: string) {
    Row({ space: 8 }) {
      Row() {
        if (store.intakeStep > i) {
          Ico({ name: 'check', dim: 12, color: T.c('primary-ink') })
        } else {
          NumText({ value: String(i + 1), dim: 12, weight: FontWeight.Bold,
            color: store.intakeStep === i ? T.c('on-primary') : T.c('text-muted') })
        }
      }
      .width(26)
      .height(26)
      .borderRadius(999)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(store.intakeStep > i ? T.c('primary-container') : store.intakeStep === i ? T.c('primary') : T.c('surface-overlay'))

      Text(label)
        .fontSize(13)
        .fontWeight(600)
        .fontColor(store.intakeStep === i ? T.c('primary') : T.c('text-muted'))
    }
  }
}

@ComponentV2
struct VfCorner {
  @Param corner: number = 0;

  build() {
    Stack() {
    }
    .width(28)
    .height(28)
    .border({
      width: {
        top: this.corner === 0 || this.corner === 1 ? 2 : 0,
        bottom: this.corner === 2 || this.corner === 3 ? 2 : 0,
        left: this.corner === 0 || this.corner === 2 ? 2 : 0,
        right: this.corner === 1 || this.corner === 3 ? 2 : 0
      },
      color: T.c('primary-ink')
    })
  }
}

@ComponentV2
struct RecogCard {
  @Param r: IntakeResult = new IntakeResult('', '❔', '', '', '', '', '个', '', '', 0, '', '', '待补', false);
  @Param ri: number = 0;

  build() {
    Row({ space: 16 }) {
      Stack() {
        if (this.r.img !== '') {
          Image(this.r.img).width(72).height(72).borderRadius(R_M).objectFit(ImageFit.Cover)
        } else {
          Text(this.r.emoji).fontSize(28)
        }
      }
      .width(72)
      .height(72)
      .borderRadius(R_M)
      .backgroundColor(T.c('surface-overlay'))

      Column({ space: 10 }) {
        Row({ space: 10 }) {
          Text(this.r.name === '' ? '待识别物品' : this.r.name)
            .fontSize(15).fontWeight(700).fontColor(T.c('text-primary'))
          Row({ space: 4 }) {
            Ico({ name: 'check', dim: 11, color: this.r.attention ? T.c('text-muted') : T.c('success') })
            Text(this.r.attention ? '待补全' : '已识别').fontSize(12).fontColor(this.r.attention ? T.c('text-muted') : T.c('success'))
          }
          ToneBadge({
            text: `价格 · ${this.r.priceSrc}`,
            tone: this.r.priceSrc === '拍照识别' ? 'teal' : this.r.priceSrc === '联网参考' ? 'amber' : 'muted'
          })
        }
        .width('100%')

        Column({ space: 10 }) {
          // 手机两列，宽屏三列
          Row({ space: 10 }) {
            Field({ label: '名称', text: this.r.name, attention: this.r.attention,
              change: (v: string): void => {
                this.r.name = v;
                this.r.attention = v.trim() === '';
              } }).layoutWeight(store.isWide ? 1 : 2)
            Field({ label: '类别', text: this.r.category,
              change: (v: string): void => {
                this.r.category = v;
              } }).layoutWeight(store.isWide ? 1 : 1)
            if (store.isWide) {
              Field({ label: '数量', text: this.r.qty, num: true,
                change: (v: string): void => {
                  this.r.qty = v;
                } }).layoutWeight(1)
            }
          }
          .width('100%')

          if (!store.isWide) {
            Row({ space: 10 }) {
              Field({ label: '数量', text: this.r.qty, num: true,
                change: (v: string): void => {
                  this.r.qty = v;
                } }).layoutWeight(1)
              Field({ label: '存放位置', text: this.r.pos,
                change: (v: string): void => {
                  this.r.pos = v;
                } }).layoutWeight(1)
            }
            .width('100%')
          }

          Row({ space: 10 }) {
            if (store.isWide) {
              Field({ label: '存放位置', text: this.r.pos,
                change: (v: string): void => {
                  this.r.pos = v;
                } }).layoutWeight(1)
            }
            Column({ space: 4 }) {
              Field({ label: '保质期', text: this.r.exp,
                change: (v: string): void => {
                  this.r.exp = v;
                } })
              if (kbSrc(this.r.kbKey) !== '') {
                Text(kbSrc(this.r.kbKey)).fontSize(11).fontColor(T.c('text-muted'))
              }
            }.layoutWeight(1)
            Field({ label: '价格（¥）', text: this.r.price, num: true,
              change: (v: string): void => {
                this.r.price = v;
              } }).layoutWeight(1)
          }
          .width('100%')
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .padding(16)
    .borderRadius(R_M)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
    .alignItems(VerticalAlign.Top)
    .transition(TransitionEffect.asymmetric(
      TransitionEffect.translate({ y: 10 }).combine(TransitionEffect.OPACITY),
      TransitionEffect.OPACITY
    ).animation({ duration: 450, delay: this.ri * 90, curve: Curve.EaseOut }))
  }
}

/* ================= 设置（也作为“我的”Tab） ================= */
@ComponentV2
export struct SettingsView {
  @Local syncNote: string = '';    // '' | conflict | err
  @Local syncDetail: string = '';
  @Local flowNote: string = '';    // 跨设备流转状态
  /* M-10 用量看板：后端聚合（与管理员端同接口）+ 本地兜底口径 */
  @Local gwUsage: UsageSummary = new UsageSummary();
  @Local gwNote: string = '';
  @Local gwFresh: boolean = false;
  /** 图谱状态（补充方案 G1）：规模 / 版本 / 最近一次重建耗时 */
  @Local graphSize: string = '';
  @Local graphVersion: string = '';
  @Local graphNote: string = '';

  aboutToAppear(): void {
    this.refreshGraphInfo();
  }

  private refreshGraphInfo(): void {
    this.graphSize = currentGraphSize();
    this.graphVersion = currentGraphVersion();
  }

  private rebuild(): void {
    runBusy('graph:rebuild', (): Promise<void> => new Promise<void>((resolve: () => void) => {
      const stat: GraphBuildStat = rebuildGraph();
      this.graphNote = `重建完成：${stat.nodes} 节点 / ${stat.edges} 边 / ${stat.communities} 社区` +
        `｜未归类 ${stat.unlinked} 项｜${stat.ms} ms`;
      this.refreshGraphInfo();
      resolve();
    }), (): void => {
      store.toast('图谱已重建');
    });
  }

  /** 本地口径：快答占比（"本地快答"记录数 / 总记录数），用于不入网时展示 */
  private localFastShare(): number {
    if (store.aiUsage.length === 0) {
      return 0;
    }
    let fast = 0;
    store.aiUsage.forEach((u: AiUsageRow) => {
      if (u.model === '本地快答') {
        fast += 1;
      }
    });
    return Math.round(fast * 1000 / store.aiUsage.length) / 10;
  }

  /** 本地口径：按路由聚合次数 */
  private localRouteRows(): UsageRow[] {
    const rows: UsageRow[] = [];
    store.aiUsage.forEach((u: AiUsageRow) => {
      let hit: UsageRow | null = null;
      rows.forEach((r: UsageRow) => {
        if (r.route === u.route && r.model === u.model) {
          hit = r;
        }
      });
      if (hit === null) {
        const r = new UsageRow();
        r.route = u.route;
        r.model = u.model;
        r.source = u.model === '本地快答' ? 'local' : 'client';
        r.calls = 1;
        r.avgMs = u.ms;
        rows.push(r);
      } else {
        const h = hit as UsageRow;
        h.avgMs = Math.round((h.avgMs * h.calls + u.ms) / (h.calls + 1));
        h.calls += 1;
      }
    });
    rows.sort((a: UsageRow, b: UsageRow): number => b.calls - a.calls);
    return rows.slice(0, 6);
  }

  private pullGatewayUsage(): void {
    runBusy('ai:usage', (): Promise<void> => gatewayUsage().then((s: UsageSummary): void => {
      this.gwUsage = s;
      this.gwFresh = true;
      this.gwNote = `近 ${7} 天：${s.total} 次调用，快答占比 ${s.fastShare}%，平均耗时 ${s.avgMs} ms`;
    }).catch((e: Error): void => {
      this.gwFresh = false;
      this.gwNote = '后端用量不可用（' + e.message + '），已回退本地记录';
    }));
  }

  private fmtUtc(u: string): string {
    if (u === '') {
      return '';
    }
    const d = new Date(u);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${mo}-${da} ${hh}:${mm}`;
  }

  private syncUp(): void {
    runBusy('sync:up', (): Promise<void> => tryUploadSync().then((r: SyncConflict): void => {
      if (r.ok) {
        this.syncNote = '';
        store.toast(`已上传到云端（版本 ${r.version}）`);
      } else if (r.conflict) {
        this.syncNote = 'conflict';
        this.syncDetail = `云端已在 ${this.fmtUtc(r.updatedAt)} 更新到版本 ${r.version}，本机也有改动`;
      } else {
        this.syncNote = 'err';
        this.syncDetail = r.error;
      }
    }));
  }

  private syncForce(): void {
    runBusy('sync:up', (): Promise<void> => forceUploadSync().then((r: SyncConflict): void => {
      this.syncNote = '';
      if (r.ok) {
        store.toast(`已覆盖上传（版本 ${r.version}）`);
      } else {
        store.toast('覆盖失败：' + r.error);
      }
    }));
  }

  private syncDown(): void {
    runBusy('sync:down', (): Promise<void> => downloadSync().then((msg: string): void => {
      this.syncNote = '';
      store.toast(msg);
    }));
  }

  /** 跨设备流转：把当前页面快照发到中转 */
  private sendFlow(): void {
    const json = buildFlowState();
    const data = buildDataSnapshot();
    publishFlow(deviceLabel(), json, data).then((): void => {
      this.flowNote = `已发送（来自${deviceLabel()}，页面状态 ${json.length} 字节 + 数据 ${Math.round(data.length / 1024)}KB）· 在另一台设备点「接收流转」`;
      store.toast('已发送流转，请在另一台设备点「接收流转」');
    }).catch((e: Error): void => {
      this.flowNote = '发送失败：' + e.message;
    });
  }

  /** 跨设备流转：接收并还原 */
  private pullFlowHere(): void {
    pullFlow().then((h: FlowHandoff): void => {
      if (!h.found || h.json === '') {
        this.flowNote = '中转里还没有流转记录：请先在另一台设备点「发送流转」';
        return;
      }
      const ok = applyFlowState(h.json);
      const items = h.data === '' ? 0 : applyDataSnapshot(h.data);
      markSyncedRev(h.rev);
      this.flowNote = ok
        ? (items >= 0 ? `已接续来自「${h.from}」的进度 · 同步 ${items} 件物品数据` : `已接续来自「${h.from}」的进度`)
        : '快照版本不一致，已忽略';
    }).catch((e: Error): void => {
      this.flowNote = '接收失败：' + e.message;
    });
  }

  /** 设置页头：标题 / 副标题（宽窄屏共用，间距沿用外层 20vp） */
  @Builder
  SettingsHead() {
    Text('设置').fontSize(28).fontWeight(800).fontColor(T.c('text-primary'))
    Text('账号 · 家庭 · 隐私与提醒').fontSize(14).fontColor(T.c('text-muted'))
  }

  /** 分组 A：账号 / 家庭空间 / 云端同步 / 隐私与数据（宽屏落在左列） */
  @Builder
  SettingsSlotA() {
        // 账号
        Row({ space: 16 }) {
          Column() {
            Text(store.userInitial).fontSize(18).fontWeight(700).fontColor(T.c('on-primary'))
          }
          .width(48)
          .height(48)
          .borderRadius(999)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(T.c('primary'))

          Column({ space: 2 }) {
            Text(store.userName).fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text(`${store.userRole} · ${store.family.name} · ${store.family.memberCount} 位成员`)
              .fontSize(13).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          TBtn({ label: '退出登录', icon: 'logout', kind: 'ghost', small: true, tap: (): void => {
            store.loggedIn = false;
            store.tabIndex = 0;
            store.libId = '';
          } })
        }
        .width('100%')
        .padding(24)
        .borderRadius(R_L)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .alignItems(VerticalAlign.Center)

        // 家庭空间（手机端顶栏无家庭菜单，这里提供切换）
        Row({ space: 16 }) {
          Column({ space: 2 }) {
            Text('家庭空间').fontSize(14).fontWeight(600).fontColor(T.c('text-primary'))
            Text(`当前：${store.family.name} · ${store.family.memberCount} 位成员`)
              .fontSize(12).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          TBtn({ label: '切换', icon: 'shuffle', kind: 'ghost', small: true, tap: (): void => {
            const other = store.families.filter((f: Family): boolean => f.id !== store.family.id);
            if (other.length > 0) {
              store.family = other[0];
              store.toast(`已切换到${other[0].name}`);
            }
          } })
        }
        .width('100%')
        .padding(24)
        .borderRadius(R_L)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .alignItems(VerticalAlign.Center)

        // 云端同步（M2：本地优先 + 云端快照备份 + 版本冲突提示 F9.10）
        Card() {
          Column({ space: 12 }) {
            Text('云端同步').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).margin({ bottom: 4 })
            Text('数据本地优先，可备份到电脑后端（MySQL）。上传时检测版本冲突：云端更新则提示，不静默覆盖。')
              .fontSize(12).fontColor(T.c('text-muted'))
            Row({ space: 12 }) {
              TBtn({ label: '上传到云端', icon: 'upload', kind: 'primary', small: true, busyKey: 'sync:up',
                tap: (): void => this.syncUp() })
              TBtn({ label: '从云端拉取', icon: 'download', kind: 'ghost', small: true, busyKey: 'sync:down',
                tap: (): void => this.syncDown() })
            }

            if (this.syncNote === 'conflict') {
              Column({ space: 12 }) {
                Row({ space: 8 }) {
                  Ico({ name: 'alert', dim: 14, color: T.c('warning') })
                  Text('发现同步冲突').fontSize(13).fontWeight(700).fontColor(T.c('warning'))
                }
                Text(this.syncDetail).fontSize(12).fontColor(T.c('text-secondary'))
                Text('选择以哪一份为准：覆盖会把本机数据写回云端并丢弃云端新改动；拉取会丢弃本机改动。')
                  .fontSize(12).fontColor(T.c('text-muted'))
                Row({ space: 12 }) {
                  TBtn({ label: '覆盖上传（以本机为准）', kind: 'primary', small: true, busyKey: 'sync:up',
                    tap: (): void => this.syncForce() })
                  TBtn({ label: '拉取云端', icon: 'download', kind: 'ghost', small: true, busyKey: 'sync:down',
                    tap: (): void => this.syncDown() })
                }
              }
              .width('100%')
              .padding(14)
              .borderRadius(R_M)
              .backgroundColor(T.c('tone-amber-bg'))
              .border({ width: 1, color: T.tone('amber')[0] })
              .alignItems(HorizontalAlign.Start)
            } else if (this.syncNote === 'err') {
              Text(this.syncDetail).fontSize(12).fontColor(T.c('danger'))
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        // 隐私与数据
        Card() {
          Column({ space: 8 }) {
            Text('隐私与数据').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).margin({ bottom: 8 })
            SwitchRow({
              title: '新物品默认仅自己可见',
              desc: '共享库与协作中不展示私有物品（F2.5）',
              on: store.settings['private'],
              tap: (): void => this.toggleSetting('private')
            })
              SwitchRow({
                title: '聊天记录仅存本地',
                desc: '聊天记录落本机存储，不上云（F9.11）',
                on: store.settings['chat'],
                tap: (): void => this.toggleSetting('chat')
              })
              SwitchRow({
                title: 'AI 对话随设备同步',
                desc: '自由流转：这边问 AI，另一台设备原样出现同一问答，并能接着问；关闭则跨端不同步（仅存本机）',
                on: store.settings['syncChat'],
                tap: (): void => this.toggleSetting('syncChat')
              })
            }
          }

  }

  /** 分组 B：AI 助手偏好 / 库存知识图谱 / AI 用量 / 提醒（宽屏落在右列） */
  @Builder
  SettingsSlotB() {
          // AI 助手偏好（M2.5 P0-4：仅本地、AI 只读，用户手填=显式确认）
          Card() {
          Column({ space: 10 }) {
            Text('AI 助手偏好').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text('仅存本机、不上云；只在菜谱 / 营养类问答中提供给 AI 参考（F5.4 同口径）')
              .fontSize(12).fontColor(T.c('text-muted'))
            Field({
              label: '家庭用餐人数', text: String(store.profile.people), placeholder: '4', num: true,
              change: (v: string): void => {
                const n = parseInt(v, 10);
                store.profile.people = isNaN(n) || n <= 0 ? 1 : n;
              }
            })
            Field({
              label: '忌口 / 过敏', text: store.profile.dislike, placeholder: '如：不吃香菜、花生过敏',
              change: (v: string): void => {
                store.profile.dislike = v;
              }
            })
            Row({ space: 8 }) {
              Text('饮食目标').fontSize(13).fontColor(T.c('text-secondary'))
              ForEach(['均衡', '控糖', '减脂', '高蛋白'], (g: string) => {
                Chip({ text: g, active: store.profile.goal === g, tap: (): void => {
                  store.profile.goal = g;
                } })
              }, (g: string) => g)
            }
            SwitchRow({
              title: '把偏好提供给 AI',
              desc: '关闭后菜谱 / 营养类回答不再参考以上偏好',
              on: store.profile.inject,
              tap: (): void => {
                store.profile.inject = !store.profile.inject;
              }
            })
            Row({ space: 12 }) {
              TBtn({ label: '保存偏好', icon: 'check', kind: 'primary', small: true, tap: (): void => {
                saveProfile();
                store.toast('AI 偏好已保存（仅本机）');
              } })
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        // 跨设备流转（演示 / 兜底通道：模拟器与跨网段用）
        Card() {
          Column({ space: 12 }) {
            CardHead({ title: '跨设备流转', sub: '手机 / 平板之间接着做' })
            Text('登录后即开启多端活同步：任一台设备改了库存/清单/设置，另一台 2 秒内自动跟上；' +
              '下面的按钮用于把"当前页面 + 本机数据"整包送过去继续。' +
              '同步内容：库与物品、方案、临期预警、采购清单、' +
              '操作日志、提醒与外观设置、AI 偏好、每日待办。' +
              '真机同账号同网时由系统「应用接续」自动完成，这里不用管；模拟器之间没有 dsoftbus，' +
              '可以走本地中转服务（backend/flow-bridge.js）演示，两端用的是同一份快照。' +
              '按既定隐私策略，聊天正文与图片二进制不随流转同步。')
              .fontSize(12).fontColor(T.c('text-muted'))
            Row({ space: 12 }) {
              TBtn({ label: '发送流转', icon: 'upload', kind: 'primary', small: true,
                tap: (): void => this.sendFlow() })
              TBtn({ label: '接收流转', icon: 'download', kind: 'ghost', small: true,
                tap: (): void => this.pullFlowHere() })
            }
            if (this.flowNote !== '') {
              Text(this.flowNote).fontSize(12).fontColor(T.c('text-secondary'))
            }
            if (store.lastSyncNote !== '') {
              Text(`自动同步状态：${store.lastSyncNote}`).fontSize(12).fontColor(T.c('text-muted'))
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        // AI 用量（M-10：路由分布 / 平均耗时 / 快答占比；端内与管理员端共用 /api/ai/usage）
        // 库存知识图谱（补充方案 G1：端侧确定性构图，0 次模型调用）
        Card() {
          Column({ space: 8 }) {
            Text('库存知识图谱').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text('把你的库构成"实例 + 概念"图谱，用于多跳检索与来源追溯；仅本机构建，不上云')
              .fontSize(12).fontColor(T.c('text-muted'))
            Row({ space: 16 }) {
              Column({ space: 4 }) {
                Text(this.graphSize).fontSize(14).fontWeight(700).fontColor(T.c('text-primary'))
                Text('当前规模').fontSize(11).fontColor(T.c('text-muted'))
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              Column({ space: 4 }) {
                Text(this.graphVersion === '' ? '—' : this.graphVersion)
                  .fontSize(14).fontWeight(700).fontColor(T.c('accent'))
                Text('图谱版本').fontSize(11).fontColor(T.c('text-muted'))
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
            }
            .width('100%')
            .padding({ top: 4, bottom: 4 })
            if (this.graphNote !== '') {
              Text(this.graphNote).fontSize(12).fontColor(T.c('text-secondary'))
            }
            Row({ space: 12 }) {
              TBtn({ label: '重建图谱', icon: 'refresh', kind: 'ghost', small: true, busyKey: 'graph:rebuild',
                tap: (): void => this.rebuild() })
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        Card() {
          Column({ space: 10 }) {
            Text('AI 用量').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text('问候 / 查询 / 位置 / 保质期走本地快答（0 次模型），其余经后端网关；快答占比 = 省下的模型调用')
              .fontSize(12).fontColor(T.c('text-muted'))

            Row({ space: 12 }) {
              Column({ space: 4 }) {
                Text(`${this.localFastShare()}%`).fontSize(20).fontWeight(800).fontColor(T.c('primary-ink'))
                Text('快答占比（本机）').fontSize(11).fontColor(T.c('text-muted'))
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              Column({ space: 4 }) {
                Text(`${store.aiUsage.length}`).fontSize(20).fontWeight(800).fontColor(T.c('text-primary'))
                Text('最近记录数（上限 30）').fontSize(11).fontColor(T.c('text-muted'))
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
            }
            .width('100%')
            .padding({ top: 4, bottom: 4 })

            if (store.aiUsage.length === 0) {
              Text('还没有 AI 调用记录').fontSize(13).fontColor(T.c('text-muted')).padding(8)
            } else {
              Text('路由分布（本机）').fontSize(12).fontWeight(700).fontColor(T.c('text-secondary'))
              ForEach(this.localRouteRows(), (r: UsageRow, i: number) => {
                Row({ space: 12 }) {
                  Text(r.route).fontSize(13).fontWeight(700).fontColor(T.c('text-primary')).width(88)
                  Text(r.model).fontSize(13).fontColor(T.c('text-secondary')).layoutWeight(1)
                  Text(`${r.calls} 次`).fontSize(12).fontColor(T.c('text-muted')).width(48)
                  Text(r.avgMs === 0 ? '直答' : `${r.avgMs} ms`).fontSize(12).fontColor(T.c('text-muted')).width(64)
                }
                .width('100%')
                .padding({ top: 6, bottom: 6 })
                .border({ width: 1, color: T.c('border') })
                .borderRadius(R_S)
              }, (r: UsageRow, i: number) => `${i}-${r.route}-${r.model}`)
            }

            Row({ space: 12 }) {
              TBtn({ label: '同步后端用量', icon: 'download', kind: 'ghost', small: true, busyKey: 'ai:usage',
                tap: (): void => this.pullGatewayUsage() })
            }
            if (this.gwNote !== '') {
              Column({ space: 6 }) {
                Text(this.gwNote).fontSize(12).fontColor(T.c('text-secondary'))
                if (this.gwFresh && this.gwUsage.byRoute.length > 0) {
                  ForEach(this.gwUsage.byRoute.slice(0, 5), (r: UsageRow, i: number) => {
                    Row({ space: 10 }) {
                      Text(r.route).fontSize(12).fontWeight(700).fontColor(T.c('text-primary')).width(80)
                      Text(r.model).fontSize(12).fontColor(T.c('text-secondary')).layoutWeight(1)
                      Text(`${r.calls} 次`).fontSize(12).fontColor(T.c('text-muted')).width(48)
                      Text(r.source === 'local' ? '快答' : `${r.avgMs} ms`)
                        .fontSize(12).fontColor(T.c('text-muted')).width(64)
                    }
                    .width('100%')
                  }, (r: UsageRow, i: number) => `gw-${i}-${r.route}-${r.model}`)
                }
              }
              .width('100%')
              .padding(10)
              .borderRadius(R_S)
              .backgroundColor(T.c('surface-overlay'))
              .alignItems(HorizontalAlign.Start)
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        // 提醒
        Card() {
          Column({ space: 8 }) {
            Text('提醒').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).margin({ bottom: 8 })
            SwitchRow({
              title: '临期预警推送',
              desc: '食材提前 3 / 7 天提醒（F8.1）',
              on: store.settings['expiry'],
              tap: (): void => this.toggleSetting('expiry')
            })
            SwitchRow({
              title: '每日早晚智能摘要',
              desc: '优先事项与临期清单（F8.2）',
              on: store.settings['digest'],
              tap: (): void => this.toggleSetting('digest')
            })
            SwitchRow({
              title: '低库存补货提醒',
              desc: '低于阈值自动提醒（F8.3）',
              on: store.settings['low'],
              tap: (): void => this.toggleSetting('low')
            })
              SwitchRow({
                title: 'AI 回复语音播报',
                desc: '用系统 TTS 朗读 AI 回复（≤120 字；无语音引擎时自动降级为纯文字，M-9）',
                on: store.settings['tts'],
                tap: (): void => this.toggleSetting('tts')
              })
            }
          }

  }

  /** 分组 C：外观 / 操作日志 / 演示数据（宽屏落在左列下半） */
  @Builder
  SettingsSlotC() {
          // 外观
          Card() {
          Column({ space: 8 }) {
            Text('外观').fontSize(17).fontWeight(700).fontColor(T.c('text-primary')).margin({ bottom: 8 })
            Text(`主题色板（默认：启核绿青蓝，取自官方徽标）· 当前 ${T.themeLabel()}`)
              .fontSize(12).fontColor(T.c('text-muted'))
            Row({ space: 8 }) {
              Chip({
                text: '启核绿青蓝', active: T.palette === 'nexcore',
                tap: (): void => {
                  T.setPalette('nexcore');
                  saveThemePrefs();
                  store.toast('已切换主题色板：启核绿青蓝');
                }
              })
              Chip({
                text: '经典橙', active: T.palette === 'classic',
                tap: (): void => {
                  T.setPalette('classic');
                  saveThemePrefs();
                  store.toast('已切换主题色板：经典橙');
                }
              })
            }
            SwitchRow({
              title: '深色模式',
              desc: '默认浅色（冷白底 + 启核绿主色），可手动切换深色',
              on: T.dark,
              tap: (): void => {
                T.setDark(!T.dark);
                saveThemePrefs();
              }
            })
            Row({ space: 12 }) {
              TBtn({ label: '恢复品牌默认主题', icon: 'refresh', kind: 'ghost', small: true, tap: (): void => {
                T.resetDefault();
                saveThemePrefs();
                store.toast('已恢复默认主题：启核绿青蓝 · 深色');
              } })
            }
          }
        }

        // 操作日志
        Card() {
          Column({ space: 12 }) {
            Text('操作日志（伪实现后端）').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text('所有写操作都经过模拟 API，落库并留痕').fontSize(13).fontColor(T.c('text-muted'))
            if (store.logs.length === 0) {
              Text('还没有操作记录，去拍一张照试试')
                .fontSize(13).fontColor(T.c('text-muted'))
                .padding(16).width('100%').textAlign(TextAlign.Center)
            } else {
              Column() {
                ForEach(store.logs, (l: LogRow2, i: number) => {
                  Row({ space: 12 }) {
                    Text(l.action).fontSize(13).fontWeight(700).fontColor(T.c('text-primary')).width(80)
                    Text(l.detail).fontSize(13).fontColor(T.c('text-secondary')).layoutWeight(1)
                    NumText({ value: l.at, dim: 12, color: T.c('text-muted') })
                  }
                  .width('100%')
                  .padding({ top: 8, bottom: 8 })
                  .border({ width: i < store.logs.length - 1 ? { bottom: 1 } : { bottom: 0 }, color: T.c('border') })
                }, (l: LogRow2, i: number) => `${i}-${l.detail}`)
              }
              .width('100%')
            }
          }
          .alignItems(HorizontalAlign.Start)
        }

        // 演示数据
        Row({ space: 16 }) {
          Column({ space: 2 }) {
            Text('演示数据').fontSize(17).fontWeight(700).fontColor(T.c('text-primary'))
            Text('本地模拟数据库，可一键重置').fontSize(13).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)

          TBtn({ label: '重置演示数据', kind: 'ghost', busyKey: 'reset', tap: (): void => {
            runBusy('reset', (): Promise<void> => {
              store.reset();
              return Promise.resolve();
            }, (): void => {
              store.toast('演示数据已重置');
            });
          } })
          }
          .width('100%')
          .padding(24)
          .borderRadius(R_L)
          .backgroundColor(T.c('surface-raised'))
          .border({ width: 1, color: T.c('border') })
          .alignItems(VerticalAlign.Center)
  }

  build() {
    Scroll() {
      Column({ space: 20 }) {
        this.SettingsHead()

        if (store.isWide) {
          /* 平板 / 2in1：左右两列铺满横向空间
             （此前整页被 760vp 上限锁死，右半屏长期空白） */
          Row({ space: 20 }) {
            Column({ space: 20 }) {
              this.SettingsSlotA()
              this.SettingsSlotC()
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)

            Column({ space: 20 }) {
              this.SettingsSlotB()
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
          }
          .width('100%')
          .alignItems(VerticalAlign.Top)
        } else {
          /* 手机：保持原来的单列顺序 A → B → C 不变 */
          this.SettingsSlotA()
          this.SettingsSlotB()
          this.SettingsSlotC()
        }
      }
      // 显式宽度 + 左边距：靠内边距留白时 ArkUI 会吃掉右侧，内容顶到屏幕右沿
      .width(pageContentWidth())
      .margin({ left: pageInset() })
      .padding({ top: 16, bottom: 96 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .align(Alignment.TopStart)
    .scrollBar(BarState.Off)
  }

  private toggleSetting(key: string): void {
    const next = !store.settings[key];
    runBusy('setting', (): Promise<void> => setSetting(key, next), (): void => {
      store.toast(next ? '已开启' : '已关闭');
    });
  }
}

class LogRow2 {
  action: string = '';
  detail: string = '';
  at: string = '';
}
