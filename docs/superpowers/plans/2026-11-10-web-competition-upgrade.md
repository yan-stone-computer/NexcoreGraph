# Web 临期菜谱推荐与传智杯材料补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将评委提出的“增加临期菜谱推荐”做成可解释、可交互、可执行、可撤销的 Web 核心功能，并按传智杯要求补齐 README、环境模板、测试证据、技术 PDF 和离线提交包；本轮不制作视频。

**Architecture:** 保留现有零构建 HTML/CSS/JS，新增独立确定性救援评分模块。页面层只展示候选，`mockapi.js` 负责状态写入，`ai.js` 与 GraphRAG 只解释代码已算出的事实。主入口增加“临期救援驾驶舱”，AI 工作台增加 Top 2 主动入口，拍照入库完成后给出下一步行动。

**Advanced Layer:** 在确定性排序之上加入多目标 Pareto 前沿、约束菜单组合求解、反事实沙盘和可回放决策轨迹。界面称其为“救援求解器”，不把它包装成无法解释的黑盒模型。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js 24 内置测试运行器、Python 3.14、python-docx、ReportLab、现有 Edge CDP 验收脚本。

**Spec:** 用户 2026-11-10 提供的提交要求与评分截图；仓库基线见 `docs/启核图策-Web端专项整改与验收文档.md` 和 `web/NexcoreGraph_web/js/`。

## Global Constraints

- 当前评分为 84；优先响应“增加临期菜谱推荐”，截止前不混入高风险 Vue 全量重写。
- 保留现有未提交改动；禁止 `git reset --hard`、`git checkout --` 或覆盖式迁移。
- 真实 API Key 只放服务端环境变量或本机 `.env`；仓库、提交包和截图不得出现有效密钥。
- `expDays > 0` 才进入临期计算；异味、变色、发黏、胀袋必须提示丢弃。
- 数量、位置、日期、缺料、营养和救回价值由代码计算；模型只能解释，不能直接写库存。
- 写操作统一“预览 → 确认 → 生效 → 可撤销 → 写日志”。
- 桌面、平板、手机均可用；用户输入进入 HTML 前必须转义。
- 技术文档 PDF 不超过 30 页，必须包含 AI 选型、集成优化、技术创新与应用创新。
- 在线演示是可选加分项；未部署时不得伪造地址。视频标记为用户确认本轮暂缓。
- Pareto 与菜单组合优化必须返回可复算的目标值、约束和淘汰原因；禁止用未实现的“量子”“因果大模型”等术语包装普通加权排序。

---

## File Structure

**Create**

- `web/NexcoreGraph_web/js/rescue.js`：纯函数匹配、评分、缺料和救回价值计算。
- `web/NexcoreGraph_web/js/rescue-view.js`：救援驾驶舱、筛选沙盘、步骤抽屉和事件绑定。
- `web/NexcoreGraph_web/tests/rescue.test.js`：排序、安全、忌口、筛选和确定性测试。
- `tools/verify_rescue_web.py`：登录、筛选、预览、执行、撤销和移动端 CDP 验收。
- `docs/传智杯-Web端提交核验单.md`：官网要求、证据路径、状态和责任方。
- `deliverables/传智杯_Web端_提交材料_20261110/`：最终离线提交目录。

**Modify**

- `web/NexcoreGraph_web/index.html`：加载新模块，资源版本改为 `v=31`。
- `web/NexcoreGraph_web/js/knowledge.js`：为 16 道菜补充烹饪方式、步骤模板和替代建议。
- `web/NexcoreGraph_web/js/mockapi.js`：新增候选查询、候选转方案和救援战绩。
- `web/NexcoreGraph_web/js/app.js`：新增导航、视图和入库后的下一步推荐。
- `web/NexcoreGraph_web/js/ai.js`：新增 `rescue` 意图和确定性快答。
- `web/NexcoreGraph_web/js/workbench.js`：增加“今晚先救哪几样”入口。
- `web/NexcoreGraph_web/js/graph-rag.js`：将救援排序补入多跳证据。
- `web/NexcoreGraph_web/css/extra.css`：救援页视觉、响应式、焦点态和低动效适配。
- `web/NexcoreGraph_web/README.md`、`web/NexcoreGraph_web/.env.example`、`README.md`：材料与运行说明。
- `tools/build_web_technical_doc.py`：生成当前传智杯技术文档。

