/* 把 uitest dumpLayout 的 JSON 读成可读清单：类型 / 文本 / 绝对边界 / 中心点 / 是否可点。
   用法：node tools/dump_ui.js <layout.json> [最小y] [最大y]
   早先写过的版本随临时目录被清掉了，这个放到仓库里长期可用（抓图与排查都用它）。 */
const fs = require('fs');

const file = process.argv[2];
const yMin = Number(process.argv[3] || 0);
const yMax = Number(process.argv[4] || 99999);
if (!file) {
  console.log('用法: node tools/dump_ui.js <layout.json> [yMin] [yMax]');
  process.exit(1);
}

const root = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = [];

function walk(node) {
  if (!node || typeof node !== 'object') return;
  const a = node.attributes || {};
  const bounds = a.bounds || '';
  const m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(bounds);
  if (m) {
    const x1 = Number(m[1]);
    const y1 = Number(m[2]);
    const x2 = Number(m[3]);
    const y2 = Number(m[4]);
    if (y2 >= yMin && y1 <= yMax) {
      const type = String(a.type || '').replace(/^.*\./, '');
      const text = String(a.text || '').trim();
      rows.push({
        type,
        text,
        clickable: String(a.clickable) === 'true',
        bounds: `${x1},${y1} - ${x2},${y2}`,
        center: `${Math.round((x1 + x2) / 2)},${Math.round((y1 + y2) / 2)}`,
        w: x2 - x1,
        h: y2 - y1
      });
    }
  }
  (node.children || []).forEach(walk);
}

walk(root);
rows
  .sort((a, b) => (Number(a.bounds.split(',')[1]) - Number(b.bounds.split(',')[1])))
  .forEach((r) => {
    console.log(
      `${r.type.padEnd(20)} ${(r.text || '(无文本)').slice(0, 24).padEnd(26)} ` +
      `bounds=${r.bounds.padEnd(24)} center=${r.center.padEnd(12)} ` +
      `size=${r.w}x${r.h}${r.clickable ? '  [可点]' : ''}`
    );
  });
console.log(`--- 命中 ${rows.length} 个节点（y ${yMin}~${yMax}）---`);
