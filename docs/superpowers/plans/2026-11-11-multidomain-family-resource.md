# 家庭资源多域数字孪生 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic medicine, fitness, and tool resource semantics plus a body-profile workout planner without weakening the existing confirmation and policy gates.

**Architecture:** Introduce one pure ArkTS resource-domain module, extend persisted models with optional compatibility fields, route digital-twin calculations through domain-specific rules, and add a deterministic workout planner and ArkUI body-profile panel. All new behavior is tested through Hypium before UI integration.

**Tech Stack:** HarmonyOS ArkTS, ArkUI V2, Hypium, existing GraphRAG and policy modules.

**Spec:** `docs/superpowers/specs/2026-11-11-multidomain-family-resource-design.md`

## Global Constraints

- AI never directly changes inventory or medicine quantities.
- Medicine recommendations only repeat user-entered amounts; no dose calculation.
- Food household meal scaling must not affect medicine, tools, or fitness equipment.
- Old serialized records without new fields must remain readable.
- All numeric recommendations are deterministic and reproducible.
- Medical and training copy must include professional-help boundaries where risk flags apply.

---

### Task 1: Resource-domain classification

**Files:**
- Create: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/ResourceDomain.ets`
- Create: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/test/ResourceDomain.test.ets`

**Interfaces:**
- Produces: `inferResourceDomain(name: string, libraryName: string, category: string): string`
- Produces: `domainLabel(domain: string): string`
- Produces: constants `DOMAIN_FOOD`, `DOMAIN_MEDICINE`, `DOMAIN_FITNESS`, `DOMAIN_TOOL`, `DOMAIN_DAILY`, `DOMAIN_OTHER`

- [ ] **Step 1: Write the failing test**

```ts
it('classifies medicine before food words', 0, () => {
  expect(inferResourceDomain('宠物药', '', '')).assertEqual(DOMAIN_MEDICINE);
});
it('classifies dumbbells as fitness equipment', 0, () => {
  expect(inferResourceDomain('哑铃', '健身角', '')).assertEqual(DOMAIN_FITNESS);
});
it('classifies screwdrivers as tools even with zero expiry', 0, () => {
  expect(inferResourceDomain('十字螺丝刀', '工具箱', '')).assertEqual(DOMAIN_TOOL);
});
```

- [ ] **Step 2: Run test and verify missing-module failure**

Run: `.\tools\build.ps1 -Task test`

- [ ] **Step 3: Implement ordered keyword inference**

Check medicine and pet-care terms first, then fitness, tools, daily supplies, food, and fallback.

- [ ] **Step 4: Run test**

Run: `.\tools\build.ps1 -Task test`

Expected: `BUILD SUCCESSFUL`.

### Task 2: Domain-safe digital twin

