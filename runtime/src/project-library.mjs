// 项目资料只通过本机授权读取。授权独立于计划/备份；资料原件永不由清理操作删除。
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { readIndex, topLevelsForProject } from "./library-index.mjs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  parse,
  resolve,
  sep,
} from "node:path";

export const PREVIEW_BYTES = 20 * 1024 * 1024;
/** 共享资料库授权文件名；与按项目的 project-grants.json 分开，语义不同。 */
const LIBRARY_FILE = "library-grant.json";
const MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  // 不把 SVG/HTML 当可预览的 image/text：直接打开同源文件时脚本会以
  // runtime 的 origin 运行，能读本地只读 API；这类文件只给下载。
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  markdown: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  json: "text/plain; charset=utf-8",
};

/** 扩展名 → MIME；未知类型一律 application/octet-stream（不冒充可预览）。 */
export function mimeTypeFor(ext) {
  return (
    MIME[String(ext ?? "").toLocaleLowerCase()] ?? "application/octet-stream"
  );
}

/** 扩展名 → core 的 ResourceKind；拿不准的一律 reference（可预览、可被引用）。 */
function kindForExtension(ext) {
  switch (String(ext ?? "").toLowerCase()) {
    case "pdf":
    case "epub":
      return "book";
    case "ppt":
    case "pptx":
      return "course";
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return "attachment";
    case "mp3":
    case "wav":
    case "mp4":
    case "flv":
      return "attachment";
    default:
      return "reference";
  }
}

export class LibraryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new LibraryError(status, message);
};
const inside = (child, root) => child === root || child.startsWith(root + sep);
const validId = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 200;

function noSymlinks(path, allowMissing = false) {
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let info;
    try {
      info = lstatSync(current);
    } catch (error) {
      if (allowMissing && error.code === "ENOENT") return;
      throw error;
    }
    if (info.isSymbolicLink()) fail(400, "项目资料路径不能经过符号链接");
  }
}

function safeRelative(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\\") ||
    path.includes("\0") ||
    isAbsolute(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  ) {
    fail(400, "资料路径必须是安全的项目相对路径");
  }
  return path;
}

function readGrants(dataDir) {
  const file = join(dataDir, "project-grants.json");
  if (!existsSync(file)) return [];
  let value;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(500, "项目授权文件读取失败；未授予任何资料权限");
  }
  if (
    !Array.isArray(value) ||
    value.some(
      (g) =>
        !g ||
        !validId(g.projectId) ||
        typeof g.directory !== "string" ||
        !isAbsolute(g.directory),
    )
  ) {
    fail(500, "项目授权文件格式无效；未授予任何资料权限");
  }
  return value;
}

function writePrivateJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = file + ".tmp-" + process.pid + "-" + randomUUID();
  try {
    writeFileSync(temp, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temp, file);
  } catch (error) {
    try {
      if (existsSync(temp)) unlinkSync(temp);
    } catch {}
    throw error;
  }
}

function writeGrants(dataDir, grants) {
  writePrivateJson(join(dataDir, "project-grants.json"), grants);
}

/** 共享资料库授权：{directory, grantedAt}；文件不存在表示未授权。 */
function readLibraryGrant(dataDir) {
  const file = join(dataDir, LIBRARY_FILE);
  if (!existsSync(file)) return null;
  let value;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(500, "共享资料库授权文件读取失败；未授予任何资料权限");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.directory !== "string" ||
    !isAbsolute(value.directory) ||
    (value.grantedAt !== undefined && !Number.isInteger(value.grantedAt))
  ) {
    fail(500, "共享资料库授权文件格式无效；未授予任何资料权限");
  }
  return { directory: value.directory, grantedAt: value.grantedAt ?? null };
}

function writeLibraryGrant(dataDir, grant) {
  writePrivateJson(join(dataDir, LIBRARY_FILE), {
    directory: grant.directory,
    grantedAt: grant.grantedAt,
  });
}

export function validateResourceAction(dataDir, data, action) {
  if (action?.type !== "education" || action.command?.op !== "saveResource")
    return;
  const resource = action.command.resource;
  const library = new ProjectLibrary({ data }, dataDir);
  library.resolveFile(resource?.projectId, resource?.path);
}