---

### Task 1: 建立可测试的救援核心

**Files**

- Create: `web/NexcoreGraph_web/js/rescue.js`
- Create: `web/NexcoreGraph_web/tests/rescue.test.js`

**Interfaces**

- Consumes: `recipes`、库存 `items`、`{soon, dislikes, maxMinutes, includeMissing}`。
- Produces: `RESCUE.rank(recipes, items, options): Candidate[]`、`RESCUE.frontier(candidates): Candidate[]`、`RESCUE.portfolio(candidates, options): Portfolio`。
- Candidate 至少含 `id/title/score/matchRate/rescueItems/rescuedValue/matched/missing/labels/steps/subs`。

- [ ] **Step 1: 写失败测试**

```js
// web/NexcoreGraph_web/tests/rescue.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { rank } = require("../js/rescue.js");

const recipes = [
  { title: "番茄炒蛋", time: "15 分钟", kcal: 320, prot: 14, method: "炒",
    ing: [["鸡蛋", "3 个", "egg"], ["番茄", "2 个", "tomato"]] },
  { title: "香煎鸡胸肉", time: "18 分钟", kcal: 280, prot: 34, method: "煎",
    ing: [["鸡肉", "200 克", "chicken"]] }
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
  assert.equal(out[0].missing.some((x) => x.kbKey === "tomato"), true);
});

test("相同输入和筛选得到相同顺序", () => {
  const items = [{ name: "鸡肉", kbKey: "chicken", qty: 2, unit: "份", expDays: 2, price: 20 }];
  const a = rank(recipes, items, { soon: 7, maxMinutes: 20 });
  const b = rank(recipes, items, { soon: 7, maxMinutes: 20 });
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
});
```

- [ ] **Step 2: 确认测试失败**

```powershell
cd web/NexcoreGraph_web
node --test tests/rescue.test.js
```

Expected: FAIL，错误包含 `Cannot find module '../js/rescue.js'`。

- [ ] **Step 3: 实现确定性评分**

```js
const urgency = Math.max(0, Math.min(1, 1 - expDays / (soon + 1)));
const matchRate = matched.length / recipe.ing.length;
const completeness = missing.length === 0 ? 1 : 1 / (1 + missing.length);
const rescueRate = matched.length
  ? matched.reduce((sum, item) => sum + item.urgency, 0) / matched.length
  : 0;
const score = Math.round(100 * (0.4 * matchRate + 0.35 * rescueRate + 0.25 * completeness));
```

以 `kbKey || name` 建索引；同名库存数量相加；忌口命中菜名或 `kbKey` 时整道排除；按 `score`、`rescueItems`、中文标题稳定排序。模块使用 IIFE 并同时导出 `window.RESCUE` 与 `module.exports`。

- [ ] **Step 3.1: 增加多目标与组合求解测试**

