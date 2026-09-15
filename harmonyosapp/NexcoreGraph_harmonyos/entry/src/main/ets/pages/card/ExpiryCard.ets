/* 启核图策 · 服务卡片「临期提醒」（2x2 / 2*4 / 4*4）
   设计规范：数字先行（等宽），顶行只有一个标签与一个图标；列表最多两项；
   状态色只表达状态（临期=琥珀，健康=启核绿）。整卡可点，直达预警中心。 */

const EC_SURFACE_TOP: string = '#171C33';
const EC_SURFACE_BOTTOM: string = '#13172B';
const EC_TEXT_STRONG: string = '#EDF1F9';
const EC_TEXT_MUTED: string = '#8E9AB8';
const EC_TEXT_BODY: string = '#C3CDE6';
const EC_ACCENT: string = '#57D794';
const EC_WARN: string = '#FFB020';

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
    Column({ space: 0 }) {
      Row() {
        Text('临期')
          .fontSize(11)
          .fontWeight(600)
          .fontColor(EC_TEXT_MUTED)
          .letterSpacing(0.4)
        Blank()
        Image($r('app.media.ic_clock'))
          .width(14)
          .height(14)
          .objectFit(ImageFit.Contain)
          .opacity(0.7)
      }
      .width('100%')

      Row({ space: 4 }) {
        Text(`${this.expiring}`)
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.expiring > 0 ? EC_WARN : EC_ACCENT)
          .fontFeature('tnum')
        Text('项')
          .fontSize(12)
          .fontColor(EC_TEXT_MUTED)
          .margin({ bottom: 5 })
      }
      .alignItems(VerticalAlign.Bottom)
      .margin({ top: 6 })

      if (this.expiring === 0) {
        Text('近 7 天没有需要处理的临期')
          .fontSize(11)
          .fontColor(EC_ACCENT)
          .maxLines(1)
          .margin({ top: 4 })
      } else {
        if (this.exp1 !== '') {
          Text(this.exp1)
            .fontSize(11)
            .fontColor(EC_TEXT_BODY)
            .maxLines(1)
            .margin({ top: 6 })
        }
        if (this.exp2 !== '') {
          Text(this.exp2)
            .fontSize(11)
            .fontColor(EC_TEXT_MUTED)
            .maxLines(1)
            .margin({ top: 2 })
        }
      }

      Blank()

      Text('查看全部')
        .fontSize(11)
        .fontWeight(600)
        .fontColor(EC_ACCENT)
    }
    .padding(13)
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .linearGradient({
      angle: 180,
      colors: [[EC_SURFACE_TOP, 0], [EC_SURFACE_BOTTOM, 1]]
    })
    .onClick(() => {
      this.go();
    })
  }
}
