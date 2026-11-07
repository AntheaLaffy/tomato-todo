#!/usr/bin/env python3
"""生成 docs/HANDBOOK/95-测试索引.md：把「哪个行为由哪条测试背书」列出来。

对应 Rust Reference 的 Tests 链接与 Test summary 章节：规则不是靠嘴说的，
有测试的就点出来，没有测试的也明说。

数据来源（每次运行都重新采集，不手填数字）：
- vitest：`packages/core/test/*.test.ts` 的 `it("…")` / `test("…")`
- node:test：`runtime/test/*` 与 `scripts/*.test.mjs` 的 `test("…")`
- Rust：`crates/guard/src/*.rs` 的 `#[test]` 函数名

为什么按「域」而不是只按章组织：一份 `core.test.ts` 同时给任务、锁机、提醒与
诊断背书，按章切会把同一个文件拆成多行、数字重复计算；按文件归域才能让
「谁跑什么」一眼对上。章节 → 测试另有一张表，因为各章页眉的「验证：」行由
`CHAPTER_TESTS` 生成，读者从章跳到本页时需要按章找。

用法：
    python3 scripts/handbook-tests.py                # 生成索引，并回写各章「验证：」行
    python3 scripts/handbook-tests.py --index-only   # 只生成 95，不动其它章文件
"""
import datetime
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "HANDBOOK" / "95-测试索引.md"

# 只在某个平台编译的模块：计数时按运行脚本的机器过滤，否则会把 macOS / Windows
# 的用例算进 Linux 的数字（`cargo test` 根本看不到它们）。
PLATFORM_OF = {
    "x11.rs": "linux",
    "wayland.rs": "linux",
    "wayland_surface.rs": "linux",
    "shell.rs": "linux",
    "macos.rs": "darwin",
    "win32.rs": "win32",
}

# 域 → （测试文件，运行命令）。一个文件只归一个域，数字才不会重复。
DOMAINS = [
    ("核心模型、锁与提醒", ["packages/core/test/core.test.ts"], "`pnpm core:test`"),
    ("教育/教学", ["packages/core/test/education.test.ts"], "`pnpm core:test`"),
    ("模板与印刷", ["packages/core/test/templates.test.ts"], "`pnpm core:test`"),
    ("引擎与存储", ["packages/core/test/engine-store.test.ts"], "`pnpm core:test`"),
    (
        "运行时 API/MCP",
        [
            "runtime/test/api-state.test.mjs",
            "runtime/test/connection.test.mjs",
            "runtime/test/engine.test.mjs",
            "runtime/test/http.test.mjs",
            "runtime/test/library.test.mjs",
            "runtime/test/library-index.test.mjs",
            "runtime/test/mcp-stdio.test.mjs",
        ],
        "`cd runtime && node --test`",
    ),
    (
        "guard 与守护进程",
        [
            "crates/guard/src",
            "runtime/test/guard-client.mjs",
            "runtime/test/guard-client.test.mjs",
            "runtime/test/supervise.test.mjs",
        ],
        "`cd crates/guard && cargo test`、`cd runtime && node --test`",
    ),
    (
        "客户端冒烟",
        [
            "scripts/attention.test.mjs",
            "scripts/modal-ssr.test.mjs",
            "scripts/navigation-filter.test.mjs",
            "scripts/persona-switch.test.mjs",
            "scripts/refresh-navigation.test.mjs",
        ],
        "`pnpm test:tools`",
    ),
    (
        "脚本工具",
        [
            "scripts/export-sqlite.test.mjs",
            "scripts/import-backup.test.mjs",
            "scripts/install.test.mjs",
            "scripts/plugin-host.test.mjs",
        ],
        "`pnpm test:tools`",
    ),
]

