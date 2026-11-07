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
    "10-锁与专注保护": "先读 `crates/guard/src/state.rs` 的 `lock()` / `enforce_worker()`（锁窗与 600ms 判定），再看 `guard.rs` 的 `decide()` 与 `focus_dsh()`（白名单与抢焦），runtime 侧的期望态在 `server.mjs` 的 `desiredGuard()`。",
    "11-定时锁机": "先读 `packages/core/src/lock.ts` 的 `scheduledAt()` 与 `tickWithLock()`（时段怎么算、到点做什么），再看 `runtime/src/engine.ts` 的 dispatch 与 `runtime/src/server.mjs` 的 `desiredGuard()`。",
    "12-课表与提醒": "先读 `packages/core/src/blocks.ts` 的占用时段与 `reminders.ts` 的窗口计算，再看 `plugin/src/client/pages/calendar.js` 的落格与 `plugin/src/client/app/reminders.js` 的提醒条。",
    "13-任务与列表": "先读 `packages/core/src/model.ts` 的 `Task` 与 `kindOf()`（类别是推导出来的），再看 `packages/core/src/plan.ts` 的校验与 `runtime/src/engine.ts` 的 `listTasks()`；界面在 `plugin/src/client/pages/tasks.js`。",
    "14-模板与印刷": "先读 `packages/core/src/templates.ts` 的 `Shape` 与 `Printing`（形状与规则分离），再看 `print_template()` 的账本去重与批量原子；界面在 `plugin/src/client/pages/print-dialog.js`。",
    "15-任务身份": "先读 `packages/core/src/identities.ts` 的 `reconcile()` 与 `validate()`，再看 `runtime/src/engine.ts` 的 `previewAction()` / `dispatch()`；旧本地数据转换在 `packages/core/src/migration.ts`。",
    "16-习惯与愿景": "先读 `packages/core/src/habits.ts` 的校验与 `templates.ts` 的 `printing_expired()`（宽限为 0），界面在 `plugin/src/client/pages/habits.js`。",
    "17-诊断与统计": "整条链路都在 `packages/core/src/diagnostics.ts`：`diagnose()` 先从会话算容量，再逐个产出 `Anomaly`；阈值与反问句写在同一文件，界面在 `plugin/src/client/pages/stats.js`。",
    "20-数据与格式": "先读 `docs/PLAN_FORMAT.md` 与 `docs/BACKUP_FORMAT.md`（契约以文档为准），再看 `runtime/src/engine.ts` 的 `exportPlan()` / `exportBackup()` / `applyFile()`。",
    "21-安装与桌面集成": "先读 `scripts/install.mjs` 的 `install()`（路径、manifest 护栏、systemd unit），再看 `packaging/aur/` 与 `desktop-integrations/gnome/`。",
    "22-架构与工程": "先读 `package.json` 的脚本与 `pnpm-workspace.yaml`，再看 `scripts/build-client.mjs` / `scripts/build-runtime.mjs` 与 `.github/workflows/`。",
    "24-界面手感与音效": "先读 `plugin/src/client/shared/ui.css.js` 的令牌与组件样式，再看 `plugin/src/client/skin/` 的氛围层与 `plugin/src/client/app/persona.js` 的看板娘。",
    "25-前端架构与状态流": "先读 `plugin/src/client/entry.js` 的 `__ModuleLoader__` 工厂与 `plugin/src/client/app/main.js` 的插槽注册，再看 `plugin/src/client/shared/store.js` 的轮询与 dispatch。",
    "28-声音的实现": "先读 `plugin/src/client/app/sound.js` 的 cue 表与 AudioContext，再看 `plugin/src/client/app/hud.js` 的触发点。",
    "29-CODEMAP与索引维护": "先读根 `CODEMAP.md` 的 Scope 与任务指南，再看 `.agents/skills/codemap/SKILL.md`（地图的结构与维护协议），最后对照本手册的 [04-导航对照](04-导航对照.md)。",
    "30-存储层": "先读 `runtime/src/data-files.mjs` 的原子写与双文件布局，再看 `runtime/src/engine.ts` 的加载与落盘。",
}

