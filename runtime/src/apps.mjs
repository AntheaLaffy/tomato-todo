// 已安装桌面应用的枚举（GET /api/apps）：专注保护的白名单要填的是 app_id，
// 而 app_id 在 Wayland 上就是 .desktop 文件名去掉 `.desktop`（X11 的 WM_CLASS
// 通常同源），所以「扫桌面入口目录」比枚举窗口更接近用户要填的东西。
//
// 为什么放在 runtime 而不是 guard：guard 只看得到**正在运行的窗口**，用户要选
// 的常常是还没启动的应用；而且 guard 的 HTTP 面要保持最小（只有锁/解锁/通知/
// 抢焦四条命令），不该为了一次性列表扩容。
//
// 取舍：
// - 只读 `[Desktop Entry]` 段，跳过 `NoDisplay=true`、`Hidden=true`、非
//   `Type=Application`：这些条目按桌面规范本来就不该出现在应用列表里。
// - id 取文件名（含子目录时用 basename）：flatpak/snap 的入口也是这个规则，
//   与白名单的精确匹配一致。重名先到先得（用户目录优先）。
// - 名称优先取 `Name[zh_CN]`（当前 locale 是中文时），否则 `Name`。
// - 结果缓存 30 秒：目录里通常几百个文件，一次扫描几毫秒，但页面「刷新应用」
//   会被连点；缓存只影响新鲜度，不影响正确性。

import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const CACHE_TTL_SECONDS = 30;
let cache = { at: 0, apps: [] };

const LOCALIZED_NAME = /^Name\[([A-Za-z_@.]+)\]$/;

function isZh() {
  const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "";
  return /^zh/i.test(locale);
}

/** XDG 应用目录，按优先级：用户 → XDG_DATA_DIRS → flatpak 导出。 */
export function desktopDirs() {
  const home = homedir();
  const dirs = [join(home, ".local/share/applications")];
  const xdg = process.env.XDG_DATA_DIRS ?? "/usr/local/share:/usr/share";
  for (const dir of xdg.split(":")) {
    if (dir !== "") dirs.push(join(dir, "applications"));
  }
  dirs.push(join(home, ".local/share/flatpak/exports/share/applications"));
  dirs.push("/var/lib/flatpak/exports/share/applications");
  return [...new Set(dirs)];
}

/** 解析一个 .desktop 文件；不是可见应用时返回 null。 */
export function parseDesktopEntry(text) {
  const fields = new Map();
  let group = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      group = line.slice(1, -1);
      continue;
    }
    if (group !== "Desktop Entry") continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (!fields.has(key)) fields.set(key, value);
  }
  if (fields.get("Type") !== "Application") return null;
  if (fields.get("NoDisplay") === "true" || fields.get("Hidden") === "true") {
    return null;
  }
  const name = fields.get("Name") ?? "";
  if (name === "") return null;
  const localized = isZh() ? fields.get("Name[zh_CN]") ?? fields.get("Name[zh]") : null;
  const exec = fields.get("Exec") ?? "";
  return {
    // Exec 的第一段是二进制名，白名单偶尔要按它填（例如 `jetbrains-idea`）。
    exec: exec.split(/\s+/)[0] ?? "",
    icon: fields.get("Icon") ?? "",
    name: localized ?? name,
    comment: fields.get("Comment") ?? "",
  };
}

function readDir(dir, out, seen) {
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of names) {
    if (entry.isDirectory()) {
      readDir(join(dir, entry.name), out, seen);
      continue;
    }
    if (!entry.name.endsWith(".desktop")) continue;
    const id = basename(entry.name, ".desktop");
    if (id === "" || seen.has(id)) continue;
    let parsed;
    try {
      parsed = parseDesktopEntry(readFileSync(join(dir, entry.name), "utf8"));
    } catch {
      continue;
    }
    if (parsed === null) continue;
    seen.add(id);
    out.push({ id, ...parsed });
  }
}

/** 全部可见应用，按名称排序；30 秒内复用上次结果。 */
export function listApps(now = Math.floor(Date.now() / 1000)) {
  if (now - cache.at < CACHE_TTL_SECONDS && cache.apps.length > 0) {
    return { apps: cache.apps, cached: true };
  }
  const apps = [];
  const seen = new Set();
  for (const dir of desktopDirs()) readDir(dir, apps, seen);
  apps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  cache = { at: now, apps };
  return { apps, cached: false };
}
