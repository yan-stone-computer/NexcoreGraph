/* Body-profile and equipment-aware workout planner. Inputs stay local; plans are deterministic. */

import { store } from '../common/Store';
import { T, R_M, S1, S2, S3, S4, S6 } from '../common/Tokens';
import { Card, Chip, Field, TBtn } from '../components/Widgets';
import { Item, Library } from '../common/Db';
import { saveProfile } from '../common/LocalStore';
import {
  buildWorkoutPlan, WorkoutExercise, WorkoutInput, WorkoutPlan, WorkoutSession
} from '../common/WorkoutPlanner';
import { DOMAIN_FITNESS } from '../common/ResourceDomain';

@ComponentV2
export struct BodyProfilePanel {
  @Local heightText: string = '';
  @Local weightText: string = '';
  @Local ageText: string = '';
  @Local limitations: string = '';
  @Local plan: WorkoutPlan = new WorkoutPlan();

  aboutToAppear(): void {
    this.heightText = store.profile.heightCm > 0 ? String(store.profile.heightCm) : '';
    this.weightText = store.profile.weightKg > 0 ? String(store.profile.weightKg) : '';
    this.ageText = store.profile.age > 0 ? String(store.profile.age) : '';
    this.limitations = store.profile.limitations;
    if (store.profile.trainingEnabled) {
      this.rebuild();
    }
  }

  private equipment(): string[] {
    const out: string[] = [];
    const add = (name: string): void => {
      if (out.indexOf(name) < 0) {
        out.push(name);
      }
    };
    store.libraries.forEach((lib: Library): void => {
      lib.items.forEach((item: Item): void => {
        if (item.qty <= 0) {
          return;
        }
        const domain: string = item.domain;
        if (domain !== DOMAIN_FITNESS) {
          return;
        }
        if (item.name.indexOf('哑铃') >= 0 || item.name.indexOf('壶铃') >= 0) {
          add('哑铃');
        } else if (item.name.indexOf('弹力带') >= 0 || item.name.indexOf('拉力带') >= 0) {
          add('弹力带');
        } else if (item.name.indexOf('跑步机') >= 0) {
          add('跑步机');
        } else if (item.name.indexOf('瑜伽垫') >= 0) {
          add('瑜伽垫');
        }
      });
    });
    return out;
  }

  private rebuild(): void {
    const input = new WorkoutInput();
    input.heightCm = parseFloat(this.heightText) || 0;
    input.weightKg = parseFloat(this.weightText) || 0;
    input.age = parseFloat(this.ageText) || 0;
    input.goal = store.profile.trainingGoal;
    input.level = store.profile.trainingLevel;
    input.weeklyDays = store.profile.weeklyDays;
    input.limitations = this.limitations;
    input.equipment = this.equipment();
    this.plan = buildWorkoutPlan(input);
  }

  private save(): void {
    store.profile.heightCm = Math.max(0, parseFloat(this.heightText) || 0);
    store.profile.weightKg = Math.max(0, parseFloat(this.weightText) || 0);
    store.profile.age = Math.max(0, parseFloat(this.ageText) || 0);
    store.profile.limitations = this.limitations.trim();
    store.profile.trainingEnabled = true;
    this.heightText = String(store.profile.heightCm);
    this.weightText = String(store.profile.weightKg);
    this.ageText = String(store.profile.age);
    saveProfile();
    this.rebuild();
  }

  @Builder
  ChoiceRow(label: string) {
    Text(label).fontSize(11).fontWeight(600).fontColor(T.c('text-muted'))
  }