# 章节 → 背书该章事实的测试来源（人工映射，改动测试文件时同步）。
# 已删除的章（18/19 助手、23 手部演示、26 工具面、27 预览服务、31 概念讲解）不在此表。
CHAPTER_TESTS = {
    "06-安全与隐私边界": [
        "runtime/test/http.test.mjs",
        "runtime/test/api-state.test.mjs",
        "runtime/test/library.test.mjs",
        "runtime/test/library-index.test.mjs",
    ],
    "10-锁与专注保护": [
        "crates/guard/src",
        "runtime/test/guard-client.mjs",
        "runtime/test/guard-client.test.mjs",
        "runtime/test/supervise.test.mjs",
    ],
    "11-定时锁机": ["packages/core/test/core.test.ts"],
    "12-课表与提醒": ["packages/core/test/core.test.ts"],
    "13-任务与列表": [
        "packages/core/test/core.test.ts",
        "runtime/test/engine.test.mjs",
    ],
    "14-模板与印刷": ["packages/core/test/templates.test.ts"],
    "15-任务身份": ["packages/core/test/core.test.ts"],
    "16-习惯与愿景": [
        "packages/core/test/templates.test.ts",
        "packages/core/test/core.test.ts",
    ],
    "17-诊断与统计": [
        "packages/core/test/core.test.ts",
        "runtime/test/engine.test.mjs",
    ],
    "20-数据与格式": [
        "packages/core/test/core.test.ts",
        "packages/core/test/engine-store.test.ts",
        "scripts/import-backup.test.mjs",
        "scripts/export-sqlite.test.mjs",
    ],
    "21-安装与桌面集成": ["scripts/install.test.mjs"],
    "22-架构与工程": [
        "runtime/test/connection.test.mjs",
        "runtime/test/engine.test.mjs",
        "runtime/test/http.test.mjs",
        "scripts/plugin-host.test.mjs",
        "packages/core/test/engine-store.test.ts",
        "runtime/test/supervise.test.mjs",
    ],
    "24-界面手感与音效": [
        "scripts/attention.test.mjs",
        "scripts/modal-ssr.test.mjs",
        "scripts/navigation-filter.test.mjs",
        "scripts/persona-switch.test.mjs",
    ],
    "25-前端架构与状态流": [
        "scripts/navigation-filter.test.mjs",
        "scripts/persona-switch.test.mjs",
        "scripts/modal-ssr.test.mjs",
        "runtime/test/api-state.test.mjs",
    ],
    # 重构后前端与 audio 测试随旧 src/ 一起删除，声音章暂无自动化背书。
    "28-声音的实现": [],
    "29-CODEMAP与索引维护": [],
    "30-存储层": [
        "packages/core/test/engine-store.test.ts",
        "scripts/export-sqlite.test.mjs",
        "scripts/import-backup.test.mjs",
        "runtime/test/engine.test.mjs",
    ],
}


def workspace_version() -> str:
    """版本只从 package.json 取，避免两处版本号漂移。"""
    try:
        text = (ROOT / "package.json").read_text(encoding="utf-8")
        m = re.search(r'^  "version":\s*"([^"]+)"', text, re.M)
        return m.group(1) if m else "—"
    except OSError:
        return "—"


def compiles_here(name: str) -> bool:
    wanted = PLATFORM_OF.get(name)
    return wanted is None or wanted == sys.platform


def expand(entry: str) -> list[str]:
    """目录展开成文件；平台专属模块按当前机器过滤。"""
    path = ROOT / entry
    if not path.is_dir():
        return [entry]
    return [
        str(p.relative_to(ROOT))
        for p in sorted(path.iterdir())
        if p.suffix in (".rs", ".ts", ".mjs") and compiles_here(p.name)
    ]


TEST_NAME = re.compile(
    r"""^\s*(?:it|test)\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)""", re.M
)


def test_names(path: str) -> list[str]:
    """一个文件里的用例名；同名的只算一次（参数化用例会重复）。"""
    p = ROOT / path
    if not p.is_file():
        return []
    text = p.read_text(encoding="utf-8")
    if p.suffix == ".rs":
        found = []
        for block in re.split(r"#\[test\]", text)[1:]:
            m = re.search(r"fn\s+([a-z0-9_]+)\s*\(", block)
            if m:
                found.append(m.group(1))
        return found
    found = [a or b or c for a, b, c in TEST_NAME.findall(text)]
    unique: list[str] = []
    for name in found:
        if name not in unique:
            unique.append(name)
    return unique


def assert_count(path: str) -> int:
    """断言数量：只能当规模参考，不是覆盖率。"""
    p = ROOT / path
    if not p.is_file():
        return 0
    text = p.read_text(encoding="utf-8")
    if p.suffix == ".ts":
        return len(re.findall(r"expect\(", text))
    if p.suffix == ".mjs":
        return len(re.findall(r"assert\.", text))
    return len(re.findall(r"assert!|assert_eq!|assert_ne!", text))