```js
const { frontier, portfolio } = require("../js/rescue.js");

test("Pareto 前沿保留互不支配的候选", () => {
  const out = rank([
    { title: "高救援", time: "30 分钟", kcal: 400, prot: 20, method: "炒",
      ing: [["鸡蛋", "2 个", "egg"]] },
    { title: "高匹配", time: "10 分钟", kcal: 300, prot: 18, method: "煮",
      ing: [["牛奶", "1 盒", "milk"], ["燕麦", "50 克", "oat"]] }
  ], [
    { name: "鸡蛋", kbKey: "egg", qty: 2, unit: "个", expDays: 1, price: 6 },
    { name: "牛奶", kbKey: "milk", qty: 2, unit: "盒", expDays: 7, price: 12 },
    { name: "燕麦", kbKey: "oat", qty: 1, unit: "袋", expDays: 300, price: 10 }
  ], { soon: 7 });
  const front = frontier(out);
  assert.equal(front.length >= 1, true);
  assert.equal(front.every((x) => x.pareto === true), true);
});

test("组合求解优先覆盖不同临期食材并遵守总时长", () => {
  const candidates = rank([
    { title: "蛋番茄", time: "20 分钟", kcal: 320, prot: 14, method: "炒",
      ing: [["鸡蛋", "2 个", "egg"], ["番茄", "1 个", "tomato"]] },
    { title: "蛋奶", time: "20 分钟", kcal: 280, prot: 12, method: "煮",
      ing: [["鸡蛋", "1 个", "egg"], ["牛奶", "1 盒", "milk"]] },
    { title: "牛奶燕麦", time: "10 分钟", kcal: 280, prot: 12, method: "煮",
      ing: [["牛奶", "1 盒", "milk"], ["燕麦", "50 克", "oat"]] }
  ], [
    { name: "鸡蛋", kbKey: "egg", qty: 3, unit: "个", expDays: 1, price: 8 },
    { name: "番茄", kbKey: "tomato", qty: 2, unit: "个", expDays: 2, price: 6 },
    { name: "牛奶", kbKey: "milk", qty: 2, unit: "盒", expDays: 1, price: 12 },
    { name: "燕麦", kbKey: "oat", qty: 1, unit: "袋", expDays: 200, price: 10 }
  ], { soon: 7 });
  const plan = portfolio(candidates, { maxMeals: 2, maxTotalMinutes: 40 });
  assert.equal(plan.meals.length, 2);
  assert.equal(plan.totalMinutes <= 40, true);
  assert.equal(plan.rescuedKeys.includes("egg"), true);
  assert.equal(plan.rescuedKeys.includes("milk"), true);
});
```

组合求解使用最多 3 道菜、最多 12 个候选的确定性穷举，避免引入黑盒求解依赖。目标按“唯一临期食材数、救回估值、匹配率、总时长短、缺料少”依次比较，并输出淘汰原因。

- [ ] **Step 4: 运行测试**

```powershell
cd web/NexcoreGraph_web
node --test tests/rescue.test.js
```

Expected: 5 tests pass，0 failures。

- [ ] **Step 5: 只提交本任务新建文件**

```powershell
git add -- web/NexcoreGraph_web/js/rescue.js web/NexcoreGraph_web/tests/rescue.test.js
git commit -m "feat(web): add deterministic expiry rescue ranking"
```

---

### Task 2: 补齐菜谱步骤与替代建议

**Files**

- Modify: `web/NexcoreGraph_web/js/knowledge.js`

**Interfaces**

- Produces: 每道菜增加 `method`、`steps`、`subs`；旧字段保持兼容。

- [ ] **Step 1: 给 16 道菜标注做法类型**

| 菜名 | method | 菜名 | method |
|---|---|---|---|
| 番茄炒蛋 | 炒 | 上汤上海青 | 煮 |
| 清炒上海青 | 炒 | 牛奶燕麦粥 | 煮 |
| 青椒炒肉 | 炒 | 番茄鸡蛋面 | 煮 |
| 香菇蒸鸡 | 蒸 | 红烧豆腐 | 烧 |
| 蒜蓉炒时蔬 | 炒 | 黄瓜炒虾仁 | 炒 |
| 土豆烧肉 | 烧 | 洋葱炒蛋 | 炒 |
| 萝卜排骨汤 | 煮 | 苹果燕麦杯 | 拌 |
| 香煎鸡胸肉 | 煎 | 蔬菜蛋炒饭 | 炒 |

- [ ] **Step 2: 添加明确步骤模板**

```js
var STEP_GUIDE = {
  "炒": ["食材切配并分开放置", "锅热后放油，按耐熟程度依次下锅翻炒至断生", "少量多次调味，尝味后立即出锅"],
  "煮": ["食材洗净切配，耐煮食材先下锅", "水或汤底煮沸后转中小火，按熟度依次加入食材", "确认主料熟透后调味，汤类和面食尽快食用"],
  "蒸": ["食材处理干净，加入基础调味后平铺装盘", "水开后上锅，保持足量蒸汽蒸至中心熟透", "关火静置 2 分钟再取出，避免烫伤"],
  "烧": ["主料切配，先煸香配料并煎至表面上色", "加入主料和适量热水，小火焖至熟软", "开盖收汁并调味，避免收干焦糊"],
  "煎": ["主料擦干水分并做基础调味", "平底锅薄油，中小火煎至两面金黄", "静置 1 分钟后切开确认中心熟透"],
  "拌": ["可生食食材洗净沥干，需要熟制的食材先彻底加热", "按口味加入调味料，轻轻拌匀", "现拌现吃，剩余部分及时冷藏"]
};
```

