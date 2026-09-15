/* 启核图策 · 通用知识库（对应完整文档第 6 篇 knowledge/*.json 的 Web 端内置子集）
   结构对齐：foods.json（保质期/存放/lowAt）、recipes.json（方案素材池）、storage-rules.json（通用规则）。
   天数为参考值；AI 回答保留「异味/变色/发黏一律不食」提示（来源见 KB.sources）。 */
(function () {
  "use strict";

  /* ---------- 食材保质期库（天） ---------- */
  /* cold=冷藏天数 roomTemp=常温天数 frozen=冷冻天数 open=开封后天数 lowAt=低库存建议阈值 */
  var FOODS = {
    egg:      { name: "鸡蛋", days: 30, open: 0, frozen: 60, tip: "洗净连盒冷藏，勿放冰箱门边（开门震动易散黄）", lowAt: 5, src: "中国营养保健食品协会", url: "https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565" },
    milk:     { name: "鲜牛奶", days: 6, open: 1, frozen: 0, tip: "巴氏奶开封后 24 小时内喝完，勿回温再冷藏", lowAt: 1, src: "中国营养保健食品协会", url: "https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565" },
    yogurt:   { name: "酸奶", days: 14, open: 2, frozen: 0, tip: "冷藏保存，开封后尽快食用", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    tofu:     { name: "豆腐", days: 4, open: 1, frozen: 30, tip: "浸清水冷藏，每天换水", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    tomato:   { name: "番茄", days: 12, open: 0, frozen: 0, tip: "未全熟可室温放置，成熟后冷藏", lowAt: 2, src: "中国营养保健食品协会", url: "https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565" },
    greens:   { name: "叶菜（上海青/菠菜）", days: 3, open: 0, frozen: 0, tip: "纸巾包裹加保鲜袋冷藏，2-3 天内食用", lowAt: 1, src: "营养师公会", url: "https://www.ctwant.com/article/440686/" },
    bokchoy:  { name: "小白菜", days: 3, open: 0, frozen: 0, tip: "去黄叶，纸巾包裹冷藏", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    cucumber: { name: "黄瓜", days: 7, open: 0, frozen: 0, tip: "擦干装袋冷藏，避免冻伤（<4°C 易出水）", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    potato:   { name: "土豆", days: 30, open: 0, frozen: 0, tip: "阴凉避光常温存放，勿与洋葱同放（互相催芽）", lowAt: 2, src: "食品安全通用规则", url: "" },
    onion:    { name: "洋葱", days: 30, open: 7, frozen: 0, tip: "网袋悬挂阴凉干燥处，切开后密封冷藏", lowAt: 1, src: "食品安全通用规则", url: "" },
    carrot:   { name: "胡萝卜", days: 21, open: 0, frozen: 60, tip: "去缨擦干装袋冷藏", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    banana:   { name: "香蕉", days: 5, open: 0, frozen: 30, tip: "常温悬挂存放，勿冷藏（低温黑皮）", lowAt: 1, src: "Mayo Clinic", url: "https://www.mayoclinic.org" },
    apple:    { name: "苹果", days: 30, open: 0, frozen: 0, tip: "冷藏可显著延后变质，单独存放（乙烯催熟）", lowAt: 2, src: "Mayo Clinic", url: "https://www.mayoclinic.org" },
    pork:     { name: "生猪肉", days: 3, open: 0, frozen: 90, tip: "冷藏不超 3-5 天；擦干分装冷冻", lowAt: 1, src: "黑龙江省人民政府", url: "https://www.hlj.gov.cn" },
    chicken:  { name: "鸡肉", days: 2, open: 0, frozen: 180, tip: "生禽肉冷藏 1-2 天，尽早冷冻", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    fish:     { name: "鲜鱼", days: 2, open: 0, frozen: 90, tip: "去内脏洗净沥干，冷藏 1-2 天", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    shrimp:   { name: "虾", days: 2, open: 0, frozen: 90, tip: "冰水冲洗后冷冻保鲜", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    rice:     { name: "大米", days: 180, open: 180, frozen: 0, tip: "密封防潮防虫，阴凉干燥处", lowAt: 1, src: "食品安全通用规则", url: "" },
    noodle:   { name: "挂面", days: 365, open: 365, frozen: 0, tip: "干燥密封保存", lowAt: 1, src: "食品安全通用规则", url: "" },
    oat:      { name: "燕麦", days: 365, open: 90, frozen: 0, tip: "开封后密封防潮", lowAt: 1, src: "食品安全通用规则", url: "" },
    soyOil:   { name: "食用油", days: 365, open: 90, frozen: 0, tip: "避光避热，开封后 3 个月内用完", lowAt: 1, src: "食品安全通用规则", url: "" },
    soySauce: { name: "生抽/酱油", days: 540, open: 90, frozen: 0, tip: "开封后冷藏可抑制霉变", lowAt: 1, src: "食品安全通用规则", url: "" },
   bread:     { name: "面包", days: 5, open: 3, frozen: 30, tip: "常温 2-3 天，冷冻保存更久，勿冷藏（回生变硬）", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    mushroom: { name: "蘑菇", days: 5, open: 0, frozen: 0, tip: "纸袋存放冷藏，勿密封塑料袋（易黏液）", lowAt: 1, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" },
    leftover: { name: "剩菜", days: 2, open: 0, frozen: 30, tip: "出锅 2 小时内冷藏，复热须彻底加热一次", lowAt: 0, src: "香港食物安全中心", url: "https://www.cfs.gov.hk" }
  };

  /* ---------- 家常菜谱池（F3.1 方案素材 / P0-3 营养速览） ---------- */
  /* ing: 用料 [名称, 数量文本, kbKey]；kcal/prot 为每份估算值 */
  var RECIPES = [
    { title: "番茄炒蛋", time: "15 分钟", kcal: 320, prot: 14, tags: ["家常", "快手"], ing: [["鸡蛋", "3 个", "egg"], ["番茄", "2 个", "tomato"]] },
    { title: "上汤上海青", time: "20 分钟", kcal: 150, prot: 6, tags: ["清淡"], ing: [["上海青", "1 把", "greens"], ["皮蛋", "1 个", ""]] },
    { title: "清炒上海青", time: "12 分钟", kcal: 110, prot: 4, tags: ["清淡", "快手"], ing: [["上海青", "1 把", "greens"]] },
    { title: "牛奶燕麦粥", time: "10 分钟", kcal: 280, prot: 12, tags: ["早餐"], ing: [["鲜牛奶", "0.5 盒", "milk"], ["燕麦", "50 克", "oat"]] },
    { title: "青椒炒肉", time: "25 分钟", kcal: 430, prot: 22, tags: ["下饭"], ing: [["五花肉", "200 克", "pork"], ["青椒", "2 个", ""]] },
    { title: "番茄鸡蛋面", time: "20 分钟", kcal: 520, prot: 20, tags: ["主食"], ing: [["鸡蛋", "2 个", "egg"], ["番茄", "1 个", "tomato"], ["挂面", "100 克", "noodle"]] },
    { title: "香菇蒸鸡", time: "35 分钟", kcal: 380, prot: 28, tags: ["蒸菜"], ing: [["鸡肉", "300 克", "chicken"], ["蘑菇", "4 朵", "mushroom"]] },
    { title: "红烧豆腐", time: "20 分钟", kcal: 260, prot: 16, tags: ["素菜"], ing: [["豆腐", "1 块", "tofu"]] },
    { title: "蒜蓉炒时蔬", time: "10 分钟", kcal: 120, prot: 3, tags: ["清淡", "快手"], ing: [["小白菜", "1 把", "bokchoy"]] },
    { title: "黄瓜炒虾仁", time: "18 分钟", kcal: 240, prot: 24, tags: ["低脂"], ing: [["虾", "200 克", "shrimp"], ["黄瓜", "1 根", "cucumber"]] },
    { title: "土豆烧肉", time: "45 分钟", kcal: 560, prot: 20, tags: ["硬菜"], ing: [["土豆", "2 个", "potato"], ["五花肉", "250 克", "pork"]] },
    { title: "洋葱炒蛋", time: "12 分钟", kcal: 280, prot: 13, tags: ["快手"], ing: [["洋葱", "1 个", "onion"], ["鸡蛋", "2 个", "egg"]] },
    { title: "萝卜排骨汤", time: "60 分钟", kcal: 350, prot: 22, tags: ["汤煲"], ing: [["胡萝卜", "1 根", "carrot"]] },
    { title: "苹果燕麦杯", time: "8 分钟", kcal: 220, prot: 8, tags: ["早餐", "低脂"], ing: [["苹果", "1 个", "apple"], ["燕麦", "40 克", "oat"], ["酸奶", "1 杯", "yogurt"]] },
    { title: "香煎鸡胸肉", time: "18 分钟", kcal: 280, prot: 34, tags: ["增肌", "低脂"], ing: [["鸡肉", "200 克", "chicken"]] },
    { title: "蔬菜蛋炒饭", time: "15 分钟", kcal: 480, prot: 15, tags: ["主食", "清库存"], ing: [["鸡蛋", "2 个", "egg"], ["米饭", "1 碗", "rice"], ["胡萝卜", "半根", "carrot"]] }
  ];

  /* ---------- 食品安全通用规则（AI 对话证据 / 存放建议） ---------- */
  var RULES = [
    { id: "r1", text: "冰箱冷藏室应保持 4°C 以下，冷冻室 -18°C 以下", tag: "温度带" },
    { id: "r2", text: "生熟分开：生肉海鲜放底层密封盒，即食食物放上层", tag: "交叉污染" },
    { id: "r3", text: "剩菜出锅 2 小时内冷藏，保存不超 2 天，复热只加热一次且须彻底", tag: "剩菜" },
    { id: "r4", text: "冷冻解冻：优先冷藏室缓慢解冻，勿室温久放，解冻后不再回冻", tag: "解冻" },
    { id: "r5", text: "「过期 / 临期」判断：异味、变色、发黏、胀袋一律不食，天数仅参考", tag: "预警" },
    { id: "r6", text: "土豆与洋葱分开放，乙烯水果（苹果/香蕉）与蔬菜分开存", tag: "存放" },
    { id: "r7", text: "香蕉、芒果、番茄勿冷藏（低温冷害），成熟前室温存放", tag: "存放" },
    { id: "r8", text: "鸡蛋存放前不水洗（破坏壳外膜），尖头朝下放置", tag: "存放" },
    { id: "r9", text: "开封调味料标注开封日期，酱油开封后建议冷藏", tag: "开封" },
    { id: "r10", text: "药品按说明书存放，多数需避光干燥；眼药水开封后 1 个月内用完", tag: "药盒" }
  ];

  /* 兼容 demo 的 kbKey 查询（app.js 的 exp-bar / 识别来源标注使用） */
  var KNOWLEDGE = {};
  Object.keys(FOODS).forEach(function (k) {
    var f = FOODS[k];
    KNOWLEDGE[k] = { name: f.name, days: f.days, tip: f.tip, src: f.src, url: f.url };
  });

  window.KB = {
    foods: FOODS,
    recipes: RECIPES,
    rules: RULES,
    version: 1,
    sources: "中国营养保健食品协会 / 香港食物安全中心 / Mayo Clinic / 黑龙江省人民政府（详见完整文档第 6 篇 knowledge/sources.md）",
    DISCLAIMER: "以上天数为参考值；异味、变色、发黏一律不食。"
  };
  window.KNOWLEDGE = KNOWLEDGE;
})();
