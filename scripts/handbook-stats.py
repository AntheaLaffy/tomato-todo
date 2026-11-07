#!/usr/bin/env python3
"""生成 docs/HANDBOOK/01-规模盘点.md。

为什么要有它：规模数字（行数、最大文件、文档量）是最容易过期的一类事实，
手工维护必然腐烂。这里把采集过程固定下来，发布前跑一次即可。

- 排除：node_modules、target、dist、bundle、gen、.git、artifacts（构建产物、依赖与本地资料），
  以及 `.agents/worktrees/`——那里是并行代理的仓库副本，算进来等于把同一份代码数两遍。
- 生成物单独排除（见 GENERATED）：`plugin/client.js` 是 esbuild 打包产物，
  `runtime/vendor/core.mjs` 由 `scripts/build-runtime.mjs` 从 packages/core 生成；
  把它们算作源码会让「改了业务代码规模就涨」这个口径失真。
- 版本取 package.json（重构后唯一版本源）；提交数与标签取 git，取不到就写「—」
- 本文件整体由脚本覆盖，要写额外内容请放到别的章节

用法：python3 scripts/handbook-stats.py
"""
import datetime
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "HANDBOOK" / "01-规模盘点.md"

EXCLUDE_DIRS = {"node_modules", "target", "dist", "bundle", "gen", ".git", "artifacts", "__pycache__"}
EXCLUDE_PARTS = {(".agents", "worktrees")}
GENERATED = {"plugin/client.js", "runtime/vendor/core.mjs"}
LANGS = [("Rust（原生守卫）", ".rs"), ("TypeScript（领域核心 + runtime）", ".ts"),
         ("Node 脚本 .mjs", ".mjs"), ("前端 .js（DSH 插件）", ".js"),
         ("Python（工具与手册脚本）", ".py")]


def is_source(path: pathlib.Path) -> bool:
    """源码判定：排掉构建产物、依赖、本地资料与并行代理的仓库副本。

    判断只看**相对仓库根**的路径——仓库自己可能就住在 `.agents/worktrees/` 下，
    用绝对路径会把整棵树都排除掉。
    """
    parts = path.relative_to(ROOT).parts
    if any(part in EXCLUDE_DIRS for part in parts):
        return False
    for pair in EXCLUDE_PARTS:
        if any(parts[i:i + 2] == pair for i in range(len(parts) - 1)):
            return False
    return rel(path) not in GENERATED