至少为番茄炒蛋、上汤上海青、牛奶燕麦粥、番茄鸡蛋面、香菇蒸鸡、红烧豆腐、黄瓜炒虾仁、蔬菜蛋炒饭填写真实 `subs`。

- [ ] **Step 3: 检查语法**

```powershell
node --check web/NexcoreGraph_web/js/knowledge.js
```

Expected: exit code 0。

- [ ] **Step 4: 提交**

```powershell
git add -- web/NexcoreGraph_web/js/knowledge.js
git commit -m "feat(web): enrich rescue recipe guidance"
```

---

### Task 3: 接入状态层与执行闭环

**Files**

- Modify: `web/NexcoreGraph_web/js/mockapi.js`
- Modify: `web/NexcoreGraph_web/js/app.js`

**Interfaces**

- Produces: `API.rescueCandidates(options)`、`API.createPlanFromCandidate(id, selectedNames)`、`API.rescueImpact()`。
- Consumes: `window.RESCUE.rank` 与现有 `executePlan/rollbackPlan/pushLog/save`。

- [ ] **Step 1: 增加只读候选查询**

```js
rescueCandidates: function (options) {
  var items = [];
  db.libraries.forEach(function (lib) {
    (lib.items || []).forEach(function (it) {
      if (!it.private || lib.mine) items.push(Object.assign({ libId: lib.id, libName: lib.name }, it));
    });
  });
  return Promise.resolve(window.RESCUE.rank(window.KB.recipes, items, Object.assign({
    soon: (db.settings && db.settings.alertSoon) || 7,
    dislikes: profileDislikes()
  }, options || {})));
},
```

- [ ] **Step 2: 只把用户选中的候选转成现有 Plan**

`createPlanFromCandidate` 必须回查候选，至少选择一项食材，保留 `used/missing/kcal/prot/steps/subs/rescueScore`，先写日志再保存。候选已失效时抛出“方案已失效，请刷新后重试”。

- [ ] **Step 3: 记录救回价值**

`executePlan` 成功后仅为 `rescue === true` 的方案追加 `rescueHistory`：`{planId,title,items,savedValue,at}`。价值按执行前匹配食材单价估算，不使用虚构节省比例。

- [ ] **Step 4: 检查语法**

```powershell
node --check web/NexcoreGraph_web/js/mockapi.js
node --check web/NexcoreGraph_web/js/app.js
```

Expected: 两条均 exit code 0。

- [ ] **Step 5: 提交，避免带走用户旧改动**

```powershell
git diff -- web/NexcoreGraph_web/js/mockapi.js web/NexcoreGraph_web/js/app.js
git add -p -- web/NexcoreGraph_web/js/mockapi.js web/NexcoreGraph_web/js/app.js
git commit -m "feat(web): connect rescue candidates to plan workflow"
```

---

### Task 4: 构建临期救援驾驶舱

**Files**

- Create: `web/NexcoreGraph_web/js/rescue-view.js`
- Modify: `web/NexcoreGraph_web/js/app.js`
- Modify: `web/NexcoreGraph_web/css/extra.css`
- Modify: `web/NexcoreGraph_web/index.html`

**Interfaces**

- Produces: `window.RESCUE_VIEW.view()` 和 `bind(root, rerender)`。
- Consumes: `API.rescueCandidates`、`API.createPlanFromCandidate`、`API.executePlan`、`API.rollbackPlan`。

- [ ] **Step 1: 实现三个页面区域**

1. “今晚先救什么”：临期件数、最近到期日、预计救回价值、Top 1。
2. “决策沙盘”：时间上限、只显示食材齐全、排除食材、人数；变化后即时重排。
3. “候选队列”：评分、匹配/缺料、临期标签、做法、购物清单、加入今晚计划。

页面顶部增加“求解器模式”：综合救援、最快开饭、最少缺料、营养优先。页面显示 Pareto 前沿数量和被支配原因，让评审能看见“为什么淘汰”而不只是“AI 推荐”。

固定标题为“临期救援驾驶舱”。无候选时显示“当前没有可安全推荐的临期食材”，并提供资源库和拍照入库入口。

