/* 启核图策 · 服务卡片「临期提醒」（2x2 / 2*4 / 4*4）
   与软件一致：浅色底 + 徽标色；状态色只表达状态（临期=琥珀，健康=启核绿）。 */

@Entry
@Component
struct ExpiryCard {
  @LocalStorageProp('expiring') expiring: number = 0;
  @LocalStorageProp('exp1') exp1: string = '';
  @LocalStorageProp('exp2') exp2: string = '';

  private go(): void {
    postCardAction(this, {
      action: 'router',
      abilityName: 'EntryAbility',
      params: { 'target': 'alerts' }
    });
  }

  @Builder
  BrandRule() {
    Row()
      .width('100%')
      .height(3)
      .borderRadius(2)
      .linearGradient({
        angle: 90,
        colors: [
          [$r('app.color.card_grad_a'), 0],
          [$r('app.color.card_grad_b'), 0.5],
          [$r('app.color.card_grad_c'), 1]
        ]
      })
  }

  build() {
    Column({ space: 0 }) {
      this.BrandRule()

      Row({ space: 6 }) {
        Image($r('app.media.logo')).width(14).height(14).objectFit(ImageFit.Contain)
        Text('临期').fontSize(11).fontWeight(600).letterSpacing(0.4)
          .fontColor($r('app.color.card_text_muted'))
        Blank()
        Image($r('app.media.ic_clock')).width(14).height(14).objectFit(ImageFit.Contain)
          .fillColor($r('app.color.card_accent_ink'))
      }
      .width('100%')
      .margin({ top: 10 })

      Row({ space: 4 }) {
        Text(`${this.expiring}`).fontSize(30).fontWeight(FontWeight.Bold).fontFeature('tnum')
          .fontColor(this.expiring > 0 ? $r('app.color.card_warn_ink') : $r('app.color.card_accent_ink'))
        Text('项').fontSize(12).fontColor($r('app.color.card_text_muted')).margin({ bottom: 5 })
      }
      .alignItems(VerticalAlign.Bottom)
      .margin({ top: 4 })

      if (this.expiring === 0) {
        Text('近 7 天没有需要处理的临期').fontSize(11).maxLines(1)
          .fontColor($r('app.color.card_accent_ink')).margin({ top: 4 })
      } else {
        if (this.exp1 !== '') {
          Text(this.exp1).fontSize(11).maxLines(1).fontColor($r('app.color.card_text_body'))
            .margin({ top: 6 })
        }
        if (this.exp2 !== '') {
          Text(this.exp2).fontSize(11).maxLines(1).fontColor($r('app.color.card_text_muted'))
            .margin({ top: 2 })
        }
      }

      Blank()

      Text('查看全部').fontSize(11).fontWeight(600).fontColor($r('app.color.card_accent_ink'))
    }
    .padding({ left: 13, right: 13, top: 10, bottom: 12 })
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.card_surface'))
    .borderRadius(16)
    .border({ width: 1, color: $r('app.color.card_border') })
    .onClick(() => {
      this.go();
    })
  }
}
