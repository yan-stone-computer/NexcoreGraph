/* Deterministic body-profile and equipment-aware workout planning.
   This module does not diagnose, prescribe or write inventory. */

export class WorkoutInput {
  heightCm: number = 0;
  weightKg: number = 0;
  age: number = 0;
  goal: string = 'general';
  level: string = 'beginner';
  weeklyDays: number = 3;
  limitations: string = '';
  equipment: string[] = [];
}

export class WorkoutExercise {
  name: string = '';
  sets: number = 0;
  reps: string = '';
  restSec: number = 0;
  equipment: string = '';
  note: string = '';
}

export class WorkoutSession {
  day: number = 1;
  focus: string = '';
  durationMin: number = 0;
  exercises: WorkoutExercise[] = [];
}

export class WorkoutPlan {
  valid: boolean = false;
  bmi: number = 0;
  bmiLabel: string = '';
  safetyNote: string = '';
  summary: string = '';
  sessions: WorkoutSession[] = [];
  equipmentGaps: string[] = [];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) {
    return 0;
  }
  const meters: number = heightCm / 100;
  return round1(weightKg / (meters * meters));
}

function bmiLabel(bmi: number): string {
  if (bmi <= 0) {
    return '待补全';
  }
  if (bmi < 18.5) {
    return '偏低';
  }
  if (bmi < 24) {
    return '正常';
  }
  if (bmi < 28) {
    return '偏高';
  }
  return '较高';
}

function owned(input: WorkoutInput, equipment: string): boolean {
  return equipment === '' || input.equipment.indexOf(equipment) >= 0;
}

function makeExercise(name: string, equipment: string, goal: string, level: string): WorkoutExercise {
  const item = new WorkoutExercise();
  item.name = name;
  item.equipment = equipment;
  item.sets = level === 'advanced' ? 4 : level === 'intermediate' ? 3 : 2;
  item.restSec = goal === 'muscle' ? 60 : goal === 'fat_loss' ? 30 : goal === 'endurance' ? 45 : 35;
  if (goal === 'muscle') {
    item.reps = '8-12 次';
  } else if (goal === 'fat_loss') {
    item.reps = '12-15 次';
  } else if (goal === 'endurance') {
    item.reps = '15-20 次';
  } else if (goal === 'mobility') {
    item.reps = '30 秒';
    item.sets = Math.max(2, item.sets - 1);
    item.restSec = 20;
  } else {
    item.reps = '10-12 次';
  }
  item.note = equipment === '' ? '自重动作' : `使用${equipment}`;
  return item;
}

function candidates(focus: string, input: WorkoutInput): WorkoutExercise[] {
  const out: WorkoutExercise[] = [];
  const add = (name: string, equipment: string): void => {
    if (owned(input, equipment) && out.length < 5) {
      out.push(makeExercise(name, equipment, input.goal, input.level));
    }
  };
  if (focus === '下肢') {
    add('徒手深蹲', '');
    add('反向弓步', '');
    add('臀桥', '');
    add('高脚杯深蹲', '哑铃');
    add('弹力带侧步', '弹力带');
  } else if (focus === '上肢') {
    add('跪姿俯卧撑', '');
    add('俯身划船', '哑铃');
    add('肩上推举', '哑铃');
    add('弹力带划船', '弹力带');
    add('鸟狗式', '');
  } else if (focus === '心肺') {
    add('原地快走', '');
    add('低冲击开合步', '');
    add('跑步机坡度走', '跑步机');
    add('弹力带侧向走', '弹力带');
    add('登山跑', '');
  } else if (focus === '灵活与恢复') {
    add('猫牛式', '');
    add('髋屈肌拉伸', '');
    add('胸椎旋转', '');
    add('瑜伽垫婴儿式', '瑜伽垫');
    add('鸟狗式', '');
  } else {
    add('徒手深蹲', '');
    add('跪姿俯卧撑', '');
    add('臀桥', '');
    add('平板支撑', '');
    add('哑铃划船', '哑铃');
  }
  return out;
}

function fillBodyweight(exercises: WorkoutExercise[], input: WorkoutInput): void {
  const fallback: string[] = ['徒手深蹲', '跪姿俯卧撑', '臀桥', '鸟狗式', '原地踏步'];
  let index: number = 0;
  while (exercises.length < 4 && index < fallback.length) {
    const name: string = fallback[index];
    if (!exercises.some((exercise: WorkoutExercise): boolean => exercise.name === name)) {
      exercises.push(makeExercise(name, '', input.goal, input.level));
    }
    index += 1;
  }
}

export function buildWorkoutPlan(input: WorkoutInput): WorkoutPlan {
  const plan = new WorkoutPlan();
  const bmi: number = calculateBmi(input.heightCm, input.weightKg);
  plan.bmi = bmi;
  plan.bmiLabel = bmiLabel(bmi);
  if (input.heightCm < 120 || input.heightCm > 230 || input.weightKg < 30 ||
    input.weightKg > 250 || input.age < 12 || input.age > 90) {
    plan.safetyNote = '身体数据超出可生成范围，请核对后再试。';
    return plan;
  }
  plan.valid = true;
  const days: number = Math.max(1, Math.min(6, Math.round(input.weeklyDays)));
  const focuses: string[] = ['全身', '下肢', '上肢', '心肺', '灵活与恢复', '全身'];
  for (let i = 0; i < days; i++) {
    const focus: string = focuses[i % focuses.length];
    const session = new WorkoutSession();
    session.day = i + 1;
    session.focus = focus;
    session.exercises = candidates(focus, input);
    fillBodyweight(session.exercises, input);
    session.durationMin = 20 + session.exercises.length * 5;
    plan.sessions.push(session);
  }
  plan.equipmentGaps = ['哑铃', '弹力带', '跑步机', '瑜伽垫'].filter((name: string): boolean =>
    input.equipment.indexOf(name) < 0);
  plan.summary = `${days} 天 · ${input.goal} · ${input.level} · BMI ${bmi}`;
  if (bmi < 18.5) {
    plan.safetyNote = 'BMI 偏低，训练强度和营养安排建议先咨询专业人士。';
  } else if (bmi >= 30) {
    plan.safetyNote = 'BMI 较高，建议从低冲击动作开始，并先咨询医生或专业教练。';
  } else if (input.age < 16 || input.age > 65) {
    plan.safetyNote = '年龄边界下建议降低强度，并由专业人士确认训练限制。';
  } else if (input.limitations.trim() !== '') {
    plan.safetyNote = '已记录身体限制。若动作引起疼痛，请停止并咨询专业人士。';
  } else {
    plan.safetyNote = '训练前热身，动作疼痛时立即停止。本计划不替代医生或教练建议。';
  }
  return plan;
}