- [ ] **Step 2: 添加可解释推荐依据**

每张卡展示“匹配 2/2 种食材、其中 2 项临期、优先消耗鸡蛋（1 天）/番茄（2 天）”，并写明“食材匹配 40% + 临期程度 35% + 缺料完整度 25%”。内容必须来自 Candidate，不得由模型改写。

- [ ] **Step 3: 添加步骤抽屉**

桌面右侧抽屉，手机底部 sheet；支持 `Escape` 关闭，关闭后焦点回到触发按钮。

- [ ] **Step 3.1: 增加救援菜单编排与反事实沙盘**

提供“今晚 1/2/3 道菜”组合卡，展示唯一临期覆盖数、总时长、合并缺料、救回估值和自动安排顺序。反事实沙盘支持排除食材和时间上限修改，并即时重新求解；结果区明确显示“覆盖 N 种临期食材、合并缺料 M 种、总时长 X 分钟”，确认后再进入批量方案预览。

- [ ] **Step 4: 接入导航和脚本**

在 AI 工作台后加入 `{ id: "rescue", label: "临期救援", icon: "flame" }`，并在 `VIEWS` 中挂载 `window.RESCUE_VIEW.view()`。`index.html` 在 `knowledge.js` 后加载 `rescue.js`，在 `app.js` 前加载 `rescue-view.js`，版本改为 `v=31`。

- [ ] **Step 5: 添加响应式与无障碍样式**

