// 到点音效只看「同一份已加载快照」之间的变化；刷新后的首帧不是跃迁。
//
// 规则：
// - 一轮计时自然结束（completionSerial 增加）→ 完成音效；
// - 新提醒到点（reminderPending 计数增加）→ 提醒音效（只播音效，不切页面）；
// - 两者同时发生以「一轮结束」优先；
// - 首次快照（prev = null）和「空快照 → 首次真实快照」（刷新）都不触发。
import test from "node:test";
import assert from "node:assert/strict";

const { attentionCue } = await import("../plugin/src/client/app/attention.js");

const snap = (serial, reminders, extra = {}) => ({
  hydrated: true,
  serial,
  reminders,
  running: false,
  paused: false,
  mode: "focus",
  ...extra,
});
// 刷新后的首帧：store 还没有数据。completionSerial / reminderPending 都还是 0。
const empty = {
  hydrated: false,
  serial: 0,
  reminders: 0,
  running: false,
  paused: false,
  mode: "focus",
};

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
  assert.equal(
    attentionCue(snap(3, 2), snap(3, 2, { running: true })),
    "start",
  );
  assert.equal(
    attentionCue(snap(3, 2), snap(3, 2, { running: true, mode: "shortBreak" })),
    "resume",
  );
  assert.equal(
    attentionCue(snap(3, 2, { running: true }), snap(3, 2, { paused: true })),
    "pause",
  );
});

// ---- 刷新 vs 运行中跃迁：旧版「刷新自动回到番茄页」的回归测试 ----

test("刷新：空快照 → 首次真实快照不算跃迁（不补完成音效）", () => {
  // 历史上有过 5 轮专注、3 条待提醒任务，都和本次刷新无关。
  const loaded = snap(5, 3);
  assert.equal(attentionCue(empty, loaded), null);
  // 另一侧也必须是已加载快照。
  assert.equal(attentionCue(loaded, empty), null);
});

test("运行中：已加载快照之后的一轮结束 / 新提醒才触发", () => {
  const baseline = snap(5, 3);
  assert.equal(attentionCue(baseline, snap(6, 3)), "complete");
  assert.equal(attentionCue(baseline, snap(5, 4)), "reminder");
  assert.equal(attentionCue(baseline, snap(5, 3)), null);
});
