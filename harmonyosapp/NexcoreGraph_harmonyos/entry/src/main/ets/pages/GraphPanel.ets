/* 启核图策 · 库存知识图谱面板（补充方案 G4 / 第 3.7 节可视化）
   分层布局（库 → 物品 → 概念），Canvas 绘制；点节点后从 GraphQuery 取"路径证据"并可问 AI。
   数据全部来自端侧图谱（GraphStore/GraphQuery），不调用模型。 */

import { store } from '../common/Store';
import { T, R_L } from '../common/Tokens';
import { TBtn, Card, CardHead, Chip, NumText } from '../components/Widgets';
import { GraphDoc, GraphNode, GraphCommunity, RagEvidence } from '../common/GraphModel';
import { graphDoc } from '../common/GraphStore';
import { currentGraphSize, currentGraphVersion, ragEvidence } from '../common/GraphQuery';
import { rebuildGraph } from '../common/GraphBuild';
import { GraphBuildStat } from '../common/GraphModel';
import { runBusy } from '../common/Api';
import { numOf } from '../common/GraphModel';

/** 画布节点（布局结果） */
class GNode {
  id: string = '';
  label: string = '';
  kind: string = 'item';       // lib | item | food
  x: number = 0;
  y: number = 0;
  r: number = 9;
  expiring: boolean = false;
}

const CANVAS_W: number = 330;
const CANVAS_H: number = 430;

@ComponentV2
export struct GraphPanel {
  private ctx: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  @Local ready: boolean = false;
  @Local nodes: GNode[] = [];
  @Local edges: string[] = [];          // "fromId->toId"
  @Local onlyExpiring: boolean = false;
  @Local sizeText: string = '';
  @Local verText: string = '';
  @Local selTitle: string = '';
  @Local selKind: string = '';
  @Local selFacts: string[] = [];
  @Local selSrc: string = '';
  @Local note: string = '';
  @Local selId: string = '';

  aboutToAppear(): void {
    this.sizeText = currentGraphSize();      // 触发按需构图
    this.verText = currentGraphVersion();
    this.buildLayout();
  }

  /** 分层布局：库（第 1 带）→ 物品（第 2 带）→ 概念（第 3 带） */
  private buildLayout(): void {
    const doc: GraphDoc | null = graphDoc();
    const nodes: GNode[] = [];
    const edges: string[] = [];
    if (doc !== null) {
      const libs: GraphCommunity[] = [];
      doc.communities.forEach((c: GraphCommunity) => {
        if (c.level === 1 && libs.length < 4) {
          libs.push(c);
        }
      });
      const n: number = Math.max(1, libs.length);
      libs.forEach((lib: GraphCommunity, i: number) => {
        const lx: number = CANVAS_W * (i + 1) / (n + 1);
        const libNode = new GNode();
        libNode.id = lib.id;
        libNode.label = lib.label;
        libNode.kind = 'lib';
        libNode.x = lx;
        libNode.y = 30;
        libNode.r = 13;
        nodes.push(libNode);

        // 该库下的物品（默认最多 5 个，仅临期模式只留临期）
        const items: GraphNode[] = [];
        doc.nodes.forEach((nd: GraphNode) => {
          if (nd.type !== 'ItemInstance') {
            return;
          }
          if (nd.community.indexOf(lib.id) < 0) {
            return;
          }
          const days = numOf(nd.props, 'expDays', 0);
          if (this.onlyExpiring && !(days > 0 && days <= 7)) {
            return;
          }
          if (items.length < 5) {
            items.push(nd);
          }
        });
        items.forEach((it: GraphNode, j: number) => {
          const itemNode = new GNode();
          itemNode.id = it.id;
          itemNode.label = it.label;
          itemNode.kind = 'item';
          itemNode.x = lx;
          itemNode.y = 100 + j * 34;
          itemNode.r = 10;
          const days = numOf(it.props, 'expDays', 0);
          itemNode.expiring = days > 0 && days <= 7;
          nodes.push(itemNode);
          edges.push(`${lib.id}->${it.id}`);

          // 概念节点（instantiates）落到第 3 带
          doc.edges.forEach((e) => {
            if (e.type === 'instantiates' && e.from === it.id) {
              const food = doc.nodes.find((x: GraphNode): boolean => x.id === e.to);
              if (food !== undefined) {
                if (nodes.find((x: GNode): boolean => x.id === food.id) === undefined && nodes.length < 24) {
                  const fNode = new GNode();
                  fNode.id = food.id;
                  fNode.label = food.label;
                  fNode.kind = 'food';
                  fNode.x = 40 + (nodes.length % 3) * 110;
                  fNode.y = 350 + Math.floor(nodes.length / 3) * 30;
                  fNode.r = 8;
                  nodes.push(fNode);
                }
                edges.push(`${it.id}->${food.id}`);
              }
            }
          });
        });
      });
    }
    this.nodes = nodes;
    this.edges = edges;
    this.draw();
  }

