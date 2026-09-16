/* 启核图策 · 登录页
   三档布局（Breakpoints）：手表=极简入口；手机=单列；平板/2in1=左右分栏（左侧放大徽标）。
   配色只走令牌：旧版残留的品牌橙辉光已全部替换为徽标绿/青。 */

import { store } from '../common/Store';
import { T, R_L, R_XL, DUR_SLOW } from '../common/Tokens';
import { Ico, TBtn, Field } from '../components/Widgets';

@ComponentV2
export struct LoginView {
  @Local phone: string = '';
  @Local code: string = '';
  @Local err: string = '';

  private submit(): void {
    if (!/^1\d{10}$/.test(this.phone)) {
      this.err = '请输入 11 位手机号';
      return;
    }
    if (this.code !== '123456') {
      this.err = '验证码错误（演示码 123456）';
      return;
    }
    this.err = '';
    store.loggedIn = true;
    store.toast(`欢迎回来，${store.userName}`);
  }

  private demo(): void {
    store.loggedIn = true;
    store.toast('已进入演示，数据来自本地模拟');
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
      Field({ label: '手机号', text: this.phone, placeholder: '输入手机号',
        change: (v: string): void => {
          this.phone = v;
        } })
      Field({ label: '验证码', text: this.code, placeholder: '6 位验证码',
        change: (v: string): void => {
          this.code = v;
        } })
      if (this.err !== '') {
        Text(this.err).fontSize(12).fontColor(T.c('danger'))
      }
      TBtn({ label: '登录 / 进入演示', kind: 'primary', tap: (): void => this.submit() })
        .width('100%')
      Text('直接进入演示')
        .fontSize(13).fontWeight(600).fontColor(T.c('primary-ink'))
        .onClick((): void => this.demo())
      Text('本地演示 · 无需真实账号 · 数据仅存本机')
        .fontSize(12).fontColor(T.c('text-muted'))
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
      Button('进入演示')
        .fontSize(14).height(44).width('100%')
        .backgroundColor(T.c('primary')).fontColor(T.c('on-primary'))
        .onClick((): void => this.demo())
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
            Column({ space: 18 }) {
              Text('登录').fontSize(22).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
              this.LoginCard()
            }
            .width(420)
            .alignItems(HorizontalAlign.Start)
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
        /* 手机：单列居中 */
        Column({ space: 20 }) {
          this.Brand(88, true)
          this.LoginCard()
        }
        .width('88%')
        .padding(28)
        .alignItems(HorizontalAlign.Center)
        .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 16 }))
          .animation({ duration: DUR_SLOW, curve: Curve.EaseOut }))
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(T.c('surface'))
  }
}
