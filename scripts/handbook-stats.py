#!/usr/bin/env python3
"""生成 docs/HANDBOOK/01-规模盘点.md。

为什么要有它：规模数字（行数、最大文件、文档量）是最容易过期的一类事实，
手工维护必然腐烂。这里把采集过程固定下来，发布前跑一次即可。

- 排除：node_modules、target、dist、bundle、gen、.git（构建产物与依赖）
- 版本取 Cargo.toml 的 workspace 版本；提交数与标签取 git，取不到就写「—」
- 本文件整体由脚本覆盖，要写额外内容请放到别的章节

用法：python3 scripts/handbook-stats.py
"""
import datetime
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "HANDBOOK" / "01-规模盘点.md"

EXCLUDE_DIRS = {"node_modules", "target", "dist", "bundle", "gen", ".git", "__pycache__"}
LANGS = [("Rust", ".rs"), ("TypeScript", ".ts"), ("Node 脚本 .mjs", ".mjs"),
         ("CSS", ".css"), ("Python", ".py")]


def files_with(suffix: str) -> list[pathlib.Path]:
    out = []
    for path in ROOT.rglob("*" + suffix):
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        if path.is_file():
            out.append(path)
    return out


def count_lines(paths) -> int:
    total = 0
    for path in paths:
        try:
            with path.open("rb") as fh:
                total += sum(1 for _ in fh)
        except OSError:
            pass
    return total


def rel(path: pathlib.Path) -> str:
    return str(path.relative_to(ROOT))


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                              check=True).stdout.strip()
    except Exception:
        return "—"


def workspace_version() -> str:
    try:
        text = (ROOT / "Cargo.toml").read_text(encoding="utf-8")
        m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.M)
        return m.group(1) if m else "—"
    except OSError:
        return "—"


def table(header: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out)


def main() -> None:
    lang_rows, total_all = [], 0
    lang_counts = {}
    for label, suffix in LANGS:
        paths = files_with(suffix)
        lines = count_lines(paths)
        lang_counts[suffix] = (lines, len(paths))
        total_all += lines
        lang_rows.append([label, f"**{lines:,}**", f"{len(paths)} 个文件"])

    # 分目录
    dirs = ["crates/core", "crates/agent", "crates/preview", "src-tauri/src", "src",
            "tests", "scripts", "agent", "mcp"]
    dir_rows = []
    for d in dirs:
        base = ROOT / d
        if not base.is_dir():
            continue
        paths = [p for p in base.rglob("*")
                 if p.is_file() and p.suffix in {".rs", ".ts", ".mjs", ".css", ".py", ".html"}
                 and not any(part in EXCLUDE_DIRS for part in p.parts)]
        dir_rows.append([f"`{d}/`", f"{count_lines(paths):,}", f"{len(paths)} 个源文件"])

    # 最大的源文件
    src = [p for p in ROOT.rglob("*")
           if p.is_file() and p.suffix in {".rs", ".ts", ".mjs", ".css", ".py"}
           and not any(part in EXCLUDE_DIRS for part in p.parts)]
    top = sorted(((count_lines([p]), p) for p in src), key=lambda x: -x[0])[:12]
    top_rows = [[f"{n:,}", f"`{rel(p)}`"] for n, p in top]

    # 文档
    doc_main = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md", "CODEMAP.md"]
    doc_rows = [[f"`{n}`", f"{count_lines([ROOT / n]):,}"] for n in doc_main if (ROOT / n).is_file()]
    docs_dir = sorted((ROOT / "docs").glob("*.md"))
    doc_rows += [[f"`docs/{p.name}`", f"{count_lines([p]):,}"] for p in docs_dir]
    handbook = sorted(p for p in (ROOT / "docs" / "HANDBOOK").glob("*.md") if p.name != OUT.name)
    releases = sorted((ROOT / ".github" / "releases").glob("*.md"))
    skills_agent = sorted(p for p in (ROOT / "agent" / "skills").glob("*/SKILL.md"))
    skills_repo = sorted(p for p in (ROOT / ".agents" / "skills").glob("*/SKILL.md"))
    codemaps = sorted(p for p in ROOT.rglob("CODEMAP.md")
                      if not any(part in EXCLUDE_DIRS for part in p.parts))

    doc_total = sum(count_lines([ROOT / n]) for n in doc_main if (ROOT / n).is_file())
    doc_total += count_lines(docs_dir) + count_lines(handbook) + count_lines(releases)
    doc_total += count_lines(skills_agent) + count_lines(skills_repo) + count_lines(codemaps)

    version = workspace_version()
    today = datetime.date.today().isoformat()
    commits = git("rev-list", "--count", "HEAD")
    tags = len([t for t in git("tag").splitlines() if t]) or "—"
    first = git("log", "--reverse", "--format=%ad", "--date=short").splitlines()
    last = git("log", "-1", "--format=%ad", "--date=short")

    body = f"""# 规模盘点

> 手册章节 ｜ 最后核对：v{version}（{today}）｜ **本文件由 `python3 scripts/handbook-stats.py` 生成**，不要手改数字；要补充说明请写到别的章节。
> 采集口径：排除 `node_modules / target / dist / bundle / gen / .git`；行数为物理行数。

**一句话**：这是理解「为什么一个番茄钟能有这么多代码」的入口——规模不是界面堆出来的，是规则与边界堆出来的。

## A. 代码规模

{table(["语言", "行数", "文件数"], lang_rows)}
| **合计** | **{total_all:,}** | —— |

## B. 分目录

{table(["目录", "行数", "源文件数"], dir_rows)}

## C. 最大的 12 个源文件

{table(["行数", "文件"], top_rows)}

看这张表能直接得出结论：体积最大的几个文件是**规则中心**与**它们的测试**，不是界面。

## D. 文档与手册

- 主文档（README / AGENTS / CONTRIBUTING / CHANGELOG / CODEMAP 等）：**{sum(count_lines([ROOT / n]) for n in doc_main if (ROOT / n).is_file()):,}** 行
- `docs/` 下的契约与设计文档（含本手册）：**{count_lines(docs_dir) + count_lines(handbook):,}** 行（其中手册 {len(handbook) + 1} 个文件）
- 发布说明：**{len(releases)}** 篇、{count_lines(releases):,} 行
- 随包技能（`agent/skills/`）：**{len(skills_agent)}** 个
- 维护者技能（`.agents/skills/`）：**{len(skills_repo)}** 个
- CODEMAP 地图文件：**{len(codemaps)}** 个

**文档合计约 {doc_total:,} 行。**

## E. 版本与节奏

| 项 | 值 |
| --- | --- |
| 当前版本 | v{version} |
| 提交数 | {commits} |
| 标签数 | {tags} |
| 首个提交 | {first[0] if first else "—"} |
| 最近提交 | {last or "—"} |

## F. 怎么用这些数字

1. **对外讲规模时只引这一页**：数字会变，口径固定在这里，别在别处另算一份。
2. **「3 万行」怎么来的**：代码合计 {total_all:,} 行，其中 Rust 与界面各占一块，测试与规则是主要增量。
3. **被问「是不是过度设计」时**：翻到 C 表——最大的文件和最大的一块是规则与测试，而不是界面代码，这本身就是答案。
4. **发布前跑一次**：`pnpm run handbook:stats`，然后把手册页眉的版本与日期一起更新。
"""

    OUT.write_text(body, encoding="utf-8")
    print(f"已写出 {rel(OUT)}：代码 {total_all:,} 行、文档 {doc_total:,} 行、"
          f"提交 {commits}、标签 {tags}、章节 {len(handbook) + 1} 个")


if __name__ == "__main__":
    main()
