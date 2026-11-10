const test = require("node:test");
const assert = require("node:assert/strict");
const { rank, frontier, portfolio } = require("../js/rescue.js");

const recipes = [
  {
    title: "番茄炒蛋",
    time: "15 分钟",
    kcal: 320,
    prot: 14,
    tags: ["家常", "快手"],
    method: "炒",
    ing: [["鸡蛋", "3 个", "egg"], ["番茄", "2 个", "tomato"]]
  },
  {
    title: "香煎鸡胸肉",
    time: "18 分钟",
    kcal: 280,
    prot: 34,
    tags: ["增肌", "低脂"],
    method: "煎",
    ing: [["鸡肉", "200 克", "chicken"]]
  }
];

test("临期食材完整的方案排在普通食材方案之前", () => {
  const items = [
    { name: "鸡蛋", kbKey: "egg", qty: 6, unit: "个", expDays: 1, price: 8 },
    { name: "番茄", kbKey: "tomato", qty: 3, unit: "个", expDays: 2, price: 5 },
    { name: "鸡肉", kbKey: "chicken", qty: 2, unit: "份", expDays: 20, price: 20 }
  ];
  const out = rank(recipes, items, { soon: 7 });
  assert.equal(out[0].title, "番茄炒蛋");
  assert.equal(out[0].matchRate, 100);
  assert.equal(out[0].labels.includes("临期优先"), true);
});

test("忌口整道排除，expDays=0 不作为可救回食材", () => {
  const items = [
    { name: "鸡蛋", kbKey: "egg", qty: 6, unit: "个", expDays: 1, price: 8 },
    { name: "番茄", kbKey: "tomato", qty: 3, unit: "个", expDays: 0, price: 5 }
  ];
  const out = rank(recipes, items, { soon: 7, dislikes: ["鸡蛋"] });
  assert.equal(out.some((x) => x.title === "番茄炒蛋"), false);
});

test("相同输入和筛选得到相同顺序", () => {
  const items = [
    { name: "鸡肉", kbKey: "chicken", qty: 2, unit: "份", expDays: 2, price: 20 }
  ];
  const a = rank(recipes, items, { soon: 7, maxMinutes: 20 });
  const b = rank(recipes, items, { soon: 7, maxMinutes: 20 });
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
});

test("Pareto 前沿保留互不支配的候选并标记支配关系", () => {
  const out = rank(
    [
      ...recipes,
      {
        title: "番茄蛋花汤",
        time: "8 分钟",
        kcal: 160,
        prot: 8,
        tags: ["清淡"],
        method: "煮",
        ing: [["鸡蛋", "1 个", "egg"], ["番茄", "1 个", "tomato"]]
      }
    ],
    [
      { name: "鸡蛋", kbKey: "egg", qty: 6, unit: "个", expDays: 1, price: 8 },
      { name: "番茄", kbKey: "tomato", qty: 3, unit: "个", expDays: 2, price: 5 },
      { name: "鸡肉", kbKey: "chicken", qty: 2, unit: "份", expDays: 20, price: 20 }
    ],
    { soon: 7 }
  );
  const front = frontier(out);
  assert.equal(front.length >= 1, true);
  assert.equal(front.every((x) => x.pareto === true), true);
  assert.equal(out.some((x) => Array.isArray(x.dominatedBy)), true);
});

test("组合求解优先覆盖不同临期食材并遵守总时长", () => {
  const candidates = rank(
    [
      {
        title: "蛋番茄",
        time: "20 分钟",
        kcal: 320,
        prot: 14,
        tags: [],
        method: "炒",
        ing: [["鸡蛋", "2 个", "egg"], ["番茄", "1 个", "tomato"]]
      },
      {
        title: "蛋奶",
        time: "20 分钟",
        kcal: 280,
        prot: 12,
        tags: [],
        method: "煮",
        ing: [["鸡蛋", "1 个", "egg"], ["牛奶", "1 盒", "milk"]]
      },
      {
        title: "牛奶燕麦",
        time: "10 分钟",
        kcal: 280,
        prot: 12,
        tags: [],
        method: "煮",
        ing: [["牛奶", "1 盒", "milk"], ["燕麦", "50 克", "oat"]]
      }
    ],
    [
      { name: "鸡蛋", kbKey: "egg", qty: 3, unit: "个", expDays: 1, price: 8 },
      { name: "番茄", kbKey: "tomato", qty: 2, unit: "个", expDays: 2, price: 6 },
      { name: "牛奶", kbKey: "milk", qty: 2, unit: "盒", expDays: 1, price: 12 },
      { name: "燕麦", kbKey: "oat", qty: 1, unit: "袋", expDays: 200, price: 10 }
    ],
    { soon: 7 }
  );
  const plan = portfolio(candidates, { maxMeals: 2, maxTotalMinutes: 40 });
  assert.equal(plan.meals.length, 2);
  assert.equal(plan.totalMinutes <= 40, true);
  assert.equal(plan.rescuedKeys.includes("egg"), true);
  assert.equal(plan.rescuedKeys.includes("milk"), true);
  assert.equal(plan.missing.length <= 2, true);
});

test("无可用库存时返回可解释空结果", () => {
  const out = rank([], [], { soon: 7 });
  assert.deepEqual(out, []);
  assert.deepEqual(frontier(out), []);
  assert.deepEqual(portfolio(out, { maxMeals: 3 }).meals, []);
});
