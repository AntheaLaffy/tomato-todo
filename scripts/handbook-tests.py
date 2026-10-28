#!/usr/bin/env python3
"""生成 docs/HANDBOOK/95-测试索引.md：把「哪一章的事实由哪些测试背书」列出来。

对应 Rust Reference 的 Tests 链接与 Test summary 章节：规则不是靠嘴说的，
有测试的就点出来，没有测试的也明说。

数据来源（都是跑一次就重新采集）：
- Rust：`crates/core/src/*.rs` 里的 `#[test]` 函数名
- 端到端：`tests/*.mjs` 里的 `test("…")` 名
用法：python3 scripts/handbook-tests.py
"""
import datetime
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "HANDBOOK" / "95-测试索引.md"


def workspace_version() -> str:
    try:
        text = (ROOT / "Cargo.toml").read_text(encoding="utf-8")
        m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.M)
        return m.group(1) if m else "—"
    except OSError:
        return "—"

# 章节 → 背书该章事实的测试来源（人工映射，改动测试文件时同步）
CHAPTER_TESTS = {
    "06-安全与隐私边界": ["tests/agent-workspace.mjs","crates/agent/src/state.rs", "tests/agent.mjs"],
    "10-锁与专注保护": ["crates/core/tests/guard_linux.rs", "tests/linux-desktops.mjs", "tests/wayland.mjs", "crates/core/src/guard.rs", "crates/core/tests/guard_x11.rs", "crates/core/tests/guard_windows.rs", "tests/native.mjs", "tests/x11-app.mjs"],
    "11-定时锁机": ["crates/core/src/lock.rs", "tests/integration.mjs", "tests/native.mjs", "tests/x11-app.mjs"],
    "12-课表与提醒": ["crates/core/src/blocks.rs", "crates/core/src/reminders.rs", "tests/integration.mjs"],
    "13-任务与列表": ["crates/core/src/tests.rs", "tests/integration.mjs"],
    "14-模板与印刷": ["crates/core/src/template_tests.rs"],
    "15-任务身份": ["crates/core/src/tests.rs"],
    "16-习惯与愿景": ["crates/core/src/template_tests.rs", "crates/core/src/tests.rs"],
    "17-诊断与统计": ["crates/core/src/diagnostics.rs"],
    "18-助手-权限与唤醒": ["crates/agent/src/tests.rs", "tests/agent.mjs", "tests/agent-workspace.mjs", "tests/agent-runtime.mjs"],
    "19-助手-文件工作区与MCP": ["crates/agent/src/tests.rs", "tests/agent.mjs"],
    "20-数据与格式": ["crates/core/src/tests.rs", "tests/integration.mjs"],
    "21-安装与桌面集成": ["tests/install.mjs", "tests/native.mjs", "tests/android-app.mjs"],
    "22-架构与工程": ["tests/integration.mjs", "tests/native.mjs", "tests/agent.mjs", "tests/agent-runtime.mjs", "tests/x11-app.mjs"],
    "23-手部演示动画": ["tests/agent.mjs", "tests/native.mjs"],
    "24-界面手感与音效": ["tests/audio.mjs", "tests/integration.mjs"],
    "26-工具面与开发流程": ["crates/agent/src/tests.rs", "tests/agent.mjs"],
    "25-前端架构与状态流": ["tests/agent-workspace.mjs", "tests/integration.mjs", "tests/audio.mjs", "tests/android-app.mjs"],
    "27-预览服务": ["tests/integration.mjs"],
    "28-声音的实现": ["tests/audio.mjs"],
    "29-CODEMAP与索引维护": [],
    "30-存储层": ["crates/core/src/tests.rs"],
    "31-概念讲解": ["tests/integration.mjs"],
}


def rust_tests(path: pathlib.Path | str) -> list[str]:
    path = pathlib.Path(path)
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    names = []
    for block in re.split(r"#\[test\]", text)[1:]:
        m = re.search(r"fn\s+([a-z0-9_]+)\s*\(", block)
        if m:
            names.append(m.group(1))
    return names


def js_tests(path: pathlib.Path | str) -> list[str]:
    """node:test 的用例名；同一文件里重复出现的只算一次。"""
    path = pathlib.Path(path)
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    names = re.findall(r'^\s*test\(\s*[\n ]*"([^"]+)"', text, re.M)
    seen, unique = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            unique.append(n)
    return unique


def assert_count(path: pathlib.Path | str) -> int:
    """脚本式验证（不用 node:test）的断言数量，用来给这类文件一个可核对的规模。"""
    path = pathlib.Path(path)
    if not path.is_file():
        return 0
    return len(re.findall(r"assert\.", path.read_text(encoding="utf-8")))


