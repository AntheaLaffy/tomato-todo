// 导航切换的判定表与持久化：刷新保持、冷启动切、提醒不切、一轮结束才切。
//
// 这些用例直接测 navigation.js 的模块契约，不渲染 React：
// - shouldGrab 是纯函数，逐行覆盖所有 reason；
// - navigate 是唯一入口，用假的 selectPanel 记录「界面到底有没有被改变」；
// - 用假 sessionStorage / localStorage 区分冷启动、刷新与旧 key 迁移。
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const nav = await import("../plugin/src/client/app/navigation.js");

const NAV_KEY = "tomato-dsh.nav";
const LEGACY_PAGE_KEY = "tomato-dsh.page";

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

let local;
let session;

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  nav.resetActivePageCache();
  nav.bindPanelOpener(null);
  delete globalThis.document;
});

/** 记录 navigate 是否真的调用了 DSH 的 selectPanel。 */
function opener() {
  const calls = [];
  nav.bindPanelOpener((panelId) => calls.push(panelId));
  return calls;
}

// ---- shouldGrab：表驱动 ----

test("shouldGrab 判定表：refresh 不动、boot 切、reminder 不切、complete 切、dialog 让位、同 serial 去重", () => {
  const table = [
    // [reason, ctx, 期望]
    ["boot", {}, true],
    ["restore", { panel: "tomato" }, true],
    ["restore", { panel: "conversation" }, false],
    ["restore", {}, false],
    ["reminder", { panel: "tomato", serial: 9, lastSerial: 0 }, false],
    ["reminder", { dialogOpen: false }, false],
    ["complete", { serial: 6, lastSerial: 5 }, true],
    ["complete", { serial: 6, lastSerial: 6 }, false],
    ["complete", { serial: 6, lastSerial: 0, dialogOpen: true }, false],
    ["user", {}, true],
    ["unknown-reason", {}, false],
  ];
  for (const [reason, ctx, expected] of table) {
    assert.equal(
      nav.shouldGrab(reason, ctx),
      expected,
      `shouldGrab(${reason}, ${JSON.stringify(ctx)}) 应为 ${expected}`,
    );
  }
});

// ---- navigate：提醒绝不抢页面 ----

test("提醒（reminder）：不切面板、不切页，只留 HUD 与提示音", () => {
  nav.setActivePageId("calendar");
  nav.setPanelVisible(true);
  const calls = opener();

  assert.equal(nav.navigate({ reason: "reminder", serial: 9 }), false);
  assert.deepEqual(calls, []);
  assert.equal(nav.getActivePageId(), "calendar");
  assert.equal(nav.isPanelVisible(), true);
  assert.deepEqual(JSON.parse(session.getItem(NAV_KEY)), { panel: "tomato", page: "calendar" });
});

// ---- navigate：一轮结束才抢 ----

test("navigate(complete)：切到番茄面板的今日专注页，并记住面板", () => {
  const calls = opener();
  assert.equal(nav.navigate({ reason: "complete", serial: 6 }), true);
  assert.deepEqual(calls, ["tomato"]);
  assert.equal(nav.getActivePageId(), "focus");
  assert.equal(nav.isPanelVisible(), true);
  assert.deepEqual(JSON.parse(session.getItem(NAV_KEY)), { panel: "tomato", page: "focus" });
});

test("navigate(complete)：同一个 completionSerial 只切一次", () => {
  const calls = opener();
  assert.equal(nav.navigate({ reason: "complete", serial: 6 }), true);
  calls.length = 0;
  assert.equal(nav.navigate({ reason: "complete", serial: 6 }), false);
  assert.deepEqual(calls, []);
  // 下一个 serial 才是新的一轮结束。
  assert.equal(nav.navigate({ reason: "complete", serial: 7 }), true);
  assert.deepEqual(calls, ["tomato"]);
});

test("navigate(complete)：有对话框打开时让位，关掉后也不补跳", () => {
  const calls = opener();
  globalThis.document = { querySelector: (selector) => (selector === '[role="dialog"]' ? {} : null) };
  assert.equal(nav.navigate({ reason: "complete", serial: 6 }), false);
  assert.deepEqual(calls, []);

  // 对话框关掉后，同一个 serial 不再补跳：结束是瞬间，不是持续状态。
  globalThis.document = { querySelector: () => null };
  assert.equal(nav.navigate({ reason: "complete", serial: 6 }), false);
  assert.deepEqual(calls, []);
});

// ---- restore：冷启动 / 刷新 ----

test("restore：冷启动（新会话）进今日专注，忽略旧页", () => {
  nav.setActivePageId("calendar");
  const calls = opener();
  assert.equal(nav.restore(), true);
  assert.deepEqual(calls, ["tomato"]);
  assert.equal(nav.getActivePageId(), "focus");
  assert.equal(nav.isPanelVisible(), true);
});

test("restore：刷新时恢复番茄面板与页（本周日程仍是本周日程）", () => {
  // 上次会话：消费掉冷启动，然后停在番茄-日历。
  assert.equal(nav.isColdStart(), true);
  nav.navigate({ page: "calendar", reason: "user" });
  const calls = opener();

  // 刷新：模块内存清空，sessionStorage 保留。
  nav.resetActivePageCache();
  assert.equal(nav.restore(), true);
  assert.deepEqual(calls, ["tomato"]);
  assert.equal(nav.getActivePageId(), "calendar");
  assert.equal(nav.isPanelVisible(), true);
});

test("restore：刷新时仍在对话页 → 完全不动", () => {
  assert.equal(nav.isColdStart(), true);
  nav.setActivePageId("tasks");
  nav.setPanelVisible(false);
  const calls = opener();

  nav.resetActivePageCache();
  assert.equal(nav.restore(), false);
  assert.deepEqual(calls, []);
  assert.equal(nav.getActivePageId(), "tasks");
  assert.equal(nav.isPanelVisible(), false);
});

// ---- 持久化与迁移 ----

test("持久化 {panel, page}：切页保留面板，打开面板保留页", () => {
  nav.setActivePageId("calendar");
  nav.setPanelVisible(true);
  nav.setActivePageId("stats");
  assert.deepEqual(JSON.parse(session.getItem(NAV_KEY)), { panel: "tomato", page: "stats" });
  // 旧 key 继续写：旧版本 / 外部脚本仍按 tomato-dsh.page 读页。
  assert.equal(local.getItem(LEGACY_PAGE_KEY), "stats");
});

test("迁移：只有旧版 tomato-dsh.page 时读回页，但不擅自打开面板", () => {
  local.setItem(LEGACY_PAGE_KEY, "stats");
  assert.equal(nav.getActivePageId(), "stats");
  assert.equal(nav.isPanelVisible(), false);
  assert.deepEqual(JSON.parse(session.getItem(NAV_KEY)), { panel: "conversation", page: "stats" });

  // 刷新后按对话处理：不切面板、不切页。
  assert.equal(nav.isColdStart(), true);
  nav.resetActivePageCache();
  const calls = opener();
  assert.equal(nav.restore(), false);
  assert.deepEqual(calls, []);
  assert.equal(nav.getActivePageId(), "stats");
});

test("subscribe：切页广播，退订后不再收到", () => {
  const seen = [];
  const off = nav.subscribe((id) => seen.push(id));
  nav.setActivePageId("focus");
  nav.navigate({ page: "calendar", reason: "user" });
  off();
  nav.setActivePageId("tasks");
  assert.deepEqual(seen, ["focus", "calendar"]);
});
