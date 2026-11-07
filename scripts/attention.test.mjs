// 「把界面拉回今日专注」的触发规则：只看状态跃迁，避免轮询/重渲染反复跳页。
//
// 规则（用户确认的行为）：
// - 一轮计时自然结束（completionSerial 增加）→ 切到今日专注；
// - 新提醒到点（reminderPending 计数增加）→ 切到今日专注；
// - 两者同时发生以「一轮结束」优先；首次快照（prev = null）不触发。
//
// 注意：这里只决定「要不要切 DSH 面板」，不涉及系统窗口焦点——浏览器抢不到。
import test from "node:test";
import assert from "node:assert/strict";

const { attentionSwitch } = await import("../plugin/src/client/app/hud.js");

const snap = (serial, reminders, extra = {}) => ({
  serial,
  reminders,
  running: false,
  paused: false,
  mode: "focus",
  ...extra,
});

test("首次快照不触发（打开页面时不抢页）", () => {
  assert.equal(attentionSwitch(null, snap(3, 2)), null);
  assert.equal(attentionSwitch(snap(3, 2), null), null);
});

test("一轮计时结束优先于提醒", () => {
  assert.equal(attentionSwitch(snap(3, 2), snap(4, 2)), "complete");
  assert.equal(attentionSwitch(snap(3, 2), snap(4, 3)), "complete");
});

test("新提醒到点触发", () => {
  assert.equal(attentionSwitch(snap(3, 2), snap(3, 3)), "reminder");
});

test("没有跃迁时不触发（轮询重复渲染）", () => {
  assert.equal(attentionSwitch(snap(3, 2), snap(3, 2)), null);
  assert.equal(attentionSwitch(snap(4, 2), snap(3, 2)), null);
});