```css
.rescue-card:focus-visible,
.rescue-filter:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 3px;
}

@media (max-width: 760px) {
  .rescue-hero,
  .rescue-workspace,
  .rescue-card-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rescue-card,
  .rescue-drawer {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 6: 浏览器冒烟**

```powershell
node --check web/NexcoreGraph_web/js/rescue-view.js
python tools/smoke_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html" --need "临期救援驾驶舱" --storage "nexcore_logged_in=1" --shot "web/NexcoreGraph_web/qa/shots/13-rescue-desktop.png"
```

Expected: `hasNeed=true`、`overflowX<=0`、`brokenImgs=0`、控制台异常为空。

- [ ] **Step 7: 提交**

```powershell
git add -- web/NexcoreGraph_web/js/rescue-view.js web/NexcoreGraph_web/css/extra.css web/NexcoreGraph_web/index.html
git add -p -- web/NexcoreGraph_web/js/app.js
git commit -m "feat(web): add expiry rescue dashboard"
```

---

### Task 5: 接入 AI 工作台、自然语言与入库流程

**Files**

- Modify: `web/NexcoreGraph_web/js/ai.js`
- Modify: `web/NexcoreGraph_web/js/workbench.js`
- Modify: `web/NexcoreGraph_web/js/graph-rag.js`
- Modify: `web/NexcoreGraph_web/js/app.js`

**Interfaces**

- Produces: `AI.route("今晚先吃什么") === "rescue"`；快答返回 `{text,candidates,model:false,src}`。
- Consumes: `API.rescueCandidates` 与 Top 3 的确定性结果。

- [ ] **Step 1: 添加 rescue 意图**

```js
if (/先吃什么|今晚吃什么|临期.*做|快过期.*做|救哪|清库存.*做/.test(t)) return "rescue";
```

在 `expiry` 之前判断，避免“鸡蛋快过期做什么”被当成保质期查询。

- [ ] **Step 2: 添加零模型快答**

```js
if (intent === "rescue") {
  return window.API.rescueCandidates({ includeMissing: true }).then(function (list) {
    var top = list.slice(0, 3);
    if (!top.length) {
      return { text: "当前没有可安全推荐的临期食材。可以先拍照入库，或补充基础食材后再让我安排。", candidates: [], model: false };
    }
    return {
      text: "优先考虑：" + top.map(function (c) { return c.title; }).join("、") + "。点候选卡查看缺料和步骤。",
      candidates: top,
      model: false,
      src: "临期救援引擎 · 0 次模型调用"
    };
  });
}
```

- [ ] **Step 3: 模型只解释已排序候选**

新函数 `rescueNarrative(candidates)` 只发送 Top 3 的 `title/matched/missing/score`。系统提示固定包含：“只能解释给定候选，不得新增食材、数量、日期或安全结论；缺证据时直接说明。”模型失败时使用确定性句子，不冒充模型结果。

- [ ] **Step 4: AI 工作台增加主动入口**

在摘要后加入“今晚先救哪几样”卡，显示临期总数、Top 2、匹配数，以及“打开救援驾驶舱”；数据不足时显示“拍照入库”。

- [ ] **Step 5: GraphRAG 补入救援证据**

在 `multi-hop` 的临期→食材→菜谱后加入“救援排序：番茄炒蛋（91）> 番茄鸡蛋面（84）”一类规则结果，并标注“确定性排序”，不能标成模型生成。

- [ ] **Step 6: 入库后给下一步**

`intake:confirm` 成功后显示“已入库 N 项；现在有 M 项适合先做”，附 Top 1 与“打开临期救援”。点击后才跳页。

- [ ] **Step 7: 冒烟无后端路径**

```powershell
python tools/smoke_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html" --need "今晚先救哪几样" --storage "nexcore_logged_in=1" --shot "web/NexcoreGraph_web/qa/shots/14-workbench-rescue.png"
```

Expected: 无 Key 时仍显示确定性 Top 2，页面无伪造模型结果。

- [ ] **Step 8: 提交**

```powershell
git add -- web/NexcoreGraph_web/js/workbench.js web/NexcoreGraph_web/js/graph-rag.js
git add -p -- web/NexcoreGraph_web/js/ai.js web/NexcoreGraph_web/js/app.js
git commit -m "feat(web): expose rescue flow through AI workbench"
```

---

### Task 6: 端到端验收与响应式证据

**Files**

- Create: `tools/verify_rescue_web.py`
- Create: `web/NexcoreGraph_web/qa/shots/15-rescue-mobile.png`
- Create: `web/NexcoreGraph_web/qa/shots/16-rescue-steps.png`
- Modify: `docs/功能测试报告.md`

**Interfaces**

- Produces: 一份 JSON 结果和可重复执行的浏览器验收流程。

- [ ] **Step 1: 脚本覆盖真实交互**

1. 写入 `nexcore_logged_in=1`。
2. 点击“临期救援”。
3. 断言标题与 Top 候选可见。
4. 选择“15 分钟”并检查候选时间。
5. 打开步骤抽屉再关闭。
6. 加入今晚计划，确认前记录库存，确认后检查扣减。
7. 点击撤销，检查库存恢复。
8. 390×844 下检查横向溢出。

- [ ] **Step 2: 运行并检查 JSON**

```powershell
python tools/verify_rescue_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html"
```

Expected:

```json
{
  "navigation": true,
  "filter": true,
  "drawer": true,
  "previewBeforeWrite": true,
  "execute": true,
  "undoRestoresStock": true,
  "mobileOverflowX": 0,
  "consoleErrors": []
}
```

- [ ] **Step 3: 测试无模型降级**

```powershell
python tools/verify_rescue_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html" --no-model
```

Expected: 排序、筛选、执行和撤销全通过；“规则计算 / 0 次模型调用”可见。

- [ ] **Step 4: 更新测试报告并提交**

在 `docs/功能测试报告.md` 增加排序、忌口、无库存、缺料、抽屉、执行、撤销、移动端和无模型降级用例。

```powershell
git add -- tools/verify_rescue_web.py web/NexcoreGraph_web/qa/shots/15-rescue-mobile.png web/NexcoreGraph_web/qa/shots/16-rescue-steps.png docs/功能测试报告.md
git commit -m "test(web): verify rescue recommendation workflow"
```

---

### Task 7: 补齐 README、环境模板与代码规范

**Files**

- Modify: `web/NexcoreGraph_web/README.md`
- Modify: `web/NexcoreGraph_web/.env.example`
- Modify: `README.md`
- Modify: `web/NexcoreGraph_web/js/agnes.js`
- Create: `web/NexcoreGraph_web/CODE-STYLE.md`

- [ ] **Step 1: Web README 补齐 8 部分**

项目介绍、技术架构、30 秒救援体验、安装运行、环境变量、演示账号、团队信息、测试与材料索引。

团队信息使用仓库当前公开信息，不新增未确认成员：

```text
高俊杰：Qt / 鸿蒙 / 安卓，罗渝川辅助
杨欢：Web / 小程序，查豪霆辅助
```

- [ ] **Step 2: 明确密钥风险**

README 写明推荐后端 `AGNES_API_KEY` 环境变量；本机直连 Key 只存 localStorage，不可用于公共电脑；`.env` 已被 `.gitignore` 排除，不能作为公共静态文件部署。

- [ ] **Step 3: 扩展环境模板**

```dotenv
NEXCORE_API_BASE=
AGNES_API_KEY=
AGNES_MODEL=agnes-2.5-flash
AGNES_VENDOR_BASE=https://api.agnes-ai.cn/v1
AGNES_CHAT_TIMEOUT_MS=30000
AGNES_VISION_TIMEOUT_MS=45000
```

同步让 `agnes.js` 解析后端地址与超时配置，真实 Key 仍不写入模板。

- [ ] **Step 4: 修正根 README 现状口径**

Web 行改为“当前为零构建原生 HTML/CSS/JS，已实现 AI 网关/直连、GraphRAG、拍照识别、临期救援、管理员端和浏览器验收；Vue 迁移是后续方向，不计入当前已实现能力。”

- [ ] **Step 5: 添加代码规范**

`CODE-STYLE.md` 写明 2 空格缩进、分号、双引号、IIFE + strict、用户输入必须 `esc()`、状态写入只放 `mockapi.js`、AI 不得直接写 `DB`、提交前缀和测试要求。

- [ ] **Step 6: 安全与冒烟**

```powershell
git grep -n -I -E "(sk-[A-Za-z0-9_-]{16,}|APP_SECRET|PRIVATE KEY)" -- . ":(exclude)deliverables/**"
python tools/smoke_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html" --need "临期救援" --storage "nexcore_logged_in=1"
```

Expected: 真实密钥 0 命中；冒烟通过。

- [ ] **Step 7: 提交**

```powershell
git add -- README.md web/NexcoreGraph_web/README.md web/NexcoreGraph_web/.env.example web/NexcoreGraph_web/CODE-STYLE.md
git add -p -- web/NexcoreGraph_web/js/agnes.js
git commit -m "docs: complete web repository submission guidance"
```

---

### Task 8: 生成不超过 30 页的技术 PDF

**Files**

- Create: `docs/传智杯-Web端技术文档.md`
- Modify: `tools/build_web_technical_doc.py`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/02_技术文档/启核图策-Web端技术文档.pdf`

