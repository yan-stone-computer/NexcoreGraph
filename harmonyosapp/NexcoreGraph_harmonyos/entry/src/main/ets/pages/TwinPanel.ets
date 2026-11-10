/* 家庭资源数字孪生沙盘：全部预测由确定性模拟器计算，AI 只负责后续解释。 */

import { store } from '../common/Store';
import { T, R_M, R_L, S1, S2, S3, S4, S6 } from '../common/Tokens';
import { Card, Chip, TBtn } from '../components/Widgets';
import { Item, Library } from '../common/Db';
import {
  itemToTwinInput, simulateTwin, TwinItemInput, TwinProjection, TwinResult, TwinRisk, TwinScenario
} from '../common/ResourceTwin';

@ComponentV2
export struct TwinPanel {
  @Local scenarioIndex: number = 0;
  @Local result: TwinResult = new TwinResult();

  aboutToAppear(): void {
    this.recalc();
  }

  private scenario(): TwinScenario {
    const value = new TwinScenario();
    value.horizonDays = 7;
    value.basePeople = store.profile.people > 0 ? store.profile.people : 3;
    value.mealsPerDay = 3;
    if (this.scenarioIndex === 1) {
      value.extraPeople = 2;
    } else if (this.scenarioIndex === 2) {
      value.savedMeals = 2;
    }
    return value;
  }

  private recalc(): void {
    const inputs: TwinItemInput[] = [];
    store.libraries.forEach((lib: Library): void => {
      lib.items.forEach((item: Item): void => {
        inputs.push(itemToTwinInput(item));
      });
    });
    this.result = simulateTwin(inputs, this.scenario());
  }

  private selectScenario(index: number): void {
    this.scenarioIndex = index;
    this.recalc();
  }

  private grade(): string {
    if (this.result.score >= 85) {
      return '稳健';
    }
    if (this.result.score >= 65) {
      return '可控';
    }
    if (this.result.score >= 40) {
      return '需处置';
    }
    return '高风险';
  }

  private openAI(): void {
    const topRisk: TwinRisk | undefined = this.result.risks.length > 0 ? this.result.risks[0] : undefined;
    store.overlay = '';
    store.aiOpen = true;
    store.aiPrefill = topRisk === undefined
      ? '请根据当前资源健康度，给出今天最值得做的 3 个整理动作'
      : `资源孪生预测：${topRisk.message}。请给出先消耗、再补货、最后复盘的三步方案`;
  }

