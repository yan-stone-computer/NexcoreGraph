/* 启核图策 · 临期救援求解器
   核心原则：库存匹配、临期程度、缺料与时间约束全部由确定性代码计算。
   - rank: 生成可解释的候选与贡献拆解
   - frontier: 计算多目标 Pareto 非支配集
   - portfolio: 在时间约束下组合 1-3 道菜，优先覆盖不同的临期食材
   模型不参与本文件计算，因此无网络、无 Key 时也能稳定演示。 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RESCUE = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var STEP_GUIDE = {
    "炒": [
      "食材切配并分开放置。",
      "锅热后放油，按耐熟程度依次下锅翻炒至断生。",
      "少量多次调味，尝味后立即出锅。"
    ],
    "煮": [
      "食材洗净切配，耐煮食材先下锅。",
      "水或汤底煮沸后转中小火，按熟度依次加入食材。",
      "确认主料熟透后调味；汤类和面食尽快食用。"
    ],
    "蒸": [
      "食材处理干净，加入基础调味后平铺装盘。",
      "水开后上锅，保持足量蒸汽蒸至中心熟透。",
      "关火静置 2 分钟再取出，避免烫伤。"
    ],
    "烧": [
      "主料切配，先煸香配料并煎至表面上色。",
      "加入主料和适量热水，小火焖至熟软。",
      "开盖收汁并调味，避免收干焦糊。"
    ],
    "煎": [
      "主料擦干水分并做基础调味。",
      "平底锅薄油，中小火煎至两面金黄。",
      "静置 1 分钟后切开确认中心熟透。"
    ],
    "拌": [
      "可生食食材洗净沥干，需要熟制的食材先彻底加热。",
      "按口味加入调味料，轻轻拌匀。",
      "现拌现吃，剩余部分及时冷藏。"
    ]
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function keyOf(value) {
    return String(value == null ? "" : value);
  }

  function minutesOf(value) {
    var match = /(\d+(?:\.\d+)?)/.exec(String(value || ""));
    return match ? Number(match[1]) : 999;
  }

  function cleanList(list) {
    return (list || []).map(function (item) {
      return String(item || "").trim().toLowerCase();
    }).filter(Boolean);
  }

  function itemKey(item) {
    return keyOf(item.kbKey || item.name);
  }

  function stockIndex(items, soon) {
    var index = {};
    (items || []).forEach(function (item) {
      var expDays = item.expDays == null ? null : Number(item.expDays);
      if (Number.isFinite(expDays) && expDays < 0) return;
      var keys = [keyOf(item.kbKey).toLowerCase(), keyOf(item.name).toLowerCase()].filter(Boolean);
      keys.forEach(function (key) {
        if (!index[key]) {
          index[key] = {
            name: item.name,
            kbKey: item.kbKey || "",
            qty: 0,
            unit: item.unit || "",
            expDays: expDays,
            price: Number(item.price) || 0,
            libId: item.libId || "",
            libName: item.libName || "",
            sample: item
          };
        }
        var entry = index[key];
        entry.qty += Number(item.qty) || 0;
        if (expDays != null && (entry.expDays == null || expDays < entry.expDays)) {
          entry.expDays = expDays;
          entry.sample = item;
        }
        entry.price = Math.max(entry.price, Number(item.price) || 0);
      });
    });
    Object.keys(index).forEach(function (key) {
      var entry = index[key];
      entry.isExpiring = entry.expDays != null && entry.expDays > 0 &&
        entry.expDays < 9000 && entry.expDays <= soon;
      entry.urgency = entry.isExpiring
        ? clamp(1 - entry.expDays / (soon + 1), 0, 1)
        : 0;
    });
    return index;
  }

  function daysLabel(expDays) {
    if (expDays == null || expDays >= 9000) return "无保质期数据";
    if (expDays === 0) return "不适用";
    if (expDays === 1) return "明天";
    return expDays + " 天后";
  }

  function stepsFor(recipe) {
    if (recipe.steps && recipe.steps.length) return recipe.steps.slice();
    return (STEP_GUIDE[recipe.method] || [
      "准备并清洗所需食材。",
      "按食材耐熟程度烹饪至中心熟透。",
      "调味后尽快食用，剩余部分及时冷藏。"
    ]).slice();
  }

  function preferenceScore(recipe, goal) {
    goal = keyOf(goal).toLowerCase();
    var tags = cleanList(recipe.tags);
    if (!goal) return 0;
    if (goal.indexOf("减脂") > -1) {
      return tags.indexOf("低脂") > -1 || tags.indexOf("清淡") > -1 ? 3 : 0;
    }
    if (goal.indexOf("增肌") > -1) {
      return tags.indexOf("增肌") > -1 || Number(recipe.prot) >= 24 ? 3 : 0;
    }
    if (goal.indexOf("控糖") > -1) {
      return tags.indexOf("清淡") > -1 || tags.indexOf("低脂") > -1 ? 3 : 0;
    }
    return tags.indexOf("家常") > -1 ? 1 : 0;
  }

  function rank(recipes, items, options) {
    options = options || {};
    var soon = Number(options.soon) > 0 ? Number(options.soon) : 7;
    var maxMinutes = Number(options.maxMinutes) > 0 ? Number(options.maxMinutes) : Infinity;
    var dislikes = cleanList(options.dislikes);
    var excluded = cleanList(options.exclude);
    var includeMissing = options.includeMissing !== false;
    var stock = stockIndex(items, soon);
    var candidates = [];

    (recipes || []).forEach(function (recipe) {
      var ingredients = recipe.ing || [];
      var blocked = ingredients.some(function (ingredient) {
        var names = cleanList([ingredient[0], ingredient[2]]);
        return names.some(function (name) {
          return dislikes.indexOf(name) > -1 || excluded.indexOf(name) > -1;
        });
      });
      if (blocked) return;
      if (minutesOf(recipe.time) > maxMinutes) return;

      var matched = [];
      var missing = [];
      ingredients.forEach(function (ingredient) {
        var name = ingredient[0];
        var kbKey = ingredient[2] || "";
        var stockItem = stock[keyOf(kbKey).toLowerCase()] || stock[keyOf(name).toLowerCase()];
        if (stockItem && stockItem.qty > 0) {
          matched.push({
            name: name,
            kbKey: kbKey,
            qty: ingredient[1],
            unit: stockItem.unit,
            expDays: stockItem.expDays,
            expiry: daysLabel(stockItem.expDays),
            urgency: stockItem.urgency,
            isExpiring: stockItem.isExpiring,
            price: stockItem.price,
            libName: stockItem.libName
          });
        } else {
          missing.push({ name: name, qty: ingredient[1], kbKey: kbKey });
        }
      });
      if (!includeMissing && missing.length) return;

      var expiring = matched.filter(function (item) { return item.isExpiring; });
      var matchRate = ingredients.length ? matched.length / ingredients.length : 0;
      var completeness = missing.length === 0 ? 1 : 1 / (1 + missing.length);
      var rescueRate = expiring.length
        ? expiring.reduce(function (sum, item) { return sum + item.urgency; }, 0) / expiring.length
        : 0;
      var baseScore = 100 * (0.4 * matchRate + 0.35 * rescueRate + 0.25 * completeness);
      var preference = preferenceScore(recipe, options.goal);
      var score = Math.round(baseScore + preference);
      var rescuedValue = expiring.reduce(function (sum, item) {
        return sum + (Number(item.price) || 0);
      }, 0);
      var labels = [];
      if (expiring.length) labels.push("临期优先");
      if (missing.length === 0) labels.push("食材齐全");
      if (minutesOf(recipe.time) <= 15) labels.push("15 分钟快手");
      if (preference > 0) labels.push(keyOf(options.goal) || "偏好匹配");

      candidates.push({
        id: "recipe:" + recipe.title,
        title: recipe.title,
        score: score,
        baseScore: Math.round(baseScore),
        matchRate: Math.round(matchRate * 100),
        rescueItems: expiring.length,
        rescuedValue: Math.round(rescuedValue * 100) / 100,
        time: recipe.time,
        timeMinutes: minutesOf(recipe.time),
        kcal: Number(recipe.kcal) || 0,
        prot: Number(recipe.prot) || 0,
        tags: (recipe.tags || []).slice(),
        method: recipe.method || "",
        matched: matched,
        missing: missing,
        labels: labels,
        steps: stepsFor(recipe),
        subs: (recipe.subs || []).slice(),
        contributions: {
          match: Math.round(40 * matchRate),
          urgency: Math.round(35 * rescueRate),
          completeness: Math.round(25 * completeness),
          preference: preference
        },
        trace: [
          "库存匹配：" + matched.length + "/" + ingredients.length + " 种，缺料 " + missing.length + " 种",
          expiring.length
            ? "临期命中：" + expiring.map(function (item) { return item.name + "（" + item.expiry + "）"; }).join("、")
            : "临期命中：0 项，按完整度与偏好排序",
          "多目标得分：" + Math.round(baseScore) + "，偏好修正 " + preference
        ],
        pareto: false,
        dominatedBy: []
      });
    });

    candidates.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.rescueItems !== a.rescueItems) return b.rescueItems - a.rescueItems;
      return a.title.localeCompare(b.title, "zh-CN");
    });
    frontier(candidates);
    return candidates;
  }

  function dominates(a, b) {
    var aValues = [a.rescueItems, a.rescuedValue, a.matchRate, -a.missing.length, -a.timeMinutes, a.prot];
    var bValues = [b.rescueItems, b.rescuedValue, b.matchRate, -b.missing.length, -b.timeMinutes, b.prot];
    var better = false;
    for (var i = 0; i < aValues.length; i += 1) {
      if (aValues[i] < bValues[i]) return false;
      if (aValues[i] > bValues[i]) better = true;
    }
    return better;
  }

  function frontier(candidates) {
    var list = candidates || [];
    list.forEach(function (candidate) {
      candidate.pareto = true;
      candidate.dominatedBy = [];
    });
    list.forEach(function (candidate) {
      list.forEach(function (other) {
        if (other === candidate) return;
        if (dominates(other, candidate)) {
          candidate.pareto = false;
          candidate.dominatedBy.push({ id: other.id, title: other.title });
        }
      });
    });
    return list.filter(function (candidate) { return candidate.pareto; });
  }

  function combinations(list, size) {
    var out = [];
    function walk(start, picked) {
      if (picked.length === size) {
        out.push(picked.slice());
        return;
      }
      for (var i = start; i < list.length; i += 1) {
        picked.push(list[i]);
        walk(i + 1, picked);
        picked.pop();
      }
    }
    if (size > 0 && size <= list.length) walk(0, []);
    return out;
  }

  function summarizePortfolio(meals) {
    var rescueMap = {};
    var missingMap = {};
    var rescuedValue = 0;
    var totalMinutes = 0;
    var matchTotal = 0;
    meals.forEach(function (meal) {
      totalMinutes += meal.timeMinutes;
      matchTotal += meal.matchRate;
      meal.matched.forEach(function (item) {
        if (!item.isExpiring) return;
        var key = keyOf(item.kbKey || item.name).toLowerCase();
        rescueMap[key] = item;
        rescuedValue += Number(item.price) || 0;
      });
      meal.missing.forEach(function (item) {
        var key = keyOf(item.kbKey || item.name).toLowerCase();
        missingMap[key] = item;
      });
    });
    return {
      meals: meals.map(function (meal, index) {
        var copy = Object.assign({}, meal);
        copy.order = index + 1;
        copy.orderLabel = "第 " + (index + 1) + " 道";
        return copy;
      }),
      rescuedKeys: Object.keys(rescueMap),
      rescuedItems: Object.keys(rescueMap),
      missing: Object.keys(missingMap).map(function (key) { return missingMap[key]; }),
      rescuedValue: Math.round(rescuedValue * 100) / 100,
      totalMinutes: totalMinutes,
      averageMatch: meals.length ? Math.round(matchTotal / meals.length) : 0
    };
  }

  function comparePortfolio(a, b) {
    var checks = [
      [a.rescuedKeys.length, b.rescuedKeys.length],
      [a.rescuedValue, b.rescuedValue],
      [a.averageMatch, b.averageMatch],
      [-a.totalMinutes, -b.totalMinutes],
      [-a.missing.length, -b.missing.length]
    ];
    for (var i = 0; i < checks.length; i += 1) {
      if (checks[i][0] !== checks[i][1]) return checks[i][0] > checks[i][1] ? 1 : -1;
    }
    return 0;
  }

  function portfolio(candidates, options) {
    options = options || {};
    var maxMeals = clamp(Number(options.maxMeals) || 2, 1, 3);
    var maxTotalMinutes = Number(options.maxTotalMinutes) > 0
      ? Number(options.maxTotalMinutes)
      : 90;
    var pool = (candidates || []).slice(0, 12);
    var best = null;
    var considered = 0;
    var rejected = [];
    for (var size = Math.min(maxMeals, pool.length); size >= 1; size -= 1) {
      combinations(pool, size).forEach(function (meals) {
        considered += 1;
        var summary = summarizePortfolio(meals);
        if (summary.totalMinutes > maxTotalMinutes) {
          rejected.push({
            meals: meals.map(function (meal) { return meal.title; }),
            reason: "总时长 " + summary.totalMinutes + " 分钟超过约束 " + maxTotalMinutes
          });
          return;
        }
        if (!best || comparePortfolio(summary, best) > 0) best = summary;
      });
      if (best) break;
    }
    if (!best) {
      return {
        meals: [],
        rescuedKeys: [],
        rescuedItems: [],
        missing: [],
        rescuedValue: 0,
        totalMinutes: 0,
        averageMatch: 0,
        considered: considered,
        rejected: rejected.slice(0, 5),
        trace: ["在时长约束内没有可行组合"]
      };
    }
    best.considered = considered;
    best.rejected = rejected.slice(0, 5);
    best.trace = [
      "枚举 " + considered + " 个满足菜数上限的组合",
      "优先最大化唯一临期食材覆盖，再比较救回估值、匹配率、总时长与缺料",
      "选中 " + best.meals.length + " 道菜，覆盖 " + best.rescuedKeys.length + " 种临期食材"
    ];
    return best;
  }

  return {
    rank: rank,
    frontier: frontier,
    portfolio: portfolio,
    minutesOf: minutesOf,
    daysLabel: daysLabel,
    safeStock: stockIndex
  };
});
