// 启核图策 · 演示种子数据（对应 webapp js/data.js 的迁移）
import type { DB } from '@/types'

export const SEED: DB = {
  /* ---------- 账号与家庭（F9.1） ---------- */
  user: { name: '林夏', phone: '13800138000', role: '家庭管理员', initial: '林' },
  family: { name: '幸福小家', memberCount: 4 },
  familyId: 'home',
  families: [
    { id: 'home', name: '幸福小家', memberCount: 4 },
    { id: 'personal', name: '林夏 · 个人', memberCount: 1 }
  ],
  users: [
    { phone: '13800138000', name: '林夏', role: '管理员', familyId: 'home', disabled: false, createdAt: '2026-08-01' },
    { phone: '13900139000', name: '妈妈', role: '成员', familyId: 'home', disabled: false, createdAt: '2026-08-02' },
    { phone: '13700137000', name: '爸爸', role: '成员', familyId: 'home', disabled: false, createdAt: '2026-08-02' },
    { phone: '13600136000', name: '妹妹', role: '只读', familyId: 'home', disabled: false, createdAt: '2026-08-05' },
    { phone: '13500135000', name: '测试号', role: '成员', familyId: 'home', disabled: true, createdAt: '2026-08-10' }
  ],
  members: {
    home: [
      { phone: '13800138000', name: '林夏', role: '管理员' },
      { phone: '13900139000', name: '妈妈', role: '成员' },
      { phone: '13700137000', name: '爸爸', role: '成员' },
      { phone: '13600136000', name: '妹妹', role: '只读' }
    ],
    personal: [{ phone: '13800138000', name: '林夏', role: '管理员' }]
  },
  invite: { code: 'TZ-4821', familyId: 'home', expiresInDays: 7, used: 2, max: 3, revoked: false },

  theme: 'light',
  settings: { private: true, chat: true, expiry: true, digest: true, low: true, alertSoon: 7, alertCritical: 3 },

  /* P0-4 家庭偏好档案：仅本地存储（D7） */
  profile: { people: 3, dislikes: '香菜、苦瓜', goal: '减脂', enabled: true },
  /* D6：Store.budget 月度预算，默认 600 */
  budget: 600,

  logs: [],
  aiUsage: [],
  config: {
    model: 'DeepSeek-V3',
    visionModel: 'Agnes-Vision',
    webSearch: true,
    searchCacheMin: 10,
    rateLimitPerDay: 200,
    unitPrice: 0.002,
    visionPrice: 0.01,
    identifyThreshold: 0.85,
    pushTemplate: '【启核图策】{{content}}',
    knowledgeVersion: 1
  },

  /* ---------- 资源库（F2：内置 8 库） ---------- */
  libraries: [
    {
      id: 'fridge', name: '冰箱', icon: 'fridge', tone: 'teal', desc: '冷藏 7 · 冷冻 1', count: 8, items: [
        { id: 'egg', no: 'NO-0001', name: '鸡蛋', emoji: '🥚', img: '', kbKey: 'egg', qty: 8, unit: '个', price: 15.9, priceSrc: '拍照识别', expDays: 3, pos: '冷藏区中层', lowAt: 5, addedAt: 12, private: false },
        { id: 'milk', no: 'NO-0002', name: '鲜牛奶', emoji: '🥛', img: '', kbKey: 'milk', qty: 1, unit: '盒', price: 12.5, priceSrc: '联网参考', expDays: 2, pos: '冷藏区上层', lowAt: 1, addedAt: 10, private: false },
        { id: 'tomato', no: 'NO-0003', name: '番茄', emoji: '🍅', img: '', kbKey: 'tomato', qty: 3, unit: '个', price: 6.8, priceSrc: '手动', expDays: 6, pos: '冷藏区底层', lowAt: 2, addedAt: 8, private: false },
        { id: 'greens', no: 'NO-0004', name: '上海青', emoji: '🥬', img: '', kbKey: 'greens', qty: 2, unit: '把', price: 8.4, priceSrc: '拍照识别', expDays: 4, pos: '冷藏区底层', lowAt: 1, addedAt: 6, private: false },
        { id: 'pork', no: 'NO-0005', name: '五花肉', emoji: '🥩', img: '', kbKey: 'pork', qty: 500, unit: '克', price: 46, priceSrc: '联网参考', expDays: 90, pos: '冷冻区', lowAt: 0, addedAt: 15, private: false },
        { id: 'tofu', no: 'NO-0006', name: '豆腐', emoji: '🍥', img: '', kbKey: 'tofu', qty: 1, unit: '块', price: 3.5, priceSrc: '手动', expDays: 4, pos: '冷藏区底层', lowAt: 1, addedAt: 3, private: false },
        { id: 'carrot', no: 'NO-0007', name: '胡萝卜', emoji: '🥕', img: '', kbKey: 'carrot', qty: 3, unit: '根', price: 4.5, priceSrc: '手动', expDays: 21, pos: '冷藏区底层', lowAt: 1, addedAt: 9, private: false },
        { id: 'leftover', no: 'NO-0008', name: '昨晚剩菜', emoji: '🍱', img: '', kbKey: 'leftover', qty: 1, unit: '份', price: 0, priceSrc: '手动', expDays: 1, pos: '冷藏区上层', lowAt: 0, addedAt: 1, private: true }
      ]
    },
    {
      id: 'wardrobe', name: '衣柜', icon: 'shirt', tone: 'indigo', desc: '上衣 9 · 下装 3 · 鞋 2', count: 5, items: [
        { id: 'tee', no: 'NO-0010', name: '白 T 恤', emoji: '👕', img: '', qty: 8, unit: '件', price: 240, priceSrc: '手动', expDays: 9999, pos: '上层抽屉', lowAt: 0, addedAt: 20, private: false },
        { id: 'hoodie', no: 'NO-0011', name: '连帽卫衣', emoji: '🧥', img: '', qty: 3, unit: '件', price: 360, priceSrc: '手动', expDays: 9999, pos: '中层挂杆', lowAt: 0, addedAt: 18, private: false },
        { id: 'jeans', no: 'NO-0012', name: '牛仔裤', emoji: '👖', img: '', qty: 2, unit: '条', price: 300, priceSrc: '手动', expDays: 9999, pos: '下层格架', lowAt: 0, addedAt: 16, private: false },
        { id: 'sneakers', no: 'NO-0013', name: '运动鞋', emoji: '👟', img: '', qty: 2, unit: '双', price: 560, priceSrc: '拍照识别', expDays: 9999, pos: '鞋架', lowAt: 0, addedAt: 14, private: false },
        { id: 'journal', no: 'NO-0014', name: '手账本', emoji: '📔', img: '', qty: 1, unit: '本', price: 45, priceSrc: '手动', expDays: 9999, pos: '顶层收纳盒', lowAt: 0, addedAt: 5, private: true }
      ]
    },
    {
      id: 'medicine', name: '药盒', icon: 'pill', tone: 'red', desc: '含 1 项有效期提醒', count: 5, items: [
        { id: 'bpx', no: 'NO-0020', name: '降压药', emoji: '💊', img: '', qty: 1, unit: '盒', price: 32, priceSrc: '手动', expDays: 9, pos: '第一层', lowAt: 0, addedAt: 4, private: false, med: true },
        { id: 'cold', no: 'NO-0021', name: '感冒灵颗粒', emoji: '💊', img: '', qty: 1, unit: '盒', price: 18, priceSrc: '手动', expDays: 200, pos: '第一层', lowAt: 0, addedAt: 30, private: false, med: true },
        { id: 'vc', no: 'NO-0022', name: '维生素 C', emoji: '🍋', img: '', qty: 1, unit: '瓶', price: 45, priceSrc: '手动', expDays: 300, pos: '第二层', lowAt: 0, addedAt: 25, private: false, med: true },
        { id: 'bandaid', no: 'NO-0023', name: '创可贴', emoji: '🩹', img: '', qty: 1, unit: '盒', price: 9.9, priceSrc: '手动', expDays: 500, pos: '第二层', lowAt: 0, addedAt: 40, private: false, med: true },
        { id: 'eyedrop', no: 'NO-0024', name: '眼药水', emoji: '💧', img: '', qty: 1, unit: '瓶', price: 28, priceSrc: '手动', expDays: 25, pos: '第三层', lowAt: 0, addedAt: 2, private: false, med: true }
      ]
    },
    {
      id: 'tools', name: '工具箱', icon: 'wrench', tone: 'slate', desc: '常用工具齐全', count: 4, items: [
        { id: 'screw', no: 'NO-0030', name: '螺丝刀套装', emoji: '🪛', img: '', qty: 1, unit: '套', price: 89, priceSrc: '手动', expDays: 9999, pos: '主隔层', lowAt: 0, addedAt: 50, private: false },
        { id: 'drill', no: 'NO-0031', name: '电钻', emoji: '🔧', img: '', qty: 1, unit: '台', price: 399, priceSrc: '拍照识别', expDays: 9999, pos: '主隔层', lowAt: 0, addedAt: 50, private: false },
        { id: 'tape', no: 'NO-0032', name: '绝缘胶带', emoji: '🧻', img: '', qty: 2, unit: '卷', price: 10, priceSrc: '手动', expDays: 9999, pos: '配件盒', lowAt: 1, addedAt: 30, private: false },
        { id: 'ruler', no: 'NO-0033', name: '卷尺', emoji: '📐', img: '', qty: 1, unit: '把', price: 15, priceSrc: '手动', expDays: 9999, pos: '配件盒', lowAt: 0, addedAt: 45, private: false }
      ]
    },
    {
      id: 'fitness', name: '健身器材', icon: 'dumbbell', tone: 'lime', desc: '哑铃 · 瑜伽垫 · 弹力带', count: 4, items: [
        { id: 'dumbbell', no: 'NO-0040', name: '可调哑铃', emoji: '🏋️', img: '', qty: 2, unit: '只', price: 480, priceSrc: '联网参考', expDays: 9999, pos: '角落', lowAt: 0, addedAt: 60, private: false },
        { id: 'yoga', no: 'NO-0041', name: '瑜伽垫', emoji: '🧘', img: '', qty: 1, unit: '张', price: 99, priceSrc: '手动', expDays: 9999, pos: '立架', lowAt: 0, addedAt: 40, private: false },
        { id: 'band', no: 'NO-0042', name: '弹力带', emoji: '➰', img: '', qty: 2, unit: '条', price: 30, priceSrc: '手动', expDays: 9999, pos: '立架', lowAt: 1, addedAt: 35, private: false },
        { id: 'rope', no: 'NO-0043', name: '跳绳', emoji: '🪢', img: '', qty: 1, unit: '根', price: 25, priceSrc: '手动', expDays: 9999, pos: '立架', lowAt: 0, addedAt: 20, private: false }
      ]
    },
    {
      id: 'books', name: '书架', icon: 'book', tone: 'brown', desc: '在读 2 本', count: 3, items: [
        { id: 'santi', no: 'NO-0050', name: '三体（全集）', emoji: '📚', img: '', qty: 1, unit: '套', price: 168, priceSrc: '拍照识别', expDays: 9999, pos: '第二层', lowAt: 0, addedAt: 70, private: false },
        { id: 'cook', no: 'NO-0051', name: '家常菜大全', emoji: '📖', img: '', qty: 1, unit: '本', price: 59, priceSrc: '手动', expDays: 9999, pos: '第一层', lowAt: 0, addedAt: 30, private: false },
        { id: 'photo', no: 'NO-0052', name: '摄影入门', emoji: '📕', img: '', qty: 1, unit: '本', price: 79, priceSrc: '手动', expDays: 9999, pos: '第一层', lowAt: 0, addedAt: 10, private: false }
      ]
    },
    {
      id: 'pet', name: '宠物食品', icon: 'paw', tone: 'orange', desc: '猫粮 · 罐头 · 冻干', count: 3, items: [
        { id: 'catfood', no: 'NO-0060', name: '猫粮', emoji: '🐾', img: '', qty: 1, unit: '袋', price: 120, priceSrc: '联网参考', expDays: 60, pos: '储物柜上层', lowAt: 1, addedAt: 22, private: false },
        { id: 'can', no: 'NO-0061', name: '猫罐头', emoji: '🥫', img: '', qty: 6, unit: '罐', price: 48, priceSrc: '拍照识别', expDays: 180, pos: '储物柜下层', lowAt: 2, addedAt: 22, private: false },
        { id: 'freeze', no: 'NO-0062', name: '冻干零食', emoji: '🐟', img: '', qty: 1, unit: '袋', price: 35, priceSrc: '手动', expDays: 90, pos: '储物柜下层', lowAt: 1, addedAt: 12, private: false }
      ]
    },
    {
      id: 'appliances', name: '家电', icon: 'plug', tone: 'violet', desc: '含 1 项保修期提醒', count: 4, items: [
        { id: 'airfryer', no: 'NO-0070', name: '空气炸锅', emoji: '🍳', img: '', qty: 1, unit: '台', price: 399, priceSrc: '拍照识别', expDays: 9999, pos: '厨房高架', lowAt: 0, addedAt: 100, private: false, warrantyDays: 23 },
        { id: 'ricecooker', no: 'NO-0071', name: '电饭煲', emoji: '🍚', img: '', qty: 1, unit: '台', price: 299, priceSrc: '手动', expDays: 9999, pos: '厨房台面', lowAt: 0, addedAt: 200, private: false, warrantyDays: 400 },
        { id: 'filter', no: 'NO-0072', name: '净水器滤芯', emoji: '🚰', img: '', qty: 1, unit: '个', price: 89, priceSrc: '手动', expDays: 30, pos: '水槽下', lowAt: 1, addedAt: 2, private: false },
        { id: 'vacuum', no: 'NO-0073', name: '吸尘器', emoji: '🧹', img: '', qty: 1, unit: '台', price: 1299, priceSrc: '拍照识别', expDays: 9999, pos: '阳台柜', lowAt: 0, addedAt: 300, private: false, warrantyDays: 700 }
      ]
    }
  ],

  alerts: [],
  plans: [],
  shopping: [],

  workbench: {
    name: '周末聚餐 · 云工作台',
    expires: '7 天后到期',
    code: 'TZ-4821',
    myDeck: ['fridge', 'wardrobe', 'medicine', 'fitness'],
    seats: [
      { id: 'me', name: '林夏 · 我', color: 'teal', libs: [] },
      {
        id: 'A', name: 'A 家', color: 'amber', libs: [
          { id: 'a1', name: '冰箱', icon: 'fridge', count: 2, items: [{ name: '腊肉', qty: 2, unit: '块', no: 'NO-9001' }, { name: '火腿', qty: 1, unit: '根', no: 'NO-9002' }] },
          { id: 'a2', name: '零食柜', icon: 'package', count: 1, items: [{ name: '坚果', qty: 1, unit: '罐', no: 'NO-9003' }] }
        ]
      },
      {
        id: 'B', name: 'B 家', color: 'violet', libs: [
          { id: 'b1', name: '冰箱', icon: 'fridge', count: 1, items: [{ name: '海鲜丸', qty: 1, unit: '袋', no: 'NO-9004' }] },
          { id: 'b2', name: '茶柜', icon: 'package', count: 1, items: [{ name: '龙井', qty: 1, unit: '罐', no: 'NO-9005' }] }
        ]
      }
    ],
    chat: [
      { sys: true, text: 'A 家 加入了牌桌' },
      { from: 'A 家', text: '今晚一起把冰箱清一清？', time: '19:02' },
      { from: '林夏', text: '好，我这边鸡蛋和番茄要先用掉', time: '19:03' },
      { from: 'B 家', text: '我冰箱还有海鲜丸，做汤刚好', time: '19:03' }
    ],
    members: [
      { name: 'A 家', color: 'teal', count: 12, items: ['鸡蛋 ×8', '番茄 ×4', '大米 2 千克', '五花肉 500 克'] },
      { name: 'B 家', color: 'amber', count: 8, items: ['面粉 1 千克', '洋葱 ×3', '土豆 ×6', '牛奶 2 盒'] }
    ],
    plan: {
      title: '番茄蛋包饭',
      consume: 'A 家鸡蛋 4 个 · A 家大米 300 克 · B 家番茄 2 个',
      note: '执行后按归属自动扣减到各自库存'
    }
  },

  /* P0-5：对话仅本地存储，≤200 条滚动（F5.4/D5） */
  chat: [
    { who: 'me', text: '今晚用现有食材能做什么？', time: '19:02' },
    { who: 'ai', text: '点「生成新方案」，我会按临期优先 > 清库存 > 营养均衡从你的库存排 3 个方案。', time: '19:02' },
    { who: 'me', text: '牛奶还能放几天？', time: '19:03' },
    { who: 'ai', text: '鲜牛奶（巴氏）冷藏约 6 天，开封后 24 小时内喝完（知识库 · 中国营养保健食品协会）。按今天算还有 2 天到期，已在临期提醒里。', time: '19:03' }
  ],

  daily: [],
  intake: { step: 0, results: [] },

  /* ---------- 7 天历史日志（种子）：看板趋势/简报与日志可对账（F7.2） ---------- */
  history7: [
    { d: 6, consume: 3, purchase: 4 }, { d: 5, consume: 5, purchase: 3 }, { d: 4, consume: 4, purchase: 6 },
    { d: 3, consume: 6, purchase: 4 }, { d: 2, consume: 7, purchase: 5 }, { d: 1, consume: 5, purchase: 7 }, { d: 0, consume: 4, purchase: 3 }
  ]
}