def files_with(suffix: str) -> list[pathlib.Path]:
    return sorted(p for p in ROOT.rglob("*" + suffix) if p.is_file() and is_source(p))


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
    """重构后唯一版本源是根 package.json（旧版读 Cargo.toml 的 workspace 版本）。"""
    try:
        return json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    except (OSError, KeyError, json.JSONDecodeError):
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
    dirs = ["packages/core", "runtime", "plugin/src/client", "crates/guard",
            "scripts", "packaging", "desktop-integrations"]
    dir_rows = []
    for d in dirs:
        base = ROOT / d
        if not base.is_dir():
            continue
        paths = [p for p in base.rglob("*")
                 if p.is_file() and p.suffix in {".rs", ".ts", ".mjs", ".js", ".py"}
                 and is_source(p)]
        dir_rows.append([f"`{d}/`", f"{count_lines(paths):,}", f"{len(paths)} 个源文件"])

    # 最大的源文件
    src = [p for p in ROOT.rglob("*")
           if p.is_file() and p.suffix in {".rs", ".ts", ".mjs", ".js", ".py"} and is_source(p)]
    top = sorted(((count_lines([p]), p) for p in src), key=lambda x: -x[0])[:12]
    top_rows = [[f"{n:,}", f"`{rel(p)}`"] for n, p in top]

    # 文档
    doc_main = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md", "CODEMAP.md"]
    doc_rows = [[f"`{n}`", f"{count_lines([ROOT / n]):,}"] for n in doc_main if (ROOT / n).is_file()]
    docs_dir = sorted((ROOT / "docs").glob("*.md"))
    doc_rows += [[f"`docs/{p.name}`", f"{count_lines([p]):,}"] for p in docs_dir]
    handbook = sorted(p for p in (ROOT / "docs" / "HANDBOOK").glob("*.md") if p.name != OUT.name)
    releases = sorted((ROOT / ".github" / "releases").glob("*.md"))
    skills_repo = sorted(p for p in (ROOT / ".agents" / "skills").glob("*/SKILL.md"))
    codemaps = sorted(p for p in ROOT.rglob("CODEMAP.md") if is_source(p))

    doc_total = sum(count_lines([ROOT / n]) for n in doc_main if (ROOT / n).is_file())
    doc_total += count_lines(docs_dir) + count_lines(handbook) + count_lines(releases)
    doc_total += count_lines(skills_repo) + count_lines(codemaps)

    version = workspace_version()
    today = datetime.date.today().isoformat()
    commits = git("rev-list", "--count", "HEAD")
    tags = len([t for t in git("tag").splitlines() if t]) or "—"
    first = git("log", "--reverse", "--format=%ad", "--date=short").splitlines()
    last = git("log", "-1", "--format=%ad", "--date=short")

    body = f"""# 规模盘点

> 手册章节 ｜ 最后核对：v{version}（{today}）｜ **本文件由 `python3 scripts/handbook-stats.py` 生成**，不要手改数字；要补充说明请写到别的章节。
> 采集口径：排除 `node_modules / target / dist / bundle / gen / .git / artifacts`、`.agents/worktrees/`（并行代理的仓库副本）与生成物 `plugin/client.js`、`runtime/vendor/core.mjs`；行数为物理行数。

**一句话**：这是理解「为什么一个番茄钟能有这么多代码」的入口——规模不是界面堆出来的，是规则与边界堆出来的。重构后领域核心在 `packages/core/`，进程与协议在 `runtime/`，界面只剩 DSH 插件那一层。

## A. 代码规模

{table(["语言", "行数", "文件数"], lang_rows)}
| **合计** | **{total_all:,}** | —— |

## B. 分目录

{table(["目录", "行数", "源文件数"], dir_rows)}

## C. 最大的 12 个源文件

{table(["行数", "文件"], top_rows)}

看这张表能得出两条：规则中心（`education` 与 `lib`）确实是最大的两块；但几个**大页面**（教育、专注、任务、日历）也各有一两千行——每页的交互与状态都塞在同一个文件里，这是重构后仍然存在的债，不该当成「界面很简单」的证据。

## D. 文档与手册

- 主文档（README / AGENTS / CONTRIBUTING / CHANGELOG / CODEMAP 等）：**{sum(count_lines([ROOT / n]) for n in doc_main if (ROOT / n).is_file()):,}** 行
- `docs/` 下的契约与设计文档（含本手册）：**{count_lines(docs_dir) + count_lines(handbook):,}** 行（其中手册 {len(handbook) + 1} 个文件）
- 发布说明：**{len(releases)}** 篇、{count_lines(releases):,} 行
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
2. **代码合计怎么来的**：{total_all:,} 行里，DSH 插件（前端 .js）与领域核心各占四成上下，原生守卫是唯一还在用 Rust 的部分。
3. **被问「是不是过度设计」时**：翻到 C 表——最大的文件是领域规则与几个大页面，不是脚手架；规模来自规则与逐页交互，不是来自依赖。
4. **发布前跑一次**：`python3 scripts/handbook-stats.py`，然后把手册页眉的版本与日期一起更新。
"""

    OUT.write_text(body, encoding="utf-8")
    print(f"已写出 {rel(OUT)}：代码 {total_all:,} 行、文档 {doc_total:,} 行、"
          f"提交 {commits}、标签 {tags}、章节 {len(handbook) + 1} 个")


if __name__ == "__main__":
    main()
