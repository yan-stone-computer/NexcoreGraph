#!/usr/bin/env python3
"""启核图策 · 鸿蒙端提交前静态检查（整改文档 M-13 工程化与合规）。

检查项（任一 FAIL 即退出码 1）：
  1. 端侧与后端源码中不存在模型厂商密钥明文（D6 / M-7，验收 X7）
  2. 知识库 rawfile 已随包（M-8）
  3. 服务卡片配置完整且支持多端尺寸（M-5）
  4. 模块声明：设备类型含 2in1、权限带 reason/usedScene（D1）
  5. 合规交付物齐全：README / LICENSE / docs/privacy.md（M-13）
  6. AI 生成内容标识存在（M-13）
  7. AI 网关四端点 + Key 只取环境变量（M-7）
  8. 图谱模块齐备（G1 端侧内核 + 后端服务）
  9. 图谱四端点与五张表就绪
 10. 端侧构图 0 次模型调用（红线 3）
 11. 图谱默认不进同步 payload（隐私分级）
 12. 高阶能力模块齐备（数字孪生 / 安全策略 / 证据清洗 / 扫码）
 13. GuardrailBench 30 条硬门槛无违规
 14. Agent 写操作已接入策略与幂等守卫
 15. 元服务不调用平台明确拒绝的 Notification 发布接口

用法：python tools/check_release.py [--root .]
"""

import argparse
import json
import os
import re
import sys

# Windows 控制台默认代码页会打乱中文输出，这里强制 UTF-8
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PASS = 'PASS'
FAIL = 'FAIL'
results = []


def check(name, ok, detail=''):
    results.append((name, PASS if ok else FAIL, detail))
    return ok


