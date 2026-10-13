#!/usr/bin/env python3
"""生成 docs/HANDBOOK/04-导航对照.md 的「关键文件与阅读顺序」附录区块。

为什么放在附录而不是各章正文：本手册面向**读代码的人**，但「哪个文件、哪个符号、先读哪个」属于**导航**，
和 CODEMAP 同类；散进每章会把「解释机制」的正文挤成目录。所以统一生成到 04 的附录区块。

文件来源有两位「权威来源」——
- `docs/HANDBOOK/04-导航对照.md` 的「关键文件」列（章节 ↔ CODEMAP ↔ 文件）
- 各章 A 表的出处（每条事实引用到的文件）
手工维护必然和这两处漂移，所以由脚本合成；**入口句**与**调用链**是人的判断，
写在下面的 ENTRY / CHAINS 里，改这两处再重跑即可。

用法：python3 scripts/handbook-paths.py
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from handbook_chapters import CHAPTER_RE  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
HAND = ROOT / "docs" / "HANDBOOK"
NAV = HAND / "04-导航对照.md"

# 入口句：一句话说清「先看哪个函数，再看哪个」。改动这里，然后重跑脚本。
ENTRY = {
    "31-概念讲解": "先读 `src/ponder.ts` 的 `PONDER_TARGETS`（概念表）与 `resolveTarget()`（命中规则），再看 `initPonder()` 的四个入口；界面侧的接线在 `src/main.ts` 的 `data-ponder` 与 `ponder-page`/`ponder-list` 两个动作。",
    "30-存储层": "整章都在 `crates/core/src/lib.rs`：先读 `Engine::open()` 与 `persist()`（一行 JSON 的读写），再读 `preview_action()` 与 `dispatch()`（校验与执行同一条路径）。",
    "28-声音的实现": "先读 `src/sound-events.ts` 的 `soundForTransition()`（选哪一个提示、优先级与静音规则），再读 `src/audio.ts` 的 `scores` 与 `stopSound()`（怎么发声、怎么淡出）。",
    "29-CODEMAP与索引维护": "先读根 `CODEMAP.md` 的 Scope 与任务指南，再看 `.agents/skills/codemap/SKILL.md`（地图的结构与维护协议），最后对照本手册的 [04-导航对照](04-导航对照.md)。",
    "10-锁与专注保护": "先从 `guard.rs` 的 `allowed()` 看判据（三种模式与精确匹配都在这一处），再看 `enforce()` 怎么抢回焦点；严格模式的拒绝在 `lib.rs` 的 `strict_protected()`。",
    "11-定时锁机": "先读 `lock.rs` 的 `validate()`（时段不重叠、星期与时间格式全在这里），再读 `scheduled_at()`；「到点做什么」在 `lib.rs` 的 `tick_with_lock()`。",
    "12-课表与提醒": "先读 `blocks.rs` 的 `band()` 与 `overlap_minutes()`（占用时段怎么算），再读 `reminders.rs` 的 `window_minutes()` 与 `tick_reminders()`；界面落格在 `src/main.ts` 的 `schedulePage()`。",
    "13-任务与列表": "先看 `lib.rs` 里 `Task` 的字段与 `kind()`（类别是推导出来的），再看 `Action` 枚举（界面能做的操作就是这些），最后到 `src/main.ts` 的 `tasksPage()` 看列表怎么渲染。",
    "14-模板与印刷": "先读 `templates.rs` 的 `Shape` 与 `Printing`（形状与规则分离），再读 `print_template()` 与 `materialize_templates()`（账本去重与整批原子）。",
    "15-目标与主线": "先读 `nodes.rs` 的 `NodeSpec` 与 `node_progress()`（节点完成条件），再读 `task_node()`（按执行时间配对）与投递结构 `Delivery`；永久 ID 在 `identities.rs` 的 `reconcile()`；节点图界面在 `src/nodegraph.ts`。",
    "16-习惯与愿景": "先看 `lib.rs` 里 `Habit`、`Vision` 与 `kind()`（习惯是推导结果，不是字段），再看 `habits.rs` 的校验与 `templates.rs` 的 `printing_expired()`（宽限为 0），界面在 `src/main.ts` 的 `habitsTab()`/`visionsTab()`。",
    "17-诊断与统计": "整条链路都在 `diagnostics.rs`：`diagnose()` 先从会话算容量，再逐个产出 `Anomaly`；阈值与反问句写在同一文件；界面在 `src/main.ts` 的 `statsPage()`。",
    "18-助手-权限与唤醒": "先读 `crates/agent/src/tools.rs` 的 `definitions(agent)`（两档工具清单就是权限边界），再读 `lib.rs` 的 `observe()`（唤醒门控与定时任务触发）与 `state.rs` 的 `Schedule()`。",
    "19-助手-文件工作区与MCP": "先读 `crates/agent/src/files.rs`：`export()` 记来源指纹、`patch()` 是受限 JSON Patch、`candidate()` 生成差异；对外 MCP 入口在 `lib.rs` 的 `mcp_entry()`。",
    "20-数据与格式": "先读 `crates/core/src/plan.rs` 的 `PlanFile` 与 `merge_into()`（配置更新与保留进度），再读 `docs/PLAN_FORMAT.md` 与 `docs/BACKUP_FORMAT.md`（契约以文档为准）。",
    "21-安装与桌面集成": "先读 `scripts/install.py` 的 `install()`（路径、护栏、DMS 补丁与备份），再读 `src-tauri/src/desktop.rs` 的托盘与自启动实现。",
    "22-架构与工程": "从 `crates/preview/src/main.rs` 看核心如何被浏览器复用，再读 `package.json` 的脚本、`.github/workflows/`（质量门与发布）与 `scripts/build-agent.mjs`（运行包重建）。",
    "23-手部演示动画": "整块在 `src/hand.ts`：`build()` 建覆盖层、`runHandScript()` 走步骤、`field()` 负责逐字符输入时重新取目标元素；`src/hand-demo.ts` 是示范脚本，`tools.rs` 的 `show_me` 是入口。",
    "24-界面手感与音效": "先用 `src/main.ts.analysis.md` 与 `src/style.css.analysis.md` 两张索引定位，再读 `src/audio.ts` 与 `src/sound-events.ts`；设置项定义在 `crates/core/src/lib.rs` 的 `Settings`。",
    "26-工具面与开发流程": "先读 `crates/agent/src/tools.rs`（工具清单即权限），再看 `agent/skills/` 与 `.agents/skills/` 两套技能的差别，最后读 `AGENTS.md` 的规范段。",
}

# 主要调用链：人的判断，宁少勿滥。
CHAINS = {
    "10-锁与专注保护": ["`lib.rs::apply()` → 保护中拒绝动作（除紧急退出）",
                    "`guard.rs::enforce()` → `windows()` → `allowed()` → `request(FocusWindow)`",
                    "`lib.rs::strict_protected()` ← 活动锁机的 strict 或（专注中 + 保护开 + strict）"],
    "12-课表与提醒": ["`reminders.rs::tick_reminders()` → `window_minutes()`（专注 × 次数 + 休息）→ 置 `reminder_pending`",
                  "`snapshot.reminder_idle()` 为真时界面才弹提醒（计时中/锁机中不弹）",
                  "`blocks.rs::overlap_minutes()` 被 `diagnostics.rs` 用来判定与「需专心」时段的冲突"],
    "15-目标与主线": ["`task_node()` → 取执行时间（计划日期 + 提醒时间或 00:00）→ 在节点 `[start, end)` 里配对",
                  "信号到时 → 逐接收节点结算 `Delivery`（可被阻断）→ 写 `Decision`",
                  "裁定 → 该节点全部配对实例报废 → `identities.rs::reconcile()` 保留 ID 与恢复数据"],
    "17-诊断与统计": ["`crates/agent/src/lib.rs::observe()` → `diagnose(snapshot, capacity)` → `Anomaly[]`",
                  "容量：用户填写 → 近 28 天中位数（下限 30）→ 每日番茄目标预算",
                  "界面：`src/main.ts::statsPage()` 读快照渲染主线与横切面"],
    "18-助手-权限与唤醒": ["`observe()` → `schedules.due(now)` 命中即进入任务轮次（并记 `fired_at`）",
                      "否则每 60 秒跑 `diagnose()` → 门控（启用/自动/空闲/凭据/安静时段/当日次数）",
                      "工具档位：`tools.rs::definitions(agent)` 决定模型看得到哪些工具"],
    "19-助手-文件工作区与MCP": ["`export_plan`/`export_backup` → `files::export()` 记来源指纹与 `fileHash`",
                          "`patch_file` → `files::patch()`（受限 RFC 6902，全部成功才写盘）",
                          "`review_file` → `files::candidate()` 预检差异 → 用户批准 → `apply_file` 再核指纹"],
    "20-数据与格式": ["`PlanFile::merge_into()` → 按 ID 更新配置、保留进度与裁定",
                  "`replace: true` → 整份同步前自动备份",
                  "恢复备份 → 暂停计时、停用锁机规则、清活动锁机、保留严格设置"],
}

SYMBOL_PAT = re.compile(
    r"^(?:pub(?:\(crate\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
JS_FUNCTION_PAT = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
STRUCT_PAT = re.compile(r"^(?:pub(?:\(crate\))?\s+)?(?:struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
EXPORT_PAT = re.compile(r"^export\s+(?:async\s+)?(?:function|const|class|type)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)

def symbols(path: pathlib.Path, cap: int | None = None) -> list[str]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8", errors="ignore")
    out: list[str] = []
    patterns = (SYMBOL_PAT, JS_FUNCTION_PAT, EXPORT_PAT) if path.suffix in (".ts", ".mjs") else (SYMBOL_PAT,)
    for pat in patterns:
        for m in pat.finditer(text):
            if m.group(1) not in out:
                out.append(m.group(1))
            if cap is not None and len(out) >= cap:
                return out
    return out


def repo_index() -> dict[str, list[pathlib.Path]]:
    """文件名 → 仓库里的真实路径（用于把 A 表里的简写补全）。"""
    skip = {"node_modules", "target", "dist", "bundle", "gen", ".git", "artifacts"}
    index: dict[str, list[pathlib.Path]] = {}
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.suffix not in (".rs", ".ts", ".mjs", ".py", ".css", ".json"):
            continue
        if any(part in skip for part in p.parts):
            continue
        index.setdefault(p.name, []).append(p)
    return index


INDEX: dict[str, list[pathlib.Path]] = {}


def resolve(candidate: str) -> str | None:
    """把 A 表里的路径（可能是 `reminders.rs` 这种简写）补成仓库里的真实相对路径。"""
    candidate = candidate.strip().strip("`")
    if candidate.startswith(("docs/HANDBOOK", "artifacts/")) or candidate in ("同上", "—", "-"):
        return None
    direct = ROOT / candidate
    if direct.is_file():
        return str(direct.relative_to(ROOT))
    matches = INDEX.get(pathlib.Path(candidate).name, [])
    if len(matches) == 1:
        return str(matches[0].relative_to(ROOT))
    if matches:
        # 多个同名文件：优先 crates/ 与 src/ 下的实现，避开测试
        ranked = sorted(matches, key=lambda p: ("test" in p.name, len(p.parts)))
        return str(ranked[0].relative_to(ROOT))
    return None

def structs(path: pathlib.Path, cap: int = 6) -> list[str]:
    if not path.is_file():
        return []
    out: list[str] = []
    for m in STRUCT_PAT.finditer(path.read_text(encoding="utf-8", errors="ignore")):
        if m.group(1) not in out:
            out.append(m.group(1))
        if len(out) >= cap:
            break
    return out

def nav_files() -> dict[str, list[str]]:
    """从 04-导航对照.md 解析「章节 → 关键文件」。"""
    if not NAV.is_file():
        return {}
    out: dict[str, list[str]] = {}
    for line in NAV.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\| \[([^\]]+)\]\(([^)]+)\) \| (.+) \| (.+) \|$", line)
        if not m or not CHAPTER_RE.match(m.group(1)):
            continue
        files = [p for p in re.findall(r"`([A-Za-z0-9_./-]+\.(?:rs|ts|mjs|py|md|json|css))`", m.group(4))]
        out[m.group(1)] = files
    return out

def a_table_files(text: str) -> list[str]:
    files: list[str] = []
    in_a = False
    for line in text.splitlines():
        if line.startswith("## A. "):
            in_a = True
            continue
        if in_a and line.startswith("## "):
            break
        if in_a and line.startswith("|"):
            for p in re.findall(r"`([A-Za-z0-9_./-]+\.(?:rs|ts|mjs|py|md|json|css))`", line):
                if p not in files:
                    files.append(p)
    return files

BEGIN = "<!-- handbook-paths:begin -->"
END = "<!-- handbook-paths:end -->"


def appendix_block(nav: dict[str, list[str]]) -> str:
    out = [BEGIN,
           "## 附录：关键文件与阅读顺序",
           "",
           "> 本节由 `scripts/handbook-paths.py` 生成：文件清单取自本章 A 表出处与上面的「章节 ↔ CODEMAP」表，",
           "> 符号优先列本章正文提到过的；入口句与调用链写在脚本的 `ENTRY` / `CHAINS` 里。",
           "> 手册正文讲机制与规则，找文件、找符号看这里或 [CODEMAP](../../CODEMAP.md)。",
           ""]
    for f in sorted(HAND.glob("*.md")):
        if not CHAPTER_RE.match(f.name):
            continue
        text = f.read_text(encoding="utf-8")
        files: list[str] = []
        for raw in list(nav.get(f.stem, [])) + a_table_files(text):
            resolved = resolve(raw)
            if resolved and resolved not in files:
                files.append(resolved)
        _c = re.search(r"^## C\. ", text, re.M)
        _e = re.search(r"^## E\. ", text, re.M)
        core = (text[:_c.start()] + text[_e.start():]) if (_c and _e) else text
        mentioned = set(re.findall(r"`([A-Za-z_][A-Za-z0-9_]*)(?:\(\))`", core))
        mentioned |= set(re.findall(r"`([A-Za-z_][A-Za-z0-9_]{2,})`", core))
        mentioned |= set(re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)(?:[A-Za-z0-9_]*)?\(\)", core))
        mentioned |= set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*::([A-Za-z_][A-Za-z0-9_]*)", core))

        out += [f"### {f.stem}", ""]
        entry = ENTRY.get(f.stem)
        if entry:
            out += [f"**入口**：{entry}", ""]
        out += ["| 顺序 | 文件 | 关键符号 |", "| --- | --- | --- |"]
        for i, path in enumerate(files, 1):
            all_syms = symbols(ROOT / path)
            picked = [s for s in all_syms if s in mentioned][:8]
            for s in all_syms:
                if len(picked) >= 8:
                    break
                if s not in picked:
                    picked.append(s)
            if path.endswith(".analysis.md"):
                cell = "（索引文档，按行段定位）"
            elif path.endswith(".md"):
                cell = "（文档）"
            else:
                cell = "、".join(f"`{s}`" for s in picked) if picked else "——"
            out.append(f"| {i} | `{path}` | {cell} |")
        chains = CHAINS.get(f.stem)
        if chains:
            out += ["", "调用链：", ""] + [f"- {x}" for x in chains]
        out.append("")
    out.append(END)
    return "\n".join(out)


def main() -> None:
    global INDEX
    INDEX = repo_index()
    nav = nav_files()
    text = NAV.read_text(encoding="utf-8")
    block = appendix_block(nav)
    if BEGIN in text and END in text:
        text = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), block, text, flags=re.S)
    else:
        text = text.rstrip() + "\n\n" + block + "\n"
    NAV.write_text(text, encoding="utf-8")
    print(f"已更新 {NAV.relative_to(ROOT)} 的附录区块")


if __name__ == "__main__":
    main()
