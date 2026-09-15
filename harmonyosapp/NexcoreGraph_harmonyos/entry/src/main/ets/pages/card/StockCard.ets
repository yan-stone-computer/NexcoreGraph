/* 启核图策 · 服务卡片「库存总览」（2x4）
   品牌头部 + 真实库存数据（EntryFormAbility 注入），点击整卡直达资源库，按钮直达拍照入库。 */

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
    Column({ space: 8 }) {
      Row({ space: 6 }) {
        Image($r('app.media.logo'))
          .width(16)
          .height(16)
          .borderRadius(5)
          .objectFit(ImageFit.Cover)
        Text('启核图策 · 库存总览')
          .fontSize(11)
          .fontWeight(700)
          .fontColor('#9FB0D8')
        Blank()
        Image($r('app.media.ic_fridge'))
          .width(14)
          .height(14)
          .objectFit(ImageFit.Contain)
          .opacity(0.7)
      }
      .width('100%')

      Row({ space: 14 }) {
        Column({ space: 5 }) {
          Text(`${this.total} 件 · ${this.libs} 库`)
            .fontSize(17)
            .fontWeight(800)
            .fontColor('#FFFFFF')
          Text(this.expiring > 0 ? `临期 ${this.expiring} 项，优先消耗` : '库存健康，暂无临期')
            .fontSize(12)
            .fontColor(this.expiring > 0 ? '#FFB37E' : '#7DE0C4')
            .maxLines(1)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Column({ space: 6 }) {
          Row({ space: 5 }) {
            Image($r('app.media.ic_camera'))
              .width(13)
              .height(13)
              .objectFit(ImageFit.Contain)
            Text('拍照入库')
              .fontSize(11)
              .fontWeight(700)
              .fontColor('#13172B')
          }
          .padding({ left: 11, right: 11, top: 6, bottom: 6 })
          .borderRadius(999)
          .backgroundColor('#FF8833')
          .onClick(() => {
            this.go('intake');
          })

          Row({ space: 5 }) {
            Image($r('app.media.ic_library'))
              .width(13)
              .height(13)
              .objectFit(ImageFit.Contain)
            Text('查看库存')
              .fontSize(11)
              .fontWeight(700)
              .fontColor('#FFFFFF')
          }
          .padding({ left: 11, right: 11, top: 6, bottom: 6 })
          .borderRadius(999)
          .border({ width: 1, color: 'rgba(255,255,255,0.35)' })
          .onClick(() => {
            this.go('libs');
          })
        }
        .alignItems(HorizontalAlign.End)
      }
      .layoutWeight(1)
      .alignItems(VerticalAlign.Center)
    }
    .padding({ left: 13, right: 13, top: 10, bottom: 10 })
    .width('100%')
    .height('100%')
    .linearGradient({
      angle: 180,
      colors: [['#1A2240', 0], ['#12162B', 1]]
    })
  }
}
