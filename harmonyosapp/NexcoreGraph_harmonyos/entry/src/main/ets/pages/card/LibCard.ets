/* 启核图策 · 服务卡片「打开库存」（2x2 / 2*4 / 4*4）
   与软件一致：浅色底 + 徽标色；图标在品牌浅绿方块里，数字等宽。 */

@Entry
@Component
struct LibCard {
  @LocalStorageProp('total') total: number = 0;
  @LocalStorageProp('libs') libs: number = 0;

  private go(): void {
    postCardAction(this, {
      action: 'router',
      abilityName: 'EntryAbility',
      params: { 'target': 'libs' }
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
        Text('打开库存').fontSize(11).fontWeight(600).letterSpacing(0.4)
          .fontColor($r('app.color.card_text_muted'))
        Blank()
        Text('查看全部').fontSize(11).fontWeight(600).fontColor($r('app.color.card_accent_ink'))
      }
      .width('100%')
      .margin({ top: 10 })

      Blank()

      Row({ space: 4 }) {
        Text(`${this.total}`).fontSize(26).fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.card_text_strong')).fontFeature('tnum')
        Text('件').fontSize(12).fontColor($r('app.color.card_text_muted')).margin({ bottom: 4 })
      }
      .alignItems(VerticalAlign.Bottom)

      Text(`${this.libs} 个库`).fontSize(11).fontFeature('tnum')
        .fontColor($r('app.color.card_text_muted')).margin({ top: 2 })
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