def read(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def find_sources(root, subdirs):
    """收集源码文件（跳过依赖与构建产物）"""
    skip = ('node_modules', 'oh_modules', 'build', '.hvigor', '.preview', 'dist', '.idea')
    out = []
    for sub in subdirs:
        base = os.path.join(root, sub)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for fn in filenames:
                if fn.endswith(('.ets', '.ts', '.js', '.json', '.json5')):
                    out.append(os.path.join(dirpath, fn))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.', help='工程根目录（含 entry/ 与 backend/）')
    args = ap.parse_args()
    root = os.path.abspath(args.root)

    # 1 密钥明文
    key_pat = re.compile(r'sk-[A-Za-z0-9_\-]{16,}')
    hits = []
    for path in find_sources(root, ['entry/src', 'backend', 'AppScope']):
        if os.path.basename(path) == 'package-lock.json':
            continue
        for m in key_pat.finditer(read(path)):
            hits.append('%s: %s...' % (os.path.relpath(path, root), m.group(0)[:12]))
    check('端侧/后端无模型密钥明文（D6/M-7）', not hits,
          '; '.join(hits) if hits else '未发现 sk- 明文')

    # 2 知识库 rawfile
    kb_dir = os.path.join(root, 'entry/src/main/resources/rawfile/knowledge')
    kb_files = ['foods.json', 'recipes.json', 'storage-rules.json']
    missing = [f for f in kb_files if not os.path.isfile(os.path.join(kb_dir, f))]
    check('知识库 rawfile 随包（M-8）', not missing,
          ('缺少 %s' % missing) if missing else ('%s 下 %d 个数据文件' % ('rawfile/knowledge', len(kb_files))))

    # 3 服务卡片
    form_cfg = os.path.join(root, 'entry/src/main/resources/base/profile/form_config.json')
    try:
        forms = json.loads(read(form_cfg)).get('forms', [])
        names = [f.get('name') for f in forms]
        multi = [f.get('name') for f in forms
                 if any(x in ('2*4', '4*4') for x in f.get('supportDimensions', []))]
        sched = [f for f in forms if f.get('scheduledUpdateTime')]
        ok = len(forms) >= 3 and len(multi) >= 2 and len(sched) >= 1
        detail = '%d 张卡片 %s；大尺寸 %s；定时刷新 %d 张' % (len(forms), names, multi, len(sched))
    except Exception as e:
        ok, detail = False, '解析失败：%s' % e
    check('服务卡片多端尺寸与定时刷新（M-5）', ok, detail)

    # 4 模块声明
    try:
        mod = json.loads(re.sub(r'//.*', '', read(os.path.join(root, 'entry/src/main/module.json5'))))
        module = mod['module']
        dev = module.get('deviceTypes', [])
        perms = module.get('requestPermissions', [])
        bad = [p['name'] for p in perms
               if p['name'] != 'ohos.permission.INTERNET'
               and not (p.get('reason') and p.get('usedScene'))]
        ok = '2in1' in dev and not bad
        detail = 'deviceTypes=%s；权限 %d 项；缺 reason/usedScene=%s' % (dev, len(perms), bad)
    except Exception as e:
        ok, detail = False, '解析失败：%s' % e
    check('设备类型含 2in1 且权限合规（D1）', ok, detail)

    # 5 合规交付物
    need = ['README.md', 'LICENSE', os.path.join('docs', 'privacy.md')]
    missing = [f for f in need if not os.path.isfile(os.path.join(root, f))]
    check('工程化与合规交付物（M-13）', not missing,
          ('缺少 %s' % missing) if missing else 'README / LICENSE / docs/privacy.md 均在')

    # 6 AI 生成标识
    marker = [os.path.relpath(p, root) for p in find_sources(root, ['entry/src'])
              if 'AI 生成' in read(p)]
    check('AI 生成内容标识（M-13）', len(marker) >= 1,
          '命中 %d 个文件：%s' % (len(marker), marker[:3]))

    # 7 AI 网关契约
    server = read(os.path.join(root, 'backend', 'server.js'))
    eps = ['/api/ai/chat', '/api/ai/vision', '/api/ai/tts', '/api/ai/usage']
    miss_ep = [e for e in eps if e not in server]
    env_key = 'process.env.AGNES_API_KEY' in server
    check('AI 网关四端点 + Key 取环境变量（M-7）', (not miss_ep) and env_key,
          ('缺端点 %s' % miss_ep) if miss_ep else ('Key 来源：环境变量' if env_key else 'Key 未从环境变量读取'))

    # 8 图谱模块齐备（补充方案 G1/G2）
    graph_ets = ['GraphModel.ets', 'GraphStore.ets', 'GraphBuild.ets', 'GraphQuery.ets']
    graph_js = ['graphBuild.js', 'graphService.js', 'graphQuery.js']
    miss_ets = [f for f in graph_ets
                if not os.path.isfile(os.path.join(root, 'entry/src/main/ets/common', f))]
    miss_js = [f for f in graph_js if not os.path.isfile(os.path.join(root, 'backend', f))]
    check('图谱模块齐备（G1 端侧内核 + 后端服务）', (not miss_ets) and (not miss_js),
          '缺端侧 %s / 后端 %s' % (miss_ets, miss_js) if (miss_ets or miss_js) else
          '端侧 4 个 + 后端 3 个模块均在')

    # 9 图谱端点与建表
    geps = ['/api/graph/rebuild', '/api/graph/query', '/api/graph/summaries', '/api/admin/graph/stats']
    miss_gep = [e for e in geps if e not in server]
    gtables = ['graph_nodes', 'graph_edges', 'graph_communities', 'graph_summaries', 'graph_versions']
    miss_gt = [t for t in gtables if ('CREATE TABLE IF NOT EXISTS ' + t) not in server]
    check('图谱端点与五表就绪', (not miss_gep) and (not miss_gt),
          '缺端点 %s / 缺表 %s' % (miss_gep, miss_gt) if (miss_gep or miss_gt) else
          '4 个端点 + 5 张表齐备')

    # 10 构图不调用模型（红线 3：建图 0 次模型）
    build_src = read(os.path.join(root, 'entry/src/main/ets/common/GraphBuild.ets'))
    no_net = ('callJson' not in build_src) and ('createHttp' not in build_src) and ('fetch(' not in build_src)
    check('端侧构图 0 次模型调用（红线 3）', no_net,
          '构图模块无网络/模型调用' if no_net else '构图模块出现网络调用，需确认是否引入模型调用')

    # 11 图谱不入同步 payload（隐私分级 P1'/P2）
    sync_src = read(os.path.join(root, 'entry/src/main/ets/common/SyncApi.ets'))
    leaked = [k for k in ('graphDoc', 'nodes', 'edges', 'summaries', 'GraphBuild', 'GraphQuery')
              if k in sync_src]
    check('图谱默认不进同步 payload（隐私分级）', not leaked,
          '同步模块未引用图谱数据' if not leaked else '同步模块疑似引用图谱字段：%s' % leaked)

    # 12 高阶能力模块
    advanced = [
        ('entry/src/main/ets/common/ResourceTwin.ets', '数字孪生'),
        ('entry/src/main/ets/pages/TwinPanel.ets', '孪生沙盘'),
        ('entry/src/main/ets/common/PolicyEngine.ets', 'Agent 策略'),
        ('entry/src/main/ets/common/ReplyText.ets', '正文清洗'),
        ('entry/src/main/ets/common/BarcodeIntake.ets', '扫码合并'),
    ]
    miss_advanced = ['%s(%s)' % (name, path) for path, name in advanced
                     if not os.path.isfile(os.path.join(root, path))]
    check('高阶能力模块齐备', not miss_advanced,
          '缺少 %s' % miss_advanced if miss_advanced else '数字孪生 / 策略 / 清洗 / 扫码模块均在')

    # 13 GuardrailBench
    eval_result_path = os.path.join(root, 'evals', 'result.json')
    try:
        ev = json.loads(read(eval_result_path))
        ok = ev.get('total', 0) >= 30 and ev.get('hardFailViolations', 1) == 0
        detail = '%s/%s 通过，硬门槛违规 %s' % (
            ev.get('passed', 0), ev.get('total', 0), ev.get('hardFailViolations', 'missing'))
    except Exception as e:
        ok, detail = False, '评测结果不可用：%s' % e
    check('GuardrailBench 30 条硬门槛', ok, detail)

    # 14 Agent 写操作接入守卫
    guarded_files = ['entry/src/main/ets/pages/AiPanel.ets',
                     'entry/src/main/ets/pages/AiWorkbench.ets']
    guard_hits = []
    for rel in guarded_files:
        src = read(os.path.join(root, rel))
        if 'checkPolicy' in src and 'claimActionOnce' in src:
            guard_hits.append(os.path.basename(rel))
    check('Agent 写操作接入策略与幂等守卫', len(guard_hits) == len(guarded_files),
          '已接入：%s' % guard_hits if guard_hits else '未找到策略接入')

    # 15 元服务不支持的系统通知不得误接入
    main_sources = find_sources(root, ['entry/src/main/ets'])
    unsupported = [os.path.relpath(p, root) for p in main_sources
                   if ('notificationManager.publish' in read(p)
                       or 'requestEnableNotification' in read(p))]
    check('元服务不调用未支持的系统通知接口', not unsupported,
          '未发现 notificationManager 发布调用' if not unsupported else '发现：%s' % unsupported[:3])

    width = max(len(r[0]) for r in results) + 2
    print('启核图策 · 鸿蒙端提交前检查')
    print('-' * (width + 34))
    failed = 0
    for name, status, detail in results:
        if status == FAIL:
            failed += 1
        print('%s %s %s' % ('OK  ' if status == PASS else 'FAIL', name.ljust(width), detail))
    print('-' * (width + 34))
    print('合计 %d 项，失败 %d 项' % (len(results), failed))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
