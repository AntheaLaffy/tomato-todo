// 共享资料库授权：一次授权整个目录，所有应试项目默认共用；项目单独授权
// 只能收窄到它里面的子目录。这里同时覆盖目录安全校验与 HTTP 端点，
// 并确认项目级授权/取消共享后的回落行为。
//
// 只用临时目录；不读写真实学习资料，也不启动 guard（startServer 只在
// /health、/api/state 等端点探测 guard，本文件的端点不碰它）。
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.ts";
import { LibraryError, ProjectLibrary } from "../src/project-library.mjs";
import { startServer, UI_ORIGIN } from "../src/server.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tomato-library-"));
  const dataDir = join(root, "data");
  const exam = join(root, "exam");
  const other = join(root, "other");
  mkdirSync(join(exam, "math"), { recursive: true });
  mkdirSync(other, { recursive: true });
  const engine = Engine.open(dataDir);
  return {
    root,
    dataDir,
    exam,
    other,
    engine,
    library: new ProjectLibrary(engine, dataDir),
  };
}

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

test("共享资料库授权后，多个项目默认挂载同一目录", () => {
  const { exam, engine, library } = fixture();
  const status = library.authorizeLibrary(exam, 1_800_000_000_000);
  assert.equal(status.authorized, true);
  assert.equal(status.directory, exam);
  assert.equal(status.projects, 0);
  assert.equal(status.grantedAt, 1_800_000_000);

  const math = library.create({ name: "数学", color: "#b8503f" });
  const english = library.create({ name: "英语", color: "#5f7b50" });
  const politics = library.create({ name: "政治", color: "#a87b2d" });

  for (const project of [math, english, politics])
    assert.equal(library.mount(project.projectId), exam);
  const after = library.libraryStatus();
  assert.equal(after.projects, 3);
  assert.deepEqual(
    after.sharedProjects.sort(),
    [math.projectId, english.projectId, politics.projectId].sort(),
  );
  for (const project of [math, english, politics]) {
    const grant = library.grantStatus(project.projectId);
    assert.equal(grant.authorized, true);
    assert.equal(grant.shared, true);
    assert.equal(grant.directory, exam);
  }
  engine.flushNow();
});

test("共享库授权文件是 0600，且只写目录与授权时刻", () => {
  const { dataDir, exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const file = join(dataDir, "library-grant.json");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), {
    directory: exam,
    grantedAt: 1_800_000_000,
  });
  engine.flushNow();
});

