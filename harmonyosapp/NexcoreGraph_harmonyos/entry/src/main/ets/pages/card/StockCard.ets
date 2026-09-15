/* 启核图策 · 服务卡片「库存总览」（2x2 / 2*4 / 4*4）
   设计规范：数据先行，无品牌头、无胶囊按钮；数字等宽；临期用语义色，其余保持中性。
   整卡可点，直达资源库。 */

const SC_SURFACE_TOP: string = '#171C33';
const SC_SURFACE_BOTTOM: string = '#13172B';
const SC_TEXT_STRONG: string = '#EDF1F9';
const SC_TEXT_MUTED: string = '#8E9AB8';
const SC_ACCENT: string = '#57D794';
const SC_WARN: string = '#FFB020';

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

  build() {
    Column({ space: 0 }) {
      Row() {
        Text('库存')
          .fontSize(11)
          .fontWeight(600)
          .fontColor(SC_TEXT_MUTED)
          .letterSpacing(0.4)
        Blank()
        Image($r('app.media.ic_fridge'))
          .width(14)
          .height(14)
          .objectFit(ImageFit.Contain)
          .opacity(0.7)
      }
      .width('100%')

      Row({ space: 4 }) {
        Text(`${this.total}`)
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(SC_TEXT_STRONG)
          .fontFeature('tnum')
        Text('件')
          .fontSize(12)
          .fontColor(SC_TEXT_MUTED)
          .margin({ bottom: 5 })
      }
      .alignItems(VerticalAlign.Bottom)
      .margin({ top: 6 })

      Text(`${this.libs} 个库`)
        .fontSize(11)
        .fontColor(SC_TEXT_MUTED)
        .fontFeature('tnum')
        .margin({ top: 2 })

      Blank()

      Row({ space: 6 }) {
        Row()
          .width(6)
          .height(6)
          .borderRadius(3)
          .backgroundColor(this.expiring > 0 ? SC_WARN : SC_ACCENT)
        Text(this.expiring > 0 ? `${this.expiring} 项临期待处理` : '近 7 天无临期')
          .fontSize(12)
          .fontWeight(600)
          .fontColor(this.expiring > 0 ? SC_WARN : SC_ACCENT)
          .fontFeature('tnum')
          .maxLines(1)
      }
      .width('100%')
    }
    .padding(13)
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .linearGradient({
      angle: 180,
      colors: [[SC_SURFACE_TOP, 0], [SC_SURFACE_BOTTOM, 1]]
    })
    .onClick(() => {
      this.go('libs');
    })
  }
}
