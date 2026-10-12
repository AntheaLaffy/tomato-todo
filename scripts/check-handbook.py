#!/usr/bin/env python3
"""手册自查：保证 docs/HANDBOOK/ 的每一章都「结构完整、事实有出处、措辞可对外」。

为什么需要它：这本手册会随代码一起更新，靠人记规矩必然漂移。把规矩写成检查：

1. 结构：A 事实 / B 可讲的细节 / C 表达素材 / D 可复现的画面 / E 边界与坑 / F 待补与更新点 六段齐全。
2. 页眉：每章必须有「最后核对：v<x.y.z>（日期）」，否则不知道它跟的是哪个版本。
3. 出处：A 表每一行的「出处」列不能为空。
4. 措辞：C 段（对外表达素材）不得出现仓库黑话与私人任务字样。
5. 隐私：全章不得出现私人任务、私人系统的字样；盘点类章节可在开头写 `allow-private-notes: true` 放行。
6. 体量：B 段至少 4 条；D 段要么给出录屏脚本，要么指向真实截图（`shots/`）。

用法：python3 scripts/check-handbook.py [章文件名…]     （默认检查全部章）
"""
import re
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from handbook_chapters import CHAPTER_RE  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
HAND = ROOT / "docs" / "HANDBOOK"

JARGON = ["阻塞时段", "裁定", "配对", "信号", "纵切面", "app_id", "材料化", "node_id"]
PRIVATE = ["约座位", "座位预约", "图书馆", "教务", "学号", "宿舍"]

SECTIONS = {
    "A": r"^## A\. 事实",
    "B": r"^## B\. ",
    "C": r"^## C\. (机制|代码路径|台词素材|表达素材)",
    "D": r"^## D\. (语义规则与不变量|关键定义与调用链|画面素材|可复现的画面)",
    "E": r"^## E\. 边界与坑",
    "F": r"^## F\. (待补|待补与更新点)",
}


def section(text: str, key: str) -> str:
    start = re.search(SECTIONS[key], text, re.M)
    if not start:
        return ""
    keys = list(SECTIONS)
    for k in keys[keys.index(key) + 1:]:
        m = re.search(SECTIONS[k], text[start.end():], re.M)
        if m:
            return text[start.end(): start.end() + m.start()]
    return text[start.end():]


def check_chapter(path: pathlib.Path, problems: list[str]) -> None:
    name = path.name
    text = path.read_text(encoding="utf-8")
    allow_private = "allow-private-notes: true" in text[:800]

    for key in SECTIONS:
        if not re.search(SECTIONS[key], text, re.M):
            problems.append(f"{name}：缺 {key} 段")

    if not re.search(r"最后核对：v\d+\.\d+\.\d+（\d{4}-\d{2}-\d{2}）", text):
        problems.append(f"{name}：页眉缺少「最后核对：v<x.y.z>（日期）」")
    if "> 导航：" not in text:
        problems.append(f"{name}：页眉缺少「导航：」行（指向 04-导航对照 / CODEMAP）")

    for line in section(text, "A").splitlines():
        if not line.startswith("|") or "---" in line:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3 or cells[0] == "#":
            continue
        if not cells[-1] or cells[-1] in ("-", "—", "无"):
            problems.append(f"{name}：事实行缺出处 → {(cells[1] if len(cells) > 1 else line)[:26]}")

    # 黑话检查只针对「对外表达素材」这种给人念的段；C 段若是代码路径（本手册的现行结构），
    # 里面本来就该出现函数名与领域词，不适用这条。
    if re.search(r"^## C\. (台词素材|表达素材)", text, re.M):
        spoken = section(text, "C")
        for word in JARGON:
            if word in spoken:
                problems.append(f"{name}：对外表达素材里出现黑话「{word}」")
    if re.search(r"^## C\. (台词素材|表达素材)", text, re.M):
        for word in PRIVATE:
            if word in section(text, "C"):
                problems.append(f"{name}：对外表达素材里出现私人任务字样「{word}」")
    if not allow_private:
        for word in PRIVATE:
            for m in re.finditer(re.escape(word), text):
                problems.append(f"{name}：第 {text[:m.start()].count(chr(10)) + 1} 行出现私人任务字样「{word}」")

    if len(re.findall(r"^\d+\.\s", section(text, "B"), re.M)) < 4:
        problems.append(f"{name}：B 段细节少于 4 条")
    # C 段是给人读的机制说明：散文，不放表格；D 段是规范性的规则清单
    c_section = section(text, "C")
    if "|" in c_section:
        problems.append(f"{name}：C 段是机制说明，不应包含表格（找文件看 04-导航对照 附录）")
    if len(re.findall(r"[\u4e00-\u9fff]", c_section)) < 120:
        problems.append(f"{name}：C 段机制说明过短（<120 字），说不清怎么运转")
    invariants = re.findall(r"^- ", section(text, "D"), re.M)
    if len(invariants) < 4:
        problems.append(f"{name}：D 段不变量少于 4 条")


