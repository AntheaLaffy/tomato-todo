// 资料库索引：扫描 → 单独索引文件 → 浏览/搜索/流式读取。
//
// 为什么单独测这一层：索引不是计划、不是备份、也不是 education.resources；
// 它只描述授权目录里有什么。这里固定三件事——扫描跳过规则、索引文件权限与
// 原子写、以及 HTTP 端点只服务「当前授权根 + 索引里确实存在」的路径。
// 全部使用临时目录，不读写真实学习资料，也不启动 guard。
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { Engine } from "../src/engine.ts";
import { LibraryError, ProjectLibrary } from "../src/project-library.mjs";
import {
  DEFAULT_MAX_ENTRIES,
  directoryMatchScore,
  groupForExtension,
  matchTopLevelToProject,
  readIndex,
  scanLibrary,
  searchIndex,
  summarize,
  topLevelsForProject,
  writeIndex,
} from "../src/library-index.mjs";
import { startServer } from "../src/server.mjs";

function rejects(fn, status, pattern) {
  assert.throws(fn, (error) => {
    assert.ok(
      error instanceof LibraryError,
      `应为 LibraryError，实际 ${error}`,
    );
    assert.equal(error.status, status);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

function buildTree() {
  const root = mkdtempSync(join(tmpdir(), "tomato-index-"));
  const libraryRoot = join(root, "library");
  const outside = join(root, "outside");
  mkdirSync(join(libraryRoot, "math", "algebra"), { recursive: true });
  mkdirSync(join(libraryRoot, "eng"), { recursive: true });
  mkdirSync(join(libraryRoot, "408"), { recursive: true });
  mkdirSync(join(libraryRoot, "politics"), { recursive: true });
  mkdirSync(join(libraryRoot, "教学安排"), { recursive: true });
  mkdirSync(join(libraryRoot, ".hidden"), { recursive: true });
  mkdirSync(join(libraryRoot, "node_modules", "pkg"), { recursive: true });
  mkdirSync(join(libraryRoot, ".git"), { recursive: true });
  mkdirSync(join(libraryRoot, "deep", "a", "b", "c", "d", "e"), {
    recursive: true,
  });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, "secret.txt"), "outside");
  writeFileSync(join(libraryRoot, "math", "algebra", "lecture1.pdf"), "pdf");
  writeFileSync(join(libraryRoot, "math", "notes.md"), "# notes");
  writeFileSync(join(libraryRoot, "eng", "listening.mp3"), "mp3");
  writeFileSync(join(libraryRoot, "408", "2020真题.pdf"), "paper");
  writeFileSync(join(libraryRoot, "politics", "outline.docx"), "docx");
  writeFileSync(join(libraryRoot, "教学安排", "week1.md"), "week");
  writeFileSync(join(libraryRoot, ".hidden", "secret.pdf"), "hidden");
  writeFileSync(join(libraryRoot, ".hidden-root.txt"), "hidden");
  writeFileSync(join(libraryRoot, "node_modules", "pkg", "index.js"), "js");
  writeFileSync(join(libraryRoot, ".git", "config"), "git");
  writeFileSync(
    join(libraryRoot, "deep", "a", "b", "c", "d", "e", "f.txt"),
    "f",
  );
  symlinkSync(join(outside, "secret.txt"), join(libraryRoot, "link.pdf"));
  symlinkSync(outside, join(libraryRoot, "linkdir"));
  return { root, libraryRoot, outside };
}

const expectedPaths = [
  "408/2020真题.pdf",
  "deep/a/b/c/d/e/f.txt",
  "eng/listening.mp3",
  "math/algebra/lecture1.pdf",
  "math/notes.md",
  "politics/outline.docx",
  "教学安排/week1.md",
].sort();

test("扫描：递归、POSIX 相对路径、排序、跳过隐藏/符号链接/node_modules", async () => {
  const { libraryRoot } = buildTree();
  const index = await scanLibrary(libraryRoot);
  assert.equal(index.root, libraryRoot);
  assert.equal(index.truncated, false);
  assert.equal(index.count, expectedPaths.length);
  assert.deepEqual(
    index.items.map((item) => item.path),
    expectedPaths,
  );
  assert.equal(
    index.items.every((item) => !item.path.includes("\\")),
    true,
  );
  const pdf = index.items.find(
    (item) => item.path === "math/algebra/lecture1.pdf",
  );
  assert.deepEqual(
    { name: pdf.name, ext: pdf.ext, sizeBytes: pdf.sizeBytes },
    { name: "lecture1.pdf", ext: "pdf", sizeBytes: 3 },
  );
  assert.equal(Number.isInteger(pdf.mtime) && pdf.mtime > 0, true);
  assert.equal(
    index.items.some((item) => item.path.startsWith(".")),
    false,
  );
  assert.equal(
    index.items.some((item) => item.path.includes("node_modules")),
    false,
  );
  assert.equal(
    index.items.some((item) => item.path.includes(".git")),
    false,
  );
  assert.equal(
    index.items.some((item) => item.path === "link.pdf"),
    false,
  );
  assert.equal(
    index.items.some((item) => item.path.startsWith("linkdir")),
    false,
  );
});

test("扫描：条目上限与耗时上限都会标记 truncated", async () => {
  const { libraryRoot } = buildTree();
  const limited = await scanLibrary(libraryRoot, { maxEntries: 2 });
  assert.equal(limited.count, 2);
  assert.equal(limited.truncated, true);
  assert.equal(
    limited.items.every((item) => expectedPaths.includes(item.path)),
    true,
  );
  assert.deepEqual(
    limited.items.map((item) => item.path),
    limited.items.map((item) => item.path).sort(),
  );

  const timed = await scanLibrary(libraryRoot, { maxMs: -1 });
  assert.equal(timed.count, 0);
  assert.equal(timed.truncated, true);
  assert.deepEqual(timed.items, []);
  assert.ok(DEFAULT_MAX_ENTRIES >= 50000);
});

test("扫描：相对路径、符号链接根、文件根都被拒", async () => {
  const { libraryRoot, outside } = buildTree();
  await assert.rejects(
    () => scanLibrary("relative/path"),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );
  symlinkSync(libraryRoot, join(outside, "link-root"));
  await assert.rejects(
    () => scanLibrary(join(outside, "link-root")),
    (error) => error.status === 400,
  );
  await assert.rejects(
    () => scanLibrary(join(libraryRoot, "math", "notes.md")),
    (error) => error.status === 400,
  );
});

test("索引文件：0600、原子写、可重写、损坏时拒绝读取", async () => {
  const { root, libraryRoot } = buildTree();
  const dataDir = join(root, "data");
  const index = await scanLibrary(libraryRoot);
  const written = writeIndex(dataDir, index);
  assert.equal(written.count, expectedPaths.length);
  const file = join(dataDir, "library-index.json");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(
    readdirSync(dataDir).some((name) => name.includes(".tmp-")),
    false,
  );
  const loaded = readIndex(dataDir);
  assert.deepEqual(loaded, {
    root: index.root,
    scannedAt: index.scannedAt,
    count: index.count,
    items: index.items,
  });
  const raw = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(raw).sort(), [
    "count",
    "items",
    "root",
    "scannedAt",
  ]);

  const second = await scanLibrary(libraryRoot, { maxEntries: 3 });
  writeIndex(dataDir, second);
  assert.equal(readIndex(dataDir).count, 3);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(
    readdirSync(dataDir).some((name) => name.includes(".tmp-")),
    false,
  );

  writeFileSync(file, "{ not json");
  rejects(() => readIndex(dataDir), 500, /损坏|格式/);
  assert.equal(readIndex(join(root, "empty")), null);
  rejects(
    () => writeIndex(dataDir, { root: libraryRoot, scannedAt: 1, items: [{}] }),
    400,
  );
});

