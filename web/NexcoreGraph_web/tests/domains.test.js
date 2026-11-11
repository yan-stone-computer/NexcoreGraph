const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze, fitnessPlan } = require("../js/domains.js");

function libraries() {
  return [
    {
      id: "medicine",
      name: "家庭药箱",
      icon: "pill",
      items: [
        { id: "m1", name: "布洛芬", qty: 1, unit: "盒", expDays: 2, lowAt: 1, pos: "上层" },
        { id: "m2", name: "创可贴", qty: 8, unit: "片", expDays: 120, lowAt: 5, pos: "下层" }
      ]
    },
    {
      id: "fitness",
      name: "健身角",
      icon: "dumbbell",
      items: [
        { id: "f1", name: "可调哑铃", qty: 1, unit: "对", expDays: 9000, pos: "阳台" },
        { id: "f2", name: "瑜伽垫", qty: 1, unit: "张", expDays: 9000, pos: "客厅" }
      ]
    },
    {
      id: "tools",
      name: "维修工具箱",
      icon: "wrench",
      items: [
        { id: "t1", name: "电钻", qty: 1, unit: "把", expDays: 9000, warrantyDays: 12, borrower: "邻居", loanDueDays: 1, pos: "储物间" },
        { id: "t2", name: "螺丝刀套装", qty: 1, unit: "套", expDays: 9000, pos: "工具箱" }
      ]
    },
    {
      id: "wardrobe",
      name: "衣橱",
      icon: "shirt",
      items: [{ id: "w1", name: "冬季大衣", qty: 1, unit: "件", price: 699, expDays: 9000, pos: "衣柜右侧" }]
    },
    {
      id: "appliances",
      name: "家电",
      icon: "plug",
      items: [{ id: "a1", name: "净水器", qty: 1, unit: "台", price: 1699, expDays: 9000, warrantyDays: 20, maintenanceDays: 10, pos: "厨房" }]
    },
    {
      id: "books",
      name: "书架",
      icon: "book",
      items: [{ id: "b1", name: "分布式系统", qty: 1, unit: "本", price: 89, expDays: 9000, pos: "书房" }]
    },
    {
      id: "pet",
      name: "宠物用品",
      icon: "paw",
      items: [{ id: "p1", name: "猫粮", qty: 1, unit: "袋", price: 129, expDays: 120, lowAt: 1, pos: "储藏柜" }]
    },
    {
      id: "cleaning",
      name: "清洁耗材",
      icon: "package",
      items: [{ id: "c1", name: "垃圾袋", qty: 1, unit: "卷", price: 12.9, expDays: 9000, lowAt: 2, pos: "清洁柜" }]
    }
  ];
}

test("识别药箱、健身器材和工具箱三个生活域", () => {
  const result = analyze(libraries(), {});
  assert.equal(result.medicine.totalItems, 2);
  assert.equal(result.medicine.expiringItems.length, 1);
  assert.equal(result.fitness.equipment.length, 2);
  assert.equal(result.tools.warrantySoon.length, 1);
  assert.equal(result.tools.activeLoans.length, 1);
  assert.equal(result.tools.loanDueSoon.length, 1);
  assert.equal(result.inventory.food.count >= 0, true);
  assert.equal(result.inventory.appliance.count, 1);
  assert.equal(result.inventory.wardrobe.count, 1);
  assert.equal(result.inventory.books.count, 1);
});

test("汇总全屋资源、生活资产和跨域风险", () => {
  const result = analyze(libraries(), {});
  assert.equal(result.household.totalItems, 11);
  assert.equal(result.household.totalValue, 2628.9);
  assert.equal(result.household.activeDomains, 8);
  assert.equal(result.household.assetItems, 5);
  assert.equal(result.household.riskCount, 5);
  assert.deepEqual(
    result.household.riskDomains.map((domain) => domain.key),
    ["medicine", "tools", "appliance", "pet", "cleaning"]
  );
});

test("药品临期优先排序并生成补货提示", () => {
  const result = analyze(libraries(), {});
  assert.equal(result.medicine.expiringItems[0].name, "布洛芬");
  assert.equal(result.medicine.lowStock.some((item) => item.name === "布洛芬"), true);
});

test("根据身体数据和现有器材生成训练计划", () => {
  const plan = fitnessPlan(
    { height: 175, weight: 78, age: 30, goal: "减脂", level: "新手", days: 3 },
    ["可调哑铃", "瑜伽垫"]
  );
  assert.equal(plan.bmi, 25.5);
  assert.equal(plan.bmiLabel, "超重");
  assert.equal(plan.sessions.length, 3);
  assert.deepEqual(plan.targetHeartRate, { min: 114, max: 133 });
  assert.equal(plan.equipmentUsed.includes("哑铃"), true);
  assert.equal(plan.exercises.some((item) => item.name.includes("哑铃")), true);
});

test("没有健身器材时自动退化为自重训练", () => {
  const plan = fitnessPlan(
    { height: 165, weight: 58, age: 28, goal: "保持", level: "新手", days: 2 },
    []
  );
  assert.equal(plan.sessions.length, 2);
  assert.equal(plan.equipmentUsed.includes("自重"), true);
  assert.equal(plan.exercises.some((item) => item.name.includes("深蹲")), true);
});

test("异常身体数据给出安全提示但不生成夸张承诺", () => {
  const plan = fitnessPlan(
    { height: 175, weight: 78, age: 70, goal: "增肌", level: "新手", days: 0 },
    []
  );
  assert.equal(plan.sessions.length >= 2, true);
  assert.equal(plan.safetyNotes.some((note) => note.includes("专业人士")), true);
});
