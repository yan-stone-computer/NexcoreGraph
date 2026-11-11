/* 启核图策 · 家庭生活域智策
   纯函数：药箱风险、工具箱保修、身体指标与器材约束训练计划。
   结果由代码计算，模型只能解释；训练建议不替代医疗诊断。 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DOMAINS = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function domainOf(library) {
    var name = String(library.name || "");
    var icon = String(library.icon || "");
    if (icon === "fridge" || /冰箱|食品柜|食材|零食/.test(name)) return "food";
    if (icon === "pill" || /药箱|药品|药柜/.test(name)) return "medicine";
    if (icon === "dumbbell" || /健身|运动|训练/.test(name)) return "fitness";
    if (icon === "wrench" || /工具|维修|五金/.test(name)) return "tools";
    if (icon === "plug" || /家电|电器|保修设备/.test(name)) return "appliance";
    if (icon === "shirt" || /衣橱|衣柜|衣物|鞋柜/.test(name)) return "wardrobe";
    if (icon === "book" || /书架|图书|书籍/.test(name)) return "books";
    if (icon === "paw" || /宠物|猫粮|狗粮/.test(name)) return "pet";
    if (/清洁|耗材|日化/.test(name)) return "cleaning";
    return "general";
  }

  function allItems(libraries, domain) {
    var out = [];
    (libraries || []).forEach(function (library) {
      if (domain && domainOf(library) !== domain) return;
      (library.items || []).forEach(function (item) {
        out.push(Object.assign({}, item, {
          libId: library.id,
          libName: library.name,
          domain: domainOf(library)
        }));
      });
    });
    return out;
  }

  function medicineSummary(libraries, soon) {
    var items = allItems(libraries, "medicine");
    var expiring = items.filter(function (item) {
      return item.expDays > 0 && item.expDays <= soon && item.expDays < 9000;
    }).sort(function (a, b) { return a.expDays - b.expDays; });
    var expired = items.filter(function (item) { return item.expDays < 0; });
    var low = items.filter(function (item) {
      return Number(item.lowAt) > 0 && Number(item.qty) <= Number(item.lowAt);
    });
    var notes = [];
    if (expiring.length) notes.push("先核对说明书与外观；临期不等于可继续使用。");
    if (expired.length) notes.push("过期药品应单独封存并按当地药品回收规则处理。");
    if (low.length) notes.push("常用药低于阈值，建议确认后加入采购清单。");
    if (!items.length) notes.push("尚未建立药箱，可创建“家庭药箱”资源库。");
    return {
      totalItems: items.length,
      expiringItems: expiring,
      expiredItems: expired,
      lowStock: low,
      notes: notes
    };
  }

  function toolSummary(libraries) {
    var items = allItems(libraries, "tools");
    var warrantySoon = items.filter(function (item) {
      return item.warrantyDays != null && item.warrantyDays >= 0 && item.warrantyDays <= 30;
    }).sort(function (a, b) { return a.warrantyDays - b.warrantyDays; });
    var maintenanceSoon = items.filter(function (item) {
      return item.maintenanceDays != null && item.maintenanceDays >= 0 && item.maintenanceDays <= 14;
    }).sort(function (a, b) { return a.maintenanceDays - b.maintenanceDays; });
    var activeLoans = items.filter(function (item) { return String(item.borrower || "").trim() !== ""; });
    var loanDueSoon = activeLoans.filter(function (item) {
      return item.loanDueDays != null && item.loanDueDays <= 2;
    }).sort(function (a, b) { return a.loanDueDays - b.loanDueDays; });
    var notes = [];
    if (warrantySoon.length) notes.push("临近保修截止的设备先检查功能并保留购买凭证。");
    if (maintenanceSoon.length) notes.push("维护周期临近：清洁、润滑或更换耗材前先断电。");
    if (loanDueSoon.length) notes.push("有工具临近归还期限，请先确认借用人和使用状态。");
    if (!items.length) notes.push("尚未建立工具箱，可创建“维修工具箱”资源库。");
    return {
      totalItems: items.length,
      warrantySoon: warrantySoon,
      maintenanceSoon: maintenanceSoon,
      activeLoans: activeLoans,
      loanDueSoon: loanDueSoon,
      notes: notes
    };
  }

  function inventorySummary(libraries, domain, label) {
    var librariesInDomain = (libraries || []).filter(function (library) {
      return domainOf(library) === domain;
    });
    var items = allItems(libraries, domain);
    var value = items.reduce(function (sum, item) {
      return sum + (Number(item.price) || 0);
    }, 0);
    var lowStock = items.filter(function (item) {
      return Number(item.lowAt) > 0 && Number(item.qty) <= Number(item.lowAt);
    });
    var expiring = items.filter(function (item) {
      return item.expDays > 0 && item.expDays <= 7 && item.expDays < 9000;
    });
    return {
      key: domain,
      label: label,
      libraries: librariesInDomain.length,
      count: items.length,
      value: Math.round(value * 100) / 100,
      lowStock: lowStock,
      expiring: expiring,
      items: items
    };
  }

  function householdSummary(inventory, medicine, tools) {
    var keys = Object.keys(inventory);
    var totalItems = keys.reduce(function (sum, key) { return sum + inventory[key].count; }, 0);
    var totalValue = keys.reduce(function (sum, key) { return sum + inventory[key].value; }, 0);
    var activeDomains = keys.filter(function (key) { return inventory[key].count > 0; }).length;
    var assetItems = ["wardrobe", "appliance", "books", "pet", "cleaning"].reduce(function (sum, key) {
      return sum + inventory[key].count;
    }, 0);
    var riskOrder = ["food", "medicine", "tools", "fitness", "appliance", "wardrobe", "books", "pet", "cleaning", "general"];
    var riskDomains = riskOrder.map(function (key) {
      var data = inventory[key];
      var riskIds = {};
      data.expiring.concat(data.lowStock).forEach(function (item) { riskIds[item.id] = true; });
      if (key === "medicine") {
        medicine.expiredItems.concat(medicine.lowStock).forEach(function (item) { riskIds[item.id] = true; });
      }
      if (key === "tools") {
        tools.warrantySoon.concat(tools.maintenanceSoon, tools.loanDueSoon).forEach(function (item) {
          riskIds[item.id] = true;
        });
      }
      if (key === "appliance") {
        data.items.forEach(function (item) {
          if ((item.warrantyDays != null && item.warrantyDays <= 30) ||
              (item.maintenanceDays != null && item.maintenanceDays <= 14)) {
            riskIds[item.id] = true;
          }
        });
      }
      return { key: key, label: data.label, count: Object.keys(riskIds).length };
    }).filter(function (domain) { return domain.count > 0; });
    return {
      totalItems: totalItems,
      totalValue: Math.round(totalValue * 100) / 100,
      activeDomains: activeDomains,
      assetItems: assetItems,
      riskCount: riskDomains.reduce(function (sum, domain) { return sum + domain.count; }, 0),
      riskDomains: riskDomains
    };
  }

  function equipmentNames(items) {
    var names = (items || []).map(function (item) { return String(item.name || ""); });
    var found = [];
    function add(label, pattern) {
      if (names.some(function (name) { return pattern.test(name); }) && found.indexOf(label) < 0) {
        found.push(label);
      }
    }
    add("哑铃", /哑铃/);
    add("杠铃", /杠铃/);
    add("壶铃", /壶铃/);
    add("弹力带", /弹力带|阻力带/);
    add("跑步机", /跑步机/);
    add("单车", /单车|骑行台/);
    add("瑜伽垫", /瑜伽|训练垫/);
    add("训练凳", /训练凳|卧推凳/);
    return found;
  }

  function bmiInfo(profile) {
    var height = number(profile.height, 170);
    var weight = number(profile.weight, 65);
    var bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
    var label = bmi < 18.5 ? "偏轻" : bmi < 24 ? "正常" : bmi < 28 ? "超重" : "肥胖";
    return { bmi: bmi, bmiLabel: label };
  }

  function exercisePool(equipment, goal, level) {
    var pool = [
      { name: "自重深蹲", area: "下肢", equipment: "自重", cue: "膝盖与脚尖方向一致" },
      { name: "平板支撑", area: "核心", equipment: "自重", cue: "保持头、背、臀成一直线" }
    ];
    if (equipment.indexOf("哑铃") > -1) {
      pool.push(
        { name: "哑铃深蹲", area: "下肢", equipment: "哑铃", cue: "重量以动作稳定为先" },
        { name: "哑铃划船", area: "背部", equipment: "哑铃", cue: "背部平直，肘部贴近身体" },
        { name: "哑铃肩推", area: "肩部", equipment: "哑铃", cue: "避免耸肩和腰部过度后仰" }
      );
    }
    if (equipment.indexOf("弹力带") > -1) {
      pool.push({ name: "弹力带划船", area: "背部", equipment: "弹力带", cue: "固定点必须牢靠" });
    }
    if (equipment.indexOf("壶铃") > -1) {
      pool.push({ name: "壶铃硬拉", area: "后链", equipment: "壶铃", cue: "以髋部发力，不弓背" });
    }
    if (equipment.indexOf("瑜伽垫") > -1) {
      pool.push({ name: "鸟狗式", area: "核心稳定", equipment: "瑜伽垫", cue: "动作缓慢，骨盆保持稳定" });
    }
    if (equipment.indexOf("跑步机") > -1 || equipment.indexOf("单车") > -1) {
      pool.push({
        name: goal === "减脂" ? "低冲击有氧间歇" : "稳态有氧",
        area: "心肺",
        equipment: equipment.indexOf("跑步机") > -1 ? "跑步机" : "单车",
        cue: "以能说短句的强度开始"
      });
    }
    if (!equipment.length) {
      pool.push(
        { name: "原地高抬腿", area: "心肺", equipment: "自重", cue: "落地缓冲，保持呼吸" },
        { name: "臀桥", area: "后链", equipment: "自重", cue: "顶端停一秒，避免腰部代偿" }
      );
    }
    if (goal === "增肌") {
      pool.sort(function (a, b) { return Number(a.equipment === "自重") - Number(b.equipment === "自重"); });
    }
    if (level === "新手") return pool.slice(0, Math.min(6, pool.length));
    return pool;
  }

  function fitnessPlan(profile, equipmentNamesInput) {
    profile = profile || {};
    var equipment = equipmentNames((equipmentNamesInput || []).map(function (name) {
      return { name: name };
    }));
    var bmi = bmiInfo(profile);
    var age = number(profile.age, 30);
    var goal = String(profile.goal || "保持");
    var level = String(profile.level || "新手");
    var days = clamp(Math.round(number(profile.days, 3)), 2, 5);
    var maxHeartRate = 220 - age;
    var targetHeartRate = {
      min: Math.round(maxHeartRate * 0.6),
      max: Math.round(maxHeartRate * 0.7)
    };
    var used = equipment.length ? equipment.slice() : ["自重"];
    var exercises = exercisePool(equipment, goal, level);
    var focus = [
      "全身力量",
      "心肺与核心",
      "下肢与背部",
      "上肢与稳定性",
      "恢复与活动度"
    ];
    var sessions = [];
    for (var i = 0; i < days; i += 1) {
      sessions.push({
        day: i + 1,
        title: "第 " + (i + 1) + " 天 · " + focus[i % focus.length],
        minutes: goal === "减脂" ? 35 : 40,
        intensity: i === days - 1 && days >= 3 ? "轻中等" : "中等",
        moves: exercises.filter(function (_, index) { return index % days === i % days; }).slice(0, 4)
      });
    }
    var safetyNotes = ["本方案为一般健身建议，不替代医疗诊断或康复处方。"];
    if (age >= 65 || bmi.bmi < 18.5 || bmi.bmi >= 28 || String(profile.limitations || "").trim()) {
      safetyNotes.push("年龄、BMI 或身体限制提示存在额外风险，开始训练前建议咨询专业人士。");
    }
    safetyNotes.push("出现胸痛、眩晕、异常气短或关节剧痛时立即停止并寻求医疗帮助。");
    var prescription = goal === "增肌"
      ? "每个力量动作 3–4 组，每组 8–12 次，组间休息 60–90 秒。"
      : goal === "减脂"
        ? "每个动作 2–3 轮，每组 12–15 次；有氧保持目标心率区间。"
        : "每个动作 2–3 组，每组 10–12 次，以动作稳定和呼吸顺畅为准。";
    return {
      bmi: bmi.bmi,
      bmiLabel: bmi.bmiLabel,
      targetHeartRate: targetHeartRate,
      equipmentUsed: used,
      sessions: sessions,
      exercises: exercises,
      prescription: prescription,
      safetyNotes: safetyNotes
    };
  }

  function analyze(libraries, profile) {
    var soon = Number(profile && profile.alertSoon) > 0 ? Number(profile.alertSoon) : 7;
    var fitnessItems = allItems(libraries, "fitness");
    var equipment = equipmentNames(fitnessItems);
    var body = profile && profile.body ? profile.body : {};
    var inventory = {
      food: inventorySummary(libraries, "food", "食材"),
      medicine: inventorySummary(libraries, "medicine", "药品"),
      fitness: inventorySummary(libraries, "fitness", "健身器材"),
      tools: inventorySummary(libraries, "tools", "维修工具"),
      appliance: inventorySummary(libraries, "appliance", "家电"),
      wardrobe: inventorySummary(libraries, "wardrobe", "衣橱"),
      books: inventorySummary(libraries, "books", "书籍"),
      pet: inventorySummary(libraries, "pet", "宠物用品"),
      cleaning: inventorySummary(libraries, "cleaning", "清洁耗材"),
      general: inventorySummary(libraries, "general", "其他资源")
    };
    var medicine = medicineSummary(libraries, soon);
    var tools = toolSummary(libraries);
    return {
      household: householdSummary(inventory, medicine, tools),
      inventory: inventory,
      medicine: medicine,
      fitness: {
        equipment: fitnessItems,
        equipmentUsed: equipment,
        plan: fitnessPlan(body, equipment)
      },
      tools: tools
    };
  }

  return {
    analyze: analyze,
    fitnessPlan: fitnessPlan,
    domainOf: domainOf,
    equipmentNames: equipmentNames
  };
});
