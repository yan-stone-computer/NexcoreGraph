"""去 AI 味的第一遍：只动"软组织"，锁死数字、专名与结构。

依据 去AI味写作/scripts/ai_tell_lint.py 的诊断结果做针对性处理：
  1) 破折号（——）是本文档最大的机器指纹（42 处）：按上下文替换成冒号或逗号，
     解释性成分用冒号，顺承/补充性成分用逗号；不无差别删字。
  2) 词表命中的"底色"换成更常见的"背景色"。
  3) 团队名称占位符替换为真实队名。
不触碰代码块内的内容；不改任何数字、专有名词与表格结构。
"""
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/作品介绍文档.md'

with open(SRC, encoding='utf-8') as f:
    lines = f.read().split('\n')

out = []
in_code = False
stat = {'dash_colon': 0, 'dash_comma': 0, 'dise': 0, 'team': 0, 'code_lines': 0}

for line in lines:
    if line.startswith('```'):
        in_code = not in_code
        out.append(line)
        continue
    if in_code:
        stat['code_lines'] += 1
        out.append(line)
        continue

    # 3) 队名
    if '<待填写>' in line and '团队名称' in line:
        line = line.replace('团队名称**：<待填写>', '团队名称**：天枢序列')
        line = line.replace('| 团队名称 | <待填写> |', '| 团队名称 | 天枢序列 |')
        stat['team'] += 1

    # 1) 破折号：后接指代/顺承 → 逗号；其余解释性 → 冒号
    line, n1 = re.subn(r'——(?=[这它我们你们])', '，', line)
    stat['dash_comma'] += n1
    line, n2 = re.subn(r'——', '：', line)
    stat['dash_colon'] += n2

    # 2) 词表命中
    if '底色' in line:
        line = line.replace('底色', '背景色')
        stat['dise'] += 1

    # 1b) 单破折号残留（U+2014）：不夹在数字之间的一律改成逗号；
    #     数字区间用的是连接号（–），不受影响
    line, n3 = re.subn(r'(?<![0-9A-Za-z])—(?![0-9A-Za-z])', '，', line)
    stat['dash_colon'] += 0
    stat['single'] = stat.get('single', 0) + n3

    out.append(line)

with open(SRC, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(out))

print('破折号→冒号 %d 处，破折号→逗号 %d 处，单破折号→逗号 %d 处，背景色 %d 处，队名替换 %d 处（跳过代码块 %d 行）'
      % (stat['dash_colon'], stat['dash_comma'], stat.get('single', 0), stat['dise'],
         stat['team'], stat['code_lines']))