  @Builder
  ScoreCard() {
    Card() {
      Column({ space: S3 }) {
        Row() {
          Column({ space: 2 }) {
            Text('资源健康度').fontSize(14).fontWeight(700).fontColor(T.c('text-secondary'))
            Row({ space: 6 }) {
              Text(`${this.result.score}`).fontSize(42).fontWeight(FontWeight.Bold)
                .fontColor(T.c('text-primary')).fontFeature('tnum')
              Text('/ 100').fontSize(13).fontColor(T.c('text-muted')).margin({ bottom: 7 })
            }
            .alignItems(VerticalAlign.Bottom)
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(this.grade())
            .fontSize(13).fontWeight(700).fontColor(T.c('primary-ink'))
            .padding({ left: 12, right: 12, top: 7, bottom: 7 })
            .borderRadius(999).backgroundColor(T.c('primary-container'))
        }
        .width('100%')

        Row({ space: S2 }) {
          this.ScorePart('新鲜度', this.result.breakdown.freshness, 40)
          this.ScorePart('充足度', this.result.breakdown.supply, 25)
          this.ScorePart('完整度', this.result.breakdown.completeness, 20)
          this.ScorePart('及时度', this.result.breakdown.response, 15)
        }
        .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  ScorePart(label: string, value: number, max: number) {
    Column({ space: 2 }) {
      Text(`${Math.round(value)}`).fontSize(17).fontWeight(700)
        .fontColor(value / max < 0.5 ? T.c('danger') : T.c('text-primary')).fontFeature('tnum')
      Text(`${label}/${max}`).fontSize(10).fontColor(T.c('text-muted'))
    }
    .layoutWeight(1)
    .padding({ top: S2, bottom: S2 })
    .borderRadius(R_M)
    .backgroundColor(T.c('surface-raised'))
  }

  @Builder
  ScenarioBar() {
    Column({ space: S2 }) {
      Text('情景推演').fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
      Text('所有轨迹由端侧确定性模拟器计算，用于比较未来 7 天风险。')
        .fontSize(11).fontColor(T.c('text-muted'))
      Row({ space: 8 }) {
        Chip({ text: '正常', active: this.scenarioIndex === 0, tap: (): void => this.selectScenario(0) })
        Chip({ text: '来客 +2', active: this.scenarioIndex === 1, tap: (): void => this.selectScenario(1) })
        Chip({ text: '少做 2 餐', active: this.scenarioIndex === 2, tap: (): void => this.selectScenario(2) })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  RiskList() {
    Column({ space: S2 }) {
      Row() {
        Text('未来风险').fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
        Blank()
        Text(`${this.result.risks.length} 项`).fontSize(12).fontColor(T.c('text-muted'))
      }
      .width('100%')

      if (this.result.risks.length === 0) {
        Text('未来 7 天没有预测到耗尽或到期浪费。')
          .fontSize(13).fontColor(T.c('primary-ink'))
          .width('100%').padding(S3).borderRadius(R_M).backgroundColor(T.c('primary-container'))
      } else {
        ForEach(this.result.risks.slice(0, 6), (risk: TwinRisk) => {
          Row({ space: 10 }) {
            Text(risk.type === 'waste' ? '临期' : '缺货')
              .fontSize(10).fontWeight(700)
              .fontColor(risk.type === 'waste' ? T.c('warning') : T.c('danger'))
              .padding({ left: 8, right: 8, top: 4, bottom: 4 })
              .borderRadius(999)
              .backgroundColor(risk.type === 'waste' ? T.c('warning-container') : T.c('danger-container'))
            Text(risk.message).fontSize(13).fontColor(T.c('text-primary')).layoutWeight(1)
            Text(risk.day === 0 ? '现在' : `D+${risk.day}`)
              .fontSize(11).fontColor(T.c('text-muted')).fontFeature('tnum')
          }
          .width('100%').padding({ top: S2, bottom: S2 })
          .border({ width: { top: 1 }, color: T.c('border') })
        }, (risk: TwinRisk, index: number) => `${risk.itemId}-${risk.type}-${index}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  ProjectionList() {
    Column({ space: S2 }) {
      Text('7 天库存轨迹').fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
      ForEach(this.result.projections.slice(0, 4), (projection: TwinProjection) => {
        Row() {
          Text(projection.itemName).fontSize(13).fontColor(T.c('text-secondary')).layoutWeight(1)
          Text(`${Math.round(projection.points[0].qty)} → ${Math.round(projection.points[projection.points.length - 1].qty)}`)
            .fontSize(13).fontWeight(600).fontColor(T.c('text-primary')).fontFeature('tnum')
        }
        .width('100%').padding({ top: 8, bottom: 8 })
        .border({ width: { top: 1 }, color: T.c('border') })
      }, (projection: TwinProjection) => projection.itemId)
      if (this.result.projections.length === 0) {
        Text('入库后这里会显示每种资源的未来数量。')
          .fontSize(12).fontColor(T.c('text-muted'))
      }
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  Actions() {
    Column({ space: S2 }) {
      Text('可执行建议').fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
      ForEach(this.result.actionHints, (hint: string, index: number) => {
        Row({ space: 8 }) {
          Text(`${index + 1}`).fontSize(11).fontWeight(700).fontColor(T.c('primary-ink'))
            .width(22).height(22).textAlign(TextAlign.Center)
            .borderRadius(999).backgroundColor(T.c('primary-container'))
          Text(hint).fontSize(13).lineHeight(19).fontColor(T.c('text-secondary')).layoutWeight(1)
        }
        .width('100%').alignItems(VerticalAlign.Top)
      }, (hint: string, index: number) => `${index}-${hint}`)
      TBtn({ label: '让 AI 生成处置方案', icon: 'sparkles', kind: 'primary', tap: (): void => this.openAI() })
        .width('100%').margin({ top: S2 })
    }
    .width('100%').alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: S6 }) {
      Row() {
        Column({ space: 2 }) {
          Text('家庭资源数字孪生').fontSize(22).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
          Text('不是记账，而是推演未来 7 天会发生什么').fontSize(12).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start).layoutWeight(1)
        TBtn({ label: '关闭', kind: 'ghost', small: true, tap: (): void => { store.overlay = ''; } })
      }
      .width('100%').alignItems(VerticalAlign.Top)

      this.ScoreCard()
      this.ScenarioBar()
      this.RiskList()
      this.ProjectionList()
      this.Actions()
      Text('数据口径：参考日耗由保质期与家庭人数估算；可在后续接入真实消耗日志提高精度。')
        .fontSize(10).lineHeight(16).fontColor(T.c('text-muted'))
    }
    .width('100%')
    .padding({ bottom: S6 })
    .alignItems(HorizontalAlign.Start)
  }
}