def measure(entry: str) -> tuple[int, int, list[str]]:
    files = expand(entry)
    names: list[str] = []
    asserts = 0
    for file in files:
        names.extend(test_names(file))
        asserts += assert_count(file)
    return len(names), asserts, files


def with_tests(files: list[str]) -> int:
    return sum(1 for file in files if test_names(file))


def label(entry: str) -> str:
    """表格里的一格：文件、用例与断言。"""
    count, asserts, files = measure(entry)
    if len(files) > 1:
        return (
            f"`{entry}`（{with_tests(files)} 个文件含用例，{count} 个用例，"
            f"{asserts} 处断言）"
        )
    if count:
        return f"`{entry}`（{count} 个用例，{asserts} 处断言）"
    return f"`{entry}`（无独立用例）"


def domain_rows() -> tuple[list[str], int, int]:
    rows = []
    total_tests = 0
    total_asserts = 0
    seen: dict[str, str] = {}
    for domain, entries, command in DOMAINS:
        for entry in entries:
            count, asserts, files = measure(entry)
            if not count:
                raise SystemExit(f"域「{domain}」的 {entry} 没有采集到用例，检查路径或命名")
            for file in files:
                if file in seen:
                    raise SystemExit(f"{file} 同时归在「{seen[file]}」与「{domain}」，数字会重复")
                seen[file] = domain
            shown = f"`{entry}`" + (
                f"（{with_tests(files)} 个文件含用例）" if len(files) > 1 else ""
            )
            rows.append(
                f"| {domain} | {shown} | {count} | {asserts} | {command} |"
            )
            total_tests += count
            total_asserts += asserts
    return rows, total_tests, total_asserts


def chapter_rows() -> list[str]:
    rows = []
    for chapter, entries in CHAPTER_TESTS.items():
        if not (ROOT / "docs" / "HANDBOOK" / f"{chapter}.md").is_file():
            continue
        if not entries:
            cell = "无自动化测试背书（见本章 F 段）"
        else:
            cell = "、".join(label(entry) for entry in entries)
        rows.append(f"| [{chapter}]({chapter}.md) | {cell} |")
    return rows


def detail_sections() -> list[str]:
    """用例清单：按文件展开，维护时能从行为直接定位到用例名。"""
    entries: list[str] = []
    for _, files, _ in DOMAINS:
        for entry in files:
            for file in expand(entry):
                if file not in entries:
                    entries.append(file)
    out: list[str] = []
    for file in sorted(entries):
        names = test_names(file)
        if not names:
            continue
        asserts = assert_count(file)
        suffix = f"，{asserts} 处断言" if asserts else ""
        out.append(f"\n### `{file}`（{len(names)} 个用例{suffix}）\n")
        out += [f"- `{name}`" for name in names]
    return out


def header_for(entries: list[str]) -> str:
    if not entries:
        return "> 验证：本章没有自动化测试背书（索引/流程类资产，靠维护者核对，见 F 段）。"
    parts = []
    for entry in entries:
        count, asserts, files = measure(entry)
        if not count:
            continue
        same = (
            "（{n} 个文件含用例）".format(n=with_tests(files)) if len(files) > 1 else ""
        )
        parts.append(f"`{entry}`{same} {count} 个用例，{asserts} 处断言")
    if not parts:
        return "> 验证：本章没有自动化测试背书（索引/流程类资产，靠维护者核对，见 F 段）。"
    return "> 验证：" + " · ".join(parts) + "（明细见 [95-测试索引](95-测试索引.md)）"