test("项目单独授权在共享库内的子目录通过，并收窄读取范围", () => {
  const { exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const project = library.create({ name: "数学", color: "#b8503f" });
  writeFileSync(join(exam, "root.txt"), "root");
  writeFileSync(join(exam, "math", "book.pdf"), "book");

  const grant = library.bind(project.projectId, join(exam, "math"));
  assert.equal(grant.authorized, true);
  assert.equal(grant.directory, join(exam, "math"));
  assert.equal(grant.shared, false);
  assert.equal(library.mount(project.projectId), join(exam, "math"));
  assert.equal(
    library.resolveFile(project.projectId, "book.pdf").path,
    join(exam, "math", "book.pdf"),
  );
  rejects(
    () => library.resolveFile(project.projectId, "../root.txt"),
    400,
    /越|安全/,
  );
  engine.flushNow();
});

test("项目单独授权在共享库外被拒", () => {
  const { exam, other, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const project = library.create({ name: "数学", color: "#b8503f" });
  rejects(() => library.bind(project.projectId, other), 400, /共享资料库内/);
  engine.flushNow();
});

test("项目单独授权指向共享库根目录等价于使用共享库，不落项目级授权", () => {
  const { dataDir, exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const narrow = library.create({ name: "数学", color: "#b8503f" });
  library.bind(narrow.projectId, join(exam, "math"));
  const project = library.create({ name: "英语", color: "#5f7b50" });
  const grant = library.bind(project.projectId, exam);
  assert.equal(grant.authorized, true);
  assert.equal(grant.shared, true);

  const grants = JSON.parse(
    readFileSync(join(dataDir, "project-grants.json"), "utf8"),
  );
  assert.equal(
    grants.some((item) => item.projectId === project.projectId),
    false,
  );
  assert.equal(library.mount(project.projectId), exam);
  // 共享根目录与别的项目子目录天然重叠，也必须能直接创建/使用。
  const physics = library.create({
    name: "物理",
    color: "#a87b2d",
    directory: exam,
  });
  assert.equal(library.mount(physics.projectId), exam);
  engine.flushNow();
});

test("共享库目录是符号链接时被拒", () => {
  const { root, exam, engine, library } = fixture();
  const link = join(root, "exam-link");
  symlinkSync(exam, link);
  rejects(
    () => library.authorizeLibrary(link, 1_800_000_000_000),
    400,
    /符号链接/,
  );
  engine.flushNow();
});

test("共享库不能是根目录、主目录或应用数据目录", () => {
  const { dataDir, engine, library } = fixture();
  rejects(
    () => library.authorizeLibrary("/", 1_800_000_000_000),
    400,
    /根目录|主目录|应用内部/,
  );
  rejects(
    () => library.authorizeLibrary(homedir(), 1_800_000_000_000),
    400,
    /根目录|主目录|应用内部/,
  );
  rejects(
    () => library.authorizeLibrary(dataDir, 1_800_000_000_000),
    400,
    /根目录|主目录|应用内部/,
  );
  engine.flushNow();
});

test("共享库必须是已存在的绝对目录", () => {
  const { root, exam, engine, library } = fixture();
  rejects(
    () => library.authorizeLibrary("exam", 1_800_000_000_000),
    400,
    /绝对目录/,
  );
  rejects(
    () => library.authorizeLibrary(join(root, "missing"), 1_800_000_000_000),
    400,
    /绝对目录/,
  );
  writeFileSync(join(root, "file.txt"), "x");
  rejects(
    () => library.authorizeLibrary(join(root, "file.txt"), 1_800_000_000_000),
    400,
    /绝对目录/,
  );
  assert.equal(library.libraryStatus().authorized, false);
  engine.flushNow();
});

test("读文件仍拒绝 ../ 越界、绝对路径与目录内符号链接", () => {
  const { exam, other, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const project = library.create({ name: "数学", color: "#b8503f" });
  writeFileSync(join(exam, "math", "ok.txt"), "ok");
  writeFileSync(join(other, "secret.txt"), "secret");
  symlinkSync(join(other, "secret.txt"), join(exam, "math", "link.txt"));

  assert.equal(
    library.resolveFile(project.projectId, "math/ok.txt").path,
    join(exam, "math", "ok.txt"),
  );
  rejects(
    () => library.resolveFile(project.projectId, "../other/secret.txt"),
    400,
    /安全/,
  );
  rejects(
    () => library.resolveFile(project.projectId, "/etc/passwd"),
    400,
    /安全/,
  );
  rejects(
    () => library.resolveFile(project.projectId, "math/link.txt"),
    400,
    /符号链接/,
  );
  engine.flushNow();
});

test("取消共享授权后，无单独授权的项目回落 403，单独授权保留", () => {
  const { dataDir, exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const shared = library.create({ name: "408", color: "#5f7b50" });
  const narrow = library.create({ name: "数学", color: "#b8503f" });
  library.bind(narrow.projectId, join(exam, "math"));

  const revoked = library.revokeLibrary();
  assert.equal(revoked.authorized, false);
  assert.equal(revoked.directory, null);
  rejects(() => library.mount(shared.projectId), 403, /尚未由用户授权/);
  assert.equal(library.mount(narrow.projectId), join(exam, "math"));
  assert.equal(library.grantStatus(narrow.projectId).authorized, true);
  assert.throws(() => statSync(join(dataDir, "library-grant.json")), /ENOENT/);
  engine.flushNow();
});

test("共享库目录失联后 mount 返回 403，状态标记为未授权", () => {
  const { root, exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const project = library.create({ name: "数学", color: "#b8503f" });
  renameSync(exam, join(root, "exam-moved"));

  rejects(() => library.mount(project.projectId), 403, /共享资料库/);
  const status = library.libraryStatus();
  assert.equal(status.authorized, false);
  assert.equal(status.directory, exam);
  assert.match(status.reason, /共享资料库|绝对目录/);
  engine.flushNow();
});

test("已有项目授权在共享库外时，拒绝该共享库授权并点名项目", () => {
  const { exam, other, engine, library } = fixture();
  const project = library.create({
    name: "数学",
    color: "#b8503f",
    directory: other,
  });
  rejects(() => library.authorizeLibrary(exam, 1_800_000_000_000), 400, /数学/);
  assert.equal(library.libraryStatus().authorized, false);
  assert.equal(library.mount(project.projectId), other);
  engine.flushNow();
});

test("共享库内置项目改名不会移动整库", () => {
  const { exam, engine, library } = fixture();
  library.authorizeLibrary(exam, 1_800_000_000_000);
  const project = library.create({ name: "数学", color: "#b8503f" });
  rejects(
    () =>
      library.rename(project.projectId, { name: "高等数学", color: "#b8503f" }),
    400,
    /共享资料库/,
  );
  assert.equal(library.mount(project.projectId), exam);
  engine.flushNow();
});

test("HTTP：授权 / 读取 / 验证 Origin / 取消授权", async () => {
  const { dataDir, exam, engine } = fixture();
  const started = await startServer({
    engine,
    dataDir,
    host: "127.0.0.1",
    port: 0,
    token: "library-token",
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
    return { status: res.status, body };
  };
  try {
    let res = await json("/api/library/grant");
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, false);
    assert.equal(res.body.directory, null);

    res = await json("/api/library/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: exam }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, true);
    assert.equal(res.body.directory, exam);

    // 项目创建可以省略 directory：共享库就是默认资料根。
    res = await json("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "数学", color: "#b8503f" }),
    });
    assert.equal(res.status, 201);
    const projectId = res.body.projectId;
    res = await json(`/api/projects/${projectId}/grant`);
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, true);
    assert.equal(res.body.shared, true);
    assert.equal(res.body.directory, exam);

    // 共享库里的相对路径可以被登记、列出并真正流式读出。
    writeFileSync(join(exam, "math", "book.txt"), "hello");
    res = await json(`/api/projects/${projectId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: {
          title: "book",
          kind: "book",
          path: "math/book.txt",
          source: "textbook",
          edition: "1",
        },
      }),
    });
    assert.equal(res.status, 201);
    const resourceId = res.body.id;
    res = await json(`/api/resources/${resourceId}/info`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "book.txt");
    const token = await json("/api/file-token");
    const file = await fetch(
      `${base}/api/resources/${resourceId}/file?access=${token.body.access}`,
    );
    assert.equal(file.status, 200);
    assert.equal(await file.text(), "hello");

    // 越出共享库的相对路径在登记时就被拒绝。
    res = await json(`/api/projects/${projectId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: {
          title: "bad",
          kind: "book",
          path: "../outside.txt",
          source: "textbook",
          edition: "1",
        },
      }),
    });
    assert.equal(res.status, 400);

    // 写端点 Origin 白名单：陌生 Origin 拒绝，DSH Origin 放行。
    res = await json("/api/library/grant", {
      method: "DELETE",
      headers: { Origin: "http://evil.example" },
    });
    assert.equal(res.status, 403);
    res = await json("/api/library/grant", {
      method: "DELETE",
      headers: { Origin: UI_ORIGIN },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.authorized, false);
    res = await json(`/api/projects/${projectId}/grant`);
    assert.equal(res.body.authorized, false);
  } finally {
    await started.close();
    engine.flushNow();
  }
});