function memoryIndex() {
  const items = [
    ["math/algebra/lecture1.pdf", "lecture1.pdf", "pdf", 10],
    ["math/notes.md", "notes.md", "md", 20],
    ["eng/listening.mp3", "listening.mp3", "mp3", 30],
    ["politics/outline.docx", "outline.docx", "docx", 40],
    ["408/2020真题.pdf", "2020真题.pdf", "pdf", 50],
    ["教学安排/cover.png", "cover.png", "png", 60],
    ["other/tool.swf", "tool.swf", "swf", 70],
  ].map(([path, name, ext, sizeBytes]) => ({
    path,
    name,
    ext,
    sizeBytes,
    mtime: 1_700_000_000,
  }));
  const sorted = items.sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    root: "/tmp/library",
    scannedAt: 1_700_000_000,
    count: sorted.length,
    items: sorted,
  };
}

test("搜索：关键词、类型组、扩展名、分页与空索引", () => {
  const index = memoryIndex();
  assert.deepEqual(
    searchIndex(index, { q: "408" }).items.map((item) => item.path),
    ["408/2020真题.pdf"],
  );
  assert.equal(searchIndex(index, { q: "MATH" }).total, 2);
  assert.equal(searchIndex(index, { kind: "pdf" }).total, 2);
  assert.equal(searchIndex(index, { kind: "image" }).total, 1);
  assert.equal(searchIndex(index, { kind: "audio" }).total, 1);
  assert.equal(searchIndex(index, { kind: "doc" }).total, 2);
  assert.equal(searchIndex(index, { kind: "docx" }).total, 1);
  assert.equal(searchIndex(index, { kind: "other" }).total, 1);
  assert.equal(searchIndex(index, { kind: "swf" }).total, 1);
  assert.equal(searchIndex(index, { kind: "missing" }).total, 0);
  const page = searchIndex(index, { offset: 1, limit: 2 });
  assert.equal(page.total, index.count);
  assert.deepEqual(
    page.items.map((item) => item.path),
    ["eng/listening.mp3", "math/algebra/lecture1.pdf"],
  );
  assert.equal(searchIndex(index, { q: "nothing" }).total, 0);
  assert.equal(searchIndex(null, { q: "math" }).total, 0);
  rejects(() => searchIndex(index, { offset: -1 }), 400, /分页/);
  rejects(() => searchIndex(index, { limit: 101 }), 400, /分页/);
});