# 主要调用链：人的判断，宁少勿滥。
CHAINS = {
    "10-锁与专注保护": ["`server.mjs::desiredGuard()` → `guard.lock/unlock`（runtime 每秒同步期望态）",
                    "`state.rs::enforce_worker()` → `guard.rs::decide()` → 把前台窗口切回锁窗",
                    "`main.mjs` tick → 新提醒 / 一轮结束 → 按设置 `guard.notify()`（不自动置前）"],
    "12-课表与提醒": ["`core.tick` → 置 `reminderPending` → `engine.tick` 落盘",
                  "前端轮询 `/api/state` → HUD 提醒条（只在空闲时显示）",
                  "`blocks.band()` 被 `diagnostics` 用来判定与「需专心」时段的冲突"],
    "17-诊断与统计": ["`engine.snapshot()` → `diagnose(snapshot, capacity)` → `Anomaly[]`",
                  "容量：近 28 天中位数（下限 30）→ 每日番茄目标预算",
                  "界面：`pages/stats.js` 读快照渲染投入统计与每日记录"],
    "20-数据与格式": ["`exportPlan()` / `exportBackup()` → dataDir/exports + sha256 指纹",
                  "`applyFile()` 校验哈希 → `importPlan` / `import`",
                  "恢复备份 → 暂停计时、停用锁机规则、清活动锁机、保留严格设置"],
}

SYMBOL_PAT = re.compile(
    r"^(?:pub(?:\(crate\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
JS_FUNCTION_PAT = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
STRUCT_PAT = re.compile(r"^(?:pub(?:\(crate\))?\s+)?(?:struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
EXPORT_PAT = re.compile(r"^export\s+(?:async\s+)?(?:function|const|class|type)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
# 插件层是 esbuild 打包的 IIFE 源码：没有 export，靠函数/常量/类的声明形态识别。
JS_CONST_PAT = re.compile(r"^(?:const|let)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=", re.M)
JS_CLASS_PAT = re.compile(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)

def symbols(path: pathlib.Path, cap: int | None = None) -> list[str]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8", errors="ignore")
    out: list[str] = []
    if path.suffix in (".ts", ".mjs", ".js"):
        patterns = (JS_FUNCTION_PAT, EXPORT_PAT, JS_CONST_PAT, JS_CLASS_PAT)
    else:
        patterns = (SYMBOL_PAT,)
    for pat in patterns:
        for m in pat.finditer(text):
            if m.group(1) not in out:
                out.append(m.group(1))
            if cap is not None and len(out) >= cap:
                return out
    return out


def repo_index() -> dict[str, list[pathlib.Path]]:
    """文件名 → 仓库里的真实路径（用于把 A 表里的简写补全）。"""
    skip = {"node_modules", "target", "dist", "bundle", "gen", ".git", "artifacts", ".project-maintenance"}
    index: dict[str, list[pathlib.Path]] = {}
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.suffix not in (".rs", ".ts", ".mjs", ".js", ".py", ".css", ".json"):
            continue
        if any(part in skip for part in p.parts):
            continue
        index.setdefault(p.name, []).append(p)
    return index


INDEX: dict[str, list[pathlib.Path]] = {}


def resolve(candidate: str) -> str | None:
    """把 A 表里的路径（可能是 `reminders.rs` 这种简写）补成仓库里的真实相对路径。"""
    candidate = candidate.strip().strip("`")
    if candidate.startswith(("docs/HANDBOOK", "artifacts/", ".project-maintenance/")) or candidate in ("同上", "—", "-"):
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
        files = [p for p in re.findall(r"`([A-Za-z0-9_./-]+\.(?:rs|ts|mjs|js|py|md|json|css))`", m.group(4))]
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
            for p in re.findall(r"`([A-Za-z0-9_./-]+\.(?:rs|ts|mjs|js|py|md|json|css))`", line):
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
