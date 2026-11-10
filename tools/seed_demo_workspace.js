'use strict';

/*
 * 准备录屏用演示工作区：五个资源库、跨品类资源、待办、采购与 AI 方案。
 * 运行前自动备份当前快照；更新后重建后端图谱，便于验证衣柜搭配问答。
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'harmonyosapp', 'NexcoreGraph_harmonyos', 'backend');
const mysql = require(path.join(BACKEND, 'node_modules', 'mysql2', 'promise'));
const FAMILY_ID = process.env.DEMO_FAMILY_ID || 'fam-mvlvr1kz7d6';
const BACKEND_URL = process.env.NEXCORE_BACKEND_URL || 'http://127.0.0.1:3000';
const BACKUP = path.join(ROOT, 'deliverables', 'video-new', 'assets', 'snapshot-before-demo-seed.json');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function item(id, no, name, emoji, qty, unit, price, expDays, pos, lowAt) {
  return {
    id,
    no,
    name,
    emoji,
    img: '',
    kbKey: '',
    qty,
    unit,
    price,
    priceSrc: '演示数据',
    expDays,
    pos,
    lowAt,
    addedAt: 1,
    private: false,
    expiring: expDays > 0 && expDays <= 7
  };
}

function library(id, name, icon, tone, description, items) {
  return {
    id,
    name,
    icon,
    tone,
    count: items.length,
    desc: description,
    items
  };
}

function buildLibraries() {
  const stamp = Date.now();
  let seq = 0;
  const make = (name, emoji, qty, unit, price, expDays, pos, lowAt) => {
    seq += 1;
    return item(
      `demo-it-${stamp}-${String(seq).padStart(3, '0')}`,
      `NO-D${String(seq).padStart(3, '0')}`,
      name,
      emoji,
      qty,
      unit,
      price,
      expDays,
      pos,
      lowAt
    );
  };

  const fridge = [
    make('鸡蛋', '🥚', 6, '个', 12, 18, '冷藏区上层', 4),
    make('鲜牛奶', '🥛', 2, '瓶', 16, 4, '冷藏区上层', 2),
    make('酸奶', '🥣', 4, '盒', 11.5, 2, '冷藏区上层', 2),
    make('番茄', '🍅', 5, '个', 9.9, 4, '果蔬抽屉', 2),
    make('菠菜', '🥬', 1, '袋', 5.8, 2, '果蔬抽屉', 1),
    make('生菜', '🥗', 1, '颗', 4.8, 3, '果蔬抽屉', 1),
    make('西兰花', '🥦', 1, '颗', 7.9, 5, '果蔬抽屉', 0),
    make('黄油', '🧈', 1, '块', 21, 40, '冰箱门架', 0),
    make('橙汁', '🧃', 2, '瓶', 18, 8, '冰箱门架', 1),
    make('全麦面包', '🍞', 1, '袋', 13.8, 2, '冷藏区中层', 1),
    make('嫩豆腐', '◻️', 2, '盒', 6.5, 3, '冷藏区中层', 1),
    make('鸡胸肉', '🍗', 1, '袋', 25.8, 2, '冷藏区下层', 0),
    make('虾仁', '🦐', 1, '袋', 36, 45, '冷冻区', 0),
    make('速冻饺子', '🥟', 1, '袋', 29.9, 90, '冷冻区', 0),
    make('苹果', '🍎', 6, '个', 15.6, 12, '果蔬抽屉', 2),
    make('香蕉', '🍌', 4, '根', 8.8, 3, '果蔬抽屉', 2),
    make('火腿片', '🥓', 1, '盒', 16.9, 6, '冷藏区中层', 1),
    make('芝士片', '🧀', 1, '包', 19.9, 25, '冷藏区上层', 0),
    make('青椒', '🫑', 3, '个', 7.2, 6, '果蔬抽屉', 2),
    make('柠檬', '🍋', 2, '个', 6.8, 14, '果蔬抽屉', 0)
  ];

  const pantry = [
    make('东北大米', '🌾', 5, '千克', 49.9, 365, '主食层', 1),
    make('高筋面粉', '🌾', 2, '千克', 18.8, 240, '主食层', 0),
    make('荞麦挂面', '🍜', 3, '袋', 12.9, 180, '主食层', 1),
    make('食用油', '🫙', 1, '桶', 69.9, 365, '调料层', 1),
    make('食用盐', '🧂', 1, '袋', 3.5, 999, '调料层', 0),
    make('白砂糖', '🧂', 1, '袋', 8.9, 365, '调料层', 0),
    make('即食燕麦', '🥣', 2, '袋', 22.8, 90, '早餐层', 1),
    make('咖啡豆', '☕', 1, '袋', 59, 60, '饮品层', 0),
    make('红茶', '🍵', 1, '盒', 26.9, 240, '饮品层', 0),
    make('原味饼干', '🍪', 2, '盒', 14.8, 150, '零食层', 1),
    make('混合坚果', '🥜', 1, '罐', 39.9, 45, '零食层', 0),
    make('番茄罐头', '🥫', 3, '罐', 15.9, 500, '储备层', 1),
    make('花生酱', '🥜', 1, '瓶', 24.8, 120, '早餐层', 0),
    make('蜂蜜', '🍯', 1, '瓶', 32.9, 500, '调料层', 0),
    make('紫菜', '🌿', 2, '包', 9.9, 180, '储备层', 0),
    make('意大利面', '🍝', 2, '袋', 13.9, 300, '主食层', 1)
  ];

  const medicine = [
    make('布洛芬', '💊', 1, '盒', 18, 60, '第一层', 1),
    make('对乙酰氨基酚', '💊', 1, '盒', 15, 120, '第一层', 1),
    make('创可贴', '🩹', 20, '片', 8.9, 240, '第二层', 6),
    make('碘伏', '🧴', 1, '瓶', 12.8, 240, '第二层', 0),
    make('电子体温计', '🌡️', 1, '支', 39.9, 999, '工具盒', 0),
    make('生理盐水', '💧', 2, '瓶', 6.5, 180, '第三层', 1),
    make('肠胃药', '💊', 1, '盒', 22.8, 90, '第一层', 0),
    make('抗过敏药', '💊', 1, '盒', 26.9, 150, '第一层', 1),
    make('医用口罩', '😷', 10, '只', 19.9, 500, '第三层', 5),
    make('棉签', '🩹', 1, '盒', 5.9, 500, '工具盒', 0),
    make('退热贴', '🩹', 2, '片', 12.9, 90, '第二层', 1),
    make('润喉片', '🍬', 1, '盒', 16.9, 120, '第一层', 0)
  ];

  const cleaning = [
    make('洗衣液', '🧴', 1, '瓶', 39.9, 365, '清洁柜上层', 2),
    make('衣物柔顺剂', '🧴', 1, '瓶', 25.9, 365, '清洁柜上层', 0),
    make('洗洁精', '🧴', 2, '瓶', 12.9, 365, '水槽下方', 1),
    make('厨房去油剂', '🧴', 1, '瓶', 18.8, 240, '水槽下方', 0),
    make('洁厕剂', '🧴', 1, '瓶', 16.9, 180, '卫生间柜', 0),
    make('玻璃清洁剂', '🧴', 1, '瓶', 14.8, 240, '清洁柜下层', 0),
    make('垃圾袋', '🗑️', 2, '卷', 12.9, 999, '清洁柜下层', 2),
    make('海绵擦', '🧽', 3, '块', 8.8, 120, '水槽下方', 2),
    make('消毒湿巾', '🧻', 2, '包', 19.9, 180, '玄关柜', 1),
    make('橡胶手套', '🧤', 2, '双', 9.9, 240, '水槽下方', 1),
    make('拖布替换头', '🧹', 2, '个', 24.9, 999, '阳台柜', 0),
    make('洗衣机清洁剂', '🧼', 1, '盒', 26.8, 240, '阳台柜', 0)
  ];

  const wardrobe = [
    make('白色牛津纺衬衫', '👔', 1, '件', 199, 999, '衣柜左侧', 0),
    make('藏青西装外套', '🧥', 1, '件', 699, 999, '衣柜左侧', 0),
    make('黑色西裤', '👖', 1, '条', 329, 999, '衣柜左侧', 0),
    make('米色针织开衫', '🧶', 1, '件', 269, 999, '衣柜中层', 0),
    make('灰色羊毛大衣', '🧥', 1, '件', 899, 999, '衣柜右侧', 0),
    make('黑色长风衣', '🧥', 1, '件', 599, 999, '衣柜右侧', 0),
    make('浅蓝牛仔夹克', '👕', 1, '件', 299, 999, '衣柜中层', 0),
    make('白色纯棉T恤', '👕', 2, '件', 89, 999, '衣柜上层', 1),
    make('黑色高领毛衣', '🧶', 1, '件', 259, 999, '衣柜上层', 0),
    make('蓝色直筒牛仔裤', '👖', 1, '条', 299, 999, '衣柜下层', 0),
    make('卡其色半裙', '👗', 1, '条', 239, 999, '衣柜中层', 0),
    make('黑色通勤连衣裙', '👗', 1, '件', 459, 999, '衣柜右侧', 0),
    make('酒红羊绒围巾', '🧣', 1, '条', 189, 999, '配饰抽屉', 0),
    make('米色帆布托特包', '👜', 1, '个', 129, 999, '包袋层', 0),
    make('黑色通勤手提包', '👜', 1, '个', 499, 999, '包袋层', 0),
    make('白色轻便运动鞋', '👟', 1, '双', 399, 999, '鞋柜上层', 0),
    make('黑色乐福鞋', '👞', 1, '双', 459, 999, '鞋柜中层', 0),
    make('棕色短靴', '🥾', 1, '双', 529, 999, '鞋柜中层', 0),
    make('防雨风衣', '🧥', 1, '件', 629, 999, '玄关衣架', 0),
    make('灰色连帽卫衣', '👕', 1, '件', 229, 999, '衣柜上层', 0),
    make('黑色运动长裤', '👖', 1, '条', 179, 999, '衣柜下层', 0),
    make('轻量跑步鞋', '👟', 1, '双', 469, 999, '鞋柜下层', 0)
  ];

  return [
    library(`demo-lib-${stamp}-01`, '冰箱', 'fridge', 'teal', '生鲜、冷冻与饮品', fridge),
    library(`demo-lib-${stamp}-02`, '食品柜', 'pantry', 'amber', '主食、调料与储备', pantry),
    library(`demo-lib-${stamp}-03`, '药箱', 'medicine', 'red', '常备药与护理用品', medicine),
    library(`demo-lib-${stamp}-04`, '清洁柜', 'tools', 'slate', '清洁与家务耗材', cleaning),
    library(`demo-lib-${stamp}-05`, '衣柜', 'wardrobe', 'brown', '通勤、休闲与鞋包配饰', wardrobe)
  ];
}

function buildPlans() {
  return [
    { id: 1, title: '菠菜鸡蛋卷', priority: '高', reason: '临期优先', time: '12 分钟', source: '知识库 · recipes', kcal: 260, prot: 18, used: [{ name: '菠菜', qty: '1 袋' }, { name: '鸡蛋', qty: '3 个' }], missing: [], status: 'pending', selected: ['菠菜', '鸡蛋'] },
    { id: 2, title: '番茄鸡胸意面', priority: '高', reason: '临期优先 · 高蛋白', time: '22 分钟', source: '知识库 · recipes', kcal: 520, prot: 38, used: [{ name: '番茄', qty: '2 个' }, { name: '鸡胸肉', qty: '1 袋' }, { name: '意大利面', qty: '120 克' }], missing: [], status: 'pending', selected: ['番茄', '鸡胸肉'] },
    { id: 3, title: '酸奶苹果早餐碗', priority: '中', reason: '临期优先 · 5 分钟早餐', time: '5 分钟', source: '知识库 · recipes', kcal: 240, prot: 9, used: [{ name: '酸奶', qty: '1 盒' }, { name: '苹果', qty: '1 个' }, { name: '燕麦', qty: '30 克' }], missing: [], status: 'pending', selected: ['酸奶', '苹果'] },
    { id: 4, title: '蒜香西兰花', priority: '中', reason: '优先消耗绿叶菜', time: '10 分钟', source: '知识库 · recipes', kcal: 130, prot: 6, used: [{ name: '西兰花', qty: '1 颗' }], missing: [], status: 'pending', selected: ['西兰花'] },
    { id: 5, title: '虾仁豆腐煲', priority: '中', reason: '现有食材组合', time: '18 分钟', source: '知识库 · recipes', kcal: 360, prot: 28, used: [{ name: '虾仁', qty: '1 袋' }, { name: '嫩豆腐', qty: '1 盒' }], missing: [], status: 'pending', selected: ['虾仁', '嫩豆腐'] },
    { id: 6, title: '黄油吐司配牛奶', priority: '中', reason: '早餐快捷', time: '6 分钟', source: '知识库 · recipes', kcal: 310, prot: 13, used: [{ name: '全麦面包', qty: '2 片' }, { name: '黄油', qty: '10 克' }, { name: '牛奶', qty: '1 瓶' }], missing: [], status: 'pending', selected: ['全麦面包', '黄油', '牛奶'] },
    { id: 7, title: '番茄火腿鸡蛋面', priority: '高', reason: '临期优先', time: '20 分钟', source: '知识库 · recipes', kcal: 490, prot: 22, used: [{ name: '番茄', qty: '1 个' }, { name: '鸡蛋', qty: '2 个' }, { name: '火腿片', qty: '1 盒' }, { name: '荞麦挂面', qty: '100 克' }], missing: [], status: 'pending', selected: ['番茄', '鸡蛋', '火腿片'] }
  ];
}

async function main() {
  loadEnv(path.join(BACKEND, '.env'));
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'tianshu',
    charset: 'utf8mb4'
  });

  const [rows] = await pool.query(
    'SELECT payload, version, updated_at FROM sync_snapshots WHERE family_id = ?',
    [FAMILY_ID]
  );
  if (!rows.length) throw new Error(`没有找到家庭快照：${FAMILY_ID}`);

  const current = JSON.parse(rows[0].payload);
  await fsp.mkdir(path.dirname(BACKUP), { recursive: true });
  await fsp.writeFile(
    BACKUP,
    JSON.stringify({ familyId: FAMILY_ID, version: rows[0].version, updatedAt: rows[0].updated_at, payload: current }, null, 2),
    'utf8'
  );

  const libraries = buildLibraries();
  const payload = {
    libraries,
    plans: buildPlans(),
    shopping: [
      { name: '洗衣凝珠', qty: '1 盒', src: '低库存提醒' },
      { name: '垃圾袋', qty: '补到 4 卷', src: '低库存提醒' },
      { name: '鲜牛奶', qty: '补到 4 瓶', src: '低库存提醒' },
      { name: '海绵擦', qty: '补到 5 块', src: '低库存提醒' }
    ],
    alerts: [],
    daily: [],
    logs: [
      { kind: 'system', text: '准备演示资源：新增食品柜、药箱、清洁柜和衣柜', time: '刚刚' },
      ...(Array.isArray(current.logs) ? current.logs : [])
    ].slice(0, 50)
  };

  const version = Date.now();
  await pool.query(
    'INSERT INTO sync_snapshots (family_id, payload, version) VALUES (?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE payload = VALUES(payload), version = VALUES(version)',
    [FAMILY_ID, JSON.stringify(payload), version]
  );
  await pool.query(
    'INSERT INTO ops_logs (family_id, action, detail) VALUES (?, ?, ?)',
    [FAMILY_ID, 'seed', `演示工作区：${libraries.length} 个库 / ${libraries.reduce((sum, lib) => sum + lib.items.length, 0)} 件资源`]
  );
  await pool.end();

  const rebuild = await fetch(`${BACKEND_URL}/api/graph/rebuild`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId: FAMILY_ID, payload })
  });
  const graphResult = await rebuild.json();
  if (!rebuild.ok || !graphResult.ok) {
    throw new Error(`图谱重建失败：${graphResult.error || rebuild.status}`);
  }

  console.log(JSON.stringify({
    familyId: FAMILY_ID,
    version,
    backup: BACKUP,
    libraries: libraries.map((lib) => ({ name: lib.name, items: lib.items.length })),
    totalItems: libraries.reduce((sum, lib) => sum + lib.items.length, 0),
    plans: payload.plans.length,
    graph: {
      nodes: graphResult.nodes,
      edges: graphResult.edges,
      communities: graphResult.communities
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
