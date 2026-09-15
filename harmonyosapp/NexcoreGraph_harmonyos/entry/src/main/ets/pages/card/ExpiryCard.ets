/* 启核图策 · 服务卡片「临期提醒」（2x2）
   品牌头部 + 临期数量与最近两项（EntryFormAbility 注入），点击直达预警中心。 */

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

  build() {
    Column({ space: 7 }) {
      Row({ space: 6 }) {
        Image($r('app.media.logo'))
          .width(15)
          .height(15)
          .borderRadius(5)
          .objectFit(ImageFit.Cover)
        Text('启核图策')
          .fontSize(11)
          .fontWeight(700)
          .fontColor('#9FB0D8')
        Blank()
        Image($r('app.media.ic_clock'))
          .width(14)
          .height(14)
          .objectFit(ImageFit.Contain)
          .opacity(0.7)
      }
      .width('100%')

      Row({ space: 5 }) {
        Text(`${this.expiring}`)
          .fontSize(24)
          .fontWeight(800)
          .fontColor(this.expiring > 0 ? '#FFB37E' : '#7DE0C4')
        Text(this.expiring > 0 ? '项临期' : '项 · 健康')
          .fontSize(12)
          .fontColor('#B8C4E8')
      }
      .alignItems(VerticalAlign.Bottom)

      if (this.expiring > 0 && this.exp1 !== '') {
        Text(this.exp1)
          .fontSize(11)
          .fontColor('#E8ECF8')
          .maxLines(1)
      }
      if (this.expiring > 0 && this.exp2 !== '') {
        Text(this.exp2)
          .fontSize(11)
          .fontColor('#B8C4E8')
          .maxLines(1)
      }

      Blank()
      Text('查看预警中心 →')
        .fontSize(10)
        .fontColor('#8FA0CC')
    }
    .padding(12)
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .linearGradient({
      angle: 180,
      colors: [['#1A2240', 0], ['#12162B', 1]]
    })
    .onClick(() => {
      this.go();
    })
  }
}