export class ProjectLibrary {
  constructor(engine, dataDir) {
    this.engine = engine;
    this.dataDir = dataDir;
  }

  project(id) {
    if (!validId(id)) fail(400, "项目 ID 无效");
    const project = this.engine.data.projects.find((p) => p.id === id);
    if (!project) fail(404, "项目不存在");
    return project;
  }
  profile(id) {
    return this.engine.data.education.projects.find((p) => p.projectId === id);
  }
  grants() {
    return readGrants(this.dataDir);
  }
  putGrant(id, directory) {
    const grants = this.grants().filter((g) => g.projectId !== id);
    if (directory) grants.push({ projectId: id, directory });
    writeGrants(this.dataDir, grants);
  }
  /** 共享资料库授权（用户只能从界面设置；助手/MCP 没有入口）。 */
  libraryGrant() {
    return readLibraryGrant(this.dataDir);
  }
  /**
   * 共享资料库的状态投影：目录失联或不再安全时仍返回 200 + authorized:false，
   * 让界面能显示「需要重新授权」，而不是把整个页面打挂。
   */
  libraryStatus() {
    const grant = this.libraryGrant();
    const profiles = this.engine.data.education.projects.filter((p) =>
      this.engine.data.projects.some((x) => x.id === p.projectId),
    );
    if (!grant)
      return {
        authorized: false,
        directory: null,
        projects: 0,
        sharedProjects: [],
      };
    try {
      const directory = this.safeDirectory(grant.directory);
      const grants = this.grants();
      const sharedProjects = profiles
        .filter((p) => {
          const own = grants.find((g) => g.projectId === p.projectId);
          return !own || own.directory === directory;
        })
        .map((p) => p.projectId);
      return {
        authorized: true,
        directory,
        projects: profiles.length,
        sharedProjects,
        grantedAt: grant.grantedAt,
      };
    } catch (error) {
      if (!(error instanceof LibraryError)) throw error;
      return {
        authorized: false,
        directory: grant.directory,
        projects: 0,
        sharedProjects: [],
        reason: error.message,
      };
    }
  }
  /**
   * 授权共享资料库。已有项目授权必须都在这个目录内：共享库是应试资料的
   * 上界，项目单独授权只能收窄，不能借旧授权越过用户这次选择的边界。
   */
  authorizeLibrary(requested, now = Date.now()) {
    const directory = this.safeDirectory(requested);
    const outside = this.grants().filter(
      (g) =>
        this.engine.data.projects.some((p) => p.id === g.projectId) &&
        !inside(g.directory, directory),
    );
    if (outside.length > 0) {
      const names = outside
        .map(
          (g) =>
            this.engine.data.projects.find((p) => p.id === g.projectId)?.name ??
            g.projectId,
        )
        .join("、");
      fail(
        400,
        `已有项目授权不在共享资料库内（${names}）；先把这些项目改到该目录内，或取消它们的单独授权`,
      );
    }
    writeLibraryGrant(this.dataDir, {
      directory,
      grantedAt: Math.floor(now / 1000),
    });
    return this.libraryStatus();
  }
  /** 只取消共享授权；按项目的单独授权原样保留。 */
  revokeLibrary() {
    const file = join(this.dataDir, LIBRARY_FILE);
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return this.libraryStatus();
  }
  /** 已授权的共享资料库真实路径；未授权返回 null，失效则 403。 */
  libraryRoot() {
    const grant = this.libraryGrant();
    if (!grant) return null;
    try {
      return this.safeDirectory(grant.directory);
    } catch (error) {
      if (error instanceof LibraryError)
        fail(403, "共享资料库已失联或不再安全，请重新授权");
      throw error;
    }
  }
  /** 目录本身的硬性安全检查：绝对路径、非符号链接、目录，且不是根/主目录/应用数据目录。 */
  safeDirectory(requested) {
    if (typeof requested !== "string" || !isAbsolute(requested))
      fail(400, "请选择已存在的绝对目录");
    let directory;
    try {
      noSymlinks(resolve(requested));
      if (!statSync(requested).isDirectory())
        fail(400, "请选择已存在的绝对目录");
      directory = realpathSync(requested);
    } catch (error) {
      if (error instanceof LibraryError) throw error;
      fail(400, "请选择已存在且不是符号链接的绝对目录");
    }
    const internal = realpathSync(this.dataDir);
    const home = realpathSync(homedir());
    if (
      directory === parse(directory).root ||
      directory === home ||
      inside(internal, directory) ||
      inside(directory, internal)
    ) {
      fail(400, "请选择专用资料目录，不能授权根目录、整个主目录或应用内部目录");
    }
    return directory;
  }
  validateDirectory(requested, projectId = null) {
    const directory = this.safeDirectory(requested);
    this.validateOverlap(directory, projectId);
    return directory;
  }
  /** 项目单独授权不能与别的项目重叠；共享库根目录是例外（见 bind/create）。 */
  validateOverlap(directory, projectId = null) {
    for (const grant of this.grants()) {
      if (
        grant.projectId !== projectId &&
        this.engine.data.projects.some((p) => p.id === grant.projectId) &&
        (inside(directory, grant.directory) ||
          inside(grant.directory, directory))
      ) {
        fail(400, "不同项目的授权目录不能重叠");
      }
    }
  }
  mount(id) {
    this.project(id);
    const profile = this.profile(id);
    const grant = this.grants().find((g) => g.projectId === id);
    const libraryRoot = this.libraryRoot();
    if (grant) {
      if (!profile || profile.directory !== grant.directory)
        fail(403, "项目目录尚未由用户授权，或绑定与授权不一致");
      let directory;
      try {
        directory = this.safeDirectory(grant.directory);
      } catch (error) {
        if (error instanceof LibraryError)
          fail(403, "项目目录已失联或不再安全，请重新授权");
        throw error;
      }
      if (libraryRoot !== null && !inside(directory, libraryRoot))
        fail(403, "项目目录不在共享资料库内，请重新授权");
      return directory;
    }
    if (libraryRoot !== null) return libraryRoot;
    fail(403, "项目目录尚未由用户授权");
  }
  grantStatus(id) {
    this.project(id);
    try {
      const directory = this.mount(id);
      let shared = false;
      try {
        shared = directory === this.libraryRoot();
      } catch {}
      return { projectId: id, authorized: true, directory, shared };
    } catch (error) {
      if (error instanceof LibraryError)
        return {
          projectId: id,
          authorized: false,
          directory: this.profile(id)?.directory ?? null,
          reason: error.message,
        };
      throw error;
    }
  }
  bind(id, requested) {
    this.project(id);
    const directory = this.safeDirectory(requested);
    const libraryRoot = this.libraryRoot();
    // 选共享库根目录等于「使用共享库」：它本来就会覆盖所有项目授权，
    // 不能再按「不同项目目录不能重叠」拒绝；也不落项目级授权，项目改名才不会动到整库。
    const usesLibrary = libraryRoot !== null && directory === libraryRoot;
    if (!usesLibrary) this.validateOverlap(directory, id);
    if (libraryRoot !== null && !inside(directory, libraryRoot))
      fail(400, "项目目录必须位于共享资料库内；如需该目录，请先更换共享资料库");
    const old =
      this.grants().find((g) => g.projectId === id)?.directory ?? null;
    const profile = this.profile(id) ?? {
      projectId: id,
      directory: "",
      examMode: false,
      visionId: null,
      target: "",
      examDate: null,
      syllabusId: null,
      pastPaperIds: [],
      mockPaperIds: [],
    };
    this.putGrant(id, usesLibrary ? null : directory);
    try {
      this.engine.applyAction({
        type: "education",
        command: { op: "saveProject", project: { ...profile, directory } },
      });
    } catch (error) {
      this.putGrant(id, old);
      throw error;
    }
    return this.grantStatus(id);
  }
  create({ name, color, directory }) {
    const libraryRoot = this.libraryRoot();
    let safe;
    if (directory === undefined || directory === null || directory === "") {
      if (libraryRoot === null)
        fail(400, "请选择已存在的绝对目录；或先在应试教育页授权共享资料库");
      safe = libraryRoot;
    } else {
      safe = this.safeDirectory(directory);
      const usesLibrary = libraryRoot !== null && safe === libraryRoot;
      if (!usesLibrary) this.validateOverlap(safe, null);
      if (libraryRoot !== null && !inside(safe, libraryRoot))
        fail(
          400,
          "项目目录必须位于共享资料库内；如需该目录，请先更换共享资料库",
        );
    }
    const before = new Set(this.engine.data.projects.map((p) => p.id));
    this.engine.applyAction({
      type: "saveProject",
      id: null,
      name,
      color,
      directory: safe,
    });
    const project = this.engine.data.projects.find((p) => !before.has(p.id));
    if (!project) fail(500, "项目创建失败");
    try {
      if (safe !== libraryRoot) this.putGrant(project.id, safe);
    } catch (error) {
      try {
        this.engine.applyAction({ type: "deleteProject", id: project.id });
      } catch {}
      throw error;
    }
    return { projectId: project.id, directory: safe };
  }
  rename(id, { name, color }) {
    const project = this.project(id);
    const old = this.mount(id);
    const libraryRoot = this.libraryRoot();
    if (libraryRoot !== null && old === libraryRoot)
      fail(
        400,
        "共享资料库本身不能通过项目改名移动；请先为项目单独授权一个子目录",
      );
    if (
      typeof name !== "string" ||
      !name ||
      name.length > 40 ||
      name === "." ||
      name === ".." ||
      /[\\/<>:"|?*\x00-\x1f]/.test(name) ||
      /[ .]$/.test(name)
    )
      fail(400, "项目名称不能作为安全的文件夹名称");
    if (name === project.name) {
      this.engine.applyAction({
        type: "saveProject",
        id,
        name,
        color,
        directory: null,
      });
      return { projectId: id, directory: old };
    }
    const target = join(dirname(old), name);
    if (existsSync(target)) fail(409, "目标资料目录已经存在，不会覆盖");
    noSymlinks(dirname(target));
    renameSync(old, target);
    try {
      this.putGrant(id, target);
      this.engine.applyAction({
        type: "renameProjectDirectory",
        id,
        name,
        color,
        directory: target,
      });
    } catch (error) {
      try {
        this.putGrant(id, old);
        renameSync(target, old);
      } catch (rollback) {
        fail(
          500,
          "项目改名失败且回退不完整；资料位于 " +
            target +
            "：" +
            rollback.message,
        );
      }
      throw error;
    }
    return { projectId: id, directory: target };
  }
  resolvePath(id, path) {
    const root = this.mount(id);
    const segments = safeRelative(path).split("/");
    const target = join(root, ...segments);
    try {
      noSymlinks(target, true);
    } catch (error) {
      if (error instanceof LibraryError) throw error;
      fail(403, "资料路径不可访问");
    }
    if (!inside(target, root)) fail(400, "资料路径越出项目目录");
    return target;
  }
  resolveFile(id, path) {
    const target = this.resolvePath(id, path);
    let info;
    try {
      info = statSync(target);
    } catch (error) {
      if (error.code === "ENOENT") fail(404, "资源文件不存在");
      throw error;
    }
    if (!info.isFile()) fail(400, "资源路径不是普通文件");
    return { path: target, sizeBytes: info.size };
  }
  /**
   * 共享库里的相对路径：与项目资料共用 safeRelative/noSymlinks/inside 规则，
   * 但不要求项目 ID——索引浏览的是整个共享库，不是某个项目的收窄目录。
   */
  resolveLibraryPath(path) {
    const root = this.libraryRoot();
    if (root === null) fail(403, "共享资料库尚未授权");
    const target = join(root, ...safeRelative(path).split("/"));
    try {
      noSymlinks(target, true);
    } catch (error) {
      if (error instanceof LibraryError) throw error;
      fail(403, "资料库路径不可访问");
    }
    if (!inside(target, root)) fail(400, "资料路径越出共享资料库");
    return target;
  }

  resolveLibraryFile(path) {
    const target = this.resolveLibraryPath(path);
    let info;
    try {
      info = statSync(target);
    } catch (error) {
      if (error.code === "ENOENT") fail(404, "资料文件不存在");
      throw error;
    }
    if (!info.isFile()) fail(400, "资料路径不是普通文件");
    return { path: target, sizeBytes: info.size };
  }

  /** 共享库文件的预览元数据；预览上限与项目资源一致（20 MiB）。 */
  libraryFileMetadata(path) {
    const file = this.resolveLibraryFile(path);
    const extension = basename(file.path).split(".").at(-1).toLowerCase();
    const mimeType = mimeTypeFor(extension);
    return {
      ...file,
      name: basename(file.path),
      mimeType,
      canPreview:
        file.sizeBytes <= PREVIEW_BYTES &&
        mimeType !== "application/octet-stream",
    };
  }

  resource(id) {
    if (!validId(id)) fail(400, "资源 ID 无效");
    const resource = this.engine.data.education.resources.find(
      (r) => r.id === id,
    );
    if (!resource) fail(404, "项目资源不存在");
    return resource;
  }
  metadata(id) {
    const resource = this.resource(id);
    const file = this.resolveFile(resource.projectId, resource.path);
    const extension = basename(file.path).split(".").at(-1).toLowerCase();
    const mimeType = mimeTypeFor(extension);
    return {
      ...file,
      name: basename(file.path),
      mimeType,
      canPreview:
        file.sizeBytes <= PREVIEW_BYTES &&
        mimeType !== "application/octet-stream",
      resource,
    };
  }
  list(
    projectId,
    { q = "", kind = "", status = "", offset = 0, limit = 40 } = {},
  ) {
    this.project(projectId);
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      fail(400, "分页参数无效");
    const needle = String(q).toLocaleLowerCase();
    const checked = status
      ? new Map(this.scan(projectId).resources.map((r) => [r.id, r.state]))
      : null;
    const resources = this.engine.data.education.resources.filter(
      (r) =>
        r.projectId === projectId &&
        (!kind || r.kind === kind) &&
        (!status || checked.get(r.id) === status) &&
        (!needle ||
          [r.title, r.path, r.source, r.edition, ...(r.topics ?? [])].some(
            (v) => String(v).toLocaleLowerCase().includes(needle),
          )),
    );
    resources.sort((a, b) => a.title.localeCompare(b.title));
    return {
      projectId,
      total: resources.length,
      offset,
      limit,
      resources: resources.slice(offset, offset + limit),
    };
  }
  scan(projectId) {
    this.project(projectId);
    let root = null;
    try {
      root = this.mount(projectId);
    } catch (error) {
      if (!(error instanceof LibraryError)) throw error;
    }
    const refs = this.engine.data.education.resourceReferenceIndex();
    const resources = this.engine.data.education.resources
      .filter((r) => r.projectId === projectId)
      .map((r) => {
        let state = "unavailable",
          detail = "项目目录未授权或已失联",
          sizeBytes = null;
        if (root) {
          try {
            const file = this.resolveFile(projectId, r.path);
            state = "available";
            detail = "";
            sizeBytes = file.sizeBytes;
          } catch (error) {
            state =
              error instanceof LibraryError && error.status === 404
                ? "missing"
                : "unavailable";
            detail = error.message;
          }
        }
        return {
          id: r.id,
          state,
          sizeBytes,
          detail,
          references: refs.get(r.id) ?? [],
        };
      });
    return { projectId, checkedAt: Math.floor(Date.now() / 1000), resources };
  }
  register(projectId, resource) {
    this.project(projectId);
    if (!resource || typeof resource !== "object" || Array.isArray(resource))
      fail(400, "资源字段无效");
    const entry = { ...resource, id: resource.id || randomUUID(), projectId };
    this.resolveFile(projectId, entry.path);
    this.engine.applyAction({
      type: "education",
      command: { op: "saveResource", resource: entry },
    });
    return entry;
  }
  /**
   * 按索引把一个项目的资料整批登记成 resources。
   *
   * 为什么要有批量入口：4,821 个文件逐条 saveResource 会让 plan.json 被重写
   * 4,821 次（每次都是整份原子写）；core 的 saveResources 让整批只落一次盘。
   * 直接读索引而不是重新遍历目录：索引是刚扫过的快照，文件在不在由它负责。
   *
   * `paths` 省略时按「顶层目录 → 项目」的映射取该项目对应的目录；显式传 paths
   * 时只登记这些路径（仍要求它们出现在索引里）。
   */
  importFromIndex(projectId, { paths = null, max = 5000 } = {}) {
    this.project(projectId);
    const root = this.mount(projectId);
    const index = readIndex(this.dataDir);
    if (!index || !Array.isArray(index.items))
      fail(409, "资料库索引尚未建立，请先扫描");
    if (index.root !== root) fail(409, "资料库索引属于另一个目录，请重新扫描");

    let candidates = index.items;
    if (Array.isArray(paths)) {
      const wanted = new Set(
        paths.filter((p) => typeof p === "string" && p !== ""),
      );
      if (wanted.size === 0) fail(400, "请选择要登记的资料");
      candidates = candidates.filter((item) => wanted.has(item.path));
      if (candidates.length !== wanted.size)
        fail(404, "有资料不在索引中，请先重新扫描");
    } else {
      const tops = [
        ...new Set(
          index.items.map((item) => item.path.split("/")[0]).filter(Boolean),
        ),
      ];
      const matched = topLevelsForProject(this.project(projectId), tops);
      if (matched !== null) {
        const allowed = new Set(matched);
        candidates = candidates.filter((item) =>
          allowed.has(item.path.split("/")[0]),
        );
      }
    }

    const existing = new Map(
      this.engine.data.education.resources
        .filter((r) => r.projectId === projectId)
        .map((r) => [r.path, r]),
    );
    const now = Math.floor(Date.now() / 1000);
    const resources = [];
    let skipped = 0;
    for (const item of candidates) {
      this.resolveFile(projectId, item.path); // 文件必须仍在授权目录内
      const current = existing.get(item.path);
      if (current !== undefined) {
        skipped += 1;
        continue;
      }
      if (resources.length >= max) fail(413, `一次最多登记 ${max} 条资料`);
      resources.push({
        id: randomUUID(),
        projectId,
        title: item.name.replace(/\.[^.]+$/, "") || item.name,
        kind: kindForExtension(item.ext),
        path: item.path,
        source: "",
        edition: "",
        topics: [],
      });
    }
    if (resources.length > 0) {
      this.engine.applyAction(
        { type: "education", command: { op: "saveResources", resources } },
        now,
      );
    }
    return {
      projectId,
      registered: resources.length,
      skipped,
      considered: candidates.length,
    };
  }

  repair(projectId, id, path) {
    const entry = this.resource(id);
    if (entry.projectId !== projectId) fail(404, "项目资源不存在");
    this.resolveFile(projectId, path);
    this.engine.applyAction({
      type: "education",
      command: { op: "saveResource", resource: { ...entry, path } },
    });
    return this.resource(id);
  }
  cleanup(projectId, ids = null) {
    this.project(projectId);
    if (ids !== null && (!Array.isArray(ids) || ids.some((id) => !validId(id))))
      fail(400, "资源 ID 列表无效");
    const states = this.scan(projectId).resources;
    const references = new Map(states.map((item) => [item.id, item]));
    const selected =
      ids ??
      states
        .filter((r) => r.state === "missing" && r.references.length === 0)
        .map((r) => r.id);
    for (const id of selected) {
      const state = references.get(id);
      if (!state || state.state !== "missing" || state.references.length > 0)
        fail(409, "只可清理仍缺失且没有教学引用的资源登记");
    }
    if (selected.length)
      this.engine.applyAction({
        type: "education",
        command: { op: "removeResources", ids: selected },
      });
    return { projectId, removed: selected.length, ids: selected };
  }
}