test("摘要：按扩展名、浏览分组与顶层目录计数", () => {
  const summary = summarize(memoryIndex());
  assert.equal(summary.count, 7);
  assert.equal(summary.byExt.pdf, 2);
  assert.equal(summary.byExt.swf, 1);
  assert.equal(summary.byKind.pdf, 2);
  assert.equal(summary.byKind.doc, 2);
  assert.equal(summary.byTop.math, 2);
  assert.equal(summary.byTop["教学安排"], 1);
  const empty = summarize(null);
  assert.deepEqual(empty, {
    root: null,
    scannedAt: null,
    count: 0,
    byExt: {},
    byKind: {},
    byTop: {},
  });
  assert.equal(groupForExtension("PNG"), "image");
});

test("顶层目录 → 项目映射：示例目录都能对上，匹配不到返回 null", () => {
  const projects = [
    { name: "数学一" },
    { name: "英语一" },
    { name: "408" },
    { name: "政治" },
    { name: "教学安排" },
  ];
  assert.equal(matchTopLevelToProject("math", projects)?.name, "数学一");
  assert.equal(matchTopLevelToProject("eng", projects)?.name, "英语一");
  assert.equal(matchTopLevelToProject("408", projects)?.name, "408");
  assert.equal(matchTopLevelToProject("politics", projects)?.name, "政治");
  assert.equal(matchTopLevelToProject("教学安排", projects)?.name, "教学安排");
  assert.equal(matchTopLevelToProject("random", projects), null);
  assert.ok(directoryMatchScore("math", "数学一") > 0);
  assert.equal(directoryMatchScore("math", "物理"), 0);
  assert.deepEqual(
    topLevelsForProject({ name: "数学一" }, [
      "math",
      "eng",
      "408",
      "politics",
      "教学安排",
    ]),
    ["math"],
  );
  assert.equal(
    topLevelsForProject({ name: "物理" }, ["math", "eng", "408"]),
    null,
  );
});

function serverFixture() {
  const root = mkdtempSync(join(tmpdir(), "tomato-index-http-"));
  const dataDir = join(root, "data");
  const exam = join(root, "exam");
  const outside = join(root, "outside");
  mkdirSync(join(exam, "math", "algebra"), { recursive: true });
  mkdirSync(join(exam, "eng"), { recursive: true });
  mkdirSync(join(exam, "408"), { recursive: true });
  mkdirSync(join(exam, "politics"), { recursive: true });
  mkdirSync(join(exam, "教学安排"), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(exam, "math", "notes.md"), "# notes");
  writeFileSync(join(exam, "math", "swap.txt"), "real");
  writeFileSync(join(exam, "math", "algebra", "lecture1.pdf"), "pdf");
  writeFileSync(join(exam, "eng", "listening.mp3"), "mp3");
  writeFileSync(join(exam, "408", "2020真题.pdf"), "paper");
  writeFileSync(join(exam, "politics", "outline.docx"), "docx");
  writeFileSync(join(exam, "教学安排", "week1.md"), "week");
  writeFileSync(join(exam, "other.swf"), "swf");
  writeFileSync(join(outside, "secret.txt"), "outside");
  const engine = Engine.open(dataDir);
  return { root, dataDir, exam, outside, engine };
}

