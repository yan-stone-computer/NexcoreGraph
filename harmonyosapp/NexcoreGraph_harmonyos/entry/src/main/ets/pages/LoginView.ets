/* 启核图策 · 登录页
   真实流程：手机号 → 向后端索取验证码 → 后端校验 → 登录并拉回该账号的云端数据。
   端侧没有固定验证码、没有"一键进入演示"入口；后端未接短信通道时，验证码只打在服务端日志里。
   三档布局（Breakpoints）：手表=极简入口；手机=单列；平板/2in1=左右分栏（左侧放大徽标）。 */

import { store } from '../common/Store';
import { T, R_L, R_XL, DUR_SLOW } from '../common/Tokens';
import { Ico, TBtn, Field } from '../components/Widgets';
import { requestLoginCode, loginByCode } from '../common/Api';
import { startLiveSync } from '../common/LiveSync';
import { currentBase, resolveBase, currentServerMode } from '../common/Backend';

@ComponentV2
export struct LoginView {
  @Local phone: string = '';
  @Local code: string = '';
  @Local err: string = '';
  @Local hint: string = '';
  @Local sending: boolean = false;
  @Local cooldown: number = 0;
  @Local serverText: string = '正在探测本机后端…';
  private cdTimer: number = -1;

  aboutToAppear(): void {
    // 标明连接目标：登录走的是你自己电脑上的局域网服务器，不是云端
    const now: string = currentBase();
    if (now !== '') {
      this.serverText = '已连接 ' + now;
      return;
    }
    resolveBase().then((base: string): void => {
      this.serverText = '已连接 ' + base +
        (currentServerMode() === 'lan-self-hosted' ? '（局域网自建服务器）' : '');
    }).catch((): void => {
      this.serverText = '未找到本机后端：请先在电脑上启动 backend（同一 WiFi，地址可在「我的 → 服务器连接」修改）';
    });
  }

  aboutToDisappear(): void {
    if (this.cdTimer !== -1) {
      clearInterval(this.cdTimer);
      this.cdTimer = -1;
    }
  }

  private phoneOk(): boolean {
    // 手机号或邮箱都可以当登录名
    return /^1\d{10}$/.test(this.phone) || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(this.phone);
  }

  /** 向后端索取验证码（60 秒内不允许重复索取） */
  private sendCode(): void {
    if (this.sending) {
      return;
    }
    if (!this.phoneOk()) {
      this.err = '请输入手机号或邮箱';
      return;
    }
    this.err = '';
    this.hint = '';
    this.sending = true;
    requestLoginCode(this.phone).then((msg: string): void => {
      this.sending = false;
      this.hint = msg;
      this.cooldown = 60;
      if (this.cdTimer !== -1) {
        clearInterval(this.cdTimer);
      }
      this.cdTimer = setInterval((): void => {
        this.cooldown = this.cooldown - 1;
        if (this.cooldown <= 0 && this.cdTimer !== -1) {
          clearInterval(this.cdTimer);
          this.cdTimer = -1;
        }
      }, 1000);
    }).catch((e: Error): void => {
      this.sending = false;
      this.err = e !== undefined && e.message !== undefined && e.message !== '' ? e.message : '验证码下发失败';
    });
  }

  private submit(): void {
    if (!this.phoneOk()) {
      this.err = '请输入手机号或邮箱';
      return;
    }
    if (this.code.length !== 6) {
      this.err = '请输入 6 位验证码';
      return;
    }
    this.err = '';
    loginByCode(this.phone, this.code).then((msg: string): void => {
      store.toast(msg);
      startLiveSync();     // 登录成功即开始多端同步与自动保存
    }).catch((e: Error): void => {
      this.err = e !== undefined && e.message !== undefined && e.message !== '' ? e.message : '登录失败，请重试';
    });
  }

  /** 品牌标识（平板左侧放大 / 手机居中） */
  @Builder
  Brand(size: number, centered: boolean) {
    Column({ space: centered ? 10 : 14 }) {
      Image($r('app.media.logo'))
        .width(size)
        .height(size)
        .objectFit(ImageFit.Contain)
      Column({ space: 6 }) {
        Text('启核图策').fontSize(size >= 120 ? 34 : 28).fontWeight(FontWeight.Bold)
          .fontColor(T.c('text-primary'))
        Text('NexcoreGraph')
          .fontSize(12).fontWeight(600).fontColor(T.c('text-secondary')).letterSpacing(2)
        Text('家里的东西，AI 帮你想 · 拍照建库 / 智能规划 / 家庭协作')
          .fontSize(13).fontColor(T.c('text-muted'))
          .textAlign(centered ? TextAlign.Center : TextAlign.Start)
      }
      .alignItems(centered ? HorizontalAlign.Center : HorizontalAlign.Start)
    }
    .alignItems(centered ? HorizontalAlign.Center : HorizontalAlign.Start)
  }