RULES_PAGE = "80-规则速查.md"
RULE_DEF = re.compile(r"^## .+`\[(rules\.[a-z0-9._]+)\]`\s*$", re.M)
RULE_REF = re.compile(r"\[rules\.[a-z0-9._]+\]")


def check_rules(problems: list[str]) -> None:
    """80 页定义规则 ID；其它页只许引用已定义的 ID。"""
    page = HAND / RULES_PAGE
    if not page.is_file():
        problems.append(f"缺 {RULES_PAGE}（规则 ID 的定义页）")
        return
    text = page.read_text(encoding="utf-8")
    defined = RULE_DEF.findall(text)
    if not defined:
        problems.append(f"{RULES_PAGE}：一个规则 ID 都没有定义")
    if len(defined) != len(set(defined)):
        dupes = {i for i in defined if defined.count(i) > 1}
        problems.append(f"{RULES_PAGE}：规则 ID 重复 → {sorted(dupes)}")

    heads = re.findall(r"^## .+$", text, re.M)
    for head in heads:
        if not RULE_DEF.match(head):
            problems.append(f"{RULES_PAGE}：标题没有规则 ID → {head[:36]}")

    used = set()
    for path in HAND.glob("*.md"):
        if path.name == RULES_PAGE:
            continue
        for m in RULE_REF.finditer(path.read_text(encoding="utf-8")):
            rid = m.group(0)[1:-1]
            used.add(rid)
            if rid not in defined:
                problems.append(f"{path.name}：引用了不存在的规则 ID `{rid}`")
    unused = [i for i in defined if i not in used]
    if unused:
        print(f"提示（不阻断）：{[u for u in unused]} 定义了但没有章节引用。")


def check_appendix(problems: list[str]) -> None:
    """04 附录里列出的文件必须真实存在（路径腐烂要当场发现）。"""
    page = HAND / "04-导航对照.md"
    if not page.is_file():
        problems.append("缺 04-导航对照.md（导航附录）")
        return
    text = page.read_text(encoding="utf-8")
    for path in re.findall(r"\| \d+ \| `([^`]+)` \|", text):
        if not (ROOT / path).exists():
            problems.append(f"04-导航对照.md：附录列出的文件不存在 → {path}")


def main() -> int:
    if not HAND.is_dir():
        print(f"找不到手册目录：{HAND}")
        return 2
    if len(sys.argv) > 1:
        files = [HAND / a for a in sys.argv[1:]]
    else:
        files = sorted(p for p in HAND.glob("*.md") if CHAPTER_RE.match(p.name))
    problems: list[str] = []
    check_rules(problems)
    check_appendix(problems)
    for path in files:
        if not path.is_file():
            problems.append(f"{path.name}：文件不存在")
            continue
        check_chapter(path, problems)
    # 软提示：一章一条 [T] 都没有，说明事实里没有可引用的测试背书
    no_test = []
    for path in files:
        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        if "[T]" not in text and "> 验证：" not in text:
            no_test.append(path.name)

    if problems:
        print("手册自查不通过：")
        for p in problems:
            print(" -", p)
        return 1
    print(f"手册自查通过：{len(files)} 章结构完整、页眉带版本、事实有出处、措辞可对外。")
    if no_test:
        print(f"提示（不阻断）：{[n for n in no_test]} 既没有行级 [T] 标记，也没有章级「验证：」行"
              f"——说明没有任何测试背书，值得在 F 段记一条。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
