/* Web 端识别链路回归检查（Node 直接跑，不需要浏览器）

   背景：Web 端的 API.recognize 曾经是"本地模拟"——按图片长度从固定池（鸡蛋/牛奶/番茄…）
   里挑几样冒认识别结果，用户根本看不出是不是模型给的。改成真实调用后，用这个脚本守住三条：
     ① 每张图都要调用一次 AGNES.vision，送的是原图 base64（不带 data: 前缀）；
     ② 返回结果按模型输出映射，不再出现固定池里的假物品；
     ③ expDays = 0 表示"不适用"，入库时不能被补成 7 天。

   用法：
     node tools/web_recognition_check.js          # 离线回归（stub 掉 AGNES.vision，验映射与红线）
     node tools/web_recognition_check.js --live   # 打真后端：用 assets/img/fridge.jpg 走 Web 端自己的 agnes.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', 'web', 'NexcoreGraph_web');
const LIVE = process.argv.indexOf('--live') > -1;

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

const calls = [];
const win = {
  localStorage: fakeStorage(),
  KB: { foods: {}, recipes: [], rules: [] },
  KNOWLEDGE: {},
  setTimeout, clearTimeout, Promise, console,
  AGNES: LIVE ? undefined : {
    vision: (opts) => {
      calls.push(opts);
      const items = calls.length === 1
        ? [{ name: '胡萝卜', category: '根茎菜', qty: 4, unit: '根', pos: '冷藏室', expDays: 14, price: 35 }]
        : [{ name: '螺丝刀', category: '手工具', qty: 1, unit: '把', pos: '工具箱', expDays: 0, price: 0 }];
      return Promise.resolve({ items: items, model: 'agnes-2.5-flash', ms: 100, trail: [], via: 'gateway' });
    },
    lastVia: () => 'gateway'
  }
};
if (LIVE) {
  /* 模拟浏览器环境，让 Web 端自己的 js/agnes.js 跑真请求 */
  win.location = { protocol: 'http:', origin: 'http://127.0.0.1:8080', href: 'http://127.0.0.1:8080/index.html' };
  win.fetch = fetch;
  win.AbortController = AbortController;
  win.URL = URL;
  win.TextDecoder = TextDecoder;
  win.navigator = { onLine: true };
}
win.window = win;
const ctx = vm.createContext(win);
const files = LIVE ? ['js/data.js', 'js/knowledge.js', 'js/agnes.js', 'js/mockapi.js']
  : ['js/data.js', 'js/knowledge.js', 'js/mockapi.js'];
files.forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
});

const FAKE_POOL = ['上海青', '五花肉', '酸奶', '黄瓜', '香蕉', '面包', '蘑菇', '鲜牛奶'];

(async () => {
  let thumb = ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'];
  let full = ['data:image/jpeg;base64,FULL_A', 'data:image/jpeg;base64,FULL_B'];
  if (LIVE) {
    const b64 = fs.readFileSync(path.join(WEB, 'assets', 'img', 'fridge.jpg')).toString('base64');
    thumb = ['data:image/jpeg;base64,' + b64];
    full = ['data:image/jpeg;base64,' + b64];
  }
  const t0 = Date.now();
  const results = await ctx.window.API.recognize(thumb, full);
  const wall = Date.now() - t0;

  const fail = [];
  if (LIVE) {
    console.log('真实网关：' + ctx.window.AGNES.status().base + '（' + ctx.window.AGNES.status().mode + '）');
    console.log('耗时：' + wall + 'ms');
    console.log('识别结果：' + results.map((r) => r.name + ' ' + r.qty + r.unit + ' / ' + r.exp + ' / ' + (r.pos || '未设置')).join('；'));
    if (!results.length) fail.push('真后端没有返回任何物品');
    if (!ctx.window.DB.intake.meta || ctx.window.DB.intake.meta.via !== 'gateway') fail.push('没有走自建网关通道');
    if (fail.length) {
      console.error('FAIL：' + fail.join('；'));
      process.exit(1);
    }
    console.log('PASS：Web 端识别真的走了模型（' + ctx.window.DB.intake.meta.model + '）');
    return;
  }
  if (calls.length !== 2) fail.push('每张图应调用一次模型，实际 ' + calls.length + ' 次');
  if (calls[0] && calls[0].imageBase64 !== 'FULL_A') fail.push('送模型的应是原图（FULL_A），实际 ' + (calls[0] || {}).imageBase64);
  if (calls.some((c) => /^data:/.test(c.imageBase64))) fail.push('imageBase64 不应带 data: 前缀');
  if (results.some((r) => FAKE_POOL.includes(r.name))) fail.push('结果里出现了固定池假物品');
  if (results[0] && results[0].exp !== '14 天') fail.push('有保质期的物品应显示 14 天');
  if (results[1] && (results[1].expDays !== 0 || results[1].exp !== '不适用')) fail.push('expDays=0 应映射为"不适用"');

  ctx.window.DB.libraries = [{ id: 'lib-x', name: '工具箱', items: [], count: 0, desc: '0 件' }];
  await ctx.window.API.addItems(results, 'lib-x');
  const saved = ctx.window.DB.libraries[0].items;
  if (saved[1] && saved[1].expDays !== 0) fail.push('入库时 expDays=0 被改成了 ' + saved[1].expDays);

  console.log('vision 调用次数：' + calls.length);
  console.log('结果：' + results.map((r) => r.name + ' ' + r.qty + r.unit + ' / ' + r.exp).join('；'));
  console.log('入库后 expDays：' + saved.map((i) => i.name + '=' + i.expDays).join('；'));
  console.log('识别元信息：' + JSON.stringify(ctx.window.DB.intake.meta && {
    model: ctx.window.DB.intake.meta.model,
    images: ctx.window.DB.intake.meta.images,
    items: ctx.window.DB.intake.meta.items,
    via: ctx.window.DB.intake.meta.via
  }));
  if (fail.length) {
    console.error('FAIL：' + fail.join('；'));
    process.exit(1);
  }
  console.log('PASS：识别走模型、结果来自模型、0 天不误判');
})();
