/* 启核图策 · 服务卡片「快捷入口」（2x2 / 2*4 / 4*4）
   与软件一致：浅色底 + 徽标色；入口用品牌浅绿底（card_tile_bg）+ 墨绿图标，
   顶部 3vp 品牌渐变条作为唯一签名元素。 */

@Entry
@Component
struct FuncCard {
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

  @Builder
  Entry(icon: Resource, label: string, target: string) {
    Column({ space: 6 }) {
      Image(icon)
        .width(20)
        .height(20)
        .objectFit(ImageFit.Contain)
        .fillColor($r('app.color.card_accent_ink'))
      Text(label)
        .fontSize(11)
        .fontWeight(600)
        .fontColor($r('app.color.card_text_strong'))
        .maxLines(1)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .borderRadius(12)
    .backgroundColor($r('app.color.card_tile_bg'))
    .onClick(() => {
      this.go(target);
    })
  }

  build() {
    Column({ space: 0 }) {
      this.BrandRule()

      Row({ space: 6 }) {
        Image($r('app.media.logo'))
          .width(15)
          .height(15)
          .objectFit(ImageFit.Contain)
        Text('启核图策')
          .fontSize(11)
          .fontWeight(600)
          .fontColor($r('app.color.card_text_body'))
          .letterSpacing(0.4)
      }
      .width('100%')
      .margin({ top: 10, bottom: 8 })

      Row({ space: 8 }) {
        this.Entry($r('app.media.ic_camera'), '拍照入库', 'intake')
        this.Entry($r('app.media.ic_sparkles'), 'AI 对话', 'ai')
      }
      .layoutWeight(1)

      Row({ space: 8 }) {
        this.Entry($r('app.media.ic_listcheck'), '我的方案', 'plans')
        this.Entry($r('app.media.ic_cart'), '采购清单', 'shopping')
      }
      .layoutWeight(1)
      .margin({ top: 8 })
    }
    .padding({ left: 12, right: 12, top: 10, bottom: 12 })
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.card_surface'))
    .borderRadius(16)
    .border({ width: 1, color: $r('app.color.card_border') })
  }
}