- [ ] **Step 1: 按七章组织**

项目概述、需求分析、系统架构、AI 技术方案、核心功能实现、测试与部署、总结与展望。AI 章必须写清选型理由、集成方式、GraphRAG、Agent、降级和成本治理。

- [ ] **Step 2: 写清创新点**

技术创新：确定性救援排序、个人库存 GraphRAG、受控 Agent、双通道 AI、多模态入库联动知识库。

技术创新补充：多目标 Pareto 前沿、约束菜单组合求解、反事实沙盘和可回放决策轨迹。

应用创新：从临期提醒到今晚行动、决策沙盘、救援战绩、家庭协作、入库后即时下一步。

- [ ] **Step 3: 更新生成脚本**

封面改为“第九届传智杯全国大学生数智创新与 AI 应用大赛”。在 AI 与核心功能章加入救援驾驶舱，引用 `13`–`16` 四张截图。

- [ ] **Step 4: 生成并检查页数**

```powershell
python tools/build_web_technical_doc.py
pdfinfo "deliverables/传智杯_Web端_提交材料_20261110/02_技术文档/启核图策-Web端技术文档.pdf"
```

Expected: `Pages` 为 1–30；超过 30 页则压缩截图和重复段落后重生成。

- [ ] **Step 5: 渲染视觉质检**

```powershell
pdftoppm -png -r 120 "deliverables/传智杯_Web端_提交材料_20261110/02_技术文档/启核图策-Web端技术文档.pdf" "deliverables/传智杯_Web端_提交材料_20261110/_qa/doc"
```

Expected: 无文字越界、表格断裂、空白页、破图或错误赛事名称。

- [ ] **Step 6: 提交源文档和生成器**

