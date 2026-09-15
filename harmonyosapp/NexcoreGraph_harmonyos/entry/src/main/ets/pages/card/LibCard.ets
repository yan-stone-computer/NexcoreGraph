/* 启核图策 · 服务卡片「打开库存」（2x2）
   柜子造型入口：大柜门 SVG 图标 + 物品计数（EntryFormAbility 注入），点击直达资源库 Tab。 */

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
    Column({ space: 10 }) {
      // 柜子图标（橙色渐变圆角底）
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.ic_cabinet'))
          .width(42)
          .height(42)
          .objectFit(ImageFit.Contain)
      }
      .width(74)
      .height(74)
      .borderRadius(20)
      .linearGradient({
        angle: 160,
        colors: [['#FF8833', 0], ['#E8701E', 1]]
      })
      .shadow({ radius: 14, color: 'rgba(255,136,51,0.45)', offsetY: 4 })

      Column({ space: 3 }) {
        Text('打开库存')
          .fontSize(14)
          .fontWeight(800)
          .fontColor('#FFFFFF')
        Text(`${this.total} 件物品 · ${this.libs} 个柜`)
          .fontSize(11)
          .fontColor('#9FB0D8')
          .maxLines(1)
      }
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .linearGradient({
      angle: 180,
      colors: [['#1A2240', 0], ['#12162B', 1]]
    })
    .onClick(() => {
      this.go();
    })
  }
}
