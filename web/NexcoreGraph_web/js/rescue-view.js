/* 启核图策 · 临期救援驾驶舱
   页面只消费 RESCUE 与 API 的确定性结果；任何模型解释都不能修改这里的库存事实。 */
(function () {
  "use strict";

  var state = {
    mode: "rescue",
    maxMinutes: 30,
    includeMissing: true,
    exclude: [],
    maxMeals: 2,
    maxTotalMinutes: 60,
    result: null,
    busy: false,
    preview: null
  };
  var boundRoot = null;

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

  function modeButton(value, label) {
    return '<button type="button" class="rescue-segment' + (state.mode === value ? " active" : "") +
      '" data-rescue-action="mode" data-value="' + value + '" aria-pressed="' + (state.mode === value) + '">' +
      esc(label) + "</button>";
  }

  function timeButton(value) {
    return '<button type="button" class="rescue-chip' + (state.maxMinutes === value ? " active" : "") +
      '" data-rescue-action="time" data-value="' + value + '" aria-pressed="' + (state.maxMinutes === value) + '">' +
      value + " 分钟</button>";
  }

  function controls(result) {
    var excluded = state.exclude.length ? state.exclude[0] : "";
    var options = result.candidates.reduce(function (list, candidate) {
      candidate.matched.forEach(function (item) {
        if (list.indexOf(item.name) < 0) list.push(item.name);
      });
      return list;
    }, []).slice(0, 20);
    return (
      '<div class="card rescue-controls">' +
      '<div class="rescue-control-main">' +
      '<div><div class="rescue-control-label">求解器模式</div><div class="rescue-segments">' +
      modeButton("rescue", "综合救援") +
      modeButton("fastest", "最快开饭") +
      modeButton("leastMissing", "最少缺料") +
      modeButton("nutrition", "营养优先") +
      "</div></div>" +
      '<div><div class="rescue-control-label">时间上限</div><div class="rescue-segments">' +
      timeButton(10) + timeButton(15) + timeButton(30) + timeButton(60) +
      "</div></div>" +
      '<div><div class="rescue-control-label">今晚菜数</div><div class="rescue-segments">' +
      [1, 2, 3].map(function (n) {
        return '<button type="button" class="rescue-chip' + (state.maxMeals === n ? " active" : "") +
          '" data-rescue-action="meals" data-value="' + n + '">' + n + " 道</button>";
      }).join("") + "</div></div>" +
      '<div><div class="rescue-control-label">总时长约束</div><div class="rescue-segments">' +
      [40, 60, 90].map(function (n) {
        return '<button type="button" class="rescue-chip' + (state.maxTotalMinutes === n ? " active" : "") +
          '" data-rescue-action="total-time" data-value="' + n + '">' + n + " 分钟</button>";
      }).join("") + "</div></div>" +
      "</div>" +
      '<div class="rescue-control-foot">' +
      '<label class="rescue-check"><input type="checkbox" data-rescue-action="include-missing"' +
      (state.includeMissing ? " checked" : "") + '><span>允许缺料菜谱</span></label>' +
      '<label class="rescue-exclude"><span>反事实排除</span><select data-rescue-action="exclude">' +
      '<option value="">不排除食材</option>' +
      options.map(function (name) {
        return '<option value="' + esc(name) + '"' + (excluded === name ? " selected" : "") + ">" + esc(name) + "</option>";
      }).join("") +
      "</select></label>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-rescue-action="reset">重置沙盘</button>' +
      "</div></div>"
    );
  }

  function kpis(stats, impact) {
    return (
      '<div class="rescue-kpis">' +
      '<div class="rescue-kpi"><span>临期食材</span><strong>' + stats.expiringKinds + "</strong><small>种，窗口 " + stats.soon + " 天</small></div>" +
      '<div class="rescue-kpi"><span>可救回估值</span><strong>' + money(stats.expiringValue) + "</strong><small>按库存单价估算</small></div>" +
      '<div class="rescue-kpi"><span>Pareto 前沿</span><strong>' + stats.paretoN + "</strong><small>共求解 " + stats.evaluatedN + " 个候选</small></div>" +
      '<div class="rescue-kpi rescue-kpi--accent"><span>累计救回</span><strong>' + impact.savedItems + "</strong><small>" + money(impact.savedValue) + " · " + impact.rescuedPlans + " 个方案</small></div>" +
      "</div>"
    );
  }

  function mealPill(meal) {
    return '<span class="rescue-meal-pill"><b>' + meal.order + "</b>" + esc(meal.title) + "</span>";
  }

  function portfolioCard(result) {
    var plan = result.portfolio;
    if (!plan || !plan.meals.length) {
      return '<div class="card rescue-portfolio rescue-empty"><div><strong>当前约束下没有可行菜单</strong>' +
        '<p>放宽时间或允许缺料后重新求解；库存为空时先去拍照入库。</p></div>' +
        '<button class="btn btn-primary" data-rescue-action="intake">拍照入库</button></div>';
    }
    var missing = plan.missing.length
      ? plan.missing.map(function (item) { return '<span class="rescue-missing">' + esc(item.name) + " " + esc(item.qty) + "</span>"; }).join("")
      : '<span class="badge badge-success">无需补料</span>';
    return (
      '<div class="card rescue-portfolio">' +
      '<div class="rescue-portfolio-head"><div><div class="rescue-eyebrow">CONSTRAINT-SOLVED MENU</div>' +
      '<h2>今晚救援菜单</h2><p>按唯一临期覆盖、救回估值、匹配率、总时长和缺料数依次比较。</p></div>' +
      '<span class="rescue-solver-badge">组合求解 · ' + plan.considered + " 次比较</span></div>" +
      '<div class="rescue-meal-line">' + plan.meals.map(mealPill).join("") + "</div>" +
      '<div class="rescue-portfolio-metrics">' +
      '<div><span>临期覆盖</span><strong>' + plan.rescuedKeys.length + " 种</strong></div>" +
      '<div><span>合并缺料</span><strong>' + plan.missing.length + " 种</strong></div>" +
      '<div><span>总时长</span><strong>' + plan.totalMinutes + " 分钟</strong></div>" +
      '<div><span>救回估值</span><strong>' + money(plan.rescuedValue) + "</strong></div>" +
      "</div>" +
      '<div class="rescue-portfolio-foot"><div><span class="rescue-mini-label">缺料</span><div class="rescue-missing-list">' + missing + "</div></div>" +
      '<button class="btn btn-primary" data-rescue-action="preview-portfolio">预览这套菜单</button></div>' +
      '<details class="rescue-trace"><summary>查看求解轨迹</summary><ol>' +
      plan.trace.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") + "</ol></details>" +
      "</div>"
    );
  }

  function contributionBars(candidate) {
    var c = candidate.contributions;
    function row(label, value, max) {
      var pct = Math.max(0, Math.min(100, Math.round(value / max * 100)));
      return '<div class="rescue-contrib"><span>' + label + "</span><i><b style=\"width:" + pct + '%"></b></i><em>' + value + "</em></div>";
    }
    return row("匹配", c.match, 40) + row("临期", c.urgency, 35) +
      row("完整", c.completeness, 25) + row("偏好", c.preference, 3);
  }

  function candidateCard(candidate) {
    var matched = candidate.matched.map(function (item) {
      return '<span class="rescue-food' + (item.isExpiring ? " urgent" : "") + '">' +
        esc(item.name) + " · " + esc(item.expiry) + "</span>";
    }).join("");
    var missing = candidate.missing.map(function (item) {
      return '<span class="rescue-missing">' + esc(item.name) + " " + esc(item.qty) + "</span>";
    }).join("");
    var labels = candidate.labels.map(function (label) {
      return '<span class="badge badge-teal">' + esc(label) + "</span>";
    }).join("");
    return (
      '<article class="rescue-card' + (candidate.pareto ? " pareto" : "") + '">' +
      '<div class="rescue-card-top"><div class="rescue-score"><strong>' + candidate.score + "</strong><span>救援分</span></div>" +
      '<div class="rescue-card-title"><div class="rescue-labels">' +
      (candidate.pareto ? '<span class="rescue-pareto">PARETO</span>' : "") + labels + "</div>" +
      "<h3>" + esc(candidate.title) + "</h3><p>" + esc(candidate.method) + " · " + esc(candidate.time) +
      " · " + candidate.kcal + " kcal · 蛋白 " + candidate.prot + "g</p></div></div>" +
      '<div class="rescue-food-row">' + (matched || '<span class="rescue-missing">没有匹配食材</span>') + "</div>" +
      (missing ? '<div class="rescue-missing-row"><span>还需</span>' + missing + "</div>" : "") +
      '<div class="rescue-contribs">' + contributionBars(candidate) + "</div>" +
      (candidate.dominatedBy.length
        ? '<p class="rescue-dominated">被「' + esc(candidate.dominatedBy[0].title) + "」支配；仍保留供反事实比较。</p>"
        : '<p class="rescue-dominance">非支配候选：没有其他方案同时超过它的救援覆盖、匹配与时间表现。</p>') +
      '<div class="rescue-card-foot"><button class="btn btn-ghost btn-sm" data-rescue-action="details" data-id="' + esc(candidate.id) + '">查看依据与做法</button>' +
      '<button class="btn btn-primary btn-sm" data-rescue-action="preview" data-id="' + esc(candidate.id) + '">加入今晚计划</button></div>' +
      "</article>"
    );
  }

  function renderContent() {
    var result = state.result;
    if (!result) {
      return '<div class="card rescue-loading">正在匹配库存、计算 Pareto 前沿并组合菜单…</div>';
    }
    var impact = window.API.rescueImpact();
    return kpis(result.stats, impact) + portfolioCard(result) + controls(result) +
      '<div class="rescue-list-head"><div><div class="rescue-eyebrow">EXPLAINABLE CANDIDATES</div><h2>候选决策队列</h2></div>' +
      '<span class="rescue-sort-note">当前模式：' + esc({
        rescue: "综合救援",
        fastest: "最快开饭",
        leastMissing: "最少缺料",
        nutrition: "营养优先"
      }[state.mode]) + "</span></div>" +
      '<div class="rescue-card-grid">' + result.candidates.map(candidateCard).join("") + "</div>";
  }

  function renderIntoRoot() {
    var content = document.getElementById("rescue-content");
    if (content) content.innerHTML = renderContent();
  }

  function queryOptions() {
    return {
      mode: state.mode,
      maxMinutes: state.maxMinutes,
      includeMissing: state.includeMissing,
      exclude: state.exclude,
      maxMeals: state.maxMeals,
      maxTotalMinutes: state.maxTotalMinutes
    };
  }

  function load() {
    var content = document.getElementById("rescue-content");
    if (content) content.innerHTML = '<div class="card rescue-loading">正在重新求解…</div>';
    return window.API.rescueCandidates(queryOptions()).then(function (result) {
      state.result = result;
      renderIntoRoot();
    }).catch(function (error) {
      if (content) content.innerHTML = '<div class="card rescue-empty"><strong>求解失败</strong><p>' + esc(error.message) + "</p></div>";
    });
  }

  function findCandidate(id) {
    return state.result && state.result.candidates.filter(function (candidate) {
      return candidate.id === id;
    })[0];
  }

  function ensureOverlay() {
    var overlay = document.getElementById("rescue-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "rescue-overlay";
      overlay.className = "rescue-overlay";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function closeOverlay() {
    var overlay = document.getElementById("rescue-overlay");
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = "";
    state.preview = null;
    var previous = document.querySelector("[data-rescue-focus-return]");
    if (previous) previous.focus();
  }

  function showOverlay(html, kind) {
    var overlay = ensureOverlay();
    overlay.innerHTML = '<div class="rescue-overlay-backdrop" data-rescue-action="close-overlay"></div>' +
      '<section class="rescue-overlay-panel ' + kind + '" role="dialog" aria-modal="true" aria-label="救援方案详情">' +
      '<button class="icon-btn rescue-overlay-close" type="button" data-rescue-action="close-overlay" aria-label="关闭">×</button>' +
      html + "</section>";
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    var focusTarget = overlay.querySelector("button, select, input");
    if (focusTarget) focusTarget.focus();
  }

  function showDetails(candidate) {
    var matched = candidate.matched.map(function (item) {
      return "<li><b>" + esc(item.name) + "</b> " + esc(item.qty) + " · " + esc(item.expiry) +
        (item.libName ? " · " + esc(item.libName) : "") + "</li>";
    }).join("");
    var missing = candidate.missing.length
      ? candidate.missing.map(function (item) { return esc(item.name) + " " + esc(item.qty); }).join("、")
      : "无";
    showOverlay(
      '<div class="rescue-drawer-head"><div class="rescue-eyebrow">DECISION REPLAY</div><h2>' + esc(candidate.title) + "</h2>" +
      "<p>救援分 " + candidate.score + " · 匹配率 " + candidate.matchRate + "% · " + esc(candidate.time) + "</p></div>" +
      '<div class="rescue-drawer-section"><h3>推荐依据</h3><ol>' +
      candidate.trace.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") + "</ol></div>" +
      '<div class="rescue-drawer-section"><h3>消耗食材</h3><ul>' + (matched || "<li>暂无匹配</li>") + "</ul><p class=\"rescue-muted\">缺料：" + esc(missing) + "</p></div>" +
      '<div class="rescue-drawer-section"><h3>做法</h3><ol>' +
      candidate.steps.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") + "</ol></div>" +
      (candidate.subs.length ? '<div class="rescue-drawer-section"><h3>替代建议</h3><ul>' +
        candidate.subs.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div class="rescue-callout">AI 只解释上述代码结果；库存、日期、缺料与得分不交给模型生成。</div>' +
      '<div class="rescue-overlay-actions"><button class="btn btn-primary" data-rescue-action="preview" data-id="' + esc(candidate.id) + '">加入今晚计划</button></div>',
      "rescue-drawer-panel"
    );
  }

  function previewRows(meals) {
    return meals.map(function (candidate) {
      return '<div class="rescue-preview-meal"><strong>' + esc(candidate.title) + "</strong>" +
        candidate.matched.map(function (item) {
          return '<div class="rescue-preview-row"><span>' + esc(item.name) + " × " + esc(item.qty) + "</span>" +
            "<span>当前 " + esc(item.qty) + " → 执行后按方案核销</span></div>";
        }).join("") +
        (candidate.missing.length ? '<p class="rescue-muted">缺料：' + candidate.missing.map(function (item) { return esc(item.name); }).join("、") + "</p>" : "") +
        "</div>";
    }).join("");
  }

  function showPreview(candidates, label) {
    if (!candidates.length) return;
    state.preview = candidates.map(function (candidate) { return candidate.id; });
    showOverlay(
      '<div class="rescue-drawer-head"><div class="rescue-eyebrow">WRITE PREVIEW</div><h2>' + esc(label) + "</h2>" +
      "<p>确认前不会扣减库存。执行后会写入操作日志，并可从方案页撤销。</p></div>" +
      '<div class="rescue-preview-list">' + previewRows(candidates) + "</div>" +
      '<div class="rescue-callout">写操作红线：预览 → 用户确认 → 执行 → 可撤销 → 写日志。</div>' +
      '<div class="rescue-overlay-actions"><button class="btn btn-ghost" data-rescue-action="close-overlay">取消</button>' +
      '<button class="btn btn-ghost" data-rescue-action="confirm" data-execute="0">仅加入计划</button>' +
      '<button class="btn btn-primary" data-rescue-action="confirm" data-execute="1">确认并执行</button></div>',
      "rescue-preview-panel"
    );
  }

  function confirmPreview(execute) {
    if (state.busy || !state.preview) return;
    state.busy = true;
    var ids = state.preview.slice();
    var created = [];
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        return window.API.createPlanFromCandidate(id, null, queryOptions()).then(function (plan) {
          created.push(plan);
        });
      });
    });
    chain.then(function () {
      if (!execute) return created;
      var runs = created.reduce(function (promise, plan) {
        return promise.then(function () { return window.API.executePlan(plan.id, plan.selected); });
      }, Promise.resolve());
      return runs.then(function () { return created; });
    }).then(function () {
      closeOverlay();
      state.busy = false;
      toast(execute ? "救援菜单已执行，可在方案页撤销" : "已加入今晚计划");
      return load();
    }).catch(function (error) {
      state.busy = false;
      toast("操作失败：" + error.message);
    });
  }

  function bind(root, rerender) {
    if (boundRoot === root) return;
    boundRoot = root;
    root.addEventListener("click", function (event) {
      var target = event.target.closest("[data-rescue-action]");
      if (!target) return;
      var action = target.getAttribute("data-rescue-action");
      if (action === "mode" || action === "time" || action === "meals" || action === "total-time") {
        var value = Number(target.getAttribute("data-value"));
        if (action === "mode") state.mode = target.getAttribute("data-value");
        if (action === "time") state.maxMinutes = value;
        if (action === "meals") state.maxMeals = value;
        if (action === "total-time") state.maxTotalMinutes = value;
        load();
      } else if (action === "reset") {
        state.mode = "rescue";
        state.maxMinutes = 30;
        state.includeMissing = true;
        state.exclude = [];
        state.maxMeals = 2;
        state.maxTotalMinutes = 60;
        load();
      } else if (action === "details") {
        var candidate = findCandidate(target.getAttribute("data-id"));
        if (candidate) showDetails(candidate);
      } else if (action === "preview") {
        var one = findCandidate(target.getAttribute("data-id"));
        if (one) showPreview([one], "确认「" + one.title + "」");
      } else if (action === "preview-portfolio") {
        showPreview(state.result.portfolio.meals, "确认今晚 " + state.result.portfolio.meals.length + " 道救援菜单");
      } else if (action === "intake") {
        if (rerender) {
          var appEvent = new CustomEvent("rescue:intake");
          window.dispatchEvent(appEvent);
        }
      }
    });
    root.addEventListener("change", function (event) {
      var target = event.target.closest("[data-rescue-action]");
      if (!target) return;
      var action = target.getAttribute("data-rescue-action");
      if (action === "include-missing") {
        state.includeMissing = target.checked;
        load();
      } else if (action === "exclude") {
        state.exclude = target.value ? [target.value] : [];
        load();
      }
    });
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-rescue-action]");
      if (!target || !target.closest("#rescue-overlay")) return;
      var action = target.getAttribute("data-rescue-action");
      if (action === "close-overlay") closeOverlay();
      if (action === "confirm") confirmPreview(target.getAttribute("data-execute") === "1");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.getElementById("rescue-overlay")?.classList.contains("show")) closeOverlay();
    });
    load();
  }

  function view() {
    return (
      '<div class="view rescue-view" id="rescue-root">' +
      '<div class="view-head rescue-view-head"><div><div class="rescue-eyebrow">MULTI-OBJECTIVE RESCUE LAB</div>' +
      "<h1>临期救援驾驶舱</h1><p>先吃最该吃的，再把缺料变成采购项。确定性求解器负责事实，AI 负责解释。</p></div>" +
      '<span class="demo-note">Pareto + 组合约束 · 离线可运行</span></div>' +
      '<div id="rescue-content"><div class="card rescue-loading">正在匹配库存、计算 Pareto 前沿并组合菜单…</div></div>' +
      "</div>"
    );
  }

  window.RESCUE_VIEW = { view: view, bind: bind };
})();