  /** 登录表单卡（平板右侧 / 手机中部复用） */
  @Builder
  LoginCard() {
    Column({ space: 14 }) {
      Field({ label: '手机号 / 邮箱', text: this.phone, placeholder: '手机号或邮箱，如 you@163.com',
        change: (v: string): void => {
          this.phone = v;
        } })
      Row({ space: 10 }) {
        Column() {
          Field({ label: '验证码', text: this.code, placeholder: '6 位验证码',
            change: (v: string): void => {
              this.code = v;
            } })
        }
        .layoutWeight(1)
        TBtn({
          label: this.sending ? '发送中…' : (this.cooldown > 0 ? `${this.cooldown}s 后重发` : '获取验证码'),
          kind: 'ghost',
          small: true,
          tap: (): void => {
            if (this.cooldown <= 0) {
              this.sendCode();
            }
          }
        })
      }
      .width('100%')
      if (this.hint !== '') {
        Text(this.hint).fontSize(12).fontColor(T.c('text-secondary'))
      }
      if (this.err !== '') {
        Text(this.err).fontSize(12).fontColor(T.c('danger'))
      }
      TBtn({ label: '登录', kind: 'primary', tap: (): void => this.submit() })
        .width('100%')
      Text('登录后你的库存、方案与 AI 对话会存在你自己的账号里，换设备登录即可继续')
        .fontSize(12).fontColor(T.c('text-muted'))
      // 标明部署形态：局域网自建服务器（数据不出局域网，不涉及公网与备案）
      Text(this.serverText)
        .fontSize(11).fontColor(T.c('text-muted'))
    }
    .padding(24)
    .borderRadius(R_XL)
    .backgroundColor(T.c('surface-raised'))
    .border({ width: 1, color: T.c('border') })
    .alignItems(HorizontalAlign.Start)
  }

  /** 手表档：方屏只有一个可达入口 */
  @Builder
  CompactLogin() {
    Column({ space: 10 }) {
      Image($r('app.media.logo')).width(56).height(56).objectFit(ImageFit.Contain)
      Text('启核图策').fontSize(15).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
      Text('手表端只做提醒，库存录入请在手机或平板上完成')
        .fontSize(11).fontColor(T.c('text-muted')).textAlign(TextAlign.Center)
    }
    .width('100%')
    .height('100%')
    .padding(10)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(T.c('surface'))
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      if (store.isCompact) {
        this.CompactLogin()
      } else if (store.isWide) {
        /* 平板 / 2in1：左右分栏，左侧放大徽标 */
        Row() {
          Column() {
            this.Brand(160, false)
          }
          .layoutWeight(5)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .backgroundColor(T.c('surface-overlay'))
          .border({ width: { right: 1 }, color: T.c('border') })
          .linearGradient({
            angle: 135,
            colors: [
              ['rgba(140,211,91,0.16)', 0],
              ['rgba(61,208,174,0.12)', 0.5],
              ['rgba(39,173,215,0.10)', 1]
            ]
          })

          Column() {
            Scroll() {
              Column({ space: 18 }) {
                Text('登录').fontSize(22).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
                this.LoginCard()
              }
              .width(420)
              .alignItems(HorizontalAlign.Start)
              .padding({ left: 24, right: 24, top: 40, bottom: 120 })
            }
            .scrollBar(BarState.Off)
            .align(Alignment.Center)
          }
          .layoutWeight(6)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .backgroundColor(T.c('surface'))
        }
        .width('100%')
        .height('100%')
      } else {
        /* 手机：单列居中；必须可滚动 —— 输入验证码时软键盘会顶起半屏，
           不可滚动时"登录"按钮会被键盘盖住（实测截图里整个按钮不可见）。 */
        Scroll() {
          Column({ space: 20 }) {
            this.Brand(88, true)
            this.LoginCard()
          }
          .width('100%')
          .padding({ left: 28, right: 28, top: 40, bottom: 120 })
          .alignItems(HorizontalAlign.Center)
          .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 16 }))
            .animation({ duration: DUR_SLOW, curve: Curve.EaseOut }))
        }
        .width('100%')
        .height('100%')
        .scrollBar(BarState.Off)
        .align(Alignment.Center)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(T.c('surface'))
  }
}