/** 用独立 socket 发 POST，避免 fetch 连接池把两个扫描请求排成串行。 */
function postScan(port) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: "/api/library/scan",
        method: "POST",
        headers: { "Content-Length": 0 },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function startLibraryServer(fixture) {
  const started = await startServer({
    engine: fixture.engine,
    dataDir: fixture.dataDir,
    host: "127.0.0.1",
    port: 0,
    token: "index-token",
    version: "0.0.0-test",
  });
  const base = `http://127.0.0.1:${started.port}`;
  const json = async (path, init = {}) => {
    const res = await fetch(base + path, init);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body, headers: res.headers };
  };
  const waitForIndex = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const stats = await json("/api/library/stats");
      if (stats.body.hasIndex) return stats.body;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("等待索引超时");
  };
  return { started, base, port: started.port, json, waitForIndex };
}

test("HTTP：授权后自动扫描，索引不写进 resources / 计划 / 备份", async () => {
  const fixture = serverFixture();
  const { started, json, waitForIndex } = await startLibraryServer(fixture);
  try {
    let res = await json("/api/library/stats");
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, false);
    assert.equal(res.body.hasIndex, false);
    assert.equal(res.body.count, 0);

    res = await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: fixture.exam }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, true);

    const stats = await waitForIndex();
    assert.equal(stats.count, 8);
    assert.equal(stats.byTop.math, 3);
    assert.equal(stats.byTop["教学安排"], 1);
    assert.ok(stats.scannedAt > 0);

    // 扫描只建索引：教学资源仍是空的，计划/备份里也没有索引。
    assert.equal(fixture.engine.data.education.resources.length, 0);
    const plan = JSON.stringify(
      fixture.engine.exportPlan(Math.floor(Date.now() / 1000)),
    );
    const backup = JSON.stringify(
      fixture.engine.exportBackup(Math.floor(Date.now() / 1000)),
    );
    assert.equal(plan.includes("library-index"), false);
    assert.equal(backup.includes("library-index"), false);
    assert.equal(plan.includes("2020真题"), false);

    const indexFile = join(fixture.dataDir, "library-index.json");
    assert.equal(statSync(indexFile).mode & 0o777, 0o600);
    assert.ok(statSync(indexFile).size > 0);
  } finally {
    await started.close();
    fixture.engine.flushNow();
  }
});

test("HTTP：items 搜索/分页/项目目录过滤，stats 与 scan 摘要一致", async () => {
  const fixture = serverFixture();
  const { started, json, waitForIndex } = await startLibraryServer(fixture);
  try {
    await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: fixture.exam }),
    });
    const stats = await waitForIndex();
    const library = new ProjectLibrary(fixture.engine, fixture.dataDir);
    const mathProject = library.create({ name: "数学一", color: "#b8503f" });
    const physicsProject = library.create({ name: "物理", color: "#5f7b50" });

    let res = await json("/api/library/items?q=408");
    assert.equal(res.status, 200);
    assert.equal(res.body.hasIndex, true);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].path, "408/2020真题.pdf");
    assert.equal(res.body.items[0].kind, "pdf");
    assert.equal(res.body.items[0].previewable, true);

    res = await json("/api/library/items?kind=pdf");
    assert.equal(res.body.total, 2);
    assert.equal(
      res.body.items.every((item) => item.kind === "pdf"),
      true,
    );

    res = await json("/api/library/items?offset=1&limit=2");
    assert.equal(res.body.total, 8);
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.offset, 1);
    assert.equal(res.body.limit, 2);

    res = await json(`/api/library/items?projectId=${mathProject.projectId}`);
    assert.equal(res.body.filtered, true);
    assert.deepEqual(res.body.matchedDirs, ["math"]);
    assert.equal(res.body.total, 3);
    assert.equal(
      res.body.items.every((item) => item.path.startsWith("math/")),
      true,
    );

    res = await json(
      `/api/library/items?projectId=${physicsProject.projectId}`,
    );
    assert.equal(res.body.filtered, false);
    assert.deepEqual(res.body.matchedDirs, []);
    assert.equal(res.body.total, stats.count);

    res = await json("/api/library/items?limit=101");
    assert.equal(res.status, 400);

    res = await json("/api/library/scan", { method: "POST" });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasIndex, true);
    assert.equal(res.body.count, stats.count);
    assert.equal(res.body.truncated, false);
    assert.equal(Number.isInteger(res.body.durationMs), true);
    assert.equal(res.body.byExt.pdf, 2);
  } finally {
    await started.close();
    fixture.engine.flushNow();
  }
});

