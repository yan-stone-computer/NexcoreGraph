/* 启核图策 · 家庭智策
   药箱、健身器材和工具箱统一在同一页面；训练计划由代码按身体数据和器材计算。 */
(function () {
  "use strict";

  var active = "overview";
  var result = null;
  var busy = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function toast(message) {
    if (window.NXG_TOAST) window.NXG_TOAST(message);
  }

  function money(value) {
    return "¥" + (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
  }

  function metric(label, value, note, tone) {
    return '<div class="domain-metric ' + (tone || "") + '"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></div>';
  }

  function tabButton(id, label) {
    return '<button type="button" class="domain-tab' + (active === id ? " active" : "") + '" data-domain-action="tab" data-value="' + id + '">' + label + "</button>";
  }

  function empty(text, libraryName) {
    return '<div class="domain-empty"><strong>' + esc(text) + '</strong><p>在资源库中创建「' + esc(libraryName) + '」并添加物品后，这里会自动分析。</p>' +
      '<button class="btn btn-primary btn-sm" data-action="nav:go" data-view="libraries">去资源库</button></div>';
  }

  function medicinePanel() {
    var data = result.medicine;
    if (!data.totalItems) return empty("还没有药箱数据", "家庭药箱");
    var urgency = data.expiringItems.concat(data.expiredItems).slice(0, 6);
    var rows = urgency.map(function (item) {
      var danger = item.expDays < 0 || item.expDays <= 3;
      return '<div class="domain-risk-row"><span class="domain-risk-dot ' + (danger ? "danger" : "warn") + '"></span>' +
        '<div><strong>' + esc(item.name) + '</strong><small>' + esc(item.libName) + " · " + esc(item.pos || "未设置位置") + '</small></div>' +
        '<span class="domain-risk-value">' + (item.expDays < 0 ? "已过期" : item.expDays + " 天") + '</span></div>';
    }).join("");
    return '<div class="domain-panel-grid">' +
      '<div class="card domain-panel-main"><div class="card-head"><div><div class="card-title">药箱风险队列</div>' +
      '<div class="card-sub">有效期由代码扫描，数量低于阈值时进入补货候选</div></div>' +
      '<span class="badge badge-red">' + data.expiringItems.length + " 项临期</span></div>" +
      (rows || '<div class="domain-safe">当前没有临期或过期药品</div>') +
      '<div class="domain-note-list">' + data.notes.map(function (note) { return "<p>" + esc(note) + "</p>"; }).join("") + "</div></div>" +
      '<div class="card domain-panel-side"><div class="card-title">药箱指标</div><div class="domain-mini-grid">' +
      '<div><strong>' + data.totalItems + '</strong><span>药品总数</span></div>' +
      '<div><strong>' + data.lowStock.length + '</strong><span>低库存</span></div>' +
      '<div><strong>' + data.expiredItems.length + '</strong><span>已过期</span></div>' +
      '<div><strong>' + data.expiringItems.length + '</strong><span>7 天内</span></div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="overlay:open" data-type="alerts">打开预警中心</button></div></div>';
  }

  function foodPanel() {
    var data = result.inventory.food;
    if (!data.count) return empty("还没有食材数据", "冰箱");
    var rows = data.expiring.slice(0, 8).map(function (item) {
      return '<div class="domain-risk-row"><span class="domain-risk-dot warn"></span><div><strong>' +
        esc(item.name) + '</strong><small>' + esc(item.libName) + " · " + esc(item.pos || "未设置位置") +
        '</small></div><span class="domain-risk-value">' + item.expDays + " 天</span></div>";
    }).join("");
    return '<div class="domain-panel-grid"><div class="card domain-panel-main"><div class="card-head"><div><div class="card-title">食材与临期库存</div>' +
      '<div class="card-sub">食材是家庭资源的一部分，不覆盖药品、器材和工具业务</div></div>' +
      '<span class="badge badge-amber">' + data.expiring.length + " 项临期</span></div>" +
      (rows || '<div class="domain-safe">当前没有临期食材</div>') +
      '<div class="domain-actions"><button class="btn btn-primary btn-sm" data-action="nav:go" data-view="rescue">打开临期救援</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="nav:go" data-view="libraries">查看全部资源</button></div></div>' +
      '<div class="card domain-panel-side"><div class="card-title">食材指标</div><div class="domain-mini-grid">' +
      '<div><strong>' + data.count + '</strong><span>物品数量</span></div>' +
      '<div><strong>' + money(data.value) + '</strong><span>库存估值</span></div>' +
      '<div><strong>' + data.expiring.length + '</strong><span>7 天内</span></div>' +
      '<div><strong>' + data.lowStock.length + '</strong><span>低库存</span></div></div></div></div>';
  }

  function bodyValue(body, key, fallback) {
    return body && body[key] != null ? body[key] : fallback;
  }

  function fitnessForm(body) {
    var goals = ["减脂", "增肌", "保持", "心肺"];
    var levels = ["新手", "进阶"];
    return '<form id="body-profile-form" class="card domain-profile"><div class="card-head"><div><div class="card-title">身体与训练画像</div>' +
      '<div class="card-sub">只保存在本机 Profile；训练建议不替代医疗诊断</div></div><button class="btn btn-primary btn-sm" type="submit">' +
      (busy ? "计算中…" : "生成训练方案") + "</button></div>" +
      '<div class="domain-form-grid">' +
      '<label>身高 cm<input id="body-height" class="num" inputmode="decimal" value="' + esc(bodyValue(body, "height", 170)) + '"/></label>' +
      '<label>体重 kg<input id="body-weight" class="num" inputmode="decimal" value="' + esc(bodyValue(body, "weight", 65)) + '"/></label>' +
      '<label>年龄<input id="body-age" class="num" inputmode="numeric" value="' + esc(bodyValue(body, "age", 30)) + '"/></label>' +
      '<label>每周天数<input id="body-days" class="num" inputmode="numeric" value="' + esc(bodyValue(body, "days", 3)) + '"/></label>' +
      '<label>目标<select id="body-goal">' + goals.map(function (goal) {
        return '<option' + (bodyValue(body, "goal", "减脂") === goal ? " selected" : "") + ">" + goal + "</option>";
      }).join("") + "</select></label>" +
      '<label>水平<select id="body-level">' + levels.map(function (level) {
        return '<option' + (bodyValue(body, "level", "新手") === level ? " selected" : "") + ">" + level + "</option>";
      }).join("") + "</select></label>" +
      "</div><label class=\"domain-limitations\">伤病或限制（可选）<input id=\"body-limitations\" value=\"" + esc(bodyValue(body, "limitations", "")) + "\" placeholder=\"如：膝盖不适\"/></label></form>";
  }

  function fitnessPanel() {
    var data = result.fitness;
    var plan = data.plan;
    var sessions = plan.sessions.map(function (session) {
      return '<div class="domain-session"><div><strong>' + esc(session.title) + '</strong><small>' + session.minutes + " 分钟 · " + esc(session.intensity) + '</small></div>' +
        '<p>' + session.moves.map(function (move) { return esc(move.name); }).join("、") + "</p></div>";
    }).join("");
    return fitnessForm(plan.bodyProfile) +
      '<div class="domain-plan-hero"><div><span class="rescue-eyebrow">BODY-AWARE PLAN</span><h2>训练方案由身体数据和现有器材求解</h2>' +
      '<p>' + esc(plan.prescription) + '</p></div><button class="btn btn-ghost btn-sm" data-domain-action="copy-plan">复制方案</button></div>' +
      '<div class="domain-plan-metrics">' +
      metric("BMI", plan.bmi, plan.bmiLabel, plan.bmi >= 28 || plan.bmi < 18.5 ? "warn" : "") +
      metric("目标心率", plan.targetHeartRate.min + "–" + plan.targetHeartRate.max, "次 / 分钟 · 60–70%") +
      metric("每周训练", plan.sessions.length + " 天", "自动排期") +
      metric("器材覆盖", plan.equipmentUsed.join(" / "), data.equipment.length + " 件库存器材") +
      "</div>" +
      '<div class="domain-session-list">' + sessions + "</div>" +
      (plan.safetyNotes.length ? '<div class="domain-safety">' + plan.safetyNotes.map(function (note) { return "<p>" + esc(note) + "</p>"; }).join("") + "</div>" : "");
  }

  function toolsPanel() {
    var data = result.tools;
    if (!data.totalItems) return empty("还没有工具箱数据", "维修工具箱");
    var rows = data.warrantySoon.concat(data.maintenanceSoon).concat(data.loanDueSoon).map(function (item) {
      return '<div class="domain-risk-row"><span class="domain-risk-dot warn"></span><div><strong>' + esc(item.name) + '</strong><small>' +
        esc(item.libName) + " · " + esc(item.pos || "未设置位置") + '</small></div><span class="domain-risk-value">' +
        (item.borrower ? "借给 " + item.borrower : item.warrantyDays != null ? "保修 " + item.warrantyDays + " 天" : "维护 " + item.maintenanceDays + " 天") + "</span></div>";
    }).join("");
    return '<div class="domain-panel-grid"><div class="card domain-panel-main"><div class="card-head"><div><div class="card-title">工具健康与保修</div>' +
      '<div class="card-sub">入库时填写剩余保修或维护周期即可自动扫描</div></div><span class="badge badge-amber">' +
      (data.warrantySoon.length + data.maintenanceSoon.length) + " 项待关注</span></div>" +
      (rows || '<div class="domain-safe">当前没有临近保修或维护的工具</div>') +
      '<div class="domain-note-list">' + data.notes.map(function (note) { return "<p>" + esc(note) + "</p>"; }).join("") + "</div></div>" +
      '<div class="card domain-panel-side"><div class="card-title">工具指标</div><div class="domain-mini-grid">' +
      '<div><strong>' + data.totalItems + '</strong><span>工具总数</span></div>' +
      '<div><strong>' + data.warrantySoon.length + '</strong><span>临近保修</span></div>' +
      '<div><strong>' + data.maintenanceSoon.length + '</strong><span>待维护</span></div>' +
      '<div><strong>' + data.activeLoans.length + '</strong><span>借出中</span></div></div>' +
      '<p class="domain-muted">安全提示：维修前先断电，涉及燃气、电路和承重结构时交由持证专业人员处理。</p></div></div>';
  }

  function assetsPanel() {
    var keys = ["wardrobe", "appliance", "books", "pet", "cleaning", "general"];
    var cards = keys.map(function (key) {
      var data = result.inventory[key];
      if (!data.count && key === "general") return "";
      var samples = data.items.slice(0, 3).map(function (item) { return item.name; }).join("、");
      return '<div class="domain-asset-card"><div><span>' + esc(data.label) + '</span><strong>' +
        data.count + " 件</strong></div><small>估值 " + money(data.value) +
        (data.lowStock.length ? " · " + data.lowStock.length + " 项低库存" : "") +
        (data.expiring.length ? " · " + data.expiring.length + " 项临期" : "") +
        (samples ? " · " + esc(samples) : "") + "</small></div>";
    }).join("");
    return '<div class="card domain-assets"><div class="card-head"><div><div class="card-title">全屋生活资产</div>' +
      '<div class="card-sub">衣橱、家电、书籍、宠物与清洁耗材使用同一库存与搜索底座</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="nav:go" data-view="libraries">管理资源库</button></div>' +
      '<div class="domain-asset-grid">' + (cards || '<div class="domain-safe">暂无其他生活资产</div>') + "</div>" +
      '<div class="domain-note-list"><p>家电保修与维护、宠物和清洁耗材低库存、衣物与书籍期限会进入全屋风险汇总；工具借出同时保留借用人和归还倒计时。</p></div></div>';
  }

  function overviewPanel() {
    var inv = result.inventory;
    var house = result.household;
    var riskMap = house.riskDomains.map(function (domain) {
      var tab = ["food", "medicine", "fitness", "tools"].indexOf(domain.key) > -1 ? domain.key : "assets";
      return '<button type="button" class="domain-risk-chip" data-domain-action="tab" data-value="' +
        tab + '"><span>' + esc(domain.label) + '</span><strong>' +
        domain.count + " 项</strong></button>";
    }).join("");
    return '<div class="domain-total-bar">' +
      metric("全屋资源", house.totalItems + " 件", house.activeDomains + " 个生活域") +
      metric("资源估值", money(house.totalValue), "按库存单价估算") +
      metric("待处理风险", house.riskCount + " 项", "临期、低库存、保修与借出") +
      metric("生活资产", house.assetItems + " 件", "衣橱 · 家电 · 书籍 · 宠物") +
      "</div>" +
      (riskMap ? '<div class="domain-risk-map">' + riskMap + "</div>" : "") +
      '<div class="domain-overview">' +
      '<button class="domain-domain-card food" data-domain-action="tab" data-value="food"><span>食材</span><strong>' + inv.food.count + " 件</strong><small>" + inv.food.expiring.length + " 项临期 · 可进入 Pareto 救援</small></button>" +
      '<button class="domain-domain-card medicine" data-domain-action="tab" data-value="medicine"><span>药箱</span><strong>' + result.medicine.expiringItems.length + " 项临期</strong><small>" + result.medicine.totalItems + " 件药品 · " + result.medicine.lowStock.length + " 项低库存</small></button>" +
      '<button class="domain-domain-card fitness" data-domain-action="tab" data-value="fitness"><span>健身</span><strong>' + result.fitness.equipmentUsed.join(" / ") + '</strong><small>BMI ' + result.fitness.plan.bmi + " · 每周 " + result.fitness.plan.sessions.length + " 天</small></button>" +
      '<button class="domain-domain-card tools" data-domain-action="tab" data-value="tools"><span>工具</span><strong>' + result.tools.activeLoans.length + " 件借出</strong><small>" + result.tools.warrantySoon.length + " 项保修 · " + result.tools.maintenanceSoon.length + " 项维护</small></button>" +
      '<button class="domain-domain-card assets" data-domain-action="tab" data-value="assets"><span>生活资产</span><strong>' + house.assetItems + ' 件</strong><small>衣橱、家电、书籍、宠物与清洁</small></button>' +
      "</div>";
  }

  function contentHTML() {
    if (!result) return '<div class="card domain-loading">正在读取药箱、健身器材和工具箱…</div>';
    if (active === "food") return foodPanel();
    if (active === "medicine") return medicinePanel();
    if (active === "fitness") return fitnessPanel();
    if (active === "tools") return toolsPanel();
    if (active === "assets") return assetsPanel();
    return overviewPanel();
  }

  function renderIntoRoot() {
    var host = document.getElementById("domain-content");
    if (host) host.innerHTML = contentHTML();
    var tabs = document.querySelectorAll(".domain-tab");
    Array.prototype.forEach.call(tabs, function (tab) {
      var selected = tab.getAttribute("data-value") === active;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
  }

  function load() {
    return window.API.domainAnalysis().then(function (data) {
      result = data;
      var body = (window.API.getState().profile || {}).body || {};
      if (result.fitness && result.fitness.plan) result.fitness.plan.bodyProfile = body;
      renderIntoRoot();
    }).catch(function (error) {
      var host = document.getElementById("domain-content");
      if (host) host.innerHTML = '<div class="card domain-empty"><strong>家庭智策加载失败</strong><p>' + esc(error.message) + "</p></div>";
    });
  }

  function saveBody(form) {
    if (busy) return;
    busy = true;
    var body = {
      height: Number(document.getElementById("body-height").value) || 170,
      weight: Number(document.getElementById("body-weight").value) || 65,
      age: Number(document.getElementById("body-age").value) || 30,
      days: Number(document.getElementById("body-days").value) || 3,
      goal: document.getElementById("body-goal").value,
      level: document.getElementById("body-level").value,
      limitations: document.getElementById("body-limitations").value.trim()
    };
    window.API.setProfile({ body: body }).then(function () {
      busy = false;
      toast("身体数据已保存，训练方案已重新计算");
      return load();
    }).catch(function (error) {
      busy = false;
      toast("保存失败：" + error.message);
    });
  }

  function copyPlan() {
    if (!result || !result.fitness) return;
    var plan = result.fitness.plan;
    var lines = [
      "启核图策训练方案",
      "BMI " + plan.bmi + "（" + plan.bmiLabel + "）",
      "目标心率 " + plan.targetHeartRate.min + "–" + plan.targetHeartRate.max + " 次/分钟",
      plan.prescription
    ];
    plan.sessions.forEach(function (session) {
      lines.push(session.title + "：" + session.moves.map(function (move) { return move.name; }).join("、"));
    });
    lines.push("提示：" + plan.safetyNotes.join(" "));
    var text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    toast("训练方案已复制");
  }

  function bind(root, rerender) {
    if (root.__domainBound) return;
    root.__domainBound = true;
    root.addEventListener("click", function (event) {
      var target = event.target.closest("[data-domain-action]");
      if (!target) return;
      var action = target.getAttribute("data-domain-action");
      if (action === "tab") {
        active = target.getAttribute("data-value");
        renderIntoRoot();
      } else if (action === "copy-plan") {
        copyPlan();
      }
    });
    root.addEventListener("submit", function (event) {
      if (event.target && event.target.id === "body-profile-form") {
        event.preventDefault();
        saveBody(event.target);
      }
    });
    load();
  }

  function view() {
    return '<div class="view domain-view" id="domain-root"><div class="view-head"><div><div class="rescue-eyebrow">HOUSEHOLD INTELLIGENCE</div>' +
      '<h1>家庭智策</h1><p>食材、药品、健身器材、工具家电与生活资产共用一套事实层；每个生活域都有自己的算法、风险和动作。</p></div>' +
      '<span class="demo-note">有效期 · 训练求解 · 保修借用 · 资产估值</span></div>' +
      '<div class="domain-tabs" role="tablist">' + tabButton("overview", "全景") + tabButton("food", "食材") + tabButton("medicine", "药箱") + tabButton("fitness", "健身") + tabButton("tools", "工具家电") + tabButton("assets", "生活资产") + "</div>" +
      '<div id="domain-content"><div class="card domain-loading">正在读取家庭生活域…</div></div></div>';
  }

  window.DOMAIN_VIEW = { view: view, bind: bind };
})();