**Files:**
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/Db.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/ResourceTwin.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/test/ResourceTwin.test.ets`

**Interfaces:**
- Consumes: `inferResourceDomain(...)`
- Produces: `TwinItemInput.domain`, `TwinItemInput.dosePerDay`, `TwinItemInput.maintenanceDays`
- Produces: `itemToTwinInput(item: Item, libraryName?: string): TwinItemInput`

- [ ] **Step 1: Add failing tests**

```ts
it('does not scale medicine by guest meals', 0, () => {
  const med = new TwinItemInput();
  med.id = 'med'; med.name = '退烧药'; med.domain = 'medicine';
  med.qty = 4; med.dosePerDay = 1; med.hasPosition = true;
  const normal = simulateTwin([med], scenario(0));
  const guests = simulateTwin([med], scenario(3));
  expect(normal.risks[0].day).assertEqual(guests.risks[0].day);
});
it('does not create daily shortage risk for a screwdriver', 0, () => {
  const tool = new TwinItemInput();
  tool.id = 'tool'; tool.name = '螺丝刀'; tool.domain = 'tool';
  tool.qty = 1; tool.hasPosition = true;
  const result = simulateTwin([tool], scenario());
  expect(result.shortageCount).assertEqual(0);
});
```

- [ ] **Step 2: Run and verify assertions fail**

Run: `.\tools\build.ps1 -Task test`

- [ ] **Step 3: Implement domain branches**

Food multiplies daily use by household factors. Medicine uses `dosePerDay` directly. Tool and fitness daily use default to zero. Maintenance risk is emitted only when `maintenanceDays` is within the horizon.

- [ ] **Step 4: Run tests**

Run: `.\tools\build.ps1 -Task test`

Expected: `BUILD SUCCESSFUL`.

### Task 3: Deterministic workout planner

**Files:**
- Create: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/WorkoutPlanner.ets`
- Create: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/test/WorkoutPlanner.test.ets`

**Interfaces:**
- Produces: `calculateBmi(heightCm: number, weightKg: number): number`
- Produces: `buildWorkoutPlan(input: WorkoutInput): WorkoutPlan`
- Produces classes `WorkoutInput`, `WorkoutExercise`, `WorkoutSession`, `WorkoutPlan`

- [ ] **Step 1: Write failing tests**

```ts
it('rejects impossible body data', 0, () => {
  const input = new WorkoutInput();
  input.heightCm = 0; input.weightKg = 70; input.weeklyDays = 3;
  expect(buildWorkoutPlan(input).valid).assertFalse();
});
it('uses only available equipment', 0, () => {
  const input = new WorkoutInput();
  input.heightCm = 170; input.weightKg = 68; input.age = 30;
  input.weeklyDays = 3; input.level = 'beginner';
  input.equipment = ['哑铃'];
  const plan = buildWorkoutPlan(input);
  expect(plan.sessions.length).assertEqual(3);
  expect(plan.sessions.some((s) => s.exercises.every((e) => e.equipment === '' ||
    input.equipment.indexOf(e.equipment) >= 0))).assertTrue();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `.\tools\build.ps1 -Task test`

- [ ] **Step 3: Implement BMI, validation, exercise library, and weekly rotation**

Generate 1 to 6 sessions, use bodyweight exercises always, and select equipment exercises only when present. Add safety flags for invalid values, BMI outside 18.5 to 35, age under 16 or over 65, and non-empty limitations.

- [ ] **Step 4: Run tests**

Run: `.\tools\build.ps1 -Task test`

Expected: `BUILD SUCCESSFUL`.

### Task 4: Persistence and sync compatibility

**Files:**
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/Db.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/LocalStore.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/Continuation.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/common/Api.ets`

**Interfaces:**
- Consumes: resource-domain inference and new profile fields
- Produces: backward-compatible load/save and intake/write propagation

- [ ] **Step 1: Add a failing DTO/profile test**

Assert that an old profile JSON without training fields restores defaults and that `buildDataSnapshot()` preserves item domain and medicine fields.

- [ ] **Step 2: Run and verify failure**

Run: `.\tools\build.ps1 -Task test`

- [ ] **Step 3: Extend DTO fields with defaults and propagate inference**

Update `ItemDto`, `LibDto`, `ProfileDto`, profile save/load, intake placement, manual add/edit, and restore paths.

- [ ] **Step 4: Run tests**

Run: `.\tools\build.ps1 -Task test`

Expected: `BUILD SUCCESSFUL`.

### Task 5: Multi-domain ArkUI

**Files:**
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/pages/TwinPanel.ets`
- Create: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/pages/BodyProfilePanel.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/pages/Overlays.ets`
- Modify: `harmonyosapp/NexcoreGraph_harmonyos/entry/src/main/ets/pages/AiWorkbench.ets`

**Interfaces:**
- Consumes: domain-aware twin and workout planner
- Produces: `store.overlay = 'bodyprofile'` flow and domain filter chips

- [ ] **Step 1: Add domain filters and domain-specific scenario labels**

Food shows meal scenarios; medicine shows refill horizon; fitness shows training days; tools show maintenance horizon.

- [ ] **Step 2: Add body profile input and plan preview**

Use numeric fields and chips already present in widgets. Persist on explicit save. Show BMI, safety note, weekly sessions, and equipment gaps.

- [ ] **Step 3: Add workbench entries**

Expose “身体档案与训练方案” beside digital twin and replace food-only quick prompts with food, medicine, training, and tool examples.

- [ ] **Step 4: Build HAP**

Run: `.\tools\build.ps1 -Task assembleHap`

Expected: `BUILD SUCCESSFUL`.

### Task 6: Full verification and pitch rewrite

**Files:**
- Modify: `docs/submission/启核图策-评委冲击版口播稿.md`
- Modify: `tools/build_oral_script_docx.py`
- Modify: `docs/submission/测试与评测报告.md`

- [ ] **Step 1: Run all automated checks**

```powershell
.\tools\build.ps1 -Task test
cd backend; npm test
cd ..; node evals/run.js --out evals/result.json
python tools/check_release.py
.\tools\build.ps1 -Task assembleHap
```

- [ ] **Step 2: Run simulator scenario**

Open digital twin, switch medicine/fitness/tool, edit body profile, generate a workout, and capture screenshots. Do not claim success if any interaction fails.

- [ ] **Step 3: Rewrite oral script around four domains**

Use medicine refill, workout generation, tool maintenance, and food cross-device continuity. Keep only evidence-backed numbers.

- [ ] **Step 4: Rebuild and visually verify DOCX**

Render every page, inspect at full resolution, run table geometry and accessibility audits, then deliver.
