/* 启核图策 · 服务卡片「快捷入口」（2x2 / 2x4）
   品牌头部（logo + 名称）+ 四个直达入口，SVG 线条图标（与应用内 24px 描边 1.7 一致）。
   postCardAction router → EntryAbility，按 want.parameters.target 设置全局状态。
   卡片环境自包含，不 import 应用 Store。 */

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
  BrandHead() {
    Row({ space: 6 }) {
      Image($r('app.media.logo'))
        .width(16)
        .height(16)
        .borderRadius(5)
        .objectFit(ImageFit.Cover)
      Text('启核图策')
        .fontSize(11)
        .fontWeight(700)
        .fontColor('#9FB0D8')
      Blank()
      Image($r('app.media.ic_scan'))
        .width(13)
        .height(13)
        .objectFit(ImageFit.Contain)
        .opacity(0.7)
    }
    .width('100%')
  }

  @Builder
  Entry(icon: Resource, label: string, target: string) {
    Column({ space: 7 }) {
      Image(icon)
        .width(22)
        .height(22)
        .objectFit(ImageFit.Contain)
      Text(label)
        .fontSize(12)
        .fontWeight(700)
        .fontColor('#FFFFFF')
        .maxLines(1)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .borderRadius(14)
    .linearGradient({
      angle: 160,
      colors: [['rgba(255,136,51,0.22)', 0], ['rgba(255,136,51,0.08)', 1]]
    })
    .border({ width: 1, color: 'rgba(255,136,51,0.35)' })
    .onClick(() => {
      this.go(target);
    })
  }

  build() {
    Column({ space: 9 }) {
      this.BrandHead()

      Row({ space: 9 }) {
        this.Entry($r('app.media.ic_camera'), '拍照入库', 'intake')
        this.Entry($r('app.media.ic_sparkles'), 'AI 对话', 'ai')
      }
      .layoutWeight(1)

      Row({ space: 9 }) {
        this.Entry($r('app.media.ic_listcheck'), '我的方案', 'plans')
        this.Entry($r('app.media.ic_cart'), '采购清单', 'shopping')
      }
      .layoutWeight(1)
    }
    .padding(11)
    .width('100%')
    .height('100%')
    .linearGradient({
      angle: 180,
      colors: [['#1A2240', 0], ['#12162B', 1]]
    })
  }
}
