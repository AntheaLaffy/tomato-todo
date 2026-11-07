// 侧栏「我的项目」→ 全部任务的项目筛选：信号必须被消费且只消费一次，
// 切页动作和筛选值分开（已经在本页时 setActivePageId 不会重挂，靠订阅生效）。
//
// 这里直接测 navigation.js 的模块级契约，不渲染页面：筛选消费、订阅广播、
// 未知/清空值（null = 全部项目）都走一遍。
import test from "node:test";
import assert from "node:assert/strict";

const nav = await import("../plugin/src/client/app/navigation.js");

test("项目筛选：订阅者收到值，切页到 tasks，取走后清空", () => {
  const seen = [];
  const off = nav.subscribeTasksFilter((value) => seen.push(value));

  nav.openTasksForProject("p-1");
  assert.deepEqual(seen, ["p-1"]);
  assert.equal(nav.getActivePageId(), "tasks");
  assert.equal(nav.takeTasksFilter(), "p-1");
  assert.equal(nav.takeTasksFilter(), null);

  off();
  nav.openTasksForProject(null);
  assert.deepEqual(seen, ["p-1"]);
  assert.equal(nav.takeTasksFilter(), null);
});

test("openPanelAt：切页并调用绑定的面板打开器", () => {
  let opened = 0;
  nav.bindPanelOpener(() => {
    opened += 1;
  });
  nav.openPanelAt("focus");
  assert.equal(opened, 1);
  assert.equal(nav.getActivePageId(), "focus");

  nav.bindPanelOpener(null);
  nav.openPanelAt("stats");
  assert.equal(opened, 1);
  assert.equal(nav.getActivePageId(), "stats");
});

test("项目筛选：取消订阅后不再收到广播", () => {
  const seen = [];
  const off = nav.subscribeTasksFilter((value) => seen.push(value));
  off();
  nav.openTasksForProject("p-2");
  assert.deepEqual(seen, []);
  assert.equal(nav.takeTasksFilter(), "p-2");
});
