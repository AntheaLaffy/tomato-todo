#!/usr/bin/env python3
"""把各章的 `F. 待补与更新点` 汇总成 docs/HANDBOOK/90-待补清单.md。

单一事实来源在各章：要改清单就改章节，然后重跑本脚本，避免两处各说一套。
分类：已补（- [x]）/ 纯代码可挖（不启动应用就能查）/ 需要跑起来（录屏、实测、出图）。
"""
import re
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from handbook_chapters import CHAPTER_RE  # noqa: E402

HAND = pathlib.Path(__file__).resolve().parent.parent / "docs" / "HANDBOOK"
OUT = HAND / "90-待补清单.md"
RUN_HINT = ("录屏", "实测", "截图", "时延", "对比图", "封面", "画面", "抓一张",
            "抓一段", "跑", "界面文案", "演示", "实拍")


def collect():
    groups = {"done": [], "code": [], "run": []}
    for p in sorted(HAND.glob("*.md")):
        if not CHAPTER_RE.match(p.name):
            continue
        text = p.read_text(encoding="utf-8")
        m = re.search(r"^## F\. 待补(?:与更新点)?\s*$(.*)$", text, re.S | re.M)
        if not m:
            continue
        for line in m.group(1).splitlines():
            line = line.strip()
            if not line.startswith("- ["):
                continue
            item = re.sub(r"^- \[[ x]\]\s*", "", line)
            key = "done" if line.startswith("- [x]") else ("run" if any(h in item for h in RUN_HINT) else "code")
            groups[key].append((p.name, item))
    return groups


def table(title, rows, hint):
    out = [f"## {title}\n", f"{hint}\n", "| 章节 | 待补 |", "| --- | --- |"]
    out += [f"| `{n}` | {i} |" for n, i in rows]
    out.append("")
    return out


def main():
    g = collect()
    total = sum(len(v) for v in g.values())
    out = [
        "# 待补清单\n",
        "> 由 `python3 scripts/handbook-backlog.py` 从各章 `F. 待补与更新点` 汇总生成 —— 改章节、再重跑，不要手改本文件。\n",
        f"> 当前：共 **{total}** 条（已补 {len(g['done'])} / 纯代码可挖 {len(g['code'])} / 需要跑起来 {len(g['run'])}）。\n",
    ]
    out += table("✅ 已补", g["done"], "已经落到章节正文里（事实 + 出处）。")
    out += table("🔴 纯代码可挖", g["code"], "在仓库里就能查到答案，不需要启动应用。")
    out += table("🟡 需要跑起来 / 录屏", g["run"], "要实机行为或产出画面素材。")
    out += [
        "## 更新约定（比待补更硬）\n",
        "1. **改代码就改手册**：改了本章涉及的实现，先改章节的 A 表与 B 段，再动其他文档。",
        "2. **页眉跟着版本走**：核对完一章，把「最后核对」改成当前版本与日期。",
        "3. **两条自查都要过**：`python3 scripts/check-handbook.py`，成片文案另跑 `artifacts/publish/check-copy.py`。",
        "4. **措辞可对外**：C 段里不出现仓库黑话，也不出现任何私人任务或私人系统的字样。",
        "",
    ]
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"已写出 {OUT.relative_to(HAND.parent.parent)}：共 {total} 条"
          f"（已补 {len(g['done'])} / 纯代码 {len(g['code'])} / 需跑起来 {len(g['run'])}）")


if __name__ == "__main__":
    main()
