/**
 * Skills bundled with this plugin.
 *
 * The skill files live in `./skills/` inside the installed package, so the
 * catalog must follow wherever the package landed: a profile's `node_modules`,
 * a `link:` target, or a git checkout. Every path here is derived from
 * `import.meta.url`, and the provider only exists while this plugin is
 * mounted, so updating the plugin is the only step needed to update its
 * skills — users never install the teaching skills separately.
 *
 * The teaching skills route model work into this plugin's own `tomato_*`
 * Host tools, independently of the DSH MCP client connection, so they belong to the same
 * release as those tools.
 *
 * Why a provider instead of pointing `dsh-skill-filesystem` at this directory:
 * two bundles appending to one `customSkillDirs` key would overwrite each
 * other, and the installed path is unknown when the bundle patch is written.
 *
 * Why only Node builtins: this package is installed by copying or linking, so
 * a third-party parser would have to resolve from a node_modules tree we do
 * not control. The frontmatter subset below covers what skill files use.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_ROOT = fileURLToPath(new URL("./skills/", import.meta.url));
const PROVIDER_NAME = "tomato-bundled";
const SOURCE = "bundled";

// Why 350: a packaged skill must beat a stale hand-installed copy under the
// user roots (400 `user-dsh`, 500 `user-agents`), otherwise a plugin update
// would silently keep loading the old text. Project roots (100/200) still win,
// so a checkout can override a bundled skill locally.
const RANK = 350;

const SKILL_FILE = "SKILL.md";
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Register the bundled skills on the host skill registry, if the host has one.
 * @param ctx - the plugin context.
 * @returns the disposable scoped fiber; the plugin's own disposal also covers it.
 */
export function registerBundledSkills(ctx) {
  // Why `inject` instead of a static `inject` on the plugin: a host may run
  // without the skill registry, and the delegation limit, `agent_message`
  // tool, and prompt text must still load there.
  return ctx.inject(["skills"], (scope) => {
    scope.skills.registerProvider(() => createProvider(scope));
  });
}

function createProvider(ctx) {
  return {
    name: PROVIDER_NAME,
    list: () => discover(ctx),
    async get(candidate) {
      const skill = await readSkill(ctx, candidate.locator);
      if (skill === undefined) return undefined;
      return {
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
        invocation: skill.invocation,
        provider: PROVIDER_NAME,
        source: SOURCE,
        resourceBase: skill.resourceBase,
        path: skill.path,
        content: skill.content,
      };
    },
  };
}

async function discover(ctx) {
  let entries;
  try {
    entries = await readdir(SKILLS_ROOT, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const candidates = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    // A skill is `<name>/SKILL.md` or a flat `<name>.md`, matching the
    // filesystem provider's layout; nested files are resources, not skills.
    const file = entry.isDirectory()
      ? join(SKILLS_ROOT, entry.name, SKILL_FILE)
      : entry.isFile() && entry.name.endsWith(".md")
        ? join(SKILLS_ROOT, entry.name)
        : undefined;
    if (file === undefined) continue;

    const skill = await readSkill(ctx, file);
    if (skill === undefined) continue;
    candidates.push({
      name: skill.name,
      description: skill.description,
      ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
      invocation: skill.invocation,
      provider: PROVIDER_NAME,
      source: SOURCE,
      resourceBase: skill.resourceBase,
      path: skill.path,
      rank: RANK,
      locator: file,
    });
  }
  return candidates;
}

async function readSkill(ctx, file) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return undefined;
  }

  const parsed = parseSkillFile(raw);
  if (parsed === undefined) {
    ctx.logger.warn(`bundled skill ${file} ignored: missing or invalid YAML frontmatter`);
    return undefined;
  }

  const name = parsed.data.name;
  if (typeof name !== "string" || !KEBAB_CASE.test(name)) {
    ctx.logger.warn(`bundled skill ${file} ignored: frontmatter needs a kebab-case name`);
    return undefined;
  }
  const description = parsed.data.description;
  if (typeof description !== "string" || description.trim() === "") {
    ctx.logger.warn(`bundled skill ${file} ignored: frontmatter needs a description`);
    return undefined;
  }

  const whenToUse = parsed.data.whenToUse;
  return {
    name,
    description: description.trim(),
    ...(typeof whenToUse === "string" && whenToUse.trim() !== ""
      ? { whenToUse: whenToUse.trim() }
      : {}),
    invocation: {
      modelInvocable: boolField(parsed.data, "disable-model-invocation") !== true,
      userInvocable: boolField(parsed.data, "user-invocable") !== false,
    },
    resourceBase: { kind: "directory", path: dirname(file) },
    path: file,
    content: parsed.body,
  };
}

function parseSkillFile(raw) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return undefined;

  let end = 1;
  while (end < lines.length && lines[end].trim() !== "---" && lines[end].trim() !== "...") {
    end += 1;
  }
  if (end === lines.length) return undefined;

  return {
    data: parseFields(lines.slice(1, end)),
    body: lines.slice(end + 1).join("\n").trim(),
  };
}

/**
 * Parse the YAML subset skill frontmatter uses: top-level `key: scalar`,
 * quoted scalars, and `>`/`|` block scalars. Nested mappings and sequences are
 * ignored on purpose — skills route on `name`/`description`, and anything else
 * is provider-specific metadata.
 * @param lines - frontmatter lines, between the `---` fences.
 * @returns parsed top-level fields.
 */
function parseFields(lines) {
  const data = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const match = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (match === null) continue;

    const key = match[1];
    const rest = match[2].trim();
    if (rest === "") continue;

    if (/^[>|][+-]?[0-9]?$/.test(rest)) {
      const folded = rest.startsWith(">");
      const block = [];
      let indent = -1;
      for (index += 1; index < lines.length; index += 1) {
        const content = lines[index];
        if (content.trim() === "") {
          block.push("");
          continue;
        }
        const current = content.length - content.trimStart().length;
        if (indent === -1) indent = current;
        if (current < indent) {
          index -= 1;
          break;
        }
        block.push(content.slice(indent));
      }
      while (block.length > 0 && block[block.length - 1] === "") block.pop();
      data[key] = folded ? fold(block) : block.join("\n");
      continue;
    }

    data[key] = scalar(rest);

    // Plain scalars may continue on indented lines; the following lines are
    // trimmed and folded into spaces, as YAML does.
    const continuation = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (next.trim() === "" || /^[ \t]/.test(next) === false) break;
      continuation.push(next.trim());
      index += 1;
    }
    if (continuation.length > 0) data[key] = `${data[key]} ${continuation.join(" ")}`.trim();
  }

  return data;
}

function fold(lines) {
  let out = "";
  for (const line of lines) {
    if (line === "") {
      out += "\n";
      continue;
    }
    out += out === "" || out.endsWith("\n") ? line : ` ${line}`;
  }
  return out.trim();
}

function scalar(value) {
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    if (end > 0) {
      try {
        return JSON.parse(value.slice(0, end + 1));
      } catch {
        return value.slice(1, end);
      }
    }
    return value;
  }
  if (value.startsWith("'")) {
    const end = value.lastIndexOf("'");
    if (end > 0) return value.slice(1, end).replace(/''/g, "'");
    return value;
  }
  // A plain scalar's inline comment starts at whitespace + `#`; `#` elsewhere
  // (markdown headings, issue numbers) is text.
  const comment = value.search(/[ \t]#/);
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

function boolField(data, key) {
  const value = data[key];
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  return undefined;
}