def describe(path: pathlib.Path | str) -> list[str]:
    if path.suffix == ".rs":
        return rust_tests(path)
    return js_tests(path)


def label(path: pathlib.Path | str, names: list[str]) -> str:
    """给「章节 → 测试」表用的一格说明。"""
    path = pathlib.Path(path)
    if names:
        asserts = assert_count(path) if path.suffix == ".mjs" else 0
        suffix = f"，{asserts} 处断言" if asserts else ""
        return f"`{path}`（{len(names)} 个用例{suffix}）"
    asserts = assert_count(path)
    if asserts:
        return f"`{path}`（脚本式验证，{asserts} 处断言）"
    return f"`{path}`（无独立用例，由其他文件覆盖）"


def main() -> None:
    all_files = sorted(
        {p for files in CHAPTER_TESTS.values() for p in files}
    )
    collected = {p: describe(ROOT / p) for p in all_files}

    rows = []
    for chapter, files in CHAPTER_TESTS.items():
        rows.append(f"| [{chapter}]({chapter}.md) | "
                    + "、".join(label(f, collected[f]) for f in files) + " |")

    detail = []
    for f in all_files:
        names = collected[f]
        if names:
            detail.append(f"\n### `{f}`（{len(names)} 个用例）\n")
            detail += [f"- `{n}`" for n in names]
        else:
            asserts = assert_count(f)
            if asserts:
                detail.append(f"\n### `{f}`（脚本式验证，{asserts} 处断言）\n")
                detail.append("- 不使用 node:test：按步骤驱动真实桌面/服务，失败即中断；逐条断言散在流程里。")

    total = sum(len(v) for v in collected.values())
    body = f"""# 测试索引

> 手册章节 ｜ 最后核对：v{workspace_version()}（{datetime.date.today().isoformat()}）｜ **由 `python3 scripts/handbook-tests.py` 生成**，不要手改。
> 对应 Rust Reference 的做法：规则旁边给出背书它的测试；没有测试的地方由各章的 `F. 待补与更新点` 记着。

**一句话**：这本手册里凡是写「不可逆」「原子」「不会重现」这类硬断言的地方，基本都能在这里找到对应测试。

## 章节 → 测试

| 章节 | 相关测试 |
| --- | --- |
{chr(10).join(rows)}

采集到的数据：**{total}** 个 node:test / Rust 用例，另有脚本式验证（断言数见表与清单）。

## 用例清单
{chr(10).join(detail)}

## 维护

- 新增或改名测试后重跑 `pnpm run handbook:tests`；章节与测试的对应关系写在脚本顶部的 `CHAPTER_TESTS` 里。
- 这里只列「某章由哪些测试背书」；某条具体事实有没有测试，由那一章 A 表里的 `[T]` 标记决定。
"""
    # 顺手把「验证：」行写回各章页眉下方（由本脚本生成，改测试就跟着变）
    for chapter, files in CHAPTER_TESTS.items():
        path = ROOT / "docs" / "HANDBOOK" / f"{chapter}.md"
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        parts = []
        for f in files:
            names = collected[f]
            if names:
                asserts = assert_count(f) if f.endswith(".mjs") else 0
                extra = f"，{asserts} 处断言" if asserts else ""
                parts.append(f"`{f}` {len(names)} 个用例{extra}")
            else:
                asserts = assert_count(f)
                parts.append(f"`{f}` 脚本式 {asserts} 处断言" if asserts else f"`{f}`（无独立用例）")
        if not files:
            line = "> 验证：本章没有自动化测试背书（索引/流程类资产，靠维护者核对，见 F 段）。"
        else:
            line = "> 验证：" + " · ".join(parts) + "（明细见 [95-测试索引](95-测试索引.md)）"
        lines = text.splitlines()
        # 只在正文开始（第一个 ## 标题）之前找页眉，避免把正文里的引用行一起搬上来
        cut = next((i for i, l in enumerate(lines) if l.startswith("## ")), len(lines))
        top_lines, body_lines = lines[:cut], lines[cut:]
        header = [l for l in top_lines if l.startswith("> ") and not l.startswith("> 验证：")]
        header.append(line)
        KEEP = ("> 手册章节", "> 事实一律", "> 验证：", "> 导航：")
        body_lines = [l for l in body_lines
                      if not (l.startswith("> ") and l.startswith(KEEP) and l not in header)]
        out_lines = [lines[0], ""] + header
        rest = list(body_lines)
        while rest and not rest[0].strip():
            rest.pop(0)
        out_lines += [""] + rest
        path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    OUT.write_text(body, encoding="utf-8")
    print(f"已写出 {OUT.relative_to(ROOT)}：{len(CHAPTER_TESTS)} 章，采集 {total} 个用例，"
          f"并把「验证：」行写回各章页眉")


if __name__ == "__main__":
    main()
