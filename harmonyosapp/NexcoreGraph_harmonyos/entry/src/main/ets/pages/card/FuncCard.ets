/* 启核图策 · 服务卡片「快捷入口」（2x2 / 2x4 / 4x4）
   设计规范（.ui-alchemy/system.md）：
     · 只有这一张卡保留品牌标记（其他卡直接给数据，避免四张卡重复 logo + 名称）
     · 入口 = 中性描边方块（无渐变、无彩色阴影），图标与文字承担识别
     · 唯一强调色为启核绿 #57D794，语义色只用于状态
   卡片环境自包含，不 import 应用 Store。 */

const FC_SURFACE_TOP: string = '#171C33';
const FC_SURFACE_BOTTOM: string = '#13172B';
const FC_TEXT_STRONG: string = '#EDF1F9';
const FC_TEXT_MUTED: string = '#8E9AB8';
const FC_TILE_BG: string = 'rgba(255,255,255,0.06)';
const FC_TILE_BORDER: string = 'rgba(255,255,255,0.10)';

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
        .width(15)
        .height(15)
        .objectFit(ImageFit.Contain)
      Text('启核图策')
        .fontSize(11)
        .fontWeight(600)
        .fontColor(FC_TEXT_MUTED)
        .letterSpacing(0.4)
    }
    .width('100%')
  }

  @Builder
  Entry(icon: Resource, label: string, target: string) {
    Column({ space: 6 }) {
      Image(icon)
        .width(20)
        .height(20)
        .objectFit(ImageFit.Contain)
        .opacity(0.92)
      Text(label)
        .fontSize(11)
        .fontWeight(600)
        .fontColor(FC_TEXT_STRONG)
        .maxLines(1)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .borderRadius(12)
    .backgroundColor(FC_TILE_BG)
    .border({ width: 1, color: FC_TILE_BORDER })
    .onClick(() => {
      this.go(target);
    })
  }

  build() {
    Column({ space: 8 }) {
      this.BrandHead()

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
    }
    .padding(12)
    .width('100%')
    .height('100%')
    .linearGradient({
      angle: 180,
      colors: [[FC_SURFACE_TOP, 0], [FC_SURFACE_BOTTOM, 1]]
    })
  }
}
