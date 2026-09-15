/* 启核图策 · 登录页（复刻 viewLogin / .login） */

import { store } from '../common/Store';
import { T, R_L, R_XL, DUR_SLOW } from '../common/Tokens';
import { Ico, TBtn, Field } from '../components/Widgets';

@ComponentV2
export struct LoginView {
  @Local phone: string = '';
  @Local code: string = '';
  @Local err: string = '';

  private submit(): void {
    const phoneOk = /^1\d{10}$/.test(this.phone);
    if (!phoneOk) {
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

  build() {
    Stack({ alignContent: Alignment.Center }) {
      // 背景辉光
      Circle({ width: 420, height: 420 })
        .fill('rgba(255,136,51,0.10)')
        .position({ x: -80, y: -120 })
      Circle({ width: 320, height: 320 })
        .fill('rgba(0,212,255,0.08)')
        .position({ x: 260, y: 480 })

      Column({ space: 20 }) {
        Image($r('app.media.logo'))
          .width(88).height(88).borderRadius(20).objectFit(ImageFit.Cover)
          .shadow({ radius: 24, color: 'rgba(255,136,51,0.35)', offsetY: 8 })

        Column({ space: 8 }) {
          Text('启核图策').fontSize(28).fontWeight(800).fontColor(T.c('text-primary'))
          Text('NexcoreGraph')
            .fontSize(12).fontWeight(600).fontColor(T.c('text-secondary')).letterSpacing(2)
          Text('家里的东西，AI 帮你想 · 拍照建库 / 智能规划 / 家庭协作')
            .fontSize(13).fontColor(T.c('text-muted')).textAlign(TextAlign.Center)
        }
        .alignItems(HorizontalAlign.Center)

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
        }
        .padding(20)
        .borderRadius(R_XL)
        .backgroundColor(T.c('surface-raised'))
        .border({ width: 1, color: T.c('border') })

        Text('直接进入演示')
          .fontSize(13).fontWeight(600).fontColor(T.c('primary'))
          .onClick(() => {
            store.loggedIn = true;
            store.toast('已进入演示，数据来自本地模拟');
          })

        Text('本地演示 · 无需真实账号 · 数据仅存本机')
          .fontSize(12).fontColor(T.c('text-muted'))
      }
      .width(store.isWide ? 420 : '88%')
      .padding(28)
      .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 16 }))
        .animation({ duration: DUR_SLOW, curve: Curve.EaseOut }))
    }
    .width('100%')
    .height('100%')
    .backgroundColor(T.c('surface'))
  }
}
