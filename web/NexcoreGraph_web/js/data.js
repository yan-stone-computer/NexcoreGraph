/* 启核图策 · Web 端初始状态（空库）

   **没有演示数据**：登录前所有业务数据为空，登录后从自建后端该家庭的同步快照拉取；
   首次登录的家庭没有快照时，就是真正的空库，由用户拍照入库或新建资源库开始。
   这里只保留与业务无关的界面默认值（主题、偏好、预算、管理员端配置模板）。
   字段对齐完整文档 1.7 数据模型：Item.lowAt（D4）、Store.budget（D6）、Profile（D7）。 */
window.DB = {
  /* 账号与家庭：登录成功后由 /api/auth/login 的结果填充 */
  user: null,
  family: null,
  familyId: "",
  families: [],
  users: [],
  members: {},
  invite: null,

  theme: "light",
  settings: { private: true, chat: true, expiry: true, digest: true, low: true, alertSoon: 7, alertCritical: 3 },

  /* P0-4 家庭偏好档案：仅本地存储，不同步（D7） */
  profile: { people: 3, dislikes: "", goal: "均衡", enabled: true },
  /* D6：Store.budget 月度预算，默认 600 */
  budget: 600,

  logs: [],
  aiUsage: [],
  /* 管理员端系统配置模板（F10.5/F10.6） */
  config: {
    model: "DeepSeek-V3",
    visionModel: "Agnes-Vision",
    webSearch: true,
    searchCacheMin: 10,
    rateLimitPerDay: 200,
    unitPrice: 0.002,
    visionPrice: 0.01,
    identifyThreshold: 0.85,
    pushTemplate: "【启核图策】{{content}}",
    knowledgeVersion: 1
  },

  stats: { mealsLeft: 0, daysLeft: 0, wasted: 0 },

  /* 业务数据：全部为空，等后端快照或用户操作 */
  libraries: [],
  alerts: [],
  plans: [],
  shopping: [],
  workbench: null,
  chat: [],
  daily: [],
  intake: { step: 0, results: [] },
  history7: []
};
