// 项目资料只通过本机授权读取。授权独立于计划/备份；资料原件永不由清理操作删除。
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, resolve, sep } from "node:path";

const PREVIEW_BYTES = 20 * 1024 * 1024;
const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", txt: "text/plain; charset=utf-8", log: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", markdown: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", json: "text/plain; charset=utf-8" };

export class LibraryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new LibraryError(status, message); };
const inside = (child, root) => child === root || child.startsWith(root + sep);
const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;

function noSymlinks(path, allowMissing = false) {
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let info;
    try { info = lstatSync(current); }
    catch (error) {
      if (allowMissing && error.code === "ENOENT") return;
      throw error;
    }
    if (info.isSymbolicLink()) fail(400, "项目资料路径不能经过符号链接");
  }
}

function safeRelative(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") || isAbsolute(path) || path.split("/").some((p) => !p || p === "." || p === "..")) {
    fail(400, "资料路径必须是安全的项目相对路径");
  }
  return path;
}

function readGrants(dataDir) {
  const file = join(dataDir, "project-grants.json");
  if (!existsSync(file)) return [];
  let value;
  try { value = JSON.parse(readFileSync(file, "utf8")); }
  catch { fail(500, "项目授权文件读取失败；未授予任何资料权限"); }
  if (!Array.isArray(value) || value.some((g) => !g || !validId(g.projectId) || typeof g.directory !== "string" || !isAbsolute(g.directory))) {
    fail(500, "项目授权文件格式无效；未授予任何资料权限");
  }
  return value;
}

function writeGrants(dataDir, grants) {
  const file = join(dataDir, "project-grants.json");
  mkdirSync(dataDir, { recursive: true });
  const temp = file + ".tmp-" + process.pid + "-" + randomUUID();
  try {
    writeFileSync(temp, JSON.stringify(grants, null, 2), { mode: 0o600, flag: "wx" });
    renameSync(temp, file);
  } catch (error) {
    try { if (existsSync(temp)) unlinkSync(temp); } catch {}
    throw error;
  }
}

export function validateResourceAction(dataDir, data, action) {
  if (action?.type !== "education" || action.command?.op !== "saveResource") return;
  const resource = action.command.resource;
  const library = new ProjectLibrary({ data }, dataDir);
  library.resolveFile(resource?.projectId, resource?.path);
}

export class ProjectLibrary {
  constructor(engine, dataDir) { this.engine = engine; this.dataDir = dataDir; }

