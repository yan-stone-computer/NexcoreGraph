"""按图片真实像素把第五章的图重新归类（修"图文不一致"）。

背景：名带 phone 的 shot-phone-home/ai/library 三张，真实像素是 2880x1920（平板），
而 shot-phone-workbench/mine 是 1320x2848（真手机）。错因是模拟器重启后端口对调，
抓图时把平板当成了手机。本脚本：
  1. 用像素尺寸判定每张图的设备归属，拒绝"按文件名猜"；
  2. 把第五章 5.4 起的图重新排一遍（手机端只放真手机图，平板端放平板图）；
  3. 出现竖屏图混进平板组、或横屏图混进手机组时直接抛错，不静默通过。
用法：python tools/fix_figures_ch5.py [docs/作品介绍文档.md]
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from md2docx import image_px  # noqa: E402  （复用同一份像素解析）

path = sys.argv[1] if len(sys.argv) > 1 else 'docs/作品介绍文档.md'
base = os.path.dirname(os.path.abspath(path))
img_dir = os.path.join(base, 'images')


def is_portrait(name):
    px = image_px(os.path.join(img_dir, name))
    if not px:
        raise SystemExit('读不到像素尺寸：' + name)
    return px[1] > px[0], px


# 先按像素判定设备，两个组各自校验，混入就报错
phone_files = ['shot-phone-workbench.jpeg', 'shot-phone-mine.jpeg']
tablet_files = ['shot-tablet-home.jpeg', 'shot-tablet-ai.jpeg',
                'shot-tablet-library.jpeg', 'shot-tablet-work.jpeg', 'shot-tablet-mine.jpeg']
for f in phone_files:
    portrait, px = is_portrait(f)
    if not portrait:
        raise SystemExit('%s 不是竖屏图（%s），手机端不应引用' % (f, px))
for f in tablet_files:
    portrait, px = is_portrait(f)
    if portrait:
        raise SystemExit('%s 是竖屏图（%s），平板端不应引用' % (f, px))

new_tail = """### 5.4 手机端截图

![手机端工作台 · 协作牌桌](./images/shot-phone-workbench.jpeg)

**图 5-7** 手机端工作台：协作池、手牌位与邀请码，用于家人拼菜与按归属扣减

![手机端我的 · 服务器连接](./images/shot-phone-mine.jpeg)

**图 5-8** 手机端"我的"：服务器连接标注为"局域网自建服务器"，当前地址在此可直接修改

### 5.5 平板端截图

![平板端首页](./images/shot-tablet-home.jpeg)

**图 5-9** 平板端首页：左侧通高导航栏 + 顶部搜索 + 多列内容区

![平板端 AI 助手](./images/shot-tablet-ai.jpeg)

**图 5-10** 平板端 AI 助手：宽屏下改为右侧停靠面板

![平板端资源库](./images/shot-tablet-library.jpeg)

**图 5-11** 平板端资源库：多库卡片，以及柜门、拍照、流转入口

![平板端工作台](./images/shot-tablet-work.jpeg)

**图 5-12** 平板端工作台

![平板端我的 · 设置](./images/shot-tablet-mine.jpeg)

**图 5-13** 平板端"我的"：宽屏下左右分栏的设置页（服务器连接、账号与数据、AI 偏好、外观）

> 平板与手机不是同一套布局：平板用左侧通高导航 + 多列内容，手机用底部标签 + 单列。

"""

text = open(path, encoding='utf-8').read()
start = text.find('### 5.4')
end = text.find('\n## 六、')
if start < 0 or end < 0:
    raise SystemExit('没找到第五章的边界（### 5.4 / ## 六、）')
text = text[:start] + new_tail + text[end + 1:]
open(path, 'w', encoding='utf-8', newline='\n').write(text)
print('第五章已按真实像素重排：手机端 %d 张、平板端 %d 张' % (len(phone_files), len(tablet_files)))
print('同时把三张误标为 phone 的平板图改名为 shot-tablet-*.jpeg（见 git mv）')