  @Builder
  PlanHeader() {
    Card() {
      Column({ space: S3 }) {
        Row() {
          Column({ space: 2 }) {
            Text('身体与器材方案').fontSize(18).fontWeight(700).fontColor(T.c('text-primary'))
            Text('依据身体数据和已入库健身器材计算').fontSize(11).fontColor(T.c('text-muted'))
          }
          .alignItems(HorizontalAlign.Start)
          .layoutWeight(1)
          Text(this.plan.valid ? `${this.plan.bmi}` : '待补全')
            .fontSize(30).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary')).fontFeature('tnum')
        }
        .width('100%')
        if (this.plan.valid) {
          Row({ space: S2 }) {
            Text(`BMI ${this.plan.bmiLabel}`).fontSize(12).fontWeight(600)
              .fontColor(T.c('primary-ink')).padding({ left: 10, right: 10, top: 5, bottom: 5 })
              .borderRadius(999).backgroundColor(T.c('primary-container'))
            Text(this.plan.summary).fontSize(11).fontColor(T.c('text-muted')).layoutWeight(1)
          }
          .width('100%')
          Text(this.plan.safetyNote).fontSize(11).lineHeight(17).fontColor(T.c('text-secondary'))
            .width('100%').padding(S2).borderRadius(R_M).backgroundColor(T.c('surface'))
        } else {
          Text(this.plan.safetyNote).fontSize(12).fontColor(T.c('text-muted'))
        }
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  SessionCard(session: WorkoutSession) {
    Card({ pad: 18 }) {
      Column({ space: 10 }) {
        Row() {
          Text(`第 ${session.day} 天 · ${session.focus}`).fontSize(15).fontWeight(700)
            .fontColor(T.c('text-primary')).layoutWeight(1)
          Text(`约 ${session.durationMin} 分钟`).fontSize(11).fontColor(T.c('text-muted'))
        }
        .width('100%')
        ForEach(session.exercises, (exercise: WorkoutExercise, index: number) => {
          Row({ space: 8 }) {
            Text(`${index + 1}`).fontSize(10).fontWeight(700).fontColor(T.c('primary-ink'))
              .width(22).height(22).textAlign(TextAlign.Center).borderRadius(999)
              .backgroundColor(T.c('primary-container'))
            Column({ space: 2 }) {
              Text(exercise.name).fontSize(13).fontWeight(600).fontColor(T.c('text-primary'))
              Text(`${exercise.sets} 组 × ${exercise.reps} · 休息 ${exercise.restSec} 秒`)
                .fontSize(10).fontColor(T.c('text-muted'))
            }
            .alignItems(HorizontalAlign.Start)
            .layoutWeight(1)
            if (exercise.equipment !== '') {
              Text(exercise.equipment).fontSize(10).fontColor(T.c('primary-ink'))
                .padding({ left: 8, right: 8, top: 3, bottom: 3 }).borderRadius(999)
                .backgroundColor(T.c('primary-container'))
            }
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)
        }, (exercise: WorkoutExercise, index: number) => `${session.day}-${index}-${exercise.name}`)
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  build() {
    Column({ space: S6 }) {
      Row() {
        Column({ space: 2 }) {
          Text('身体档案与训练方案').fontSize(22).fontWeight(FontWeight.Bold).fontColor(T.c('text-primary'))
          Text('输入身体数据，系统按目标、水平和已有器材生成计划').fontSize(12).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
      }
      .width('100%')
      .alignItems(VerticalAlign.Top)

      Card() {
        Column({ space: S3 }) {
          Row({ space: 12 }) {
            Field({ label: '身高（cm）', text: this.heightText, num: true,
              change: (v: string): void => { this.heightText = v; } }).layoutWeight(1)
            Field({ label: '体重（kg）', text: this.weightText, num: true,
              change: (v: string): void => { this.weightText = v; } }).layoutWeight(1)
            Field({ label: '年龄', text: this.ageText, num: true,
              change: (v: string): void => { this.ageText = v; } }).layoutWeight(1)
          }
          .width('100%')

          this.ChoiceRow('训练目标')
          Row({ space: 8 }) {
            Chip({ text: '均衡', active: store.profile.trainingGoal === 'general',
              tap: (): void => { store.profile.trainingGoal = 'general'; } })
            Chip({ text: '减脂', active: store.profile.trainingGoal === 'fat_loss',
              tap: (): void => { store.profile.trainingGoal = 'fat_loss'; } })
            Chip({ text: '增肌', active: store.profile.trainingGoal === 'muscle',
              tap: (): void => { store.profile.trainingGoal = 'muscle'; } })
            Chip({ text: '耐力', active: store.profile.trainingGoal === 'endurance',
              tap: (): void => { store.profile.trainingGoal = 'endurance'; } })
          }
          .width('100%')

          this.ChoiceRow('训练水平')
          Row({ space: 8 }) {
            Chip({ text: '入门', active: store.profile.trainingLevel === 'beginner',
              tap: (): void => { store.profile.trainingLevel = 'beginner'; } })
            Chip({ text: '进阶', active: store.profile.trainingLevel === 'intermediate',
              tap: (): void => { store.profile.trainingLevel = 'intermediate'; } })
            Chip({ text: '熟练', active: store.profile.trainingLevel === 'advanced',
              tap: (): void => { store.profile.trainingLevel = 'advanced'; } })
          }
          .width('100%')

          this.ChoiceRow('每周训练天数')
          Row({ space: 8 }) {
            ForEach([1, 2, 3, 4, 5], (day: number) => {
              Chip({ text: `${day} 天`, active: store.profile.weeklyDays === day,
                tap: (): void => { store.profile.weeklyDays = day; } })
            }, (day: number) => `day-${day}`)
          }
          .width('100%')

          Field({ label: '身体限制或注意事项', text: this.limitations,
            placeholder: '如：膝部不适、腰部旧伤；没有可留空',
            change: (v: string): void => { this.limitations = v; } })

          Row({ space: 8 }) {
            Text(this.equipment().length === 0 ? '未发现可用器材，将生成自重计划' :
              `已匹配器材：${this.equipment().join('、')}`)
              .fontSize(11).fontColor(T.c('text-muted')).layoutWeight(1)
            TBtn({ label: '生成计划', icon: 'sparkles', kind: 'primary', small: true,
              tap: (): void => this.save() })
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)
        }
        .alignItems(HorizontalAlign.Start)
      }

      this.PlanHeader()
      if (this.plan.valid) {
        ForEach(this.plan.sessions, (session: WorkoutSession) => {
          this.SessionCard(session)
        }, (session: WorkoutSession) => `session-${session.day}`)
        if (this.plan.equipmentGaps.length > 0) {
          Text(`可补充器材：${this.plan.equipmentGaps.join('、')}。未拥有的器材不会进入当前动作。`)
            .fontSize(11).lineHeight(17).fontColor(T.c('text-muted')).width('100%')
        }
      }
      Text('本页不做诊断或处方。出现疼痛、眩晕或基础疾病时，请停止训练并咨询医生或专业教练。')
        .fontSize(10).lineHeight(16).fontColor(T.c('text-muted')).width('100%')
    }
    .width('100%')
    .padding({ bottom: S6 })
    .alignItems(HorizontalAlign.Start)
  }
}
