/**
 * Symlink this package's bundled skills into other agents' skill directories.
 *
 * Why symlinks: this package is the only copy of these skills. A link makes
 * every other agent (Codex, Claude Code, Gemini, opencode, ...) read the same
 * files the plugin ships, so updating the plugin updates them too. There is
 * nothing to keep in sync by hand, and a plugin update never leaves a second
 * stale copy behind.
 *
 * Two callers share this one implementation: the plugin mounts
 * `installSkillLinks` so the common case needs no command, and
 * `link-skills.mjs` exposes the same operations to a human.
 *
 * It never deletes a real directory or file. A link it did not create is
 * replaced only when `force` is set; the plugin uses `force` so that a link
 * left by an older install path heals on the next mount.
 */
import { lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute directory of this package. */
export const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
/** Absolute directory holding the bundled skills. */
export const SKILLS_DIR = join(PACKAGE_DIR, "skills");
/** Cross-agent skill root shared by Agent-Skills-compatible tools. */
export const SHARED_SKILL_DIR = join(homedir(), ".agents", "skills");
/** Agent-specific roots to fall back to when the shared one does not exist. */
export const AGENT_SKILL_DIRS = [
  join(homedir(), ".codex", "skills"),
  join(homedir(), ".claude", "skills"),
  join(homedir(), ".gemini", "skills"),
  join(homedir(), ".config", "opencode", "skills"),
];

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function expandHome(path) {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

/**
 * Pick the roots the plugin links into without being told: the shared root
 * when it exists (it is the cross-agent hub), otherwise every agent-specific
 * root that exists. Roots that resolve to the same directory are merged, so a
 * repository symlinked from several agents is linked only once.
 * @returns directories to link into; empty when no agent root exists yet.
 */
export function autoLinkDirs() {
  const roots = [SHARED_SKILL_DIR, ...AGENT_SKILL_DIRS].filter(isDirectory);
  const seen = new Map();
  for (const root of roots) {
    let key = root;
    try {
      key = realpathSync(root);
    } catch {
      // A racing removal only means the root is unusable this run.
      continue;
    }
    if (!seen.has(key)) seen.set(key, root);
  }
  const shared = seen.get(safeRealpath(SHARED_SKILL_DIR));
  return shared === undefined ? [...seen.values()] : [shared];
}

/**
 * Create (or remove) this package's skill links in the given directories.
 * @param options - `dirs`, plus `remove`, `force`, `relative`, `dryRun`, `create`.
 * @returns `{ entries, failures }` where each entry reports its action.
 */
export function linkSkills(options) {
  const dirs = options.dirs ?? [];
  const dryRun = options.dryRun === true;
  const entries = [];

  for (const dir of dirs) {
    if (!isDirectory(dir)) {
      if (options.create !== true) {
        entries.push({ dir, name: undefined, action: "skip", message: "directory does not exist" });
        continue;
      }
      if (!dryRun) mkdirSync(dir, { recursive: true });
      entries.push({ dir, name: undefined, action: "mkdir" });
    }
    if (!isDirectory(dir) && !dryRun) continue;

    for (const skill of listSkills()) {
      entries.push({ dir, ...applyTo(dir, skill, options) });
    }
  }

  return { entries, failures: entries.filter((entry) => entry.action === "skip").length };
}

function listSkills() {
  let entries;
  try {
    entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const file = join(SKILLS_DIR, entry.name, "SKILL.md");
      if (exists(file)) skills.push({ name: entry.name, path: join(SKILLS_DIR, entry.name) });
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      skills.push({ name: basename(entry.name, ".md"), path: join(SKILLS_DIR, entry.name) });
    }
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

function applyTo(dir, skill, options) {
  const linkPath = join(dir, skill.name);
  const existing = lstatOrUndefined(linkPath);
  const dryRun = options.dryRun === true;
  const target = options.relative === true ? relative(dir, skill.path) : skill.path;

  if (options.remove === true) {
    if (existing?.isSymbolicLink() !== true) return { name: skill.name, action: "none", linkPath };
    if (pointsAt(linkPath) !== resolve(skill.path)) return { name: skill.name, action: "none", linkPath };
    if (!dryRun) unlinkSync(linkPath);
    return { name: skill.name, action: "unlink", linkPath };
  }

  if (existing === undefined) {
    if (!dryRun) symlinkSync(target, linkPath, "dir");
    return { name: skill.name, action: "link", linkPath, target };
  }
  if (existing.isSymbolicLink() !== true) {
    return { name: skill.name, action: "skip", linkPath, message: "a real file or directory is in the way" };
  }
  if (pointsAt(linkPath) === resolve(skill.path)) {
    return { name: skill.name, action: "ok", linkPath };
  }
  if (options.force !== true) {
    return { name: skill.name, action: "skip", linkPath, message: `points elsewhere (${pointsAt(linkPath)})` };
  }
  if (!dryRun) {
    unlinkSync(linkPath);
    symlinkSync(target, linkPath, "dir");
  }
  return { name: skill.name, action: "replace", linkPath, target };
}

/**
 * Mount-time linking. Honors the plugin's `linkSkills` setting: `false`
 * disables it, an array names the directories, and the default links into the
 * agent roots that already exist.
 *
 * Why no unlink on dispose: a reload mounts the new instance around the old
 * one, and removing links on teardown would race that mount and could strip
 * links the new instance just made. Links stay valid while the package exists;
 * `node link-skills.mjs --remove` is the explicit way to drop them.
 * @param ctx - plugin context used for logging.
 * @param setting - `false`, an array of directories, or `true`/`undefined`.
 * @param label - logger tag.
 */
export function installSkillLinks(ctx, setting, label = "skills") {
  if (setting === false) return;

  const dirs = Array.isArray(setting)
    ? setting.map((dir) => expandHome(dir))
    : autoLinkDirs();
  if (dirs.length === 0) {
    ctx.logger.info(`${label}: no other agent skill directory yet; run node link-skills.mjs when one exists`);
    return;
  }

  let result;
  try {
    result = linkSkills({ dirs, force: true, create: Array.isArray(setting) });
  } catch (error) {
    ctx.logger.warn(`${label}: linking skipped (${error.message})`);
    return;
  }

  const linked = result.entries.filter((entry) => entry.action === "link" || entry.action === "replace");
  if (linked.length > 0) {
    const roots = [...new Set(linked.map((entry) => entry.dir))].join(", ");
    ctx.logger.info(`${label}: linked ${linked.map((entry) => entry.name).join(", ")} into ${roots}`);
  }
  for (const entry of result.entries) {
    if (entry.action === "skip") ctx.logger.warn(`${label}: left ${entry.linkPath ?? entry.dir} alone (${entry.message})`);
  }
}

function pointsAt(linkPath) {
  return resolve(dirname(linkPath), readlinkSync(linkPath));
}

function lstatOrUndefined(path) {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