  project(id) {
    if (!validId(id)) fail(400, "项目 ID 无效");
    const project = this.engine.data.projects.find((p) => p.id === id);
    if (!project) fail(404, "项目不存在");
    return project;
  }
  profile(id) { return this.engine.data.education.projects.find((p) => p.projectId === id); }
  grants() { return readGrants(this.dataDir); }
  putGrant(id, directory) {
    const grants = this.grants().filter((g) => g.projectId !== id);
    if (directory) grants.push({ projectId: id, directory });
    writeGrants(this.dataDir, grants);
  }
  validateDirectory(requested, projectId = null) {
    if (typeof requested !== "string" || !isAbsolute(requested)) fail(400, "请选择已存在的绝对目录");
    let directory;
    try {
      noSymlinks(resolve(requested));
      if (!statSync(requested).isDirectory()) fail(400, "请选择已存在的绝对目录");
      directory = realpathSync(requested);
    } catch (error) {
      if (error instanceof LibraryError) throw error;
      fail(400, "请选择已存在且不是符号链接的绝对目录");
    }
    const internal = realpathSync(this.dataDir);
    const home = realpathSync(homedir());
    if (directory === parse(directory).root || directory === home || inside(internal, directory) || inside(directory, internal)) {
      fail(400, "请选择专用资料目录，不能授权根目录、整个主目录或应用内部目录");
    }
    for (const grant of this.grants()) {
      if (grant.projectId !== projectId && this.engine.data.projects.some((p) => p.id === grant.projectId) && (inside(directory, grant.directory) || inside(grant.directory, directory))) {
        fail(400, "不同项目的授权目录不能重叠");
      }
    }
    return directory;
  }
  mount(id) {
    this.project(id);
    const profile = this.profile(id);
    const grant = this.grants().find((g) => g.projectId === id);
    if (!profile || !grant || profile.directory !== grant.directory) fail(403, "项目目录尚未由用户授权，或绑定与授权不一致");
    try { return this.validateDirectory(grant.directory, id); }
    catch (error) { if (error instanceof LibraryError) fail(403, "项目目录已失联或不再安全，请重新授权"); throw error; }
  }
  grantStatus(id) {
    this.project(id);
    try { return { projectId: id, authorized: true, directory: this.mount(id) }; }
    catch (error) { if (error instanceof LibraryError) return { projectId: id, authorized: false, directory: this.profile(id)?.directory ?? null, reason: error.message }; throw error; }
  }
  bind(id, requested) {
    this.project(id);
    const directory = this.validateDirectory(requested, id);
    const old = this.grants().find((g) => g.projectId === id)?.directory ?? null;
    const profile = this.profile(id) ?? { projectId: id, directory: "", examMode: false, visionId: null, target: "", examDate: null, syllabusId: null, pastPaperIds: [], mockPaperIds: [] };
    this.putGrant(id, directory);
    try { this.engine.applyAction({ type: "education", command: { op: "saveProject", project: { ...profile, directory } } }); }
    catch (error) { this.putGrant(id, old); throw error; }
    return this.grantStatus(id);
  }
  create({ name, color, directory }) {
    const safe = this.validateDirectory(directory);
    const before = new Set(this.engine.data.projects.map((p) => p.id));
    this.engine.applyAction({ type: "saveProject", id: null, name, color, directory: safe });
    const project = this.engine.data.projects.find((p) => !before.has(p.id));
    if (!project) fail(500, "项目创建失败");
    try { this.putGrant(project.id, safe); }
    catch (error) {
      try { this.engine.applyAction({ type: "deleteProject", id: project.id }); } catch {}
      throw error;
    }
    return { projectId: project.id, directory: safe };
  }
  rename(id, { name, color }) {
    const project = this.project(id);
    const old = this.mount(id);
    if (typeof name !== "string" || !name || name.length > 40 || name === "." || name === ".." || /[\\/<>:"|?*\x00-\x1f]/.test(name) || /[ .]$/.test(name)) fail(400, "项目名称不能作为安全的文件夹名称");
    if (name === project.name) {
      this.engine.applyAction({ type: "saveProject", id, name, color, directory: null });
      return { projectId: id, directory: old };
    }
    const target = join(dirname(old), name);
    if (existsSync(target)) fail(409, "目标资料目录已经存在，不会覆盖");
    noSymlinks(dirname(target));
    renameSync(old, target);
    try {
      this.putGrant(id, target);
      this.engine.applyAction({ type: "renameProjectDirectory", id, name, color, directory: target });
    } catch (error) {
      try { this.putGrant(id, old); renameSync(target, old); }
      catch (rollback) { fail(500, "项目改名失败且回退不完整；资料位于 " + target + "：" + rollback.message); }
      throw error;
    }
    return { projectId: id, directory: target };
  }
  resolvePath(id, path) {
    const root = this.mount(id);
    const segments = safeRelative(path).split("/");
    const target = join(root, ...segments);
    try { noSymlinks(target, true); }
    catch (error) { if (error instanceof LibraryError) throw error; fail(403, "资料路径不可访问"); }
    if (!inside(target, root)) fail(400, "资料路径越出项目目录");
    return target;
  }
  resolveFile(id, path) {
    const target = this.resolvePath(id, path);
    let info;
    try { info = statSync(target); }
    catch (error) { if (error.code === "ENOENT") fail(404, "资源文件不存在"); throw error; }
    if (!info.isFile()) fail(400, "资源路径不是普通文件");
    return { path: target, sizeBytes: info.size };
  }
  resource(id) {
    if (!validId(id)) fail(400, "资源 ID 无效");
    const resource = this.engine.data.education.resources.find((r) => r.id === id);
    if (!resource) fail(404, "项目资源不存在");
    return resource;
  }
  metadata(id) {
    const resource = this.resource(id);
    const file = this.resolveFile(resource.projectId, resource.path);
    const extension = basename(file.path).split(".").at(-1).toLowerCase();
    const mimeType = MIME[extension] ?? "application/octet-stream";
    return { ...file, name: basename(file.path), mimeType, canPreview: file.sizeBytes <= PREVIEW_BYTES && mimeType !== "application/octet-stream", resource };
  }
  list(projectId, { q = "", kind = "", status = "", offset = 0, limit = 40 } = {}) {
    this.project(projectId);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, "分页参数无效");
    const needle = String(q).toLocaleLowerCase();
    const checked = status ? new Map(this.scan(projectId).resources.map((r) => [r.id, r.state])) : null;
    const resources = this.engine.data.education.resources.filter((r) => r.projectId === projectId && (!kind || r.kind === kind) && (!status || checked.get(r.id) === status) && (!needle || [r.title, r.path, r.source, r.edition, ...(r.topics ?? [])].some((v) => String(v).toLocaleLowerCase().includes(needle))));
    resources.sort((a, b) => a.title.localeCompare(b.title));
    return { projectId, total: resources.length, offset, limit, resources: resources.slice(offset, offset + limit) };
  }
  scan(projectId) {
    this.project(projectId);
    let root = null;
    try { root = this.mount(projectId); } catch (error) { if (!(error instanceof LibraryError)) throw error; }
    const refs = this.engine.data.education.resourceReferenceIndex();
    const resources = this.engine.data.education.resources.filter((r) => r.projectId === projectId).map((r) => {
      let state = "unavailable", detail = "项目目录未授权或已失联", sizeBytes = null;
      if (root) {
        try {
          const file = this.resolveFile(projectId, r.path);
          state = "available"; detail = ""; sizeBytes = file.sizeBytes;
        } catch (error) {
          state = error instanceof LibraryError && error.status === 404 ? "missing" : "unavailable";
          detail = error.message;
        }
      }
      return { id: r.id, state, sizeBytes, detail, references: refs.get(r.id) ?? [] };
    });
    return { projectId, checkedAt: Math.floor(Date.now() / 1000), resources };
  }
  register(projectId, resource) {
    this.project(projectId);
    if (!resource || typeof resource !== "object" || Array.isArray(resource)) fail(400, "资源字段无效");
    const entry = { ...resource, id: resource.id || randomUUID(), projectId };
    this.resolveFile(projectId, entry.path);
    this.engine.applyAction({ type: "education", command: { op: "saveResource", resource: entry } });
    return entry;
  }
  repair(projectId, id, path) {
    const entry = this.resource(id);
    if (entry.projectId !== projectId) fail(404, "项目资源不存在");
    this.resolveFile(projectId, path);
    this.engine.applyAction({ type: "education", command: { op: "saveResource", resource: { ...entry, path } } });
    return this.resource(id);
  }
  cleanup(projectId, ids = null) {
    this.project(projectId);
    if (ids !== null && (!Array.isArray(ids) || ids.some((id) => !validId(id)))) fail(400, "资源 ID 列表无效");
    const states = this.scan(projectId).resources;
    const references = new Map(states.map((item) => [item.id, item]));
    const selected = ids ?? states.filter((r) => r.state === "missing" && r.references.length === 0).map((r) => r.id);
    for (const id of selected) {
      const state = references.get(id);
      if (!state || state.state !== "missing" || state.references.length > 0) fail(409, "只可清理仍缺失且没有教学引用的资源登记");
    }
    if (selected.length) this.engine.applyAction({ type: "education", command: { op: "removeResources", ids: selected } });
    return { projectId, removed: selected.length, ids: selected };
  }
}
