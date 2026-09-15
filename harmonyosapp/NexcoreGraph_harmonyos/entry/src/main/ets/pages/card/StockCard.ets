/* 启核图策 · 服务卡片「库存总览」（2x2 / 2*4 / 4*4）
   配色与软件一致：浅色底 + 徽标绿青蓝；颜色一律走 app.color.card_* 资源，
   随系统明暗自动切换（form_config colorMode = auto）。
   版式：顶部 3vp 品牌渐变条（唯一签名元素）→ 标签 → 30vp 等宽大数字 → 底部状态点。 */

@Entry
@Component
struct StockCard {
  @LocalStorageProp('total') total: number = 0;
  @LocalStorageProp('libs') libs: number = 0;
  @LocalStorageProp('expiring') expiring: number = 0;

  private go(target: string): void {
    postCardAction(this, {
      action: 'router',
      abilityName: 'EntryAbility',
      params: { 'target': target }
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
        Text('库存').fontSize(11).fontWeight(600).letterSpacing(0.4)
          .fontColor($r('app.color.card_text_muted'))
        Blank()
        Image($r('app.media.ic_fridge')).width(14).height(14).objectFit(ImageFit.Contain)
          .fillColor($r('app.color.card_accent_ink'))
      }
      .width('100%')
      .margin({ top: 10 })

      Row({ space: 4 }) {
        Text(`${this.total}`).fontSize(30).fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.card_text_strong')).fontFeature('tnum')
        Text('件').fontSize(12).fontColor($r('app.color.card_text_muted')).margin({ bottom: 5 })
      }
      .alignItems(VerticalAlign.Bottom)
      .margin({ top: 4 })

      Text(`${this.libs} 个库`).fontSize(11).fontColor($r('app.color.card_text_muted'))
        .fontFeature('tnum').margin({ top: 2 })

      Blank()

      Row({ space: 6 }) {
        Row().width(6).height(6).borderRadius(3)
          .backgroundColor(this.expiring > 0 ? $r('app.color.card_warn_ink') : $r('app.color.card_accent_ink'))
        Text(this.expiring > 0 ? `${this.expiring} 项临期待处理` : '近 7 天无临期')
          .fontSize(12).fontWeight(600).fontFeature('tnum').maxLines(1)
          .fontColor(this.expiring > 0 ? $r('app.color.card_warn_ink') : $r('app.color.card_accent_ink'))
      }
      .width('100%')
    }
    .padding({ left: 13, right: 13, top: 10, bottom: 12 })
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .backgroundColor($r('app.color.card_surface'))
    .borderRadius(16)
    .border({ width: 1, color: $r('app.color.card_border') })
    .onClick(() => {
      this.go('libs');
    })
  }
}
