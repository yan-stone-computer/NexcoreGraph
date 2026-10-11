/* 启核图策 · AI 对话面板（标准 IM 版式：头像+气泡、时间在气泡外、方案卡片独立成卡）
   ponytail: 语音输入未接 ASR（P1），接 CoreSpeechKit 时替换 mic 按钮 handler。 */

import { store, stampLabel } from '../common/Store';
import { T, R_M, R_L } from '../common/Tokens';
import { Ico, TBtn, IconBtn, PlanCard } from '../components/Widgets';
import { ChatMsg, Plan } from '../common/Db';
import { chatReply, generatePlans, setItemQtyByName, addAIPlan, addShoppingByAI } from '../common/Api';
import { askAI } from '../common/AiGateway';
import { saveChat, clearChatSaved } from '../common/LocalStore';
import { scheduleLivePublish } from '../common/LiveSync';
import { AsrSession } from '../common/Asr';
import { TtsSession } from '../common/Tts';
import { common } from '@kit.AbilityKit';
import { pasteboard } from '@kit.BasicServicesKit';

@ComponentV2
export struct AiPanel {
  @Local input: string = '';
  @Local listening: boolean = false;
  private asr: AsrSession = new AsrSession();
  private tts: TtsSession = new TtsSession();
  private scroller: Scroller = new Scroller();
  /** 是否显示"回到顶部"（往回翻历史时才出现） */
  @Local showTop: boolean = false;

  /** 造一条对话消息：时间标签一律由时间戳算出（不再写死"刚刚"） */
  private mkMsg(who: string, text: string, plans: number[]): ChatMsg {
    const ts: number = Date.now();
    const m = new ChatMsg(who, text, stampLabel(ts, ''), plans);
    m.ts = ts;
    return m;
  }
  /** 滚动位置跟踪：离顶超过一屏的 1/3 就显示回到顶部 */
  private trackScroll(): void {
    let off: number = 0;
    try {
      off = this.scroller.currentOffset().yOffset;
    } catch (_e) {
      off = 0;
    }
    this.showTop = off > 160;
  }

  aboutToDisappear(): void {
    this.tts.release();
  }

  aboutToAppear(): void {
    // 工作台 / 图谱面板注入的预填提问：打开对话即带入输入框（避免用户复述上下文）
    if (store.aiPrefill !== '') {
      this.input = store.aiPrefill;
      store.aiPrefill = '';
    }
    // 打开就把视角落到最新一条：对话是"往下长"的，停在顶部会看不到刚回复的内容。
    // 面板刚挂载时高度还没量好，所以延迟稍大一点再滚。
    this.scrollToBottom();
    setTimeout((): void => {
      this.scroller.scrollEdge(Edge.Bottom);
    }, 260);
  }