```powershell
git add -- docs/传智杯-Web端技术文档.md tools/build_web_technical_doc.py
git commit -m "docs: build competition-ready web technical report"
```

---

### Task 9: 制作离线提交包与核验单

**Files**

- Create: `docs/传智杯-Web端提交核验单.md`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/README.md`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/01_源码/`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/03_运行与环境/`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/04_测试与截图/`
- Create: `deliverables/传智杯_Web端_提交材料_20261110/SHA256SUMS.txt`

- [ ] **Step 1: 建立官网要求核验表**

每行包含要求、状态、证据、核验命令、责任方。视频标记“用户确认本轮暂缓”；在线演示无地址时标记“可选，未提供”。

- [ ] **Step 2: 复制最小运行文件**

只包含 `README.md`、`CODE-STYLE.md`、`index.html`、`admin.html`、运行所需 `assets/`、`css/`、`js/`、`tests/`、`qa/shots/`、`.env.example`、启动脚本。不得包含 `.env`、`node_modules`、缓存或视频素材。

- [ ] **Step 3: 从提交包启动验收**

```powershell
python -m http.server 8096 --directory "deliverables/传智杯_Web端_提交材料_20261110/01_源码"
```

Expected: 页面与管理员端可打开，修复资源缺失后重新复制。

- [ ] **Step 4: 扫描与哈希**

```powershell
Get-ChildItem -Recurse -File "deliverables/传智杯_Web端_提交材料_20261110" | Select-String -Pattern "sk-[A-Za-z0-9_-]{16,}"
Get-FileHash "deliverables/传智杯_Web端_提交材料_20261110/02_技术文档/启核图策-Web端技术文档.pdf" -Algorithm SHA256
```

Expected: 密钥 0 命中，PDF hash 写入 `SHA256SUMS.txt`。

- [ ] **Step 5: 生成 ZIP 并验证**

```powershell
Compress-Archive -Path "deliverables/传智杯_Web端_提交材料_20261110/*" -DestinationPath "deliverables/传智杯_Web端_提交材料_20261110.zip" -Force
Get-FileHash "deliverables/传智杯_Web端_提交材料_20261110.zip" -Algorithm SHA256
```

Expected: ZIP 可解压并按 README 启动。

- [ ] **Step 6: 提交核验单**

```powershell
git add -- docs/传智杯-Web端提交核验单.md
git commit -m "docs: add web competition submission checklist"
```

---

### Task 10: 最终回归与交付

- [ ] **Step 1: 运行全部检查**

```powershell
cd web/NexcoreGraph_web
node --test tests/rescue.test.js
node --check js/rescue.js
node --check js/rescue-view.js
node --check js/mockapi.js
node --check js/ai.js
node --check js/app.js
cd ../..
python tools/verify_rescue_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html"
```

Expected: 单测和语法全过；交互 JSON 全为 true，控制台异常为空。

- [ ] **Step 2: 检查 1600×1000、1024×768、390×844**

三个视口均不得横向滚动、按钮重叠或 AI 球遮挡主操作。

- [ ] **Step 3: 手工走主演示路径**

登录 → 工作台 Top 2 → 救援驾驶舱 → 15 分钟筛选 → 推荐依据 → 步骤抽屉 → 加入计划 → 检查预览 → 执行 → 撤销 → 刷新验证持久化和审计日志。

- [ ] **Step 4: 检查材料口径**

```powershell
git grep -n "目标：Vue 3"
git grep -n "3–5 分钟"
git grep -n "第十四届"
git grep -n "1080p"
```

Expected: 不使用其他赛事封面；传智杯视频口径为 5–8 分钟、MP4、1080p、普通话并标记待提交。

- [ ] **Step 5: 最终交付说明**

只报告有证据的结果：测试输出、PDF 页数、包大小、SHA256，以及仍需用户处理的事项：Public 仓库确认、可选在线部署和后续视频。

---

## Self-Review Checklist

- 评分建议对应 Task 1–6，包含排序、解释、执行和撤销。
- 官网材料对应 Task 7–9；视频与在线演示保持真实状态。
- AI 选型、集成、优化与创新点在 Task 8 明确拆分。
- 现有脏工作区通过 `git diff` + `git add -p` 防止误提交。
- 所有事实来自代码；模型失败时仍有确定性结果。
