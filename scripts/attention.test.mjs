// 到点音效只看状态跃迁；后台提醒不应切走 DSH 对话。
//
// 规则：
// - 一轮计时自然结束（completionSerial 增加）→ 完成音效；
// - 新提醒到点（reminderPending 计数增加）→ 提醒音效；
// - 两者同时发生以「一轮结束」优先；首次快照（prev = null）不触发。
import test from "node:test";
import assert from "node:assert/strict";

const { attentionCue } = await import("../plugin/src/client/app/hud.js");

const snap = (serial, reminders, extra = {}) => ({
  serial,
  reminders,
  running: false,
  paused: false,
  mode: "focus",
  ...extra,
});

test("首次快照不补播历史音效", () => {
  assert.equal(attentionCue(null, snap(3, 2)), null);
  assert.equal(attentionCue(snap(3, 2), null), null);
});

test("一轮计时结束优先于提醒", () => {
  assert.equal(attentionCue(snap(3, 2), snap(4, 2)), "complete");
  assert.equal(attentionCue(snap(3, 2), snap(4, 3)), "complete");
});

test("新提醒到点播放提醒音效", () => {
  assert.equal(attentionCue(snap(3, 2), snap(3, 3)), "reminder");
});

test("没有跃迁时不触发（轮询重复渲染）", () => {
  assert.equal(attentionCue(snap(3, 2), snap(3, 2)), null);
  assert.equal(attentionCue(snap(4, 2), snap(3, 2)), null);
});

test("开始、暂停和休息的音效仍按原有优先级播放", () => {
  assert.equal(attentionCue(snap(3, 2), snap(3, 2, { running: true })), "start");
  assert.equal(attentionCue(snap(3, 2), snap(3, 2, { running: true, mode: "shortBreak" })), "resume");
  assert.equal(attentionCue(snap(3, 2, { running: true }), snap(3, 2, { paused: true })), "pause");
});