  private nodeById(id: string): GNode | null {
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].id === id) {
        return this.nodes[i];
      }
    }
    return null;
  }

  private draw(): void {
    if (!this.ready) {
      return;
    }
    const c = this.ctx;
    c.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // 带区标题
    c.font = '10px sans-serif';
    c.fillStyle = T.c('text-muted');
    c.fillText('库', 6, 16);
    c.fillText('物品', 6, 86);
    c.fillText('概念（食材）', 6, 336);

    // 边
    this.edges.forEach((e: string) => {
      const parts = e.split('->');
      const a = this.nodeById(parts[0]);
      const b = this.nodeById(parts[1]);
      if (a === null || b === null) {
        return;
      }
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.strokeStyle = T.c('border');
      c.lineWidth = 1;
      c.stroke();
    });

    // 节点
    this.nodes.forEach((n: GNode) => {
      const selected = n.id === this.selId;
      let fill = T.c('primary');
      if (n.kind === 'lib') {
        fill = T.c('accent');
      } else if (n.kind === 'food') {
        fill = T.c('tone-lime');
      } else if (n.expiring) {
        fill = T.c('warning');
      }
      c.beginPath();
      c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      if (selected) {
        c.beginPath();
        c.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
        c.strokeStyle = T.c('primary');
        c.lineWidth = 2;
        c.stroke();
      }
      c.font = '10px sans-serif';
      c.fillStyle = T.c('text-secondary');
      c.fillText(n.label.length > 5 ? n.label.substring(0, 5) : n.label, n.x - 16, n.y + n.r + 12);
    });
  }

  /** 点选：取最近的节点，展示路径证据 */
  private pick(px: number, py: number): void {
    let best: GNode | null = null;
    let bestD: number = 32 * 32;
    this.nodes.forEach((n: GNode) => {
      const dx = n.x - px;
      const dy = n.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    });
    if (best === null) {
      return;
    }
    const hit = best as GNode;
    this.selId = hit.id;
    this.selTitle = hit.label;
    this.selKind = hit.kind === 'lib' ? '库' : hit.kind === 'food' ? '概念（食材）' : '物品实例';
    const ev: RagEvidence = ragEvidence('local', hit.label);
    this.selFacts = ev.lines.slice(0, 3);
    this.selSrc = ev.paths.length > 0 ? ev.paths[0].src : '';
    this.draw();
  }

  private rebuild(): void {
    runBusy('graph:rebuild', (): Promise<void> => new Promise<void>((resolve: () => void) => {
      const stat: GraphBuildStat = rebuildGraph();
      this.note = `${stat.nodes} 节点 / ${stat.edges} 边 / ${stat.communities} 社区｜${stat.ms} ms`;
      this.sizeText = currentGraphSize();
      this.verText = currentGraphVersion();
      this.buildLayout();
      resolve();
    }), (): void => {
      store.toast('图谱已重建');
    });
  }

  build() {
    Column({ space: 10 }) {
      Row({ space: 10 }) {
        Column({ space: 3 }) {
          Text('库存知识图谱').fontSize(20).fontWeight(800).fontColor(T.c('text-primary'))
          Text(`${this.sizeText}｜${this.verText}`).fontSize(12).fontColor(T.c('text-muted'))
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        TBtn({ label: '重建', icon: 'refresh', kind: 'ghost', small: true, busyKey: 'graph:rebuild',
          tap: (): void => this.rebuild() })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Row({ space: 8 }) {
        Chip({ text: '全部', active: !this.onlyExpiring, tap: (): void => {
          this.onlyExpiring = false;
          this.buildLayout();
        } })
        Chip({ text: '仅临期', active: this.onlyExpiring, tap: (): void => {
          this.onlyExpiring = true;
          this.buildLayout();
        } })
        Text('点节点看证据路径').fontSize(11).fontColor(T.c('text-muted'))
      }
      .width('100%')

      Canvas(this.ctx)
        .width(CANVAS_W)
        .height(CANVAS_H)
        .backgroundColor(T.c('surface-raised'))
        .borderRadius(R_L)
        .onReady((): void => {
          this.ready = true;
          this.draw();
        })
        .onTouch((e: TouchEvent): void => {
          if (e.touches.length > 0) {
            this.pick(e.touches[0].x, e.touches[0].y);
          }
        })

      if (this.note !== '') {
        Text(this.note).fontSize(12).fontColor(T.c('text-secondary'))
      }

      Card() {
        Column({ space: 8 }) {
          CardHead({
            title: this.selTitle === '' ? '未选择节点' : this.selTitle,
            sub: this.selTitle === '' ? '在上方图谱中点一个节点' : `${this.selKind} · 路径证据（代码查询）`,
            badgeText: '可解释', badgeTone: 'teal', badgeIcon: 'check'
          })
          if (this.selFacts.length > 0) {
            ForEach(this.selFacts, (f: string, i: number) => {
              Row({ space: 8 }) {
                NumText({ value: String(i + 1), dim: 12, weight: FontWeight.Bold, color: T.c('primary') })
                Text(f).fontSize(12).fontColor(T.c('text-secondary')).layoutWeight(1)
              }
              .width('100%')
            }, (f: string, i: number) => `fact-${i}`)
          }
          if (this.selSrc !== '') {
            Text(this.selSrc).fontSize(11).fontColor(T.c('text-muted'))
          }
          Row({ space: 10 }) {
            TBtn({ label: '问 AI 关于它', icon: 'sparkles', kind: 'primary', small: true, tap: (): void => {
              if (this.selTitle !== '') {
                store.aiPrefill = `「${this.selTitle}」现在该怎么处理？`;
                store.overlay = '';
                store.aiOpen = true;
              }
            } })
            Text('图谱只在本机构建，不上云').fontSize(11).fontColor(T.c('text-muted'))
          }
        }
        .alignItems(HorizontalAlign.Start)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
