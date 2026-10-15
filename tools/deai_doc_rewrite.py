"""按"去 AI 味"整改作品介绍文档：删掉"文档在讲自己"的话，保留事实与数据。

依据：用户反馈"图文不一致、很多句子一看就是 AI 写的（什么待审批之类的）"。
本脚本只做有明确边界的机械整改，改不动的会打印出来，不会静默跳过：

  1. 删掉 5.6「建议补拍清单」整节（提交文档不该列自己还缺什么）；
  2. 删掉 5.4/5.5 里"说明：…如实标注/已剔除"这类过程话术（以 > 开头的说明段）；
  3. 6.2 的占位表格换成一句人话（不再满页 <待填写>）；
  4. 章节标题口语化：动线 → 顺序、"证据索引"去掉括号里的自夸；
  5. 全局替换机器腔词汇：如实/不掩饰/硬证据/支撑证据/口径 等；
  6. 移除 5.3 的证书配图（图片内容我无法自证，"图文不一致"的风险直接掐掉），
     证书以文字说明 + 原件随材料提交。
用法：python tools/deai_doc_rewrite.py [docs/作品介绍文档.md]
"""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'docs/作品介绍文档.md'
with open(path, encoding='utf-8') as f:
    text = f.read()

report = []


def drop_section(name, start_marker, end_pattern):
    """删掉从 start_marker 到下一个匹配 end_pattern 的整段"""
    global text
    i = text.find(start_marker)
    if i < 0:
        report.append('未找到：' + name)
        return
    m = re.search(end_pattern, text[i:])
    if not m:
        report.append('未找到结束标记：' + name)
        return
    text = text[:i] + text[i + m.start():]
    report.append('已删除：' + name)


# 1) 删掉 5.6 待补拍清单（直到"## 附录"或文末）
drop_section('5.6 建议补拍清单', '### 5.6 ', r'\n## ')

# 2) 删掉 5.x 里以 "> 说明：" / "> 抓图方法" 开头的过程说明段
before = text.count('\n> ')
text = re.sub(r'\n> [^\n]*(?:\n> [^\n]*)*', '', text)
report.append('删除过程说明段：%d 处' % (before - text.count('\n> ')))

# 3) 6.2 的占位表格 → 一句话
tbl_start = text.find('| 项 | 是否已有 | 备注 / 证明材料 |')
if tbl_start >= 0:
    tbl_end = text.find('\n\n', tbl_start)
    text = text[:tbl_start] + ('项目目前未申报论文与专利；软件著作权与竞赛获奖情况以实际申报及组委会公示为准。'
                               if tbl_end < 0 else
                               '项目目前未申报论文与专利；软件著作权与竞赛获奖情况以实际申报及组委会公示为准。'
                               + text[tbl_end:])
    report.append('已替换：6.2 占位表格')
else:
    report.append('未找到：6.2 占位表格')

# 4) 标题口语化
for old, new in [
    ('### 8.4 加分点 → 证据索引（评委可直接按点核对）', '### 8.4 每项加分点的证据位置'),
    ('### 8.5 演示时的加分点展示动线（对应"可稳定演示"）', '### 8.5 现场演示顺序'),
    ('### 8.3 形态限制的实测证据（为什么某些能力"没做"）', '### 8.3 元服务形态的能力边界'),
    ('## 八、评审标准对照与加分点（赛道：智慧生活）', '## 八、评审标准对照（赛道：智慧生活）'),
]:
    if old in text:
        text = text.replace(old, new)
        report.append('已改标题：' + new)
    else:
        report.append('未找到标题：' + old)

# 5) 机器腔词汇
for old, new in [
    ('如实标注为', '标注为'),
    ('如实标注', '标注'),
    ('如实列出', '列出'),
    ('如实', ''),
    ('不掩饰', ''),
    ('硬证据（可当场复核）', '现场可核对的证据'),
    ('硬证据', '证据'),
    ('支撑证据', '对应证据'),
    ('演示动线', '演示顺序'),
    ('本文不代为转述', ''),
    ('口径', '算法'),
    # 数字区间用 ~（之前想改但被 PowerShell 引号坑了，这次固定在脚本里）
    ('\u2013', '~'),
    # 状态列换人话：原来满页"待补"像审批件
    ('○ 待补', '○ 未做'),
    ('△ 部分', '△ 部分实现'),
    ('✅ 已实现', '✅ 已做'),
]:
    n = text.count(old)
    if n:
        text = text.replace(old, new)
        report.append('替换 %s -> %s（%d 处）' % (old, new, n))

# 6) 移除 5.3 的证书配图（保留文字说明）
img = '![项目负责人鸿蒙应用开发者认证（原件截图）](./images/cert-harmonyos.png)\n\n'
if img in text:
    text = text.replace(img, '')
    report.append('已移除：5.3 证书配图')
else:
    report.append('未找到：5.3 证书配图')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('\n'.join(report))
