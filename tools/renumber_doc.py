# -*- coding: utf-8 -*-
"""作品介绍文档编号整理（一次性脚本，改完保留在此备查）。

改版过程中攒下四类编排问题，靠手工改容易漏：
1. 章节顺序错乱：三章（创新点）物理上排在二章（鸿蒙与 AI 能力说明）前面；
2. 附录 A 的子节用了 8.1-8.5，与正文第八章 8.1-8.5 撞号；
3. 各节内部条目统一叫 "(1)(2)(3)"，在 Word 大纲里看起来像重复的小节；
4. 交叉引用写的是旧编号（如 2.1(4) 跨端同步、3.1(1) 视觉识别），改版后这些编号已不存在。

本脚本按"先排序、再编号、最后修引用"的顺序处理，并把目录按最终标题生成。
用法：python tools/renumber_doc.py docs/作品介绍文档.md
"""
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/作品介绍文档.md'

CN_ORDER = ['一', '二', '三', '四', '五', '六', '七', '八']

# 旧引用 -> 新编号（改版后正确的位置）。键是原文里的写法。
REF_PAIRS = [
    ('（详见 2.1 亮点二与 4.2）', '（详见 2.3.3 与 4.3.1）'),
    ('见 2.1(1)。多跳模式', '见 2.3.1。多跳模式'),
    ('2.1(4) / 4.2(4)', '1.5.8 · 4.3.4'),
    ('3.1(1)', '2.3.1'),
    ('2.1(1) / 4.2(1)', '2.3.3 · 4.3.1'),
    ('1.2(1)(3) / 3.1', '1.5.1 · 1.5.3'),
    ('3.1(4)', '2.3.4'),
    ('4.2(2)', '4.3.2'),
    ('4.5 / 2.1(6)', '4.5 · 3.5.6'),
    ('3.2 / 4.3', '2.4.1 · 4.2'),
    ('三章 3.1(5)', '三章 3.5.3'),
    ('三章 3.1', '三章 3.5'),
    ('见 8.4 报错证据', '见 A.3 的报错证据'),
    ('1.5(1)(2)(5)', '1.5.1 · 1.5.2 · 1.5.5'),
    ('4.3(5)', '4.3.5'),
    ('2.3(6) / 1.5(4) / 5.10', '2.3.6 · 1.5.4 · 5.10'),
]


def chapter_key(line):
    """返回 ('ch', 序号) / ('app', 字母) / None"""
    m = re.match(r'^## ([一二三四五六七八])、', line)
    if m:
        return ('ch', CN_ORDER.index(m.group(1)))
    m = re.match(r'^## 附录 ([A-Z])', line)
    if m:
        return ('app', m.group(1))
    return None


def split_blocks(lines):
    """按 '## ' 切块：前导元信息 + 每章一块"""
    blocks = []
    cur = []
    for ln in lines:
        if ln.startswith('## '):
            if cur:
                blocks.append(cur)
            cur = [ln]
        else:
            cur.append(ln)
    if cur:
        blocks.append(cur)
    return blocks


def sort_key(key):
    """正文按章序在前，附录按字母在后"""
    if key[0] == 'ch':
        return (0, key[1])
    return (1, ord(key[1]) - ord('A'))


def main():
    with open(SRC, encoding='utf-8') as f:
        lines = f.read().split('\n')

    # 1) 章节排序：正文按 一..八，附录排在最后（A 在 B 前）
    blocks = split_blocks(lines)
    head = [b for b in blocks if chapter_key(b[0]) is None]
    body = [b for b in blocks if chapter_key(b[0]) is not None]
    body.sort(key=lambda b: sort_key(chapter_key(b[0])))
    out_lines = []
    for b in head + body:
        out_lines.extend(b)
    lines = out_lines

    # 2) 条目编号：#### (n) 标题 -> #### X.Y.Z 标题（每个 ### 节内从 1 起）
    sec = ''
    n = 0
    for i, ln in enumerate(lines):
        m = re.match(r'^### ([0-9]+\.[0-9]+) ', ln)
        if m:
            sec = m.group(1)
            n = 0
            continue
        m = re.match(r'^#### \((\d+)\) (.+)$', ln)
        if m and sec:
            n += 1
            lines[i] = '#### %s.%d %s' % (sec, n, m.group(2))

    # 3) 附录 A 的子节：### 8.x -> ### A.x
    in_app_a = False
    for i, ln in enumerate(lines):
        if ln.startswith('## 附录 A'):
            in_app_a = True
            continue
        if ln.startswith('## '):
            in_app_a = False
        if in_app_a:
            m = re.match(r'^### 8\.(\d+) (.*)$', ln)
            if m:
                lines[i] = '### A.%s %s' % (m.group(1), m.group(2))

    text = '\n'.join(lines)

    # 4) 交叉引用修正
    for old, new in REF_PAIRS:
        text = text.replace(old, new)

    # 5) 顺手清掉的重复字
    text = text.replace('△ 部分实现实现', '△ 部分实现')

    # 6) 头部版本与日期
    text = text.replace('**版本号**：V1.0.0', '**版本号**：V1.1.0')
    text = text.replace('**编制日期**：2026 年 10 月 15 日', '**编制日期**：2026 年 10 月 16 日')

    # 7) 目录：只列章与附录（二级条目太多会把目录撑到三四页），插在元信息之后。
    #    重复执行时先摘掉旧目录，保证幂等。
    lines = text.split('\n')
    out = []
    skip = False
    for ln in lines:
        if ln.startswith('## 目录'):
            skip = True
            continue
        if skip:
            if ln.startswith('## ') or ln.strip() == '---':
                skip = False
            else:
                continue
        out.append(ln)
    lines = out

    toc = ['## 目录', '']
    for ln in lines:
        if ln.startswith('## ') and not ln.startswith('## 目录'):
            toc.append('- ' + ln[3:].strip())
    toc.append('')

    # 插在元信息块（第一个 '---'）之后，其余内容原样保留
    idx = -1
    for i, ln in enumerate(lines):
        if ln.strip() == '---':
            idx = i
            break
    if idx < 0:
        raise SystemExit('没找到元信息分隔线，目录没有插入')
    text = '\n'.join(lines[:idx + 1]) + '\n\n' + '\n'.join(toc) + '\n' + '\n'.join(lines[idx + 1:])

    with open(SRC, 'w', encoding='utf-8') as f:
        f.write(text)

    # 8) 复检：还有没有漏改的旧式引用
    left = re.findall(r'\d\.\d\(\d\)', text)
    print('已整理：%s' % os.path.abspath(SRC))
    print('剩余旧式引用：%s' % ('无' if not left else '、'.join(sorted(set(left)))))
    heads = [l[3:].strip() for l in text.split('\n')
             if l.startswith('## ') and not l.startswith('## 目录')]
    print('章节顺序：%s' % '、'.join(heads))


if __name__ == '__main__':
    main()
