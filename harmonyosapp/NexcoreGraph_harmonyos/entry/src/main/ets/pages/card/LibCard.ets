/* 启核图策 · 服务卡片「打开库存」（2x2 / 2*4 / 4*4）
   设计规范：图标放在中性描边方块里（不再用彩色渐变块与彩色阴影，避免"彩色光晕"）；
   规模用等宽数字，标题一句、说明一句。整卡可点，直达资源库。 */

const LC_SURFACE_TOP: string = '#171C33';
const LC_SURFACE_BOTTOM: string = '#13172B';
const LC_TEXT_STRONG: string = '#EDF1F9';
const LC_TEXT_MUTED: string = '#8E9AB8';
const LC_TILE_BG: string = 'rgba(255,255,255,0.06)';
const LC_TILE_BORDER: string = 'rgba(255,255,255,0.10)';
const LC_ACCENT: string = '#57D794';

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

  build() {
    Column({ space: 0 }) {
      Row() {
        Row() {
          Image($r('app.media.ic_cabinet'))
            .width(20)
            .height(20)
            .objectFit(ImageFit.Contain)
            .opacity(0.92)
        }
        .width(38)
        .height(38)
        .borderRadius(12)
        .backgroundColor(LC_TILE_BG)
        .border({ width: 1, color: LC_TILE_BORDER })
        .justifyContent(FlexAlign.Center)
        Blank()
        Text('查看全部')
          .fontSize(11)
          .fontWeight(600)
          .fontColor(LC_ACCENT)
      }
      .width('100%')

      Blank()

      Row({ space: 4 }) {
        Text(`${this.total}`)
          .fontSize(26)
          .fontWeight(FontWeight.Bold)
          .fontColor(LC_TEXT_STRONG)
          .fontFeature('tnum')
        Text('件')
          .fontSize(12)
          .fontColor(LC_TEXT_MUTED)
          .margin({ bottom: 4 })
      }
      .alignItems(VerticalAlign.Bottom)

      Text(`打开库存 · ${this.libs} 个库`)
        .fontSize(11)
        .fontColor(LC_TEXT_MUTED)
        .fontFeature('tnum')
        .margin({ top: 2 })
    }
    .padding(13)
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .linearGradient({
      angle: 180,
      colors: [[LC_SURFACE_TOP, 0], [LC_SURFACE_BOTTOM, 1]]
    })
    .onClick(() => {
      this.go();
    })
  }
}