test("HTTP：扫描并发保护，同一时刻只跑一次", async () => {
  const fixture = serverFixture();
  mkdirSync(join(fixture.exam, "bulk"), { recursive: true });
  for (let i = 0; i < 1200; i += 1)
    writeFileSync(join(fixture.exam, "bulk", `file-${i}.txt`), "x");
  const { started, port, json, waitForIndex } =
    await startLibraryServer(fixture);
  try {
    await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: fixture.exam }),
    });
    await waitForIndex();
    const [a, b] = await Promise.all([postScan(port), postScan(port)]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    // 第二次等待同一次扫描：两边的 scannedAt / durationMs / count 必须一致。
    assert.equal(a.body.scannedAt, b.body.scannedAt);
    assert.equal(a.body.durationMs, b.body.durationMs);
    assert.equal(a.body.count, 1208);
    assert.equal(b.body.count, 1208);
  } finally {
    await started.close();
    fixture.engine.flushNow();
  }
});

test("HTTP：文件流式读取、Range、非索引/越界/符号链接被拒", async () => {
  const fixture = serverFixture();
  const { started, base, json, waitForIndex } =
    await startLibraryServer(fixture);
  try {
    await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: fixture.exam }),
    });
    await waitForIndex();
    const token = (await json("/api/file-token")).body.access;
    const url = (path, extra = "") =>
      `${base}/api/library/file?path=${encodeURIComponent(path)}&access=${token}${extra}`;

    let res = await fetch(url("math/notes.md"));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "# notes");
    assert.match(res.headers.get("content-type"), /text\/plain/);
    assert.equal(res.headers.get("accept-ranges"), "bytes");

    res = await fetch(url("math/notes.md"), {
      headers: { Range: "bytes=0-1" },
    });
    assert.equal(res.status, 206);
    assert.equal(await res.text(), "# ");
    assert.equal(res.headers.get("content-range"), "bytes 0-1/7");

    res = await fetch(url("math/notes.md", "&download=1"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /attachment/);

    assert.equal((await fetch(url("../outside/secret.txt"))).status, 400);
    assert.equal((await fetch(url("/etc/passwd"))).status, 400);
    assert.equal((await fetch(url("math/not-indexed.txt"))).status, 404);

    // 索引之后把普通文件换成库外符号链接：即使路径在索引里也拒绝。
    unlinkSync(join(fixture.exam, "math", "swap.txt"));
    symlinkSync(
      join(fixture.outside, "secret.txt"),
      join(fixture.exam, "math", "swap.txt"),
    );
    assert.equal((await fetch(url("math/swap.txt"))).status, 400);

    res = await fetch(url("other.swf"));
    assert.equal(res.status, 413);
    res = await fetch(url("other.swf", "&download=1"));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "swf");
  } finally {
    await started.close();
    fixture.engine.flushNow();
  }
});

test("HTTP：索引属于旧目录时不再对外提供，stats 标记 stale", async () => {
  const fixture = serverFixture();
  const { started, json, waitForIndex } = await startLibraryServer(fixture);
  try {
    await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: fixture.exam }),
    });
    await waitForIndex();
    const oldIndex = readIndex(fixture.dataDir);
    const other = join(fixture.root, "other-exam");
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, "new.md"), "new");
    await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: other }),
    });
    // 等授权后的自动扫描落地，避免它稍后覆盖我们人为放回的旧索引。
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await json("/api/library/stats");
      if (current.body.hasIndex && current.body.root === other) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    // 人为把旧目录的索引放回去，模拟「授权已换、索引还没重扫」。
    writeIndex(fixture.dataDir, oldIndex);
    const stats = await json("/api/library/stats");
    assert.equal(stats.body.hasIndex, false);
    assert.equal(stats.body.stale, true);
    assert.equal(stats.body.count, 0);
    const res = await json("/api/library/items");
    assert.equal(res.body.hasIndex, false);
    assert.equal(res.body.total, 0);
  } finally {
    await started.close();
    fixture.engine.flushNow();
  }
});