def main() -> int:
    index_only = "--index-only" in sys.argv[1:]
    version = workspace_version()
    today = datetime.date.today().isoformat()
    rows, total, asserts = domain_rows()

    # 按命令分组的总数，方便对照四个测试入口的实际输出。
    groups = {"core": 0, "runtime": 0, "tools": 0, "guard": 0}
    seen: set[str] = set()
    for _, entries, _ in DOMAINS:
        for entry in entries:
            for file in expand(entry):
                if file in seen:
                    continue
                seen.add(file)
                if file.startswith("packages/core/"):
                    groups["core"] += len(test_names(file))
                elif file.startswith("runtime/"):
                    groups["runtime"] += len(test_names(file))
                elif file.startswith("scripts/"):
                    groups["tools"] += len(test_names(file))
                elif file.startswith("crates/guard/"):
                    groups["guard"] += len(test_names(file))
    group_total = sum(groups.values())
    if group_total != total:
        raise SystemExit(f"域合计 {total} 与按目录合计 {group_total} 不一致")

    detail = detail_sections()
    body = f"""# 测试索引

> 手册章节 ｜ 最后核对：v{version}（{today}）｜ **由 `python3 scripts/handbook-tests.py` 生成**，不要手改。
> 导航：章节、文件与阅读顺序见 [04-导航对照](04-导航对照.md)；测试分层与命令见 [22-架构与工程](22-架构与工程.md)。
> 验证：本页数字由脚本从测试文件现场采集，与 `pnpm core:test`、`cd runtime && node --test`、`pnpm test:tools`、`cd crates/guard && cargo test` 的实际输出一致。

**一句话**：这本手册里凡是写「不可逆」「原子」「不会重现」这类硬断言的地方，基本都能在这里找到对应测试；找不到的，由各章 `F. 待补与更新点` 明说。

## A. 事实（哪个行为由哪条测试背书）

> 测试文件就是出处：下表的「测试文件」列都是可直接打开的路径，「运行方式」列是复现数字的命令。

| 域 | 测试文件 | 用例 | 断言 | 运行方式 |
| --- | --- | --- | --- | --- |
{chr(10).join(rows)}

采集到 **{total}** 个用例、**{asserts}** 处断言：core {groups["core"]} · runtime {groups["runtime"]} · tools {groups["tools"]} · guard {groups["guard"]}。四个数字分别对应四条命令，互不包含；断言数统计的是源码里的断言调用，只能当规模参考，不是覆盖率。

### 章节 → 测试

| 章节 | 相关测试（出处） |
| --- | --- |
{chr(10).join(chapter_rows())}

## B. 可讲的细节

1. **为什么按域而不是按章组织**：同一份 `core.test.ts` 同时给任务、锁机、提醒与诊断背书，按章切会把一个文件拆成多行、数字重复；按文件归域，才能让「谁跑什么、出了问题先看哪」一眼对上。章节表只负责把读者从章带到文件。
2. **为什么数字由脚本采集而不是手写**：测试会增删、文件会改名，手写的「74 个用例」过两周就开始骗人。脚本读 `it(`、`test(` 与 `#[test]`，并数 `expect(`、`assert.` 和 Rust 的断言宏，每次生成都重算。
3. **为什么 runtime 的 76 里有一个不带 `.test` 的文件**：`runtime/test/guard-client.mjs` 里有 23 个真实用例，`node --test` 按 `**/test/**` 的发现规则把它当测试跑；它不是被别的测试导入的工具模块，文件名只是少了 `.test` 后缀，所以这一轮只如实记录，不改代码。
4. **为什么 guard 单独一格**：Rust 单测在 `crates/guard` 这个独立 cargo workspace 里，不进 pnpm 的测试链；`cargo test` 只跑编译到当前平台的用例，macOS 与 Windows 分支在 Linux 上不会被统计。
5. **为什么客户端冒烟与脚本工具分开**：两者都跑 `pnpm test:tools`，但前者测插件前端的纯函数与降级渲染（注意力提示、面板路由、角色切换、对话框 SSR），后者测安装器与数据导入导出脚本；失败时该找的文件完全不同。
6. **断言数量怎么数**：`.ts` 数 `expect(`，`.mjs` 数 `assert.`，Rust 数 `assert!`、`assert_eq!`、`assert_ne!`。它只能说明测试有多密，不能说明每行代码都被走到。
7. **为什么保留「章节 → 测试」**：各章页眉的「验证：」行由脚本按这张表生成；改测试后重跑脚本，章页眉与本页一起更新，读者不必在两张表之间对不上号。

## C. 机制（一次生成与一次运行分别发生什么）

生成脚本先读两张人工映射：域表决定一个测试文件归到哪一格，章表决定哪一章由哪些文件背书。它把目录展开成文件，逐文件采集用例名与断言数——TypeScript 走 vitest 的 `it(` 与 `test(`，JavaScript 走 node:test 的 `test(`，Rust 走 `#[test]` 后的函数名；平台专属的 Rust 模块按当前机器过滤，所以 Linux 上不会把 macOS 的用例算进来。采集结果先按测试文件去重，再加总成域合计与四个命令的分组数字，最后把「用例清单」按文件展开。运行侧对应四条命令：`pnpm core:test` 让 vitest 直接加载 `packages/core/src` 的 TypeScript；`cd runtime && node --test` 让 Node 自己发现 `runtime/test` 下的文件，并在进程内起假 guard 与 HTTP 服务；`pnpm test:tools` 只跑 `scripts` 里登记的七个测试文件；`cd crates/guard && cargo test` 先编译独立 workspace 再跑 Rust 单测。四条命令互不包含，因此四个数字可以直接相加。

## D. 语义规则与不变量

- 一个测试文件只出现在一个域里；域合计必须等于四个命令的实际用例总数。
- 用例名描述行为（英文 snake_case 或中文短语），改名视为行为变更，要同步本页与相关章。
- 本页数字必须由脚本生成；手改的表格会在下次运行时被覆盖。
- `crates/guard` 的 23 是 Linux 编译面的数字；换平台要重跑 `cargo test`，并让脚本按同一平台过滤。
- 测试不得读写用户真实数据目录：runtime 与脚本测试都使用临时目录或 mock，不碰正在运行的实例。

## E. 边界与坑

- `node --test` 的默认发现规则包含 `**/test/**/*.mjs`，所以 `runtime/test/guard-client.mjs` 也会被跑；单独跑 `runtime/test/guard-client.test.mjs` 只有 4 个用例，两个数字不能混用。
- `pnpm core:test` 目前不产出覆盖率报告；断言数不等于覆盖率，也不代表每个分支都被断言到。
- guard 的锁屏、窗口枚举与白名单切换只在真实桌面发生，`cargo test` 只测纯计算与本地 HTTP；桌面行为要按 [10-锁与专注保护](10-锁与专注保护.md) 在隔离桌面手动验证。
- 脚本工具的测试用临时 HOME 与 XDG 目录并 mock `systemctl`，不验证真实安装到用户桌面后的效果。
- 客户端冒烟测试不启动浏览器，也不覆盖 CSS 布局、真实输入设备与 Web Audio。
- 没有自动化测试的章节（[29-CODEMAP与索引维护](29-CODEMAP与索引维护.md)）靠维护者核对，见该章 F 段。

## F. 待补与更新点

- `runtime/test/guard-client.mjs` 的名字不带 `.test`，靠目录规则才被跑到；更稳妥的做法是改名为 `guard-client.test.mjs` 并显式列进测试脚本，本轮只记录，不改代码。
- Windows 与 macOS 的 guard 后端没有 CI：`crates/guard/src/win32.rs` 与 `macos.rs` 的用例要在对应平台跑 `cargo test`，本页当前只反映 Linux。
- 覆盖率没有接入；接入后应看行覆盖率与分支覆盖率，而不是把断言数当质量指标。
- 客户端冒烟与脚本工具混在 `scripts` 同一目录，由域表按文件名分组；新增测试文件时，域表、章表与 `pnpm test:tools` 的命令行三处都要登记。
- 用 `--index-only` 生成时不会回写各章页眉的「验证：」行；需要同步页眉时去掉该参数重跑，但会改动其它章文件。

## 用例清单（按文件）
{chr(10).join(detail)}
"""
    OUT.write_text(body, encoding="utf-8")

    if not index_only:
        for chapter, entries in CHAPTER_TESTS.items():
            path = ROOT / "docs" / "HANDBOOK" / f"{chapter}.md"
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            line = header_for(entries)
            lines = text.splitlines()
            cut = next((i for i, l in enumerate(lines) if l.startswith("## ")), len(lines))
            top_lines, body_lines = lines[:cut], lines[cut:]
            header = [l for l in top_lines if l.startswith("> ") and not l.startswith("> 验证：")]
            header.append(line)
            keep = ("> 手册章节", "> 事实一律", "> 验证：", "> 导航：")
            body_lines = [
                l
                for l in body_lines
                if not (l.startswith("> ") and l.startswith(keep) and l not in header)
            ]
            out_lines = [lines[0], ""] + header
            rest = list(body_lines)
            while rest and not rest[0].strip():
                rest.pop(0)
            out_lines += [""] + rest
            path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    suffix = "，并回写了各章「验证：」行" if not index_only else "（只生成索引）"
    print(
        f"已写出 {OUT.relative_to(ROOT)}：{len(rows)} 行域表，{total} 个用例，"
        f"{asserts} 处断言{suffix}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
