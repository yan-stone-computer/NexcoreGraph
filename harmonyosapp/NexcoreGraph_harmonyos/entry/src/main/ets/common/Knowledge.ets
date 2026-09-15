/* 启核图策 · 内置知识库（M2.5 P0-3 营养速览 + 创新菜谱素材）
   数据镜像仓库 knowledge/foods.json 与 knowledge/recipes.json（权威来源见 knowledge/sources.md），
   打包为代码常量避免 rawfile 解析；后端 knowledge 表上线后可切换为接口下发。 */

import { Consume } from './Db';

export class RecipeTpl {
  name: string = '';
  time: string = '';
  kcal: number = 0;
  used: Consume[] = [];
  optional: Consume[] = [];

  constructor(name: string, time: string, kcal: number, used: Consume[], optional: Consume[]) {
    this.name = name;
    this.time = time;
    this.kcal = kcal;
    this.used = used;
    this.optional = optional;
  }
}

/* 家常菜谱池（每份估算热量，千卡；烹调油影响大，仅作"约"值展示） */
export const RECIPES: RecipeTpl[] = [
  new RecipeTpl('番茄炒蛋', '10 分钟', 542, [new Consume('鸡蛋', '3 个'), new Consume('番茄', '2 个')], []),
  new RecipeTpl('青椒炒肉', '15 分钟', 440, [new Consume('五花肉', '200 克'), new Consume('青椒', '2 个')], [new Consume('大蒜', '2 瓣')]),
  new RecipeTpl('清炒上海青', '12 分钟', 120, [new Consume('上海青', '1 把')], [new Consume('大蒜', '2 瓣')]),
  new RecipeTpl('上汤上海青', '20 分钟', 180, [new Consume('上海青', '1 把')], [new Consume('皮蛋', '1 个')]),
  new RecipeTpl('牛奶燕麦粥', '10 分钟', 260, [new Consume('鲜牛奶', '0.5 盒'), new Consume('燕麦', '50 克')], []),
  new RecipeTpl('番茄蛋花汤', '10 分钟', 130, [new Consume('番茄', '1 个'), new Consume('鸡蛋', '1 个')], []),
  new RecipeTpl('蒜蓉西兰花', '12 分钟', 110, [new Consume('西兰花', '1 颗')], [new Consume('大蒜', '3 瓣')]),
  new RecipeTpl('家常麻婆豆腐', '20 分钟', 320, [new Consume('豆腐', '1 盒')], [new Consume('豆瓣酱', '1 勺')]),
  new RecipeTpl('香煎鸡胸肉', '15 分钟', 220, [new Consume('鸡胸肉', '200 克')], [new Consume('黑胡椒', '少许')]),
  new RecipeTpl('紫菜蛋花汤', '8 分钟', 90, [new Consume('鸡蛋', '1 个')], [new Consume('紫菜', '适量')]),
  new RecipeTpl('黄金蛋炒饭', '12 分钟', 480, [new Consume('隔夜米饭', '1 碗'), new Consume('鸡蛋', '2 个')], [new Consume('火腿', '适量')]),
  new RecipeTpl('醋溜土豆丝', '12 分钟', 190, [new Consume('土豆', '2 个')], [new Consume('干辣椒', '2 个')]),
  new RecipeTpl('凉拌黄瓜', '8 分钟', 70, [new Consume('黄瓜', '2 根')], [new Consume('大蒜', '2 瓣')]),
  new RecipeTpl('清蒸鲈鱼', '25 分钟', 260, [new Consume('鲈鱼', '1 条')], [new Consume('蒸鱼豉油', '2 勺')]),
  new RecipeTpl('虾仁蒸蛋', '15 分钟', 180, [new Consume('鸡蛋', '2 个'), new Consume('虾', '100 克')], []),
  new RecipeTpl('酸奶水果碗', '5 分钟', 210, [new Consume('酸奶', '1 杯')], [new Consume('燕麦', '20 克')])
];

/** 精确匹配菜名取热量 */
export function kcalExact(name: string): number {
  for (let i = 0; i < RECIPES.length; i++) {
    if (RECIPES[i].name === name) {
      return RECIPES[i].kcal;
    }
  }
  return 0;
}

/** 关键词粗估热量（AI 创新菜谱等没有精确条目时，展示"约"值） */
export function kcalGuess(name: string): number {
  const e = kcalExact(name);
  if (e > 0) {
    return e;
  }
  if (name.includes('汤') || name.includes('羹')) {
    return 130;
  }
  if (name.includes('粥')) {
    return 260;
  }
  if (name.includes('饭') || name.includes('面')) {
    return 480;
  }
  if (name.includes('虾') || name.includes('鱼')) {
    return 220;
  }
  if (name.includes('沙拉') || name.includes('拌')) {
    return 120;
  }
  return 300;
}