  /** M-8 来源引用：点击复制知识库来源链接（不依赖外部浏览器权限） */
  private copySource(url: string): void {
    try {
      const data = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, url);
      pasteboard.getSystemPasteboard().setData(data);
      store.toast('来源链接已复制');
    } catch (_e) {
      store.toast('来源：' + url);
    }
  }

  private toggleVoice(): void {
    if (this.listening) {
      this.asr.stop();
      this.listening = false;
      return;
    }
    const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.listening = true;
    store.toast('正在聆听，请说话…');
    this.asr.start(ctx, (text: string, _isFinal: boolean): void => {
      this.input = text;
    }, (msg: string): void => {
      this.listening = false;
      store.toast('语音识别失败：' + msg);
    });
  }

  private send(): void {
    const v = this.input.trim();
    if (v === '' || store.chatTyping) {
      return;
    }
    this.input = '';
      const mine = this.mkMsg('me', v, []);
      store.chat = store.chat.concat([mine]);
      store.chatTyping = true;
      // 自由流转：这边刚问出去的问题要立刻同步到另一台设备
      scheduleLivePublish();
      this.scrollToBottom();
    askAI(v).then((reply): void => {
      store.chatTyping = false;
      const replyMsg = this.mkMsg('ai', reply.text, []);
      replyMsg.adjName = reply.adjName;
      replyMsg.adjQty = reply.adjQty;
      replyMsg.shopName = reply.shopName;
      replyMsg.shopQty = reply.shopQty;
      replyMsg.srcNote = reply.srcNote;
      replyMsg.srcUrl = reply.srcUrl;
        store.chat = store.chat.concat([replyMsg]);
        scheduleLivePublish();
        // 创新菜谱 [菜] 行 → 回查库存落方案卡（M2.5 P0-3）
      if (reply.dishTitle !== '') {
        addAIPlan(reply.dishTitle, reply.dishTime, reply.dishNote, reply.dishIngredients).then((pid: number): void => {
          replyMsg.plans = [pid];
          store.chat = store.chat.slice();
          this.scrollToBottom();
        });
      }
      saveChat();
      // M-9：开启播报后，AI 回复自动朗读（≤120 字，无引擎时静默降级）
      if (store.settings['tts']) {
        this.tts.speak(reply.text);
      }
      this.scrollToBottom();
    }).catch((_e: Error): void => {
      // 断网兜底：用本地事实层回答（只复述用户库里真实存在的数据，不编造）
      chatReply(v).then((reply): void => {
        store.chatTyping = false;
          const replyMsg = this.mkMsg('ai', reply.text, reply.plans);
          store.chat = store.chat.concat([replyMsg]);
          scheduleLivePublish();
          store.toast('连不上模型服务，已用本地库存事实回答');
        this.scrollToBottom();
      }).catch((): void => {
        store.chatTyping = false;
        store.toast('AI 暂时不可用，请检查后端服务后重试');
      });
    });
  }

  private scrollToBottom(): void {
    setTimeout((): void => {
      this.scroller.scrollEdge(Edge.Bottom);
    }, 60);
  }

  build() {
    Column() {
      // 头部：品牌 + 主操作
      Row({ space: 10 }) {
        Image($r('app.media.logo'))
          .width(34).height(34).borderRadius(10).objectFit(ImageFit.Cover)
        Column({ space: 1 }) {
          Text('AI 助手').fontSize(16).fontWeight(800).fontColor(T.c('text-primary'))
          if (store.isWide) {
            Text('基于你的实时库存回答').fontSize(11).fontColor(T.c('text-muted'))
          }
        }
        .alignItems(HorizontalAlign.Start)

        Blank()

        TBtn({ label: '生成方案', icon: 'sparkles', kind: 'primary', small: true, busyKey: 'plans',
          tap: (): void => {
            generatePlans().then((plans: Plan[]): void => {
              const msg = this.mkMsg('ai', `按当前库存重新生成了 ${plans.length} 个方案，优先消耗临期食材：`,
                plans.map((p: Plan): number => p.id));
              store.chat = store.chat.concat([msg]);
              store.toast(`已生成 ${plans.length} 个新方案`);
              this.scrollToBottom();
            });
          } })

        if (store.isWide) {
          // 停靠模式没有系统关闭键
          IconBtn({ icon: 'x', dim: 17, tap: (): void => {
            store.aiOpen = false;
          } })
            .width(34).height(34)
        }
      }
      .width('100%')
      .padding({ left: 16, right: store.isWide ? 16 : 88, top: 12, bottom: 12 })
      .border({ width: { bottom: 1 }, color: T.c('border') })
      .alignItems(VerticalAlign.Center)

      // 消息列表
      // 外面套一层 Stack：用来放"回到顶部"悬浮按钮
      Stack({ alignContent: Alignment.TopEnd }) {
      Scroll(this.scroller) {
        Column({ space: 20 }) {
          if (this.listening) {
            Row({ space: 8 }) {
              Ico({ name: 'mic', dim: 14, color: T.c('danger') })
              Text('正在聆听…').fontSize(12).fontWeight(600).fontColor(T.c('danger'))
            }
            .padding({ left: 14, right: 14, top: 8, bottom: 8 })
            .borderRadius(999)
            .backgroundColor(T.c('danger-container'))
          }
          if (store.chat.length === 0 && !store.chatTyping) {
            Column({ space: 12 }) {
              Image($r('app.media.logo'))
                .width(56).height(56).borderRadius(14).objectFit(ImageFit.Cover)
              Text('天枢小助手已就绪').fontSize(15).fontWeight(700).fontColor(T.c('text-primary'))
              Text('试试问我：今晚能做什么菜？牛奶还能放几天？')
                .fontSize(12).fontColor(T.c('text-muted')).textAlign(TextAlign.Center)
            }
            .width('100%')
            .padding({ top: 80 })
            .alignItems(HorizontalAlign.Center)
          }
          ForEach(store.chat, (m: ChatMsg, i: number) => {
            this.MsgGroup(m)
          }, (m: ChatMsg, i: number) => `${i}-${m.plans.length}`)

          if (store.chatTyping) {
            Row({ space: 10 }) {
              this.AiAvatar()
              Row({ space: 8 }) {
                Ico({ name: 'fridge', dim: 14, color: T.c('primary-ink') })
                Text('正在翻冰箱找食材').fontSize(12).fontWeight(600).fontColor(T.c('text-muted'))
                TypingDots()
              }
              .padding({ left: 14, right: 14, top: 12, bottom: 12 })
              .borderRadius({ topLeft: 4, topRight: 16, bottomLeft: 16, bottomRight: 16 })
              .backgroundColor(T.c('surface-overlay'))
            }
            .width('100%')
            .alignItems(VerticalAlign.Top)
          }
        }
        .width('100%')
        .padding(16)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height('100%')
      .align(Alignment.TopStart)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
      .onDidScroll((): void => this.trackScroll())

        // 往回翻看历史时才出现（在最顶部时不挡视线）
        if (this.showTop) {
          Row({ space: 6 }) {
            Ico({ name: 'arrow-up', dim: 13, color: T.c('primary-ink') })
            Text('回到顶部').fontSize(12).fontWeight(600).fontColor(T.c('primary-ink'))
          }
          .padding({ left: 12, right: 12, top: 7, bottom: 7 })
          .borderRadius(999)
          .backgroundColor(T.c('primary-container'))
          .border({ width: 1, color: T.c('border') })
          .shadow({ radius: 8, color: 'rgba(0,0,0,0.12)', offsetY: 2 })
          .margin({ top: 12, right: 16 })
          .onClick((): void => {
            this.scroller.scrollEdge(Edge.Top);
            this.showTop = false;
          })
        }
      }
      .layoutWeight(1)
      .width('100%')

      // 输入栏：清空对话 + 完整输入框 + 发送
      Row({ space: 8 }) {
        IconBtn({ icon: 'trash', dim: 18, tap: (): void => {
          if (store.chat.length === 0) {
            store.toast('对话已经是空的');
            return;
          }
          store.chat = [];
          store.chatTyping = false;
          clearChatSaved();
          store.toast('对话已清空');
        } })
          .width(36).height(36)

        Row({ space: 2 }) {
          TextInput({ text: this.input, placeholder: '问点什么，比如：牛奶还能放几天？' })
            .layoutWeight(1)
            .height(42)
            .fontSize(14)
            .backgroundColor(Color.Transparent)
            .border({ width: 0 })
            .padding({ left: 8, right: 0 })
            .fontColor(T.c('text-primary'))
            .placeholderColor(T.c('text-muted'))
            .onChange((v: string) => {
              this.input = v;
            })
            .onSubmit(() => this.send())

          IconBtn({ icon: 'camera', dim: 17, tap: (): void => {
            // 直接进入拍照入库（Agnes 视觉识别），与资源库“拍照入库”同一流程
            store.aiOpen = false;
            store.overlay = 'intake';
          } })
            .width(34).height(34)
          IconBtn({ icon: 'mic', dim: 18, tap: (): void => this.toggleVoice() })
            .width(34).height(34)
            .margin({ right: 4 })
        }
        .layoutWeight(1)
        .height(48)
        .padding({ left: 8, right: 4 })
        .borderRadius(24)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })
        .alignItems(VerticalAlign.Center)

        TBtn({ label: '发送', kind: 'primary', tap: (): void => this.send() })
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 10, bottom: 12 })
      .alignItems(VerticalAlign.Center)
      .border({ width: { top: 1 }, color: T.c('border') })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Color.Transparent)
  }

  @Builder
  AiAvatar() {
    // AI 头像使用官方徽标（docs/brand/nexcore-graph-logomark）
    Image($r('app.media.ai_avatar'))
      .width(32)
      .height(32)
      .objectFit(ImageFit.Contain)
      .borderRadius(999)
      .clip(true)
      .backgroundColor(T.c('accent-container'))
  }

  /* 一条消息：气泡 +（AI 附带方案卡）+ 气泡外时间 */
  @Builder
  MsgGroup(m: ChatMsg) {
    Column({ space: 6 }) {
      if (m.who === 'ai') {
        Row({ space: 10 }) {
          this.AiAvatar()
          Column() {
            Text(m.text)
              .fontSize(14)
              .lineHeight(20)
              .fontColor(T.c('text-primary'))
          }
          .padding({ left: 14, right: 14, top: 10, bottom: 10 })
          .constraintSize({ maxWidth: '72%' })
          .borderRadius({ topLeft: 4, topRight: 16, bottomLeft: 16, bottomRight: 16 })
          .backgroundColor(T.c('surface-overlay'))
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .alignItems(VerticalAlign.Top)

        // 方案卡片：独立于气泡，左对齐缩进
        if (m.plans.length > 0) {
          Column({ space: 8 }) {
            ForEach(m.plans, (pid: number, pi: number) => {
              Column() {
                PlanCardById({ pid: pid, ci: pi })
              }
              .width('100%')
            }, (pid: number) => `${pid}`)
          }
          .width('88%')
          .margin({ left: 42 })
        }

        // 自然语言调整：确认后应用（F5.5/F6.2 预览后生效）
        if (m.who === 'ai' && m.adjName !== '' && m.adjQty >= 0 && !m.adjDone) {
          Row({ space: 8 }) {
            TBtn({
              label: `应用调整：${m.adjName} → ${m.adjQty}`, icon: 'check', kind: 'soft', small: true,
              tap: (): void => {
                setItemQtyByName(m.adjName, m.adjQty).then((): void => {
                  m.adjDone = true;
                  store.chat = store.chat.slice();
                  saveChat();
                  store.toast(`已调整「${m.adjName}」数量为 ${m.adjQty}`);
                }).catch((e: Error): void => {
                  store.toast(e.message);
                });
              }
            })
          }
          .width('88%')
          .margin({ left: 42, top: 4 })
        }

        // [购物] 工具行：确认后加入采购清单（M2.5 P0-2 预览后生效）
        if (m.who === 'ai' && m.shopName !== '' && !m.shopDone) {
          Row({ space: 8 }) {
            TBtn({
              label: `加入采购清单：${m.shopName} ${m.shopQty}`, icon: 'cart', kind: 'soft', small: true,
              tap: (): void => {
                addShoppingByAI(m.shopName, m.shopQty).then((): void => {
                  m.shopDone = true;
                  store.chat = store.chat.slice();
                  saveChat();
                  store.toast(`已把「${m.shopName}」加入采购清单`);
                }).catch((e: Error): void => {
                  store.toast(e.message);
                });
              }
            })
          }
          .width('88%')
          .margin({ left: 42, top: 4 })
        }

        // 来源小字（M2.5 P0-1：证据可溯源）
        if (m.srcNote !== '') {
          Row({ space: 6 }) {
            Text(m.srcNote)
              .fontSize(10)
              .fontColor(T.c('text-muted'))
            if (m.srcUrl !== '') {
              Text('来源链接')
                .fontSize(10)
                .fontColor(T.c('accent'))
                .decoration({ type: TextDecorationType.Underline, color: T.c('accent') })
                .onClick((): void => this.copySource(m.srcUrl))
            }
          }
          .margin({ left: 42, top: 2 })
        }

        // 播报（M-9）：仅当设置开启时展示；系统无 TTS 引擎时自动隐藏
        Row({ space: 8 }) {
          // 没有真实时间戳的历史消息不显示时间（宁可空着，也不显示写死的"刚刚"）
          if (m.time !== '') {
            Text(m.time).fontSize(10).fontColor(T.c('text-muted'))
          }
          if (store.settings['tts'] && this.tts.isUsable()) {
            Text('播报')
              .fontSize(10)
              .fontColor(T.c('text-secondary'))
              .onClick((): void => {
                this.tts.speak(m.text);
              })
          }
        }
        .margin({ left: 42 })
      } else {
        Row({ space: 10 }) {
          Blank()
          Column() {
            Text(m.text)
              .fontSize(14)
              .lineHeight(20)
              .fontColor(T.c('on-primary'))
          }
          .padding({ left: 14, right: 14, top: 10, bottom: 10 })
          .constraintSize({ maxWidth: '72%' })
          .borderRadius({ topLeft: 16, topRight: 4, bottomLeft: 16, bottomRight: 16 })
          .backgroundColor(T.c('primary'))
        }
        .width('100%')
        .alignItems(VerticalAlign.Top)

        if (m.time !== '') {
          Text(m.time)
            .fontSize(10)
            .fontColor(T.c('text-muted'))
            .width('100%')
            .textAlign(TextAlign.End)
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/* 按方案 id 找到并渲染 PlanCard */
@ComponentV2
struct PlanCardById {
  @Param pid: number = 0;
  @Param ci: number = 0;

  private plan(): Plan {
    for (let i = 0; i < store.plans.length; i++) {
      if (store.plans[i].id === this.pid) {
        return store.plans[i];
      }
    }
    return new Plan(0, '', '中', '', '', '', [], [], 'pending');
  }

  build() {
    Column() {
      PlanCard({ plan: this.plan(), compact: true })
    }
    .borderRadius(R_M)
    .backgroundColor(T.c('surface'))
    .border({ width: 1, color: T.c('border') })
    .padding({ left: 12, right: 12 })
    .transition(TransitionEffect.asymmetric(
      TransitionEffect.translate({ y: 8 }).combine(TransitionEffect.OPACITY),
      TransitionEffect.OPACITY
    ).animation({ duration: 300, delay: this.ci * 90, curve: Curve.EaseOut }))
  }
}

@ComponentV2
struct TypingDots {
  build() {
    Row({ space: 4 }) {
      Circle({ width: 6, height: 6 }).fill(T.c('text-muted')).opacity(0.4)
      Circle({ width: 6, height: 6 }).fill(T.c('text-muted')).opacity(0.7)
      Circle({ width: 6, height: 6 }).fill(T.c('text-muted')).opacity(1)
    }
  }
}
