/* 家庭资源数字孪生沙盘：全部预测由确定性模拟器计算，AI 只负责后续解释。 */

import { store } from '../common/Store';
import { T, R_M, R_L, S1, S2, S3, S4, S6 } from '../common/Tokens';
import { Card, Chip, TBtn } from '../components/Widgets';
import { Item, Library } from '../common/Db';
import {
  itemToTwinInput, simulateTwin, TwinItemInput, TwinProjection, TwinResult, TwinRisk, TwinScenario
} from '../common/ResourceTwin';
import {
  DOMAIN_FITNESS, DOMAIN_FOOD, DOMAIN_MEDICINE, DOMAIN_TOOL, domainLabel
} from '../common/ResourceDomain';

@ComponentV2
export struct TwinPanel {
  @Local scenarioIndex: number = 0;
  @Local result: TwinResult = new TwinResult();
  @Local selectedDomain: string = 'all';

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
        const input = itemToTwinInput(item, lib.name);
        if (this.selectedDomain === 'all' || input.domain === this.selectedDomain) {
          inputs.push(input);
        }
      });
    });
    this.result = simulateTwin(inputs, this.scenario());
  }

  private selectScenario(index: number): void {
    this.scenarioIndex = index;
    this.recalc();
  }

  private selectDomain(domain: string): void {
    this.selectedDomain = domain;
    this.recalc();
  }

  private riskLabel(type: string): string {
    if (type === 'waste') {
      return '临期';
    }
    if (type === 'maintenance') {
      return '维护';
    }
    if (type === 'unavailable') {
      return '不可用';
    }
    if (type === 'refill' || this.selectedDomain === DOMAIN_MEDICINE) {
      return '余量';
    }
    return '缺货';
  }

  private freshnessLabel(): string {
    if (this.selectedDomain === DOMAIN_MEDICINE) {
      return '有效期';
    }
    if (this.selectedDomain === DOMAIN_FITNESS) {
      return '可用性';
    }
    if (this.selectedDomain === DOMAIN_TOOL) {
      return '维护度';
    }
    return '新鲜度';
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
          this.ScorePart(this.freshnessLabel(), this.result.breakdown.freshness, 40)
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
  DomainBar() {
    Column({ space: S2 }) {
      Text('资源域').fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
      Row({ space: 8 }) {
        Chip({ text: '全部', active: this.selectedDomain === 'all',
          tap: (): void => this.selectDomain('all') })
        Chip({ text: '食品', active: this.selectedDomain === DOMAIN_FOOD,
          tap: (): void => this.selectDomain(DOMAIN_FOOD) })
        Chip({ text: '药品', active: this.selectedDomain === DOMAIN_MEDICINE,
          tap: (): void => this.selectDomain(DOMAIN_MEDICINE) })
      }
      .width('100%')
      Row({ space: 8 }) {
        Chip({ text: '健身', active: this.selectedDomain === DOMAIN_FITNESS,
          tap: (): void => this.selectDomain(DOMAIN_FITNESS) })
        Chip({ text: '工具', active: this.selectedDomain === DOMAIN_TOOL,
          tap: (): void => this.selectDomain(DOMAIN_TOOL) })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  ScenarioBar() {
    Column({ space: S2 }) {
      Text(this.selectedDomain === 'all' || this.selectedDomain === DOMAIN_FOOD ? '食品情景' : '域规则')
        .fontSize(16).fontWeight(700).fontColor(T.c('text-primary'))
      if (this.selectedDomain === 'all' || this.selectedDomain === DOMAIN_FOOD) {
        Text('食品按人数和餐次推演，其他资源域不会被餐次错误放大。')
          .fontSize(11).fontColor(T.c('text-muted'))
        Row({ space: 8 }) {
          Chip({ text: '正常', active: this.scenarioIndex === 0, tap: (): void => this.selectScenario(0) })
          Chip({ text: '来客 +2', active: this.scenarioIndex === 1, tap: (): void => this.selectScenario(1) })
          Chip({ text: '少做 2 餐', active: this.scenarioIndex === 2, tap: (): void => this.selectScenario(2) })
        }
        .width('100%')
      } else if (this.selectedDomain === DOMAIN_MEDICINE) {
        Text('按用户填写的每日用量计算余量天数；系统不生成剂量建议。')
          .fontSize(11).fontColor(T.c('text-muted'))
      } else if (this.selectedDomain === DOMAIN_FITNESS) {
        Text('器材数量决定是否可用，训练计划会根据目标、水平和现有器材生成。')
          .fontSize(11).fontColor(T.c('text-muted'))
      } else if (this.selectedDomain === DOMAIN_TOOL) {
        Text('工具默认不按日耗扣减；仅提示维护、保修和当前不可用状态。')
          .fontSize(11).fontColor(T.c('text-muted'))
      }
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
        Text(this.selectedDomain === DOMAIN_TOOL || this.selectedDomain === DOMAIN_FITNESS
          ? '未来 7 天没有预测到不可用或维护风险。'
          : '未来 7 天没有预测到耗尽或到期浪费。')
          .fontSize(13).fontColor(T.c('primary-ink'))
          .width('100%').padding(S3).borderRadius(R_M).backgroundColor(T.c('primary-container'))
      } else {
        ForEach(this.result.risks.slice(0, 6), (risk: TwinRisk) => {
          Row({ space: 10 }) {
            Text(this.riskLabel(risk.type))
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
      Row({ space: 12 }) {
        TBtn({ label: '身体档案与训练', icon: 'users', kind: 'soft', small: true,
          tap: (): void => { store.overlay = 'bodyprofile'; } }).layoutWeight(1)
        TBtn({ label: '让 AI 解释', icon: 'sparkles', kind: 'primary', small: true,
          tap: (): void => this.openAI() }).layoutWeight(1)
      }
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
      }
      .width('100%').alignItems(VerticalAlign.Top)

      this.ScoreCard()
      this.DomainBar()
      this.ScenarioBar()
      this.RiskList()
      this.ProjectionList()
      this.Actions()
      Text('数据口径：食品按保质期与家庭情景；药品按用户填写用量；工具和器材只看可用性与维护。')
        .fontSize(10).lineHeight(16).fontColor(T.c('text-muted'))
    }
    .width('100%')
    .padding({ bottom: S6 })
    .alignItems(HorizontalAlign.Start)
  }
}
